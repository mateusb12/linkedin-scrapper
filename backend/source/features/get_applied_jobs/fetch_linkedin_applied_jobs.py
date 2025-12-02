import time
import os
import re
import json
from pathlib import Path

import requests
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional

# Conditional imports to allow standalone execution without DB
try:
    from models import Job
    from source.features.job_population.job_repository import JobRepository
    from source.features.get_applied_jobs.linkedin_fetch_call_repository import get_linkedin_fetch_artefacts
    from utils.date_parser import parse_relative_date
except ImportError:
    # Mocks for standalone testing
    Job = Any
    JobRepository = Any
    get_linkedin_fetch_artefacts = Any
    parse_relative_date = Any


# --- 1. THE GOLDEN ENRICHER FUNCTION ---
def fetch_exact_applied_date(session: requests.Session, job_urn: str) -> Optional[datetime]:
    """
    Hits the specific job entity endpoint to get the raw timestamp.
    Endpoint: /voyager/api/jobs/jobPostings/{job_id}
    """
    try:
        # Extract ID (handles 'urn:li:jobPosting:123' or just '123')
        job_id = job_urn.split(":")[-1]

        url = f"https://www.linkedin.com/voyager/api/jobs/jobPostings/{job_id}"

        # Ensure we ask for JSON
        headers = {
            'accept': 'application/json',
            'x-restli-protocol-version': '2.0.0'
        }

        # Respectful delay
        time.sleep(0.5)

        response = session.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            data = response.json()
            # The Golden Path found in your Bash script
            timestamp_ms = data.get("applyingInfo", {}).get("appliedAt")

            if timestamp_ms:
                return datetime.fromtimestamp(timestamp_ms / 1000.0, tz=timezone.utc)

    except Exception as e:
        print(f"   [Timestamp Fetch Error] {e}")

    return None


# --- 2. EXISTING HELPER: Parse Entity ---
def _structure_job_from_entity(item: Dict[str, Any]) -> Any:
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

    title = item.get('title', {}).get('text', 'Unknown Title').strip()
    company = item.get('primarySubtitle', {}).get('text', 'Unknown Company').strip()
    location = item.get('secondarySubtitle', {}).get('text', 'Unknown Location').strip()

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


def _enrich_and_save_new_job(job_data: Dict[str, str], job_repo: JobRepository, session: requests.Session) -> Job:
    """
    Saves basic data and immediately fetches the golden timestamp.
    """
    job_repo.add_job_by_dict(job_data)
    job = job_repo.get_by_urn(job_data['urn'])

    if job:
        job.has_applied = True

        # Fetch exact date immediately
        exact_date = fetch_exact_applied_date(session, job.urn)
        if exact_date:
            job.applied_on = exact_date

        job_repo.commit()

    return job


# --- 3. CORE: Fetch Logic (Updated to pass session) ---
def fetch_all_linkedin_jobs() -> List[Job]:
    job_repo = JobRepository()

    # Load Config from DB
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

    # Fetch Page 1
    print(f"\n--- 🚀 Fetching Page 1 (QueryID: {query_id}) ---")
    try:
        url = build_url(0)
        response = session.get(url)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"❌ Failed to fetch: {e}")
        return job_repo.fetch_applied_jobs()

    # Pagination logic
    try:
        paging = data.get('data', {}).get('data', {}).get('searchDashClustersByAll', {}).get('paging', {})
        total_jobs = paging.get('total', 0)
        print(f"✅ Connection Successful. Total Applied Jobs: {total_jobs}")
    except AttributeError:
        total_jobs = 0

    if total_jobs == 0:
        return job_repo.fetch_applied_jobs()

    page_size = 10
    all_jobs_processed = []

    # Process Page 1 (Passing session!)
    parsed_count, new_count = _process_page_data(data, job_repo, all_jobs_processed, session)
    print(f"   -> Page 1: Parsed {parsed_count} jobs ({new_count} new).")

    # Fetch Remaining Pages
    for start in range(page_size, total_jobs, page_size):
        print(f"   -> Fetching page start {start}...", end=" ")
        try:
            time.sleep(1.0)
            url = build_url(start)
            response = session.get(url)

            if response.status_code != 200:
                print(f"⚠️ Failed ({response.status_code})")
                continue

            parsed_count, new_count = _process_page_data(response.json(), job_repo, all_jobs_processed, session)
            print(f"Parsed {parsed_count} ({new_count} new).")

        except Exception as e:
            print(f"❌ Error: {e}")

    return job_repo.fetch_applied_jobs()


def _process_page_data(data: Dict, repo: JobRepository, out_list: List, session: requests.Session) -> Tuple[int, int]:
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
                        _enrich_and_save_new_job(structured, repo, session)
                        new_jobs_counter += 1
                    else:
                        # Fix existing jobs missing timestamps
                        if not existing.applied_on:
                            print(f"   ♻️ Backfilling timestamp for {structured['urn']}...", end=" ")
                            exact_date = fetch_exact_applied_date(session, structured['urn'])
                            if exact_date:
                                existing.applied_on = exact_date
                                print(f"✅ {exact_date}")
                            else:
                                print("❌")
                            repo.commit()

                    out_list.append(structured)

    return (len(out_list) - count_before), new_jobs_counter


# ==============================================================================
# 4. STANDALONE TESTING BLOCK (Replicates your Bash Script Logic)
# ==============================================================================
if __name__ == "__main__":
    DEBUG = True  # Set to False later to silence debug

    def dbg(msg):
        if DEBUG:
            print(f"\n[DEBUG] {msg}\n")

    import sys
    from pathlib import Path

    print("\n--- 🐍 PYTHON REPLICA OF BASH SCRIPT (Fixed) 🐍 ---")

    # 1. Locate HAR file
    har_path = Path("linkedin.har")

    if not har_path.exists():
        script_dir = Path(__file__).parent
        potential_paths = [
            Path.cwd() / "linkedin.har",
            Path.home() / "Downloads" / "linkedin.har",
            script_dir / "linkedin.har"
        ]
        for p in potential_paths:
            if p.exists():
                har_path = p
                break

    if not har_path.exists():
        print(f"❌ Error: 'linkedin.har' not found.")
        sys.exit(1)

    print(f"[1] Extracting credentials from {har_path}...")

    with open(har_path, "r", encoding="utf-8", errors="ignore") as f:
        har_content = f.read()

    li_at_match = re.search(r'li_at=([^;"]+)', har_content)
    jsession_match = re.search(r'JSESSIONID=?[\\"]*ajax:([0-9]+)', har_content)

    if not li_at_match or not jsession_match:
        print("❌ Could not extract tokens from HAR")
        sys.exit(1)

    li_at = li_at_match.group(1)
    csrf = f"ajax:{jsession_match.group(1)}"

    print(f"✔ LI_AT: {li_at[:20]}...")
    print(f"✔ CSRF:  {csrf}")

    # 2. Setup session
    session = requests.Session()
    session.headers.update({
        "csrf-token": csrf,
        "x-restli-protocol-version": "2.0.0",
        "accept": "application/vnd.linkedin.normalized+json+2.1",
        "user-agent": "Mozilla/5.0"
    })
    session.cookies.set("li_at", li_at)
    session.cookies.set("JSESSIONID", f'"{csrf}"')

    # 3. Fetch job list (FIXED: Manual URL Construction)
    print("\n[2] Fetching job list...")

    base_url = "https://www.linkedin.com/voyager/api/graphql"

    # CRITICAL FIX: Define exact string to avoid %28 encoding of parentheses
    variables = "(start:0,query:(flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))"
    query_id = "voyagerSearchDashClusters.ef3d0937fb65bd7812e32e5a85028e79"

    # Manually append to URL
    full_url = f"{base_url}?variables={variables}&queryId={query_id}"

    dbg(f"GET {full_url}")

    # Pass headers/cookies via session, but NO 'params=' argument
    resp = session.get(full_url)

    if resp.status_code != 200:
        print(f"❌ List fetch failed: {resp.status_code}")
        print(f"Response: {resp.text[:300]}")
        sys.exit(1)

    job_ids = set(re.findall(r'urn:li:jobPosting:(\d+)', resp.text))
    print(f"✔ Found {len(job_ids)} jobs.\n")

    # 4. Fetch Details
    print("[3] Fetching Exact Timestamps...")
    print("-" * 65)
    print(f"{'Job ID':<15} | {'Source':<10} | {'Applied At (UTC)'}")
    print("-" * 65)

    for jid in sorted(job_ids):
        timestamp_date = fetch_exact_applied_date(session, jid)
        if timestamp_date:
            print(f"{jid:<15} | {'API':<10} | {timestamp_date}")
        else:
            print(f"{jid:<15} | {'API':<10} | ❌ Not found")

    print("-" * 65)
    print("Done.")
