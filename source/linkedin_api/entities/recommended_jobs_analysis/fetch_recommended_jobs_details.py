#!/usr/bin/env python3
"""
get_recommended_jobs_details.py

Refactored to use a command-builder and executor approach.
Reads a JSON list of RecommendedJobCard entries, builds per-job Command objects,
then executes them in a separate loop and aggregates results into a clean JSON summary.
"""

import os
import json
import time
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict
from urllib.parse import quote_plus

import requests
from dotenv import load_dotenv

from source.linkedin_api.data_fetching.curl_txt_reader import CurlRequest
from source.path.path_reference import get_data_folder_path

CURL_TEMPLATE_FILE = "get_single_recommended_job_curl_example.txt"
INPUT_FILE = "all_recommended_jobs_metadata.json"
OUTPUT_SUMMARY = "job_details_summary.json"

LIMIT = 0
SLEEP_SEC = 1


@dataclass
class JobDetail:
    job_id: int
    job_urn: str
    status: str
    error: Optional[str] = None
    title: Optional[str] = None
    navigation_bar_subtitle: Optional[str] = None
    company_name: Optional[str] = None
    location: Optional[str] = None
    reposted_job: Optional[bool] = None
    job_state: Optional[str] = None
    created_at: Optional[int] = None
    content_source: Optional[str] = None
    job_description_urn: Optional[str] = None
    posted_on_text: Optional[str] = None
    description_text: Optional[str] = None
    employment_type: Optional[str] = None
    workplace_types: List[str] = None
    apply_url: Optional[str] = None


@dataclass
class Command:
    method: str
    url: str
    headers: Dict[str, str]
    cookies: Dict[str, str]
    job_id: int
    job_urn: str


def build_variables_parseq(job_urn: str) -> str:
    return (
        "(cardSectionTypes:List(TOP_CARD,HOW_YOU_FIT_CARD,JOB_DESCRIPTION_CARD),"
        f"jobPostingUrn:{quote_plus(job_urn)},"
        "includeSecondaryActionsV2:true,"
        "jobDetailsContext:(isJobSearch:false))"
    )


def has_graphql_errors(raw: Dict[str, Any]) -> bool:
    if raw.get('errors'):
        return True
    data = raw.get('data')
    if isinstance(data, dict) and data.get('errors'):
        return True
    return False


def extract_fields(raw: Dict[str, Any], job_id: int, job_urn: str) -> JobDetail:
    data_node = raw.get('data', {}).get('data', {})
    included = raw.get('included', [])

    def find_by_type(suffix: str) -> Dict[str, Any]:
        return next((item for item in included
                     if isinstance(item.get('$type'), str) and item['$type'].endswith(suffix)), {})

    jp = find_by_type('.JobPosting')
    jpc = find_by_type('.JobPostingCard')
    jd = find_by_type('.JobDescription')
    ja = find_by_type('JobSeekerApplicationDetail')

    title = jpc.get('title', {}).get('text', '').strip() or None
    nav = jpc.get('navigationBarSubtitle')
    if nav and '·' in nav:
        comp, loc = [p.strip() for p in nav.split('·', 1)]
    else:
        comp = loc = None

    # Employment type insights
    emp_list: List[str] = []
    insights = jpc.get('jobInsightsV2ResolutionResults') or []
    if insights:
        descs = insights[0].get('jobInsightViewModel', {}).get('description') or []
        for item in descs:
            txt = item.get('text', {}).get('text')
            if txt:
                emp_list.append(txt)

    workplace = jp.get('*workplaceTypesResolutionResults') or []

    return JobDetail(
        job_id=job_id,
        job_urn=job_urn,
        status='OK',
        title=title,
        navigation_bar_subtitle=nav,
        company_name=comp,
        location=loc,
        reposted_job=jp.get('repostedJob'),
        job_state=jp.get('jobState'),
        created_at=jp.get('createdAt'),
        content_source=jp.get('contentSource'),
        job_description_urn=jd.get('entityUrn'),
        posted_on_text=jd.get('postedOnText'),
        description_text=jd.get('descriptionText', {}).get('text'),
        employment_type=', '.join(emp_list) if emp_list else None,
        workplace_types=workplace,
        apply_url=ja.get('companyApplyUrl')
    )


def build_recommended_jobs_commands() -> List[Command]:
    # Load CURL template
    raw_curl = Path(CURL_TEMPLATE_FILE).read_text(encoding='utf-8').strip()
    template = CurlRequest.from_curl_text(raw_curl)
    errs = template.validate()
    # Ignore missing '{start}' placeholder error for per-job detail calls
    errs = [e for e in errs if "variables_template missing '{start}'" not in e]
    if errs:
        raise ValueError(f"Invalid curl template: {errs}")

    # Prepare a session to capture headers & cookies
    session = template.build_session()
    base_url = template.url.split('?', 1)[0]

    # Load recommended jobs list
    data_folder = get_data_folder_path()
    jobs = json.loads(Path(data_folder, INPUT_FILE).read_text(encoding='utf-8'))
    limit = LIMIT or len(jobs)

    commands: List[Command] = []
    for idx, entry in enumerate(jobs, start=1):
        if idx > limit:
            break
        job_id = entry.get('job_id')
        job_urn = entry.get('job_urn')
        if not job_id or not job_urn:
            continue

        var_str = build_variables_parseq(job_urn)
        url = f"{base_url}?variables={var_str}&queryId={template.query_id}"
        commands.append(Command(
            method='GET',
            url=url,
            headers=dict(session.headers),  # type: ignore
            cookies=session.cookies.get_dict(),
            job_id=job_id,
            job_urn=job_urn
        ))

    return commands


def execute_recommended_jobs_commands(commands: List[Command]) -> List[JobDetail]:
    summary: List[JobDetail] = []
    for idx, cmd in enumerate(commands, start=1):
        print(f"[{idx}/{len(commands)}] Fetching {cmd.job_id}...")
        try:
            resp = requests.request(cmd.method, cmd.url, headers=cmd.headers, cookies=cmd.cookies, timeout=15)
            resp.raise_for_status()
            raw = resp.json()
            if has_graphql_errors(raw):
                raise ValueError("Partial GraphQL errors detected")
            detail = extract_fields(raw, cmd.job_id, cmd.job_urn)
        except Exception as e:
            logging.warning("Failed fetch %s: %s", cmd.job_id, e)
            detail = JobDetail(job_id=cmd.job_id, job_urn=cmd.job_urn, status='FAILED', error=str(e))
        summary.append(detail)
        time.sleep(SLEEP_SEC)
    return summary


def main():
    load_dotenv()
    commands = build_recommended_jobs_commands()
    summary = execute_recommended_jobs_commands(commands)

    data_folder = get_data_folder_path()
    out_path = Path(data_folder, OUTPUT_SUMMARY)
    with open(out_path, 'w', encoding='utf-8') as out_f:
        json.dump([asdict(d) for d in summary], out_f, ensure_ascii=False, indent=2)

    print(f"Wrote clean summary to {out_path} ({len(summary)} entries)")


if __name__ == '__main__':
    main()
