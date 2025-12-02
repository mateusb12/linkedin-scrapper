import time
import re
import requests
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional

from models import Job, Company
from source.features.job_population.job_repository import JobRepository
from source.features.get_applied_jobs.linkedin_fetch_call_repository import get_linkedin_fetch_artefacts
from utils.date_parser import parse_relative_date

# --- 1. THE GOLDEN ENRICHER FUNCTION ---
def fetch_exact_applied_date(session: requests.Session, job_urn: str) -> Optional[datetime]:
    try:
        job_id = job_urn.split(":")[-1]
        url = f"https://www.linkedin.com/voyager/api/jobs/jobPostings/{job_id}"
        headers = {'accept': 'application/json', 'x-restli-protocol-version': '2.0.0'}
        time.sleep(0.5)
        response = session.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            data = response.json()
            timestamp_ms = data.get("applyingInfo", {}).get("appliedAt")
            if timestamp_ms:
                return datetime.fromtimestamp(timestamp_ms / 1000.0, tz=timezone.utc)
    except Exception as e:
        print(f"   [Timestamp Fetch Error] {e}")
    return None

# --- 2. UPDATED PARSER: Now Extracts Company Info ---
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
    company_name = item.get('primarySubtitle', {}).get('text', 'Unknown Company').strip()
    location = item.get('secondarySubtitle', {}).get('text', 'Unknown Location').strip()

    # --- NEW: Extract Company URN and Logo ---
    company_urn = None
    company_logo = None

    # Try to find company logo/urn in the 'image' field
    image_data = item.get('image', {}).get('attributes', [])
    if image_data:
        detail_data = image_data[0].get('detailData', {})
        # This is usually the Company URN (e.g. urn:li:fsd_company:12345)
        raw_company_ref = detail_data.get('*companyLogo')

        if raw_company_ref:
            # Normalize to standard URN if needed, or keep as is if it matches DB format
            company_urn = raw_company_ref

    return {
        'title': title,
        'company': company_name,     # String name
        'company_urn': company_urn,  # URN for DB Link
        'location': location,
        'url': navigation_url,
        'urn': urn_id
    }

def _ensure_company_exists(session, name: str, urn: str):
    """Upserts the company into the DB so the Foreign Key works."""
    if not urn:
        return

    # Check if exists
    existing = session.query(Company).filter_by(urn=urn).first()
    if not existing:
        print(f"   🏭 Creating new company: {name} ({urn})")
        new_company = Company(
            urn=urn,
            name=name,
            logo_url=None, # We could fetch this, but for now getting the link is priority
            url=f"https://www.linkedin.com/company/{urn.split(':')[-1]}"
        )
        session.add(new_company)
        try:
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"   ⚠️ Failed to save company: {e}")

def _enrich_and_save_new_job(job_data: Dict[str, str], job_repo: JobRepository, session: requests.Session) -> Job:
    """Only called for BRAND NEW jobs."""

    # 1. CRITICAL: Ensure Company Exists BEFORE saving job
    if job_data.get('company_urn'):
        _ensure_company_exists(job_repo.session, job_data['company'], job_data['company_urn'])

    # 2. Add Job
    job_repo.add_job_by_dict(job_data)
    job = job_repo.get_by_urn(job_data['urn'])

    if job:
        print(f"   ✨ New Job Detected! Fetching timestamp for {job.urn}...", end=" ")
        job.has_applied = True
        exact_date = fetch_exact_applied_date(session, job.urn)
        if exact_date:
            job.applied_on = exact_date
            print(f"✅ {exact_date}")
        else:
            print("⚠️ Date not found")

        # 3. Double Check Company Link (just in case add_job_by_dict missed it)
        if job_data.get('company_urn') and not job.company_urn:
            job.company_urn = job_data['company_urn']

        job_repo.commit()

    return job

# --- 3. CORE: Fetch Logic ---
def fetch_all_linkedin_jobs() -> List[Job]:
    job_repo = JobRepository()

    print("--- ⚙️ Loading config ---")
    artefacts = get_linkedin_fetch_artefacts()
    if not artefacts:
        print("❌ Config not found.")
        return job_repo.fetch_applied_jobs()

    session, config = artefacts
    base_url = config.get('base_url')
    query_id = config.get('query_id')

    def build_url(start_index: int) -> str:
        variables = f"(start:{start_index},query:(flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))"
        return f"{base_url}?variables={variables}&queryId={query_id}"

    # Fetch List (Page 1)
    print(f"\n--- 🚀 Checking LinkedIn for updates... ---")
    try:
        url = build_url(0)
        response = session.get(url)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"❌ Failed to fetch list: {e}")
        return job_repo.fetch_applied_jobs()

    all_jobs_processed = []

    # Process Page 1
    new_count, updated_count = _process_page_data(data, job_repo, all_jobs_processed, session)

    print(f"   -> Summary: {new_count} new jobs added, {updated_count} existing jobs updated.")

    return job_repo.fetch_applied_jobs()

def _process_page_data(data: Dict, repo: JobRepository, out_list: List, session: requests.Session) -> Tuple[int, int]:
    new_jobs_counter = 0
    updated_jobs_counter = 0

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
                        # Fix for existing jobs with missing companies
                        if structured.get('company_urn') and not existing.company_urn:
                            print(f"   🔧 Fixing missing company for {structured['urn']}...")
                            _ensure_company_exists(repo.session, structured['company'], structured['company_urn'])
                            existing.company_urn = structured['company_urn']
                            repo.commit()
                            updated_jobs_counter += 1

                        # Logic for timestamps (existing)
                        needs_date = existing.applied_on is None
                        if needs_date:
                            print(f"   ♻️  Backfilling timestamp for {structured['urn']}...", end=" ")
                            exact_date = fetch_exact_applied_date(session, structured['urn'])
                            if exact_date:
                                existing.applied_on = exact_date
                                existing.has_applied = True
                                repo.commit()
                                updated_jobs_counter += 1
                                print(f"✅ {exact_date}")
                            else:
                                print("❌ Not found")

                        if not existing.has_applied:
                            existing.has_applied = True
                            repo.commit()

                    out_list.append(structured)

    return new_jobs_counter, updated_jobs_counter


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
