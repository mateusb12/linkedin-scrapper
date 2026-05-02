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
import re
from dataclasses import asdict
from typing import Dict, Any, List, Iterator

from source.features.get_applied_jobs.linkedin_http_proxy import LinkedInProxy
from source.features.get_applied_jobs.utils_proxy import JobPost
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
            job_id = re.sub(r"\D", "", str(base["job_id"]))
            enriched_job = self.proxy.batch_enricher.enrich_job(job_id)
            enriched.append(enriched_job)

        # 5. Convert to plain dicts and save
        jobs_dicts = [self._job_post_to_dict(jp) for jp in enriched]
        saved_info = self.repo.upsert_jobs(jobs_dicts, stage="applied")

        return {
            "status": "success",
            "synced_count": len(saved_info),
            "details": saved_info,
        }

    def sync_smart_stream(self) -> Iterator[Dict[str, Any]]:
        """
        Streaming smart sync with progress events for the frontend.

        The HTTP and enrichment work is still synchronous, but each stage emits
        enough state for the UI to show a meaningful progress bar.
        """
        yield {
            "type": "progress",
            "stage": "checking",
            "message": "Checking recently stored jobs",
            "processed": 0,
            "total": 1,
            "progress": 5,
        }

        existing_ids = self.repo.get_applied_urns(limit=50)

        yield {
            "type": "progress",
            "stage": "fetching",
            "message": "Fetching latest applied jobs from LinkedIn",
            "processed": 0,
            "total": 1,
            "progress": 15,
        }

        candidates = self.proxy.fetch_latest_applied_candidates(limit=15)
        new_candidates = [
            c for c in candidates
            if str(c["job_id"]) not in existing_ids
        ]

        yield {
            "type": "progress",
            "stage": "diffing",
            "message": f"Found {len(new_candidates)} new jobs from {len(candidates)} candidates",
            "processed": 0,
            "total": max(len(new_candidates), 1),
            "candidate_count": len(candidates),
            "new_count": len(new_candidates),
            "progress": 30,
        }

        if not new_candidates:
            yield {
                "type": "finished",
                "stage": "finished",
                "message": "Already up to date",
                "synced_count": 0,
                "details": [],
                "progress": 100,
            }
            return

        enriched: List[JobPost] = []
        total = len(new_candidates)

        for index, base in enumerate(new_candidates, start=1):
            job_id = re.sub(r"\D", "", str(base["job_id"]))
            yield {
                "type": "progress",
                "stage": "enriching",
                "message": f"Updating {base.get('company', 'Unknown')} - {base.get('title', 'Untitled job')}",
                "processed": index - 1,
                "total": total,
                "job_id": job_id,
                "company": base.get("company"),
                "title": base.get("title"),
                "progress": 30 + round(((index - 1) / total) * 55),
            }

            enriched_job = self.proxy.batch_enricher.enrich_job(job_id)
            enriched.append(enriched_job)

            yield {
                "type": "progress",
                "stage": "enriching",
                "message": f"Updated {base.get('company', 'Unknown')} - {base.get('title', 'Untitled job')}",
                "processed": index,
                "total": total,
                "job_id": job_id,
                "company": base.get("company"),
                "title": base.get("title"),
                "progress": 30 + round((index / total) * 55),
            }

        yield {
            "type": "progress",
            "stage": "saving",
            "message": "Saving updated job data",
            "processed": total,
            "total": total,
            "progress": 92,
        }

        jobs_dicts = [self._job_post_to_dict(jp) for jp in enriched]
        saved_info = self.repo.upsert_jobs(jobs_dicts, stage="applied")

        yield {
            "type": "finished",
            "stage": "finished",
            "message": f"Smart sync inserted {len(saved_info)} applied jobs",
            "synced_count": len(saved_info),
            "details": saved_info,
            "progress": 100,
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
