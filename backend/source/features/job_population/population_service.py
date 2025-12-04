import math
import time
import json
import traceback
from datetime import datetime
from typing import Dict, Any, Generator

from sqlalchemy import or_

from source.features.fetch_curl.fetch_service import FetchService
from source.features.job_population.job_repository import JobRepository
from models import Company, Job
from source.features.job_population.linkedin_parser import parse_job_entries
from source.features.job_population.enrichment_service import EnrichmentService
from source.features.get_applied_jobs.linkedin_fetch_call_repository import get_linkedin_fetch_artefacts
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
    def stream_description_backfill() -> Generator[str, None, None]:
        """
        Generator that processes missing descriptions one by one and yields
        SSE-compatible JSON events for the frontend.
        """
        print("[DEBUG] 🟢 Starting stream_description_backfill generator...", flush=True)

        try:
            db = get_db_session()
            print("[DEBUG] Database session created.", flush=True)

            # 1. Setup Session
            print("[DEBUG] Loading LinkedIn configuration...", flush=True)
            session_artefacts = get_linkedin_fetch_artefacts()

            if not session_artefacts:
                print("[DEBUG] ❌ Failed to load LinkedIn configuration.", flush=True)
                yield f"event: error\ndata: {json.dumps({'error': 'Could not load LinkedIn session. Update cookies.'})}\n\n"
                return

            requests_session, _ = session_artefacts
            print("[DEBUG] LinkedIn session loaded successfully.", flush=True)

            # 2. Get Targets
            print("[DEBUG] Querying database for jobs with missing descriptions...", flush=True)
            target_jobs = db.query(Job).filter(
                or_(
                    Job.description_full == "No description provided",
                    Job.applicants == 0,    # If default is 0
                    Job.applicants.is_(None) # If null
                )
            ).order_by(Job.posted_on.desc()).all()

            total = len(target_jobs)
            print(f"[DEBUG] Found {total} jobs to backfill.", flush=True)

            if total == 0:
                print("[DEBUG] No jobs found. Sending complete event.", flush=True)
                yield f"event: complete\ndata: {json.dumps({'message': 'No jobs to backfill.'})}\n\n"
                return

            start_time = time.time()
            processed = 0
            success_count = 0

            # 3. Iterate and Stream
            for job in target_jobs:
                processed += 1
                print(f"[DEBUG] Processing {processed}/{total}: URN={job.urn} Title='{job.title}'", flush=True)

                # Metrics
                elapsed = time.time() - start_time
                avg_time = elapsed / processed
                remaining_jobs = total - processed
                eta_seconds = remaining_jobs * avg_time

                # 4. Fetch
                # Use the new enrichment method (returns Dict)
                print(f"[DEBUG] Fetching enrichment data for {job.urn}...", flush=True)
                try:
                    enrichment_data = EnrichmentService.fetch_single_job_details_enrichment(requests_session, job.urn)
                except Exception as e:
                    print(f"[DEBUG] ❌ Error calling EnrichmentService: {e}", flush=True)
                    traceback.print_exc()
                    enrichment_data = {}

                description = enrichment_data.get("description")
                applicants = enrichment_data.get("applicants")

                status = "failed"
                should_save = False

                if description:
                    # Update description if it was missing or different
                    if job.description_full != description:
                        job.description_full = description
                        should_save = True

                    # Update applicants if found
                    if applicants is not None and job.applicants != applicants:
                        job.applicants = applicants
                        print(f"[DEBUG] ✅ Updating Applicants: {job.applicants} -> {applicants}", flush=True)
                        should_save = True

                    if should_save:
                        job.processed = False
                        db.commit()
                        status = "success"
                        success_count += 1
                        print(f"[DEBUG] 💾 Job saved.", flush=True)
                    else:
                        # Even if we didn't save (data matched), we count it as a "success" for the UI
                        status = "success"
                        print(f"[DEBUG] 🤷 No changes needed.", flush=True)

                else:
                    print(f"[DEBUG] ⚠️ No description returned.", flush=True)

                # 5. Build Payload
                payload = {
                    "current": processed,
                    "total": total,
                    "job_title": job.title,
                    "company": job.company.name if job.company else "Unknown",
                    "status": status,
                    "eta_seconds": round(eta_seconds),
                    "success_count": success_count,
                    "applicants_found": applicants
                }

                # 6. Yield Event
                print(f"[DEBUG] Yielding event for {job.title}...", flush=True)
                yield f"data: {json.dumps(payload)}\n\n"

                # 7. Safety Sleep
                print("[DEBUG] Sleeping for 2.0s...", flush=True)
                time.sleep(2.0)

            db.close()
            print("[DEBUG] 🏁 Stream finished. Closing DB session.", flush=True)
            yield f"event: complete\ndata: {json.dumps({'message': 'Backfill finished'})}\n\n"

        except Exception as e:
            print(f"[DEBUG] 💥 CRITICAL ERROR in stream: {e}", flush=True)
            traceback.print_exc()
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"