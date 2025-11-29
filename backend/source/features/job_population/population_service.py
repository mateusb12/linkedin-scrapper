import math
from typing import Dict, Any

# Import from the existing fetch feature (The Provider)
from source.features.fetch_curl.fetch_service import FetchService
from repository.job_repository import JobRepository
from models import Company
from database.database_connection import get_db_session
from source.features.job_population.linkedin_parser import parse_job_entries


class PopulationService:

    @staticmethod
    def get_total_pages() -> int:
        """
        Executes page 1 fetch to read the 'total' metadata.
        """
        # We reuse the existing logic in FetchService to get the raw JSON
        # Note: We need to ensure FetchService exposes a method that returns dict
        # or we use execute_fetch_page and assume it returns the structure we need.
        data = FetchService.execute_fetch_page(page_number=1)

        if not data:
            return 0

        # If FetchService returns a processed object (JobsPage), we might need to
        # adjust FetchService to return raw dict, OR access the raw structure if available.
        # Assuming we modify FetchService slightly to return dict, or we parse what we get.

        # Ideally, we call a 'raw' method. See modification below.
        paging = data.get('paging', {})
        total = paging.get('total', 0)
        count = paging.get('count', 25)

        if count == 0: return 0
        return math.ceil(total / count)

    @staticmethod
    def fetch_and_save_page(page_number: int) -> Dict[str, Any]:
        """
        Orchestrates the pipeline: Fetch -> Parse -> Save
        """
        # 1. FETCH (Using Fetch Feature)
        raw_data = FetchService.execute_fetch_page_raw(page_number) # We will add this method
        if not raw_data:
            return {"success": False, "message": "Network request failed"}

        # 2. PARSE (Using Local Parser)
        job_entries = parse_job_entries(raw_data)
        if not job_entries:
            return {"success": True, "count": 0, "message": "No jobs on this page"}

        # 3. SAVE (Using Repository)
        repo = JobRepository()
        session = get_db_session() # Or use repo's session

        saved_count = 0
        try:
            for job_data in job_entries:
                # Basic check to avoid overwriting existing full details
                existing = repo.get_by_urn(job_data['urn'])
                if not existing:
                    # Create Company stub if missing (optional, based on your logic)
                    if job_data.get('company_urn'):
                        comp = session.query(Company).filter_by(urn=job_data['company_urn']).first()
                        if not comp:
                            session.add(Company(urn=job_data['company_urn'], name="Unknown"))

                    # Add Job
                    repo.add_job_by_dict(job_data)
                    saved_count += 1

            repo.commit()
            return {"success": True, "count": saved_count, "total_found": len(job_entries)}

        except Exception as e:
            repo.rollback()
            return {"success": False, "error": str(e)}
        finally:
            repo.close()
            session.close()