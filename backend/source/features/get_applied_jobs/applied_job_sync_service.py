"""
job_sync_service.py — Orchestration layer.

Responsibilities:
    - Coordinate LinkedInProxy (HTTP) and JobRepository (SQL)
    - Implement sync strategies (incremental, smart, backfill)

Rules:
    - This is the ONLY module that imports both linkedin_proxy and job_repository
    - Contains no raw SQL and no raw HTTP calls
    - Pure coordination logic
"""

from dataclasses import asdict
from typing import Dict, Any, List

from source.features.get_applied_jobs.linkedin_proxy import LinkedInProxy, JobPost
from source.features.jobs.job_repository import JobRepository


class JobSyncService:
    """Coordinates LinkedIn fetching with database persistence."""

    def __init__(self, debug: bool = False, slim_mode: bool = True):
        self.proxy = LinkedInProxy(debug=debug, slim_mode=slim_mode)
        self.repo = JobRepository()

    def sync_smart(self) -> Dict[str, Any]:
        """
        Smart sync: fetch latest from LinkedIn, diff against DB,
        enrich only new jobs, save them.
        """
        # 1. Get existing IDs from DB
        existing_ids = self.repo.get_applied_urns(limit=50)

        # 2. Get light listing from LinkedIn
        candidates = self.proxy.fetch_latest_applied_candidates(limit=15)

        # 3. Filter to truly new jobs
        new_candidates = [
            c for c in candidates
            if str(c["job_id"]) not in existing_ids
        ]

        print(f"🔎 Smart Sync: {len(candidates)} received, {len(new_candidates)} are new.")

        if not new_candidates:
            return {
                "status": "success",
                "message": "Already up to date",
                "synced_count": 0,
                "details": [],
            }

        # 4. Enrich new jobs via LinkedIn
        enriched: List[JobPost] = []
        for base in new_candidates:
            enriched.append(self.proxy.enrich_single_job(base))

        # 5. Convert to plain dicts and save
        jobs_dicts = [self._job_post_to_dict(jp) for jp in enriched]
        saved_info = self.repo.upsert_jobs(jobs_dicts, stage="applied")

        return {
            "status": "success",
            "synced_count": len(saved_info),
            "details": saved_info,
        }

    def sync_full_listing(self, stage: str = "applied") -> Dict[str, Any]:
        """
        Full sync: fetch entire listing with enrichment, save all.
        """
        response = self.proxy.fetch_jobs_listing(stage=stage)

        jobs_dicts = [self._job_post_to_dict(jp) for jp in response.jobs]
        saved_info = self.repo.upsert_jobs(jobs_dicts, stage=stage)

        return {
            "status": "success",
            "synced_count": len(saved_info),
            "details": saved_info,
        }

    @staticmethod
    def _job_post_to_dict(jp: JobPost) -> dict:
        """Convert a JobPost dataclass to a plain dict for the repository."""
        return asdict(jp)
