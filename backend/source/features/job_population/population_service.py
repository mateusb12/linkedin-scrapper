import math
from typing import Dict, Any

from source.features.fetch_curl.fetch_service import FetchService
from repository.job_repository import JobRepository
from models import Company
from source.features.job_population.linkedin_parser import parse_job_entries

class PopulationService:

    @staticmethod
    def get_total_pages() -> int:
        """
        Executes page 1 fetch to read the 'total' metadata.
        """
        # Use execute_fetch_page_raw which we confirmed exists
        data = FetchService.execute_fetch_page_raw(page_number=1)

        if not data:
            return 0

        # Safe parsing of paging info
        try:
            # We assume the structure is:
            # data -> data -> jobsDashJobCardsByJobCollections -> paging -> total/count
            inner_data = (data.get('data') or {}).get('data') or {}
            collections = inner_data.get('jobsDashJobCardsByJobCollections') or {}
            paging = collections.get('paging') or {}

            total = paging.get('total', 0)
            count = paging.get('count', 25)

            if count == 0: return 0
            return math.ceil(total / count)
        except Exception as e:
            print(f"Error parsing total pages: {e}")
            return 0

    @staticmethod
    def fetch_and_save_page(page_number: int) -> Dict[str, Any]:
        """
        Orchestrates the pipeline: Fetch -> Parse -> Save
        """
        # 1. FETCH
        raw_data = FetchService.execute_fetch_page_raw(page_number)
        if not raw_data:
            return {"success": False, "message": "Network request failed"}

        # 2. PARSE
        job_entries = parse_job_entries(raw_data)
        if not job_entries:
            return {"success": True, "count": 0, "message": "No jobs on this page"}

        # 3. SAVE
        repo = JobRepository()
        session = repo.session  # <--- CRITICAL FIX: Use the repository's session

        saved_count = 0
        try:
            for job_data in job_entries:
                existing = repo.get_by_urn(job_data['urn'])
                if not existing:
                    # Check/Create Company using the SAME session
                    if job_data.get('company_urn'):
                        comp = session.query(Company).filter_by(urn=job_data['company_urn']).first()
                        if not comp:
                            session.add(Company(urn=job_data['company_urn'], name="Unknown"))
                            session.flush() # Make available for foreign key check

                    # Add Job (repo uses self.session, which is 'session' here)
                    repo.add_job_by_dict(job_data)
                    saved_count += 1

            repo.commit()
            return {"success": True, "count": saved_count, "total_found": len(job_entries)}

        except Exception as e:
            repo.rollback()
            print(f"Database error on page {page_number}: {e}")
            return {"success": False, "error": str(e)}
        finally:
            repo.close()