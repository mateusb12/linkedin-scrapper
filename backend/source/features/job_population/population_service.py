import math
import time
import json
import traceback
from datetime import datetime, timedelta
from typing import Dict, Any, Generator
from dateutil import parser as date_parser

from sqlalchemy import or_

from source.features.fetch_curl.fetch_service import FetchService
from source.features.job_population.job_repository import JobRepository
from models import Company, Job, Email
from source.features.job_population.linkedin_parser import parse_job_entries
from source.features.job_population.enrichment_service import EnrichmentService
from source.features.fetch_curl.linkedin_http_client import get_linkedin_fetch_artefacts
from database.database_connection import get_db_session

class PopulationService:

    @staticmethod
    def get_total_pages() -> int:
        data = FetchService.execute_fetch_page_raw(page_number=1)
        if not data: return 0
        try:
            inner = (data.get('data') or {}).get('data') or {}
            paging = (inner.get('jobsDashJobCardsByJobCollections') or {}).get('paging') or {}
            total = paging.get('total', 0)
            count = paging.get('count', 25)
            if count == 0: return 0
            return math.ceil(total / count)
        except Exception:
            return 0

    @staticmethod
    def fetch_and_save_page(page_number: int) -> Dict[str, Any]:
        print(f"\n[Population] ================= START PAGE {page_number} =================")

        # 1. FETCH PAGINATION (Lightweight)
        print(f"[Population] Step 1: Fetching List for Page {page_number}...")
        raw_data = FetchService.execute_fetch_page_raw(page_number)
        if not raw_data:
            print("[Population] ❌ Network request failed.")
            return {"success": False, "message": "Network request failed"}

        # 2. PARSE SUMMARIES
        job_entries = parse_job_entries(raw_data)
        if not job_entries:
            print("[Population] ⚠️ No jobs found in parsed entries.")
            return {"success": True, "count": 0, "total_found": 0, "message": "No jobs found"}

        print(f"[Population] Step 2: Parsed {len(job_entries)} raw job entries.")

        repo = JobRepository()
        session = repo.session
        saved_count = 0

        # 3. IDENTIFY NEW JOBS
        new_jobs = []
        for job in job_entries:
            if not repo.get_by_urn(job['urn']):
                new_jobs.append(job)

        # 4. BATCH ENRICHMENT (The Magic Step)
        if new_jobs:
            # Extract IDs for the batch call
            job_ids = [j['job_id'] for j in new_jobs]

            print(f"[Population] Step 4: Batch Enriching {len(job_ids)} IDs...")
            enriched_results = EnrichmentService.fetch_batch_job_details(job_ids)
            print(f"[Population] ✅ Batch returned data for {len(enriched_results)} jobs.")

            # 5. MERGE & SAVE
            for job in new_jobs:
                job_id = job['job_id']

                # --- Enrichment Merge ---
                if job_id in enriched_results:
                    details = enriched_results[job_id]
                    job.update(details)
                else:
                    print(f"   > [⚠️ Missing] No batch details for Job {job_id}. Marking unprocessed.")
                    job['description_full'] = "No description provided"
                    job['processed'] = False

                # --- Company Handling ---
                c_urn = job.get('company_urn')
                if c_urn:
                    comp = session.query(Company).filter_by(urn=c_urn).first()
                    c_name = job.get('company_name', 'Unknown')
                    c_logo = job.get('company_logo')

                    if not comp:
                        print(f"     -> Creating NEW Company: {c_name} ({c_urn})")
                        new_comp = Company(urn=c_urn, name=c_name, logo_url=c_logo)
                        session.add(new_comp)
                        session.flush()
                    else:
                        if c_logo and not comp.logo_url:
                            comp.logo_url = c_logo
                            session.add(comp)

                repo.add_job_by_dict(job)
                saved_count += 1

        print(f"[Population] Step 5: Committing {saved_count} jobs to database...")
        repo.commit()
        repo.close()
        print(f"[Population] ================= END PAGE {page_number} =================\n")

        return {
            "success": True,
            "count": saved_count,
            "total_found": len(job_entries)
        }

    @staticmethod
    def stream_description_backfill(time_range: str = 'all_time') -> Generator[str, None, None]:
        """
        Generator that processes jobs and yields SSE-compatible JSON events
        with detailed diffs on what changed.
        """
        print(f"[DEBUG] 🟢 Starting stream_description_backfill generator. Range: {time_range}", flush=True)

        try:
            db = get_db_session()

            # 1. Setup Session
            session_artefacts = get_linkedin_fetch_artefacts()
            if not session_artefacts:
                yield f"event: error\ndata: {json.dumps({'error': 'Could not load LinkedIn session. Update cookies.'})}\n\n"
                return

            requests_session, _ = session_artefacts

            # 2. Date Filtering Logic
            cutoff_date = None
            now = datetime.now()

            if time_range == 'past_24h':
                cutoff_date = now - timedelta(days=1)
            elif time_range == 'past_week':
                cutoff_date = now - timedelta(weeks=1)
            elif time_range == 'past_month':
                cutoff_date = now - timedelta(days=30)
            elif time_range == 'past_6_months':
                cutoff_date = now - timedelta(days=180)
            elif time_range == 'past_year':
                cutoff_date = now - timedelta(days=365)
            # 'all_time' leaves cutoff_date as None

            # 3. Build Query
            # We want to check ALL jobs for updates (applicants), not just ones missing descriptions
            query = db.query(Job)

            # Apply date filter if applicable
            if cutoff_date:
                # Assuming posted_on is stored as ISO string "YYYY-MM-DD..."
                # Lexicographical comparison works for ISO dates
                cutoff_str = cutoff_date.isoformat()
                print(f"[DEBUG] Filtering jobs posted after: {cutoff_str}")
                # [MODIFIED] Include jobs with missing dates so we can fix them!
                query = query.filter(
                    Job.posted_on.is_(None) | (Job.posted_on >= cutoff_str)
                )

            target_jobs = query.order_by(Job.posted_on.desc()).all()
            total = len(target_jobs)

            print(f"[DEBUG] Found {total} jobs matching criteria.", flush=True)

            if total == 0:
                # This event tells frontend we are done immediately
                yield f"event: complete\ndata: {json.dumps({'message': 'No jobs found for this period.'})}\n\n"
                return

            start_time = time.time()
            processed = 0
            success_count = 0

            # 4. Iterate and Stream
            for index, job in enumerate(target_jobs, start=1):
                print(
                    f"[DEBUG] Processing job {index}/{total} | Company: {job.company.name if job.company else 'Unknown'} | URN: {job.urn}",
                    flush=True
                )
                processed += 1

                # Metrics calculation
                elapsed = time.time() - start_time
                avg_time = elapsed / processed
                remaining_jobs = total - processed
                eta_seconds = remaining_jobs * avg_time

                # 5. Fetch Enrichment Data
                try:
                    enrichment_data = EnrichmentService.fetch_single_job_details_enrichment(requests_session, job.urn)
                except Exception as e:
                    print(f"[DEBUG] ❌ Error calling EnrichmentService: {e}", flush=True)
                    enrichment_data = {}

                new_desc = enrichment_data.get("description")
                new_applicants = enrichment_data.get("applicants")
                new_status = enrichment_data.get("application_status")
                posted_text = enrichment_data.get("posted_date_text")

                status = "failed"
                should_save = False
                changes = [] # List to store specific updates

                # --- Diff Logic ---
                TERMINAL_STATES = {"Refused", "Rejected", "Offer", "Hired", "Interviewing"}

                # 1. Check if we should ignore the update (Terminal State)
                if job.application_status in TERMINAL_STATES:
                    print(
                        f"[DEBUG] Skipping status update for {job.urn}. Current: {job.application_status} (Protected)")
                # 2. Check if it is ACTUALLY different (The Fix)
                elif job.application_status != new_status:
                    changes.append({
                        "field": "Status",
                        "old": job.application_status,
                        "new": new_status
                    })
                    job.application_status = new_status
                    should_save = True

                # 2. Fix Missing Date (NEW)
                if (job.posted_on is None or job.posted_on == "") and posted_text:
                    try:
                        # Clean string "Posted on Oct 15, 2025." -> "Oct 15, 2025"
                        clean_date_str = posted_text.replace("Posted on ", "").replace(".", "").strip()
                        # Parse to ISO format using dateutil
                        dt_object = date_parser.parse(clean_date_str)
                        new_iso_date = dt_object.isoformat()

                        changes.append({
                            "field": "Date Fix",
                            "old": "Missing",
                            "new": f"Fixed to {clean_date_str}"
                        })
                        job.posted_on = new_iso_date
                        should_save = True
                    except Exception as e:
                        print(f"[Warning] Date parse failed for {posted_text}: {e}")

                # 3. Check Description
                if new_desc and job.description_full != new_desc:
                    changes.append({
                        "field": "Description",
                        "old": "Missing" if job.description_full == "No description provided" else "Outdated",
                        "new": "Updated"
                    })
                    job.description_full = new_desc
                    should_save = True

                # 4. Check Applicants
                # Handle None/0 logic carefully
                old_applicants = job.applicants if job.applicants is not None else 0
                incoming_applicants = new_applicants if new_applicants is not None else 0

                if new_applicants is not None and old_applicants != incoming_applicants:
                    changes.append({
                        "field": "Applicants",
                        "old": old_applicants,
                        "new": incoming_applicants
                    })
                    job.applicants = incoming_applicants
                    should_save = True

                if should_save:
                    job.processed = False # Mark for re-indexing by AI if needed
                    db.commit()
                    status = "success"
                    success_count += 1
                    print(f"[DEBUG] 💾 Job {job.urn} updated.", flush=True)
                elif new_desc or new_applicants or new_status:
                    # Found data, but it matched DB (Success, but no update needed)
                    status = "success"
                    # print(f"[DEBUG] 🤷 Job {job.urn} is up to date.", flush=True)

                # 6. Build Payload
                payload = {
                    "current": processed,
                    "total": total,
                    "job_title": job.title,
                    "company": job.company.name if job.company else "Unknown",
                    "status": status,
                    "eta_seconds": round(eta_seconds),
                    "success_count": success_count,
                    "changes": changes # <--- Sending the Diff to frontend
                }

                yield f"data: {json.dumps(payload)}\n\n"

                # Gentle rate limit to avoid LinkedIn 429
                time.sleep(1.5)

            db.close()
            yield f"event: complete\ndata: {json.dumps({'message': 'Enrichment finished'})}\n\n"

        except Exception as e:
            traceback.print_exc()
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    @staticmethod
    def reconcile_failures() -> Dict[str, Any]:
        print("[Reconcile] Starting SQL Cross-Check...")
        session = get_db_session()
        updated_count = 0

        import re

        try:
            # 1. Fetch emails
            rejection_emails = session.query(Email).filter(
                or_(Email.folder == 'Job fails', Email.category == 'Rejection')
            ).all()

            # 2. Fetch active jobs
            active_jobs = session.query(Job).filter(
                or_(
                    Job.application_status.is_(None),
                    Job.application_status.notin_(['Refused', 'Rejected', 'Hired'])
                )
            ).all()

            for job in active_jobs:
                # SKIP JOBS WITHOUT COMPANY
                if not job.company or not job.company.name:
                    continue

                # 1. Normalize
                company_name_raw = job.company.name.lower().strip()
                company_slug = re.sub(r'[\W_]+', '', company_name_raw)

                if len(company_slug) < 3: continue

                # Debug specific company
                if "framework" in company_name_raw:
                    print(f"[DEBUG LOOP] Processing: {company_name_raw} (Slug: {company_slug})")

                match_found = False
                for email in rejection_emails:
                    sender = (email.sender or "").lower()
                    address = (email.sender_email or "").lower()
                    subject = (email.subject or "").lower()

                    content_blob = f"{sender} {address} {subject}"

                    if company_name_raw in content_blob or (len(company_slug) > 3 and company_slug in content_blob):
                        match_found = True
                        print(f"[Reconcile] ❌ MATCH FOUND! {job.company.name} -> Refused")
                        break

                if match_found:
                    job.application_status = "Refused"
                    updated_count += 1

            session.commit()
            return {"success": True, "updated_count": updated_count}

        except Exception as e:
            session.rollback()
            print(f"[Reconcile] Error: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}
        finally:
            session.close()