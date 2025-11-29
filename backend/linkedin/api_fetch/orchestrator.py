# run.py
# --- Contains orchestration, data processing, and application logic ---

import json
import math
import shlex
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

# 1. IMPORT THE NEW FETCHER MODULE

# 2. THE REST OF YOUR IMPORTS REMAIN
from linkedin.api_fetch.orchestration_curls.orchestration_parser import parse_orchestration_data
from linkedin.api_fetch.single_job.structure_single_job import extract_job_details
from services.linkedin_calls.fetch_linkedin_recommended_jobs import fetch_page_data_from_api, \
    fetch_raw_job_details_from_api

def to_curl(request):
    """
    Converts a python `requests.PreparedRequest` object to a cURL command string.
    """
    command = "curl -X {method} {uri}".format(
        method=shlex.quote(request.method),
        uri=shlex.quote(request.url)
    )

    if request.headers:
        for header, value in request.headers.items():
            command += " -H {header}".format(
                header=shlex.quote(f"{header}: {value}")
            )

    if request.body:
        body = request.body
        if isinstance(body, bytes):
            try:
                body = body.decode('utf-8')
            except:
                body = str(body)
        command += " -d {body}".format(body=shlex.quote(body))

    return command


def get_total_job_pages() -> Optional[int]:
    """
    Fetches the first page of job results to determine the total number of available pages.
    """
    print("--- Attempting to determine total number of pages... ---")
    # Call the API fetcher. The result is a parsed object, not a dict yet.
    page_object = fetch_page_data_from_api(page_number=1, quiet=True)
    if not page_object:
        print("Error: Could not retrieve pagination metadata. The cURL command might be expired.")
        return None

    # Convert the object to a dictionary to access paging info
    data = asdict(page_object)
    paging_info = data.get('paging', {})
    total_jobs = paging_info.get('total', 0)
    jobs_per_page = paging_info.get('count', 0)

    if not total_jobs or not jobs_per_page:
        print("Error: Pagination data is missing 'total' or 'count' fields.")
        return None

    total_pages = math.ceil(total_jobs / jobs_per_page)
    print(f"--- Found {total_jobs} total jobs. ---")
    return total_pages


def fetch_page_data(page_number: int, quiet: bool = False) -> Optional[Dict[str, Any]]:
    """
    A wrapper that calls the API fetcher and returns the page data as a dictionary.
    This maintains the original function signature for backward compatibility.
    """
    parsed_page_object = fetch_page_data_from_api(page_number, quiet)
    return asdict(parsed_page_object) if parsed_page_object else None


def fetch_individual_job_data(job_urn_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Fetches raw job data using the API fetcher and then structures it.
    This function separates the fetching from the structuring.
    """
    # 1. Fetch raw data from the API
    raw_results = fetch_raw_job_details_from_api(job_urn_ids)

    # 2. Process (structure) the raw data
    structured = []
    if not raw_results:
        return structured

    print("\n--- Structuring fetched job details... ---")
    for entry in raw_results:
        details = extract_job_details(entry)
        if details:
            structured.append(asdict(details))
    print(f"--- Successfully structured {len(structured)} job details. ---")
    return structured


def fetch_and_process_page_data(page_number: int) -> Optional[Dict[str, Any]]:
    """
    Orchestrates fetching and combining all necessary data for a given page.
    (This function's logic remains largely unchanged, as it was already an orchestrator).
    """
    # 1. Fetch the specific page's data
    page_data = fetch_page_data(page_number=page_number)
    if not page_data:
        print(f"Halting processing for page {page_number} as no data was fetched.")
        return None

    # 2. Extract URNs to fetch individual job details
    job_urn_ids = [item.get("urn") for item in page_data.get("jobs", []) if item and item.get("urn")]
    if not job_urn_ids:
        print(f"No job URNs found on page {page_number}.")
        return parse_orchestration_data(page_data, [])

    # 3. Fetch and structure individual job data
    structured_jobs_data = fetch_individual_job_data(job_urn_ids)

    # 4. Combine pagination and individual job data
    combined_data = parse_orchestration_data(page_data, structured_jobs_data)
    return combined_data


def save_data_to_json(data: Dict[str, Any], page_number: int):
    """
    Saves the provided data to a JSON file.
    """
    out_dir = Path("output")
    out_dir.mkdir(exist_ok=True)
    output_filename = f"combined_data_page_{page_number}.json"
    output_path = out_dir / output_filename

    try:
        output_path.write_text(
            json.dumps(
                data,
                indent=2,
                ensure_ascii=False,
                default=lambda o: o.isoformat() if isinstance(o, (date, datetime)) else str(o),
            ),
            encoding="utf-8",
        )
        job_count = len(data.get('jobs', []))
        print(f"\n✔ Saved {output_filename} ({job_count} entries)")
    except Exception as e:
        print(f"\n✗ Failed to save data for page {page_number}: {e}")


def run_fetch_for_page(page_number: int):
    """
    Orchestrates the process for a single, specified page.
    """
    total_pages = get_total_job_pages()
    if total_pages is None:
        print("Could not determine page limits. Halting execution.")
        return

    print(f"Total pages available: {total_pages}")
    if not (0 < page_number <= total_pages):
        print(f"\nError: Requested page {page_number} is invalid. Only pages 1 through {total_pages} are available.")
        return

    combined_data = fetch_and_process_page_data(page_number)

    if combined_data:
        save_data_to_json(combined_data, page_number)
    else:
        print(f"\nNo data was processed for page {page_number}, nothing to save.")


def main():
    """
    Serves as a demonstration of how to use the module's functions.
    """
    print("--- Running Script Demonstration ---")
    page_to_fetch = 5  # <--- CHANGE THIS VALUE TO TEST DIFFERENT PAGES
    run_fetch_for_page(page_number=page_to_fetch)


if __name__ == "__main__":
    main()