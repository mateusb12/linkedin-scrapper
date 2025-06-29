import argparse
import json
import math
import re
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Any

from backend.linkedin.api_fetch.orchestration_curls.orchestration_parser import parse_orchestration_data
from backend.linkedin.api_fetch.pagination.pagination_recommended_jobs import parse_curl_command, fetch_linkedin_jobs, \
    parse_jobs_page
from backend.linkedin.api_fetch.single_job.fetch_single_job_details import make_session, fetch_job_detail
from backend.linkedin.api_fetch.single_job.structure_single_job import extract_job_details
from backend.path.path_reference import get_orchestration_curls_folder_path

# Paths to your orchestration cURL commands
env_path = get_orchestration_curls_folder_path()
PAGINATION_CURL_COMMAND_PATH = Path(env_path, "pagination_curl.txt")
INDIVIDUAL_JOB_CURL_COMMAND_PATH = Path(env_path, "individual_job_curl.txt")


def fetch_pagination_data(page: int = 1) -> Dict[str, Any]:
    """
    Executes the pagination cURL for a specific page, parses the jobs page,
    and returns a dictionary with pagination data.

    Args:
        page: The page number to fetch (e.g., 1, 2, 3...).
    """
    try:
        content = PAGINATION_CURL_COMMAND_PATH.read_text(encoding="utf-8").strip()
        url, headers = parse_curl_command(content)
        print("--- Successfully parsed pagination cURL command ---")
    except Exception as e:
        raise RuntimeError(f"Failed to parse pagination cURL: {e}")

    # --- New Logic to Modify URL for Pagination ---
    # Find the count (jobs per page), defaulting to 24 if not found
    count_match = re.search(r"count:(\d+)", url)
    count = int(count_match.group(1)) if count_match else 24

    # Calculate the start index based on the desired page
    start_index = (page - 1) * count

    # Replace the 'start:XX' value in the URL with the calculated one.
    # This uses a regular expression to find 'start:' followed by any number of digits.
    modified_url = re.sub(r"start:\d+", f"start:{start_index}", url)

    print(f"--- Fetching page {page} (start index: {start_index}) ---")
    # --- End of New Logic ---

    live_data = fetch_linkedin_jobs(modified_url, headers)  # Use the modified URL
    if not live_data:
        print("Received no data from the API. This could be due to an expired cURL token or invalid page number.")
        return {}

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
    parser = argparse.ArgumentParser(description="Fetch LinkedIn job postings from a specific page.")
    parser.add_argument(
        "--page",
        type=int,
        default=1,
        help="The page number of job results to fetch. Defaults to 1."
    )
    args = parser.parse_args()

    # 1. Fetch pagination data for the selected page
    pagination_data = fetch_pagination_data(page=args.page)
    if not pagination_data or not pagination_data.get('paging'):
        print("Halting execution as no pagination data was fetched.")
        return

    # --- New: Calculate and display total pages ---
    paging_info = pagination_data.get('paging', {})
    total_jobs = paging_info.get('total', 0)
    jobs_per_page = paging_info.get('count', 0)
    total_pages = 0

    if jobs_per_page > 0:
        # Use math.ceil to round up to the nearest whole number
        total_pages = math.ceil(total_jobs / jobs_per_page)
        print(f"--- Found {total_jobs} total jobs. Total pages available: {total_pages} ---")
    else:
        print("--- Could not determine total pages. ---")

    # --- New: Validate the requested page number ---
    if 0 < total_pages < args.page:
        print(f"\nError: You requested page {args.page}, but only {total_pages} pages are available.")
        print("Please run the script again with a valid page number.")
        return  # Exit the script
    # --- End of new logic ---

    job_urn_ids = [item.get("urn") for item in pagination_data.get("jobs", []) if item and item.get("urn")]

    # 2. Fetch and structure individual job data
    structured_jobs_data = fetch_individual_job_data(job_urn_ids)

    combined_data = parse_orchestration_data(pagination_data, structured_jobs_data)

    # 3. Persist outputs
    out_dir = Path("output")
    out_dir.mkdir(exist_ok=True)

    output_filename = f"combined_data_page_{args.page}.json"
    output_path = out_dir / output_filename

    output_path.write_text(
        json.dumps(
            combined_data,
            indent=2,
            ensure_ascii=False,
            default=lambda o: o.isoformat() if isinstance(o, (date, datetime)) else str(o),
        ),
        encoding="utf-8",
    )
    print(f"\n✔ Saved {output_filename} ({len(pagination_data.get('jobs', []))} entries)")


if __name__ == "__main__":
    main()
