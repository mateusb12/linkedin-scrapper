import re
import math
import time
import os
import requests
from typing import List, Dict, Any, Optional, Tuple

from exceptions.service_exceptions import LinkedInScrapingException
from models import Job
from repository.job_repository import JobRepository
from services.linkedin_calls.fetch_linkedin_timestamp import fetch_job_timestamp
from services.linkedin_calls.curl_storage.linkedin_fetch_call_repository import get_linkedin_fetch_artefacts


def setup_session(config: Dict[str, Any]) -> requests.Session:
    """
    DEPRECATED: Sets up and configures the requests.Session object.
    This function is maintained for backward compatibility. The primary logic
    has moved to get_linkedin_fetch_artefacts in the repository. This function
    now calls it internally and ignores the 'config' parameter.
    """
    print("⚠️ WARNING: Calling setup_session is deprecated. Update dependencies to use get_linkedin_fetch_artefacts.")
    artefacts = get_linkedin_fetch_artefacts()
    if artefacts:
        session, _ = artefacts
        return session
    # Fallback to a basic session if the new method fails
    return requests.Session()


def _fetch_initial_data(session: requests.Session, config: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]: # <-- No longer Optional
    """Fetches the first page to get the total number of saved jobs."""
    print("Fetching first page to get total job count...")
    base_url = config['base_url']
    query_id = config['query_id']
    initial_url = (
        f"{base_url}?variables=(start:0,query:(flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))"
        f"&queryId={query_id}"
    )
    try:
        response = session.get(initial_url)
        response.raise_for_status() # This will raise an exception on 4xx or 5xx errors
        data = response.json()
    except requests.exceptions.RequestException as e:
        # --- FIX: Raise our custom exception instead of returning None ---
        error_message = f"Failed to fetch initial data from LinkedIn: {e}"
        print(f"❌ {error_message}")
        raise LinkedInScrapingException(error_message) from e

    total_jobs = data.get('data', {}).get('data', {}).get('searchDashClustersByAll', {}).get('paging', {}).get('total', 0)
    if total_jobs == 0:
        # This is a valid case, but you might still want to raise an exception if you expect jobs
        print("No saved jobs found on LinkedIn.")

    return total_jobs, data


def _structure_job_from_entity(item: Dict[str, Any]) -> Optional[Dict[str, str]]:
    """
    Parses a single job entity from the LinkedIn API response into a dictionary.
    This function does NOT perform any network requests.
    """
    if item.get('$type') != 'com.linkedin.voyager.dash.search.EntityResultViewModel':
        return None

    url = item.get('navigationUrl', 'N/A')
    match = re.search(r'/jobs/view/(\d+)', url)
    if not match:
        return None

    urn_id = f"urn:li:jobPosting:{match.group(1)}"
    status = 'N/A'
    insights = item.get('insightsResolutionResults', [])
    if insights and isinstance(insights, list):
        status = insights[0].get('simpleInsight', {}).get('title', {}).get('text', 'N/A').strip()

    return {
        'title': item.get('title', {}).get('text', 'N/A').strip(),
        'company': item.get('primarySubtitle', {}).get('text', 'N/A').strip(),
        'location': item.get('secondarySubtitle', {}).get('text', 'N/A').strip(),
        'url': url,
        'status': status,
        'urn': urn_id,
    }


def _enrich_and_save_new_job(job_data: Dict[str, str], job_repo: JobRepository) -> Job:
    """
    Enriches a new job with a timestamp by fetching it, then saves it to the database.
    """
    print(f"✨ New job found: {job_data['urn']}. Fetching timestamp...")
    job_number = job_data['urn'].split(':')[-1]
    job_datetime_obj = fetch_job_timestamp(job_number)

    if job_datetime_obj:
        job_data["timestamp"] = job_datetime_obj.isoformat()

    job_repo.add_job_by_dict(job_data)
    print(f"   -> Saved {job_data['urn']} to the database.")
    return job_repo.get_by_urn(job_data['urn'])


def _process_page(page_json: Dict[str, Any], job_repo: JobRepository) -> Tuple[List[Job], bool]:
    """
    Processes a single page of job results, adding new jobs to the database.
    Returns the list of processed jobs and a boolean indicating if new jobs were found.
    """
    new_jobs_found_on_page = False

    potential_jobs = [
        job for item in page_json.get('included', [])
        if (job := _structure_job_from_entity(item)) is not None
    ]
    if not potential_jobs:
        return [], False

    potential_jobs_map = {job['urn']: job for job in potential_jobs}
    urns_on_page = list(potential_jobs_map.keys())

    existing_jobs_in_db = job_repo.get_multiple_jobs_by_urn_list(urns_on_page)

    processed_jobs = []
    for urn in urns_on_page:
        if existing_jobs_in_db.get(urn):
            print(f"✅ Job {urn} found in database (cached).")
            processed_jobs.append(existing_jobs_in_db[urn])
        else:
            new_jobs_found_on_page = True
            new_job_data = potential_jobs_map[urn]
            enriched_job = _enrich_and_save_new_job(new_job_data, job_repo)
            processed_jobs.append(enriched_job)

    return processed_jobs, new_jobs_found_on_page


def fetch_all_linkedin_jobs() -> List[Job]:
    """
    Main function to fetch all saved jobs. It first loads API configuration,
    then fetches new ones from LinkedIn.
    """
    full_scan = os.getenv('FULL_SCAN', 'FALSE').upper() == 'TRUE'
    if full_scan:
        print("🚀 FULL_SCAN enabled. All pages will be processed.")

    job_repo = JobRepository()

    # --- Phase 1: Load Configuration and Setup Session from Repository ---
    print("--- ⚙️ Phase 1: Loading config and preparing session from repository ---")
    artefacts = get_linkedin_fetch_artefacts()
    if not artefacts:
        print("Aborting sync.")
        return job_repo.fetch_applied_jobs()  # Return what's already in the DB

    session, config = artefacts

    # --- Phase 2: Scrape LinkedIn for new jobs ---
    print("\n--- 🚀 Phase 2: Fetching new jobs from LinkedIn ---")
    total_jobs, first_page_data = _fetch_initial_data(session, config)

    if total_jobs == 0:
        return job_repo.fetch_applied_jobs()
    page_size = 10  # LinkedIn API default
    num_pages = math.ceil(total_jobs / page_size)
    print(f"✅ Found {total_jobs} jobs across {num_pages} pages. Will now process them.\n")

    all_jobs = []

    # Process the first page
    print(f"--- Processing page 1 of {num_pages} ---")
    processed_jobs, new_jobs_found = _process_page(first_page_data, job_repo)
    all_jobs.extend(processed_jobs)

    if not new_jobs_found and not full_scan:
        applied_jobs = job_repo.fetch_applied_jobs()
        print(f"\n--- No new jobs found on the first page. Sync is up to date. Found {len(applied_jobs)} jobs in DB. ---")
        return applied_jobs

    # Loop through the rest of the pages
    base_url = config['base_url']
    query_id = config['query_id']
    for start_index in range(page_size, total_jobs, page_size):
        current_page_num = (start_index // page_size) + 1
        print(f"\n--- Fetching and processing page {current_page_num} of {num_pages} ---")

        url = (
            f"{base_url}?variables=(start:{start_index},query:(flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))"
            f"&queryId={query_id}"
        )
        try:
            time.sleep(1) # Be respectful to the API
            response = session.get(url)
            response.raise_for_status()
            page_data = response.json()

            processed_jobs, new_jobs_found = _process_page(page_data, job_repo)
            all_jobs.extend(processed_jobs)

            if not new_jobs_found and not full_scan:
                print(f"\n--- No new jobs found on page {current_page_num}. Stopping sync. ---")
                print("--- To process all pages, set the environment variable FULL_SCAN=TRUE ---")
                break

        except requests.exceptions.RequestException as e:
            print(f"❌ Error on page {current_page_num}: {e}. Skipping.")
            continue

    return job_repo.fetch_applied_jobs()


def main():
    print("--- Starting LinkedIn Job Sync ---")
    start_time = time.time()
    jobs = fetch_all_linkedin_jobs()
    end_time = time.time()

    duration = end_time - start_time
    print(f"\n--- ✨ Sync complete. Found {len(jobs)} total applied jobs in DB after {duration:.2f} seconds. ---")


if __name__ == "__main__":
    main()