import math
import time
import os
import re
import requests
import json
from datetime import datetime
from typing import List, Dict, Any, Tuple # Added Tuple

from models import Job
from source.features.job_population.job_repository import JobRepository
from services.linkedin_calls.curl_storage.linkedin_fetch_call_repository import get_linkedin_fetch_artefacts
from utils.date_parser import parse_relative_date

# --- HELPER: Parse Entity ---
def _structure_job_from_entity(item: Dict[str, Any]) -> Any:
    # 1. Extract URN
    urn_id = item.get('entityUrn')
    if urn_id:
        match = re.search(r'jobPosting:(\d+)', urn_id)
        if match:
            urn_id = f"urn:li:jobPosting:{match.group(1)}"

    navigation_url = item.get('navigationUrl', '')
    if not urn_id and navigation_url:
        match = re.search(r'/jobs/view/(\d+)', navigation_url)
        if match:
            urn_id = f"urn:li:jobPosting:{match.group(1)}"

    if not urn_id:
        return None

    # 2. Extract Details
    title = item.get('title', {}).get('text', 'Unknown Title').strip()
    company = item.get('primarySubtitle', {}).get('text', 'Unknown Company').strip()
    location = item.get('secondarySubtitle', {}).get('text', 'Unknown Location').strip()

    # 3. Extract Status
    status_text = 'N/A'
    insights = item.get('insightsResolutionResults', [])
    if insights and isinstance(insights, list):
        status_text = insights[0].get('simpleInsight', {}).get('title', {}).get('text', 'N/A').strip()

    return {
        'title': title,
        'company': company,
        'location': location,
        'url': navigation_url,
        'status': status_text,
        'urn': urn_id
    }

def _enrich_and_save_new_job(job_data: Dict[str, str], job_repo: JobRepository) -> Job:
    job_repo.add_job_by_dict(job_data)

    job = job_repo.get_by_urn(job_data['urn'])
    if job:
        job.has_applied = True
        if job_data.get('status'):
            try:
                iso_date = parse_relative_date(job_data['status'])
                job.applied_on = datetime.fromisoformat(iso_date)
            except Exception: pass
        job_repo.commit()

    return job

# --- CORE: Fetch Logic ---
def fetch_all_linkedin_jobs() -> List[Job]:
    job_repo = JobRepository()

    # Optional: Force full scan via env var if needed later
    full_scan = os.getenv('FULL_SCAN', 'FALSE').upper() == 'TRUE'

    # 1. Load Config
    print("--- ⚙️ Loading config ---")
    artefacts = get_linkedin_fetch_artefacts()
    if not artefacts:
        print("❌ Config not found.")
        return job_repo.fetch_applied_jobs()

    session, config = artefacts
    base_url = config.get('base_url')
    query_id = config.get('query_id')

    if not query_id:
        print("❌ Missing 'query_id'.")
        return job_repo.fetch_applied_jobs()

    def build_url(start_index: int) -> str:
        variables = f"(start:{start_index},query:(flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))"
        return f"{base_url}?variables={variables}&queryId={query_id}"

    # 2. Fetch Page 1
    print(f"\n--- 🚀 Fetching Page 1 (QueryID: {query_id}) ---")
    try:
        url = build_url(0)
        response = session.get(url)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"❌ Failed to fetch: {e}")
        return job_repo.fetch_applied_jobs()

    # 3. Parse Metadata
    try:
        paging = data.get('data', {}).get('data', {}).get('searchDashClustersByAll', {}).get('paging', {})
        total_jobs = paging.get('total', 0)
        print(f"✅ Connection Successful. Total Applied Jobs: {total_jobs}")
    except AttributeError:
        total_jobs = 0

    if total_jobs == 0:
        return job_repo.fetch_applied_jobs()

    # 4. Processing Loop
    page_size = 10
    all_jobs_processed = []

    # Process Page 1
    parsed_count, new_count = _process_page_data(data, job_repo, all_jobs_processed)
    print(f"   -> Page 1: Parsed {parsed_count} jobs ({new_count} new).")

    # --- SMART EXIT (PAGE 1) ---
    if not full_scan and parsed_count > 0 and new_count == 0:
        print("✅ No new jobs on Page 1. Database is up to date. Stopping early.")
        return job_repo.fetch_applied_jobs()
    # ---------------------------

    # Fetch Remaining Pages
    print(f"--- Starting Sync for remaining {total_jobs - 10} jobs ---")

    for start in range(page_size, total_jobs, page_size):
        print(f"   -> Fetching page start {start}...", end=" ")
        try:
            time.sleep(1.0) # Be respectful
            url = build_url(start)
            response = session.get(url)

            if response.status_code != 200:
                print(f"⚠️ Failed ({response.status_code})")
                continue

            parsed_count, new_count = _process_page_data(response.json(), job_repo, all_jobs_processed)
            print(f"Parsed {parsed_count} ({new_count} new).")

            # --- SMART EXIT (LOOP) ---
            if not full_scan and parsed_count > 0 and new_count == 0:
                print("✅ No new jobs found on this page. Stopping sync.")
                break
            # -------------------------

        except Exception as e:
            print(f"❌ Error: {e}")

    print(f"✨ Sync complete. Total processed in this run: {len(all_jobs_processed)}.")
    return job_repo.fetch_applied_jobs()

def _process_page_data(data: Dict, repo: JobRepository, out_list: List) -> Tuple[int, int]:
    """
    Returns: (total_parsed_on_page, new_jobs_on_page)
    """
    count_before = len(out_list)
    new_jobs_counter = 0

    included_map = {item.get('entityUrn'): item for item in data.get('included', [])}

    try:
        search_clusters = data.get('data', {}).get('data', {}).get('searchDashClustersByAll', {})
        elements = search_clusters.get('elements', [])
    except AttributeError:
        elements = []

    for cluster in elements:
        items = cluster.get('items', [])
        for item_wrapper in items:
            item_obj = item_wrapper.get('item', {})
            entity_urn_ref = item_obj.get('*entityResult')

            if not entity_urn_ref: continue

            resolved_entity = included_map.get(entity_urn_ref)
            if resolved_entity:
                structured = _structure_job_from_entity(resolved_entity)

                if structured:
                    existing = repo.get_by_urn(structured['urn'])
                    if not existing:
                        _enrich_and_save_new_job(structured, repo)
                        new_jobs_counter += 1
                    else:
                        # Ensure status is synced even if job exists
                        if not existing.has_applied:
                            existing.has_applied = True
                            repo.commit()

                    out_list.append(structured)

    return (len(out_list) - count_before), new_jobs_counter

if __name__ == "__main__":
    fetch_all_linkedin_jobs()