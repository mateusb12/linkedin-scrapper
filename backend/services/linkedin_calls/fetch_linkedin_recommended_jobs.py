# linkedin_fetcher.py
# --- Contains all direct HTTP call and API interaction logic ---

import re
from pathlib import Path
from typing import List, Dict, Any, Optional

# Assuming these imports are correct relative to your project structure
from linkedin.api_fetch.pagination.pagination_recommended_jobs import parse_curl_command_from_orm, fetch_linkedin_jobs, \
    parse_jobs_page
from linkedin.api_fetch.single_job.fetch_single_job_details import make_session, fetch_job_detail
from models import FetchCurl
from path.path_reference import get_orchestration_curls_folder_path

# Path to your individual job cURL command file
env_path = get_orchestration_curls_folder_path()
INDIVIDUAL_JOB_CURL_COMMAND_PATH = Path(env_path, "individual_job_curl.txt")


def _load_pagination_job_curl_command() -> FetchCurl:
    """Loads the pagination cURL command from the database."""
    from database.database_connection import get_db_session
    db = get_db_session()
    record = db.query(FetchCurl).filter(FetchCurl.name == "Pagination").first()
    return record


def fetch_page_data_from_api(page_number: int, quiet: bool = False) -> Optional[dict]:
    """
    Executes the pagination cURL for a specific page and returns the parsed page data.
    This function handles the direct API call.

    Args:
        page_number: The page number to fetch (e.g., 1, 2, 3...).
        quiet: If True, suppresses some print statements.

    Returns:
        A dictionary containing the parsed data for the requested page, or None on failure.
    """
    try:
        db_content = _load_pagination_job_curl_command()
        url, headers = parse_curl_command_from_orm(db_content)
        if not quiet:
            print("--- Successfully parsed pagination cURL command ---")
    except Exception as e:
        raise RuntimeError(f"Failed to parse pagination cURL: {e}") from e

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

    # This returns a structured Pydantic model, ready for conversion to dict
    return parse_jobs_page(live_data)


def fetch_raw_job_details_from_api(job_urn_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Given a list of job URNs, fetches the raw, detailed data for each job.
    This function handles the direct API calls.

    Args:
        job_urn_ids: A list of job URN identifiers.

    Returns:
        A list of dictionaries, where each contains the raw response for a job.
    """
    if not job_urn_ids:
        print("No job URNs provided to fetch details.")
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
            # We append the raw data along with the URN for context
            raw_results.append({"jobPostingUrn": urn, "detailResponse": data})
            print("✓")
        except Exception as exc:
            print(f"✗ Failed: {exc}")

    return raw_results