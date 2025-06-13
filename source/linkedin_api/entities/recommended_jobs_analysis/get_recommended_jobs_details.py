#!/usr/bin/env python3
"""
get_recommended_jobs_details.py

Reads a JSON list of RecommendedJobCard entries (with `job_id` and `job_urn`),
builds per-job GraphQL calls in LinkedIn’s ParSeq format,
then fetches and aggregates results into a JSON summary via a dataclass.
Adds detection of partial-success GraphQL responses.
"""

import os
import json
import time
import logging
from pathlib import Path
from urllib.parse import quote_plus
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv
from source.linkedin_api.curl_command_builder import CurlRequest
from source.path.file_content_loader import load_curl_file
from source.path.path_reference import get_data_folder_path

# Configurable paths & limits
CURL_TEMPLATE_FILE = "job_curl_example.txt"
INPUT_FILE = "recommended_jobs.json"
OUTPUT_SUMMARY = "job_details_summary.json"
# Set a limit (int) to cap fetches; 0 or None means no limit
LIMIT = 5

typing_optional = Optional[Any]


@dataclass
class JobDetail:
    job_id: int
    job_urn: str
    raw: Dict[str, Any]
    status: str
    error: Optional[str] = None


def build_variables_parseq(job_urn: str) -> str:
    """
    Build the LinkedIn ParSeq-style variables string,
    percent-encoding the URN value only.
    """
    return (
        "(cardSectionTypes:List(TOP_CARD,HOW_YOU_FIT_CARD,JOB_DESCRIPTION_CARD),"
        f"jobPostingUrn:{quote_plus(job_urn)},"
        "includeSecondaryActionsV2:true,"
        "jobDetailsContext:(isJobSearch:false))"
    )


def has_graphql_errors(raw: Dict[str, Any]) -> bool:
    """
    Detect if the GraphQL response contains partial-data errors.
    """
    # top-level 'errors' OR nested in 'data'
    if raw.get('errors'):
        return True
    data = raw.get('data')
    if isinstance(data, dict) and data.get('errors'):
        return True
    return False


def main():
    load_dotenv()
    # Load curl template for URL + queryId
    raw_curl = load_curl_file(CURL_TEMPLATE_FILE)
    template: CurlRequest = CurlRequest.from_curl_text(raw_curl)

    data_folder = get_data_folder_path()
    with open(Path(data_folder, INPUT_FILE), 'r', encoding='utf-8') as f:
        jobs = json.load(f)
    total_jobs = len(jobs)
    display_total = total_jobs if not LIMIT else min(total_jobs, LIMIT)

    summary: List[JobDetail] = []

    base_url = template.url.split('?', 1)[0]
    session = template.build_session()

    for idx, entry in enumerate(jobs, start=1):
        if LIMIT and idx > LIMIT:
            logging.info("Reached limit of %d jobs, stopping.", LIMIT)
            break

        job_id = entry.get('job_id')
        urn = entry.get('job_urn')
        if not job_id or not urn:
            continue

        var_str = build_variables_parseq(urn)
        url = f"{base_url}?variables={var_str}&queryId={template.query_id}"

        print(f"[{idx}/{display_total}] Fetching job {job_id}...")
        try:
            resp = session.get(url)
            resp.raise_for_status()
            data = resp.json()

            if has_graphql_errors(data):
                status, error = 'PARTIAL', None
            else:
                status, error = 'OK', None
        except Exception as e:
            data, status, error = {}, 'FAILED', str(e)
            logging.warning("Fetch failed for %s: %s", job_id, error)

        summary.append(JobDetail(
            job_id=job_id,
            job_urn=urn,
            raw=data,
            status=status,
            error=error
        ))

        time.sleep(1)

    # Write out summary
    output_path = Path(data_folder, OUTPUT_SUMMARY)
    with open(output_path, 'w', encoding='utf-8') as sf:
        json.dump([asdict(j) for j in summary], sf, ensure_ascii=False, indent=2)

    print(f"Wrote summary: {OUTPUT_SUMMARY} entries={len(summary)}")


if __name__ == '__main__':
    main()
