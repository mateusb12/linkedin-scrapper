import math
from typing import Dict, Any

from source.features.fetch_curl.fetch_service import FetchService
from source.features.job_population.job_repository import JobRepository
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