import json
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Any

from backend.data_fetching.data_fetching.orchestration_curls.orchestration_parser import parse_orchestration_data
from backend.data_fetching.data_fetching.pagination.pagination_recommended_jobs import parse_curl_command, \
    fetch_linkedin_jobs, parse_jobs_page
from backend.data_fetching.data_fetching.single_job.fetch_single_job_details import fetch_job_detail, make_session
from backend.data_fetching.data_fetching.single_job.structure_single_job import extract_job_details
from backend.path.path_reference import get_orchestration_curls_folder_path

# Paths to your orchestration cURL commands
env_path = get_orchestration_curls_folder_path()
PAGINATION_CURL_COMMAND_PATH = Path(env_path, "pagination_curl.txt")
INDIVIDUAL_JOB_CURL_COMMAND_PATH = Path(env_path, "individual_job_curl.txt")


def fetch_pagination_data() -> Dict[str, Any]:
    """
    Executes the pagination cURL, parses the jobs page, and returns a dictionary
    with pagination data.
    """
    try:
        content = PAGINATION_CURL_COMMAND_PATH.read_text(encoding="utf-8").strip()
        url, headers = parse_curl_command(content)
        print("--- Successfully parsed pagination cURL command ---")
    except Exception as e:
        raise RuntimeError(f"Failed to parse pagination cURL: {e}")

    live_data = fetch_linkedin_jobs(url, headers)
    parsed_page = parse_jobs_page(live_data)
    return asdict(parsed_page)


def fetch_individual_job_data(job_urn_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Given a list of job URNs, executes the individual-job cURL, fetches each job's detail,
    and returns a list of structured job dicts.
    """
    # Read the individual-job cURL command once
    content = INDIVIDUAL_JOB_CURL_COMMAND_PATH.read_text(encoding="utf-8").strip()
    session = make_session(content)

    raw_results = []
    total = len(job_urn_ids)
    for idx, urn in enumerate(job_urn_ids, start=1):
        try:
            print(f"[{idx}/{total}] Fetching detail for {urn}...", end=" ")
            data = fetch_job_detail(session, urn)
            raw_results.append({"jobPostingUrn": urn, "detailResponse": data})
            print("✓")
        except Exception as exc:
            print(f"✗ Failed: {exc}")

    # Structure the raw results
    structured = []
    for entry in raw_results:
        details = extract_job_details(entry)
        if details:
            structured.append(asdict(details))
    return structured


def main():
    # 1. Fetch pagination data
    pagination_data = fetch_pagination_data()
    job_urn_ids = [item.get("urn") for item in pagination_data.get("jobs", []) if item and item.get("urn")]

    # 2. Fetch and structure individual job data
    structured_jobs_data = fetch_individual_job_data(job_urn_ids)

    combined_data = parse_orchestration_data(pagination_data, structured_jobs_data)

    # 3. Persist outputs
    out_dir = Path("output")
    out_dir.mkdir(exist_ok=True)

    # Save pagination data
    (out_dir / "combined_data.json").write_text(
        json.dumps(
            combined_data,
            indent=2,
            ensure_ascii=False,
            default=lambda o: o.isoformat() if isinstance(o, (date, datetime)) else str(o),
        ),
        encoding="utf-8",
    )
    print(f"✔ Saved pagination_data.json ({len(pagination_data.get('jobs', []))} entries)")


if __name__ == "__main__":
    main()
