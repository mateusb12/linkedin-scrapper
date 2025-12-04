# source/features/get_applied_jobs/fetch_linkedin_applied_jobs.py

import time
import re
import requests
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional

from models import Job, Company
from source.features.job_population.job_repository import JobRepository
from source.features.get_applied_jobs.linkedin_fetch_call_repository import get_linkedin_fetch_artefacts
from source.features.job_population.enrichment_service import EnrichmentService
from utils.date_parser import parse_relative_date

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

    company_urn = None
    company_logo = None
    image_data = item.get('image', {}).get('attributes', [])
    if image_data:
        detail_data = image_data[0].get('detailData', {})
        raw_company_ref = detail_data.get('*companyLogo')
        if raw_company_ref:
            company_urn = raw_company_ref

    return {
        'title': title,
        'company': company_name,
        'company_urn': company_urn,
        'location': location,
        'url': navigation_url,
        'urn': urn_id
    }

def _ensure_company_exists(session, name: str, urn: str):
    if not urn:
        return
    existing = session.query(Company).filter_by(urn=urn).first()
    if not existing:
        print(f"   🏭 Creating new company: {name} ({urn})")
        new_company = Company(
            urn=urn,
            name=name,
            logo_url=None,
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

    # 1. Ensure Company
    if job_data.get('company_urn'):
        _ensure_company_exists(job_repo.session, job_data['company'], job_data['company_urn'])

    # 2. Add Basic Job Data
    job_repo.add_job_by_dict(job_data)
    job = job_repo.get_by_urn(job_data['urn'])

    if job:
        print(f"   ✨ New Job: {job.title}")
        job.has_applied = True

        # 3. Fetch Timestamp
        print(f"      📅 Fetching timestamp...", end=" ")
        exact_date = fetch_exact_applied_date(session, job.urn)
        if exact_date:
            job.applied_on = exact_date
            print(f"✅ {exact_date}")
        else:
            print("⚠️ Not found")

        print(f"      📝 Fetching description...", end=" ")
        enrichment_data = EnrichmentService.fetch_single_job_details_enrichment(session, job.urn)

        description = enrichment_data.get("description")
        applicants = enrichment_data.get("applicants")
        if description:
            job.description_full = description

            if applicants is not None:
                job.applicants = applicants
                print(f" (Applicants: {applicants})", end="")

            job.processed = False
            print(f" ✅ Saved")
        else:
            print(" ⚠️ Failed to fetch description")

        # 5. Double Check Company Link
        if job_data.get('company_urn') and not job.company_urn:
            job.company_urn = job_data['company_urn']

        job_repo.commit()

    return job

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
                        # Existing job logic (company fix, timestamp backfill)
                        if structured.get('company_urn') and not existing.company_urn:
                            print(f"   🔧 Fixing missing company for {structured['urn']}...")
                            _ensure_company_exists(repo.session, structured['company'], structured['company_urn'])
                            existing.company_urn = structured['company_urn']
                            repo.commit()
                            updated_jobs_counter += 1

                        if existing.applied_on is None:
                            exact_date = fetch_exact_applied_date(session, structured['urn'])
                            if exact_date:
                                existing.applied_on = exact_date
                                existing.has_applied = True
                                repo.commit()
                                updated_jobs_counter += 1

                        # 👇 ALSO CHECK MISSING DESCRIPTION ON EXISTING JOBS
                        if existing.description_full == "No description provided":
                            print(f"   📝 Backfilling description for {existing.title}...", end=" ")
                            desc = EnrichmentService.fetch_single_job_description(session, existing.urn)
                            if desc:
                                existing.description_full = desc
                                existing.processed = False
                                repo.commit()
                                print("✅")
                                updated_jobs_counter += 1
                            else:
                                print("⚠️ Failed")

                        if not existing.has_applied:
                            existing.has_applied = True
                            repo.commit()

                    out_list.append(structured)

    return new_jobs_counter, updated_jobs_counter