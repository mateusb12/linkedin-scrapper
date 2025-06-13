#!/usr/bin/env python3
"""
fetch_job_details.py

Reads a JSON list of RecommendedJobCard entries (with `job_id` and `job_urn`),
uses a `CurlRequest` template to build per-job GraphQL calls,
then fetches and aggregates results into a JSON summary via a dataclass.
"""
import os
import json
import time
import logging
from pathlib import Path
from urllib.parse import quote
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional
import requests
from dotenv import load_dotenv
from source.linkedin_api.curl_command_builder import CurlRequest
from source.path.file_content_loader import load_curl_file
from source.path.path_reference import get_data_folder_path

load_dotenv()

CURL_TEMPLATE_FILE = "job_curl_example.txt"
INPUT_FILE = "recommended_jobs.json"
OUTPUT_SUMMARY = "job_details_summary.json"
LIMIT = 10


# Data class for output
@dataclass
class JobDetail:
    job_id: int
    job_urn: str
    raw: Dict[str, Any]
    status: str
    error: Optional[str] = None


def main():
    curl_file = "curl.txt"
    raw_curl = load_curl_file(curl_file)
    template: CurlRequest = CurlRequest.from_curl_text(raw_curl)
    errs = template.validate()
    if errs:
        logging.error("CurlRequest template validation errors: %s", errs)
        return

    data_folder_path = get_data_folder_path()
    file_location = Path(data_folder_path, INPUT_FILE)
    with open(file_location, 'r', encoding='utf-8') as f:
        jobs = json.load(f)
        total = len(jobs)

    summary: List[JobDetail] = []

    for idx, entry in enumerate(jobs, start=1):
        if idx > LIMIT:
            print(f"Reached limit of {LIMIT} jobs, stopping.")
            break
        job_id = entry.get('job_id')
        urn = entry.get('job_urn')
        if not (job_id and urn):
            continue

        # Fill in the variables_template placeholder with this URN
        vars_str = template.variables_template.replace(
            '<JOB_POSTING_URN>', urn
        )
        # Build URL by injecting variables and query_id
        url = f"{template.url.split('?')[0]}?variables={quote(vars_str, safe='(),:=')}&queryId={template.query_id}"

        # Build session
        sess = template.build_session()

        print(f"[{idx}/{total}] Fetching job {job_id}...")
        try:
            resp = sess.get(url)
            resp.raise_for_status()
            data = resp.json()
            status = 'OK'
            error = None
        except Exception as e:
            data = {}
            status = 'FAILED'
            error = str(e)
            logging.warning("Fetch failed for %s: %s", job_id, error)

        summary.append(JobDetail(
            job_id=job_id,
            job_urn=urn,
            raw=data,
            status=status,
            error=error,
        ))

        time.sleep(1)

    # Write summary
    output_location = Path(data_folder_path, OUTPUT_SUMMARY)
    with open(output_location, 'w', encoding='utf-8') as sf:
        json.dump([asdict(j) for j in summary], sf, ensure_ascii=False, indent=2)

    print(f"Wrote summary: {OUTPUT_SUMMARY} entries={len(summary)}")


if __name__ == '__main__':
    main()
