# linkedin_fetcher.py
import re
import requests
import json
from pathlib import Path
from typing import List, Dict, Any, Optional

# Updated Imports
from linkedin.api_fetch.pagination.pagination_recommended_jobs import parse_jobs_page
from linkedin.api_fetch.single_job.fetch_single_job_details import make_session, fetch_job_detail
from models import FetchCurl
from path.path_reference import get_orchestration_curls_folder_path

env_path = get_orchestration_curls_folder_path()
INDIVIDUAL_JOB_CURL_COMMAND_PATH = Path(env_path, "individual_job_curl.txt")


def _load_pagination_job_curl_command() -> FetchCurl:
    from database.database_connection import get_db_session
    db = get_db_session()
    record = db.query(FetchCurl).filter(FetchCurl.name == "Pagination").first()
    return record


def fetch_linkedin_jobs(url: str, headers: Dict) -> Optional[Dict]:
    """Helper to make the actual request."""
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error making request to LinkedIn: {e}")
        if e.response is not None:
            print(f"Status Code: {e.response.status_code}")
        return None


def fetch_page_data_from_api(page_number: int, quiet: bool = False) -> Optional[dict]:
    try:
        db_content = _load_pagination_job_curl_command()
        if not db_content:
            raise ValueError("No pagination cURL command found in the database.")

        # --- NEW LOGIC: Ask ORM to build the request ---
        url, headers = db_content.construct_request(page_number=page_number)

        if not quiet:
            print(f"\n🚀 Fetching Page {page_number}")
            print(f"   URL: {url[:80]}...")
            print(f"   CSRF: {headers.get('csrf-token')}")

        live_data = fetch_linkedin_jobs(url, headers)

        if not live_data:
            print("Received no data from the API.")
            return None

        return parse_jobs_page(live_data)

    except Exception as e:
        print(f"Fatal error during fetch: {e}")
        return None


def fetch_raw_job_details_from_api(job_urn_ids: List[str]) -> List[Dict[str, Any]]:
    # This part remains mostly as-is until we fully migrate individual jobs to ORM too
    if not job_urn_ids:
        print("No job URNs provided.")
        return []

    content = INDIVIDUAL_JOB_CURL_COMMAND_PATH.read_text(encoding="utf-8").strip()
    session = make_session(content)

    raw_results = []
    total = len(job_urn_ids)
    print(f"--- Fetching details for {total} jobs... ---")
    for idx, urn in enumerate(job_urn_ids, start=1):
        try:
            # print(f"[{idx}/{total}] {urn}...", end=" ")
            data = fetch_job_detail(session, urn)
            raw_results.append({"jobPostingUrn": urn, "detailResponse": data})
            # print("✓")
        except Exception as exc:
            print(f"✗ Failed: {exc}")

    return raw_results