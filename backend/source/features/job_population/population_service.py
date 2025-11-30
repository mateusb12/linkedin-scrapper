import math
from typing import Dict, Any

from source.features.fetch_curl.fetch_service import FetchService
from repository.job_repository import JobRepository
from models import Company
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
        # 1. FETCH PAGINATION (Lightweight)
        print(f"--- Fetching Page {page_number} (List) ---")
        raw_data = FetchService.execute_fetch_page_raw(page_number)
        if not raw_data:
            return {"success": False, "message": "Network request failed"}

        # 2. PARSE SUMMARIES
        job_entries = parse_job_entries(raw_data)
        if not job_entries:
            return {"success": True, "count": 0, "total_found": 0, "message": "No jobs found"}

        repo = JobRepository()
        session = repo.session
        saved_count = 0

        # 3. IDENTIFY NEW JOBS
        new_jobs = []
        for job in job_entries:
            if not repo.get_by_urn(job['urn']):
                new_jobs.append(job)

        print(f"Found {len(new_jobs)} new jobs to enrich out of {len(job_entries)}.")

        # 4. BATCH ENRICHMENT (The Magic Step)
        if new_jobs:
            # Extract IDs for the batch call
            job_ids = [j['job_id'] for j in new_jobs]

            print(f"--- Batch Fetching Details for {len(job_ids)} jobs ---")
            enriched_results = EnrichmentService.fetch_batch_job_details(job_ids)

            # 5. MERGE & SAVE
            for job in new_jobs:
                jid = job['job_id']

                # If we got details for this ID, merge them in
                if jid in enriched_results:
                    job.update(enriched_results[jid])
                else:
                    print(f"⚠️ Warning: No details found for {jid} in batch response.")
                    job['description_full'] = "No description provided"
                    job['processed'] = False

                # Handle Company
                if job.get('company_urn'):
                    comp = session.query(Company).filter_by(urn=job['company_urn']).first()
                    if not comp:
                        session.add(Company(urn=job['company_urn'], name=job.get('company_name', 'Unknown')))
                        session.flush()

                repo.add_job_by_dict(job)
                saved_count += 1

        repo.commit()
        repo.close()

        return {
            "success": True,
            "count": saved_count,
            "total_found": len(job_entries)
        }