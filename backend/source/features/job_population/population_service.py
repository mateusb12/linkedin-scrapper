import math
from typing import Dict, Any

from source.features.fetch_curl.fetch_service import FetchService
from repository.job_repository import JobRepository
from models import Company
from source.features.job_population.enrichment_service import EnrichmentService
from source.features.job_population.linkedin_parser import parse_job_entries

class PopulationService:

    @staticmethod
    def get_total_pages() -> int:
        data = FetchService.execute_fetch_page_raw(page_number=1)
        if not data: return 0
        try:
            # Safe extraction
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
        # 1. FETCH
        raw_data = FetchService.execute_fetch_page_raw(page_number)
        if not raw_data:
            return {"success": False, "message": "Network request failed"}

        # 2. PARSE
        job_entries = parse_job_entries(raw_data)
        if not job_entries:
            return {"success": True, "count": 0, "total_found": 0, "message": "No jobs found"}

        # 3. SAVE & CHECK DUPLICATES
        repo = JobRepository()
        session = repo.session  # <--- Important: Use Repo's session

        saved_count = 0
        try:
            for job_data in job_entries:
                # This is the "Is it already inside DB?" check
                existing = repo.get_by_urn(job_data['urn'])

                if not existing:
                    # It's new! Add it.
                    job_id = job_data.get('job_id')
                    print(f"   > Enriching Job ID: {job_id}...", end=" ")
                    enriched_data = EnrichmentService.fetch_job_details(job_id)
                    if enriched_data:
                        print("Success.")
                        # Merge enriched fields into job_data
                        job_data.update(enriched_data)
                    else:
                        print("Failed (saving basic data).")
                        job_data['description_full'] = "No description provided"
                        job_data['processed'] = False

                    if job_data.get('company_urn'):
                        comp = session.query(Company).filter_by(urn=job_data['company_urn']).first()
                        if not comp:
                            session.add(Company(urn=job_data['company_urn'], name="Unknown"))
                            session.flush()

                    repo.add_job_by_dict(job_data)
                    saved_count += 1
                # If existing: We do nothing (Skip)

            repo.commit()

            # The frontend uses 'count' (saved) vs 'total_found' to determine if it was a skip
            return {
                "success": True,
                "count": saved_count,
                "total_found": len(job_entries)
            }

        except Exception as e:
            repo.rollback()
            return {"success": False, "error": str(e)}
        finally:
            repo.close()