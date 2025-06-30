import json
import re
import math
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

# Assuming these imports are correct relative to your project structure
from linkedin.api_fetch.orchestration_curls.orchestration_parser import parse_orchestration_data
from linkedin.api_fetch.pagination.pagination_recommended_jobs import parse_curl_command_from_curl_string, \
    fetch_linkedin_jobs, \
    parse_jobs_page, parse_curl_command_from_orm
from linkedin.api_fetch.single_job.fetch_single_job_details import make_session, fetch_job_detail
from linkedin.api_fetch.single_job.structure_single_job import extract_job_details
from models import FetchCurl
from path.path_reference import get_orchestration_curls_folder_path

# Paths to your orchestration cURL commands
env_path = get_orchestration_curls_folder_path()
PAGINATION_CURL_COMMAND_PATH = Path(env_path, "pagination_curl.txt")
INDIVIDUAL_JOB_CURL_COMMAND_PATH = Path(env_path, "individual_job_curl.txt")


def get_total_job_pages() -> Optional[int]:
    """
    Fetches the first page of job results to determine the total number of available pages.

    Returns:
        The total number of pages as an integer, or None if it cannot be determined.
    """
    print("--- Attempting to determine total number of pages... ---")
    # We only need to fetch the first page (start=0) to get the 'total' count.
    data = fetch_page_data(page_number=1, quiet=True)  # Use quiet mode to suppress unnecessary logs

    if not data or not data.get('paging'):
        print("Error: Could not retrieve pagination metadata. The cURL command might be expired.")
        return None

    paging_info = data.get('paging', {})
    total_jobs = paging_info.get('total', 0)
    jobs_per_page = paging_info.get('count', 0)

    if not total_jobs or not jobs_per_page:
        print("Error: Pagination data is missing 'total' or 'count' fields.")
        return None

    # Use math.ceil to round up to the nearest whole number
    total_pages = math.ceil(total_jobs / jobs_per_page)
    print(f"--- Found {total_jobs} total jobs. ---")
    return total_pages


def load_pagination_job_curl_command() -> FetchCurl:
    """Loads the pagination cURL command from the database."""
    from backend.database.database_connection import get_db_session
    db = get_db_session()
    record = db.query(FetchCurl).filter(FetchCurl.name == "Pagination").first()
    return record


def load_single_job_curl_command() -> FetchCurl:
    """Loads the single job cURL command from the database."""
    from backend.database.database_connection import get_db_session
    db = get_db_session()
    record = db.query(FetchCurl).filter(FetchCurl.name == "SingleJob").first()
    return record


def fetch_page_data(page_number: int, quiet: bool = False) -> Optional[Dict[str, Any]]:
    """
    Executes the pagination cURL for a specific page, parses the jobs page,
    and returns a dictionary with pagination data.

    Args:
        page_number: The page number to fetch (e.g., 1, 2, 3...).
        quiet: If True, suppresses some print statements. Used by get_total_pages.

    Returns:
        A dictionary containing the parsed data for the requested page.
    """
    try:
        db_content = load_pagination_job_curl_command()
        url, headers = parse_curl_command_from_orm(db_content)
        if not quiet:
            print("--- Successfully parsed pagination cURL command ---")
    except Exception as e:
        raise RuntimeError(f"Failed to parse pagination cURL: {e}")

    count_match = re.search(r"count:(\d+)", url)
    count = int(count_match.group(1)) if count_match else 24
    start_index = (page_number - 1) * count
    modified_url = re.sub(r"start:\d+", f"start:{start_index}", url)

    if not quiet:
        print(f"--- Fetching page {page_number} (start index: {start_index}) ---")

    live_data = fetch_linkedin_jobs(modified_url, headers)
    if not live_data:
        if not quiet:
            print("Received no data from the API. This could be due to an expired cURL token or invalid page number.")
        return None

    parsed_page = parse_jobs_page(live_data)
    return asdict(parsed_page)


def fetch_individual_job_data(job_urn_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Given a list of job URNs, fetches and structures the detailed data for each job.
    """
    if not job_urn_ids:
        print("No job URNs found to fetch individual details.")
        return []

    content = INDIVIDUAL_JOB_CURL_COMMAND_PATH.read_text(encoding="utf-8").strip()
    session = make_session(content)

    raw_results = []
    total = len(job_urn_ids)
    print(f"--- Fetching details for {total} jobs... ---")
    for idx, urn in enumerate(job_urn_ids, start=1):
        try:
            print(f"[{idx}/{total}] Fetching detail for {urn}...", end=" ")
            data = fetch_job_detail(session, urn)
            raw_results.append({"jobPostingUrn": urn, "detailResponse": data})
            print("✓")
        except Exception as exc:
            print(f"✗ Failed: {exc}")

    structured = []
    for entry in raw_results:
        details = extract_job_details(entry)
        if details:
            structured.append(asdict(details))
    return structured


def fetch_and_process_page_data(page_number: int) -> Optional[Dict[str, Any]]:
    """
    Fetches all necessary data for a given page number and combines it.

    Args:
        page_number: The page number to fetch.

    Returns:
        A dictionary containing the combined data for the page, or None if fetching fails.
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
        # Still return page_data in case it contains useful metadata
        return parse_orchestration_data(page_data, [])

    # 3. Fetch and structure individual job data
    structured_jobs_data = fetch_individual_job_data(job_urn_ids)

    # 4. Combine pagination and individual job data
    combined_data = parse_orchestration_data(page_data, structured_jobs_data)
    return combined_data


def save_data_to_json(data: Dict[str, Any], page_number: int):
    """
    Saves the provided data to a JSON file.

    Args:
        data: The dictionary of data to save.
        page_number: The page number, used for the filename.
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
    Orchestrates the process of fetching, processing, and saving
    all job data for a single, specified page.

    Args:
        page_number: The page number to fetch.
    """
    # First, get the page limit to validate the input
    total_pages = get_total_job_pages()
    if total_pages is None:
        print("Could not determine page limits. Halting execution.")
        return

    print(f"Total pages available: {total_pages}")

    # Validate the requested page number
    if not (0 < page_number <= total_pages):
        print(f"\nError: Requested page {page_number} is invalid. Only pages 1 through {total_pages} are available.")
        return

    # Fetch and process the data
    combined_data = fetch_and_process_page_data(page_number)

    # Save the data if it was fetched successfully
    if combined_data:
        save_data_to_json(combined_data, page_number)
    else:
        print(f"\nNo data was processed for page {page_number}, nothing to save.")


def main():
    """
    Serves as a demonstration of how to use the module's functions.
    You can call get_total_job_pages() and run_fetch_for_page() from other scripts.
    """
    print("--- Running Script Demonstration ---")

    # Example 1: Get total pages
    total_pages = get_total_job_pages()
    if total_pages:
        print(f"\nDemonstration: Total pages found: {total_pages}")

    # Example 2: Fetch data for a specific page (e.g., page 5)
    # You can change this page number to test with a different page.
    page_to_fetch = 5  # <--- CHANGE THIS VALUE TO TEST DIFFERENT PAGES
    if total_pages and page_to_fetch > total_pages:
        print(f"\nWarning: Page {page_to_fetch} is greater than the total of {total_pages} pages. Adjusting to last page.")
        page_to_fetch = total_pages

    print(f"\nDemonstration: Attempting to fetch and save data for page {page_to_fetch}...")
    run_fetch_for_page(page_number=page_to_fetch)


if __name__ == "__main__":
    # The script is now designed to be imported, but this allows it to be run directly
    # for demonstration purposes.
    main()
