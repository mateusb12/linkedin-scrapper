import math
import time
import os
import requests
import shlex  # Added for safe quoting
from typing import List, Dict, Any, Tuple
from urllib.parse import quote

from exceptions.service_exceptions import LinkedInScrapingException
from models import Job
from source.features.job_population.job_repository import JobRepository
from services.linkedin_calls.fetch_linkedin_timestamp import fetch_job_timestamp
from services.linkedin_calls.curl_storage.linkedin_fetch_call_repository import get_linkedin_fetch_artefacts

# --- HELPER: Debug Curl ---
def debug_print_curl(response):
    """
    Reconstructs and prints the exact cURL command from the Python request object.
    This captures headers, cookies, and URL exactly as Python sent them.
    """
    req = response.request
    command = f"curl -X {req.method} '{req.url}'"

    for k, v in req.headers.items():
        # Escape single quotes for bash safety
        safe_value = v.replace("'", "'\\''")
        command += f" \\\n -H '{k}: {safe_value}'"

    print("\n--------- 🐛 DEBUG: PYTHON GENERATED CURL (Copy below to Terminal) ---------\n")
    print(command)
    print("\n----------------------------------------------------------------------------\n")

# --- HELPER: Parse Entity ---
def _structure_job_from_entity(item: Dict[str, Any]) -> Any:
    """Parses a single job entity from the LinkedIn API response."""
    # Check if the item is an EntityResultViewModel
    if item.get('$type') != 'com.linkedin.voyager.dash.search.EntityResultViewModel':
        return None

    url = item.get('navigationUrl', 'N/A')
    # Regex to extract job ID
    import re
    match = re.search(r'/jobs/view/(\d+)', url)
    if not match:
        return None

    urn_id = f"urn:li:jobPosting:{match.group(1)}"
    status = 'N/A'
    insights = item.get('insightsResolutionResults', [])
    if insights and isinstance(insights, list):
        # Extract status like "Applied 1mo ago"
        status = insights[0].get('simpleInsight', {}).get('title', {}).get('text', 'N/A').strip()

    return {
        'title': item.get('title', {}).get('text', 'N/A').strip(),
        'company': item.get('primarySubtitle', {}).get('text', 'N/A').strip(),
        'location': item.get('secondarySubtitle', {}).get('text', 'N/A').strip(),
        'url': url,
        'status': status,
        'urn': urn_id,
        'applied_on': status # Passing raw status to be parsed by util later
    }

# --- HELPER: Enrich & Save ---
def _enrich_and_save_new_job(job_data: Dict[str, str], job_repo: JobRepository) -> Job:
    """Enriches a new job with a timestamp and saves it."""
    # print(f"✨ New job found: {job_data['urn']}")

    # 1. Fetch Timestamp (optional, adds delay)
    # job_number = job_data['urn'].split(':')[-1]
    # job_datetime_obj = fetch_job_timestamp(job_number)
    # if job_datetime_obj:
    #     job_data["timestamp"] = job_datetime_obj.isoformat()

    # 2. Add to Repository
    job_repo.add_job_by_dict(job_data)

    # 3. Mark as Applied explicitly
    job_repo.mark_applied(job_data['urn'])

    return job_repo.get_by_urn(job_data['urn'])

# --- CORE: Fetch Logic ---
def fetch_all_linkedin_jobs() -> List[Job]:
    """
    Re-creates the 'SEARCH_MY_ITEMS_JOB_SEEKER' cURL request logic.
    """
    job_repo = JobRepository()

    # 1. Load Config (Headers & QueryID) from DB
    print("--- ⚙️ Loading 'LinkedIn_Saved_Jobs_Scraper' config ---")
    artefacts = get_linkedin_fetch_artefacts()
    if not artefacts:
        print("❌ Config not found. Aborting.")
        return job_repo.fetch_applied_jobs()

    session, config = artefacts
    base_url = config['base_url']
    query_id = config['query_id'] # This MUST match the hash in your cURL

    if not query_id:
        print("❌ Missing 'query_id' in configuration.")
        return job_repo.fetch_applied_jobs()

    # 2. Define the Request Generator
    def build_url(start_index: int) -> str:
        # EXACT variables structure from your cURL
        variables = f"(start:{start_index},query:(flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))"
        # We quote the variables to ensure safe URL characters (parentheses etc)
        # However, requests params usually handle this, but manual construction is safer for LinkedIn's strict parser
        return f"{base_url}?variables={variables}&queryId={query_id}"

    # 3. Fetch Initial Page
    print(f"\n--- 🚀 Fetching 'Applied' Jobs (QueryID: {query_id}) ---")
    try:
        # We manually build the URL to ensure parentheses aren't double-encoded incorrectly
        url = build_url(0)
        response = session.get(url)

        # --- DEBUG: PRINT CURL ---
        debug_print_curl(response)
        # -------------------------

        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"❌ Failed to fetch initial data: {e}")
        return job_repo.fetch_applied_jobs()

    # 4. Parse Total Count
    try:
        paging = data.get('data', {}).get('data', {}).get('searchDashClustersByAll', {}).get('paging', {})
        total_jobs = paging.get('total', 0)
    except AttributeError:
        total_jobs = 0

    print(f"✅ Found {total_jobs} total applied jobs on LinkedIn.")

    if total_jobs == 0:
        return job_repo.fetch_applied_jobs()

    # 5. Pagination Loop
    page_size = 10 # LinkedIn hard limit for this endpoint is usually 10
    all_jobs_processed = []

    # Process First Page Data (already fetched)
    _process_page_data(data, job_repo, all_jobs_processed)

    # Fetch Remaining Pages
    for start in range(page_size, total_jobs, page_size):
        print(f"   -> Fetching page starting at {start}...")
        try:
            time.sleep(1.5) # Rate limit protection
            url = build_url(start)
            response = session.get(url)

            if response.status_code != 200:
                print(f"   ⚠️ Page failed with {response.status_code}")
                continue

            _process_page_data(response.json(), job_repo, all_jobs_processed)

        except Exception as e:
            print(f"   ❌ Error on page {start}: {e}")

    return job_repo.fetch_applied_jobs()

def _process_page_data(data: Dict, repo: JobRepository, out_list: List):
    """Parses the specific nested structure of 'searchDashClustersByAll'."""
    clusters = data.get('data', {}).get('data', {}).get('searchDashClustersByAll', {}).get('elements', [])

    for cluster in clusters:
        items = cluster.get('items', [])
        for item in items:
            entity_result = item.get('item', {}).get('entityResult', {})
            structured = _structure_job_from_entity(entity_result)

            if structured:
                # Upsert / Save logic
                existing = repo.get_by_urn(structured['urn'])
                if not existing:
                    _enrich_and_save_new_job(structured, repo)
                else:
                    # Ensure it's marked applied even if it existed before
                    repo.mark_applied(structured['urn'])

                out_list.append(structured)

if __name__ == "__main__":
    fetch_all_linkedin_jobs()