import json
import math
import time
from typing import Dict, Any, Generator

from database.database_connection import get_db_session
from source.features.fetch_curl.fetch_service import FetchService
from source.features.get_applied_jobs.linkedin_fetch_call_repository import get_linkedin_fetch_artefacts
from source.features.job_population.job_repository import JobRepository
from models import Company, Job
from source.features.job_population.linkedin_parser import parse_job_entries
from source.features.job_population.enrichment_service import EnrichmentService

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

        import json
        import os
        debug_file = "debug_linkedin_response.json"
        print(f"   [DEBUG] Saving raw response to {debug_file}...")
        with open(debug_file, 'w', encoding='utf-8') as f:
            json.dump(raw_data, f, indent=2, ensure_ascii=False)

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

        print(f"[Population] Step 3: Identified {len(new_jobs)} NEW jobs (out of {len(job_entries)}).")

        # 4. BATCH ENRICHMENT (The Magic Step)
        if new_jobs:
            # Extract IDs for the batch call
            job_ids = [j['job_id'] for j in new_jobs]

            print(f"[Population] Step 4: Batch Enriching {len(job_ids)} IDs...")
            # print(f"             IDs: {job_ids}") # Uncomment if you want to see exact IDs

            enriched_results = EnrichmentService.fetch_batch_job_details(job_ids)
            print(f"[Population] ✅ Batch returned data for {len(enriched_results)} jobs.")

            # 5. MERGE & SAVE
            for job in new_jobs:
                job_id = job['job_id']

                # --- Enrichment Merge ---
                if job_id in enriched_results:
                    details = enriched_results[job_id]
                    job.update(details)

                    # Debug Data Quality
                    desc_len = len(details.get('description_full', ''))
                    has_logo = 'Yes' if details.get('company_logo') else 'No'
                    print(f"   > [Merged] Job {job_id} | Desc Length: {desc_len} chars | Logo: {has_logo} | Company: {details.get('company_name')}")
                else:
                    print(f"   > [⚠️ Missing] No batch details for Job {job_id}. Marking unprocessed.")
                    job['description_full'] = "No description provided"
                    job['processed'] = False

                # --- Company Handling ---
                c_urn = job.get('company_urn')
                if c_urn:
                    # Check if company exists
                    comp = session.query(Company).filter_by(urn=c_urn).first()

                    c_name = job.get('company_name', 'Unknown')
                    c_logo = job.get('company_logo') # Extracted from enrichment

                    if not comp:
                        # Create new company with logo
                        print(f"     -> Creating NEW Company: {c_name} ({c_urn})")
                        new_comp = Company(
                            urn=c_urn,
                            name=c_name,
                            logo_url=c_logo
                        )
                        session.add(new_comp)
                        session.flush() # Flush to ensure ID exists for foreign key
                    else:
                        # Optional: Update logo if we didn't have it before
                        if c_logo and not comp.logo_url:
                            print(f"     -> Updating Logo for Existing Company: {c_name}")
                            comp.logo_url = c_logo
                            session.add(comp) # Mark for update
                        # else:
                        #     print(f"     -> Company {c_name} exists and has logo. Skipping update.")

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
        db = get_db_session()

        # 1. Setup Session
        session_artefacts = get_linkedin_fetch_artefacts()
        if not session_artefacts:
            yield f"event: error\ndata: {json.dumps({'error': 'Could not load LinkedIn session. Update cookies.'})}\n\n"
            return

        requests_session, _ = session_artefacts

        # 2. Get Targets
        target_jobs = db.query(Job).filter(
            Job.description_full == "No description provided"
        ).order_by(Job.posted_on.desc()).all()

        total = len(target_jobs)
        if total == 0:
            yield f"event: complete\ndata: {json.dumps({'message': 'No jobs to backfill.'})}\n\n"
            return

        start_time = time.time()
        processed = 0
        success_count = 0

        # 3. Iterate and Stream
        for job in target_jobs:
            processed += 1

            # --- Metrics Calculation ---
            elapsed = time.time() - start_time
            avg_time = elapsed / processed
            remaining_jobs = total - processed
            eta_seconds = remaining_jobs * avg_time

            # 4. Fetch
            description = EnrichmentService.fetch_single_job_description(requests_session, job.urn)
            status = "failed"

            if description:
                job.description_full = description
                # Reset processed flag so AI keyword extraction runs again later
                job.processed = False
                db.commit()
                status = "success"
                success_count += 1

            # 5. Build Payload
            payload = {
                "current": processed,
                "total": total,
                "job_title": job.title,
                "company": job.company.name if job.company else "Unknown",
                "status": status,
                "eta_seconds": round(eta_seconds),
                "success_count": success_count
            }

            # 6. Yield Event
            yield f"data: {json.dumps(payload)}\n\n"

            # 7. Safety Sleep (Essential)
            time.sleep(2.0)

        db.close()
        yield f"event: complete\ndata: {json.dumps({'message': 'Backfill finished'})}\n\n"