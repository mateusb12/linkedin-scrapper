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
        existing_ids = self.repo.get_applied_urns(limit=None)

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
        saved_info = self.repo.upsert_jobs(
            jobs_dicts,
            stage="applied",
            update_existing=False,
        )
        inserted_info = [
            item for item in saved_info
            if item.get("status") != "skipped_existing"
        ]

        return {
            "status": "success",
            "synced_count": len(inserted_info),
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

        existing_ids = self.repo.get_applied_urns(limit=None)

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
                "message": f"Appending {base.get('company', 'Unknown')} - {base.get('title', 'Untitled job')}",
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
                "message": f"Appended {base.get('company', 'Unknown')} - {base.get('title', 'Untitled job')}",
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
            "message": "Saving new applied jobs",
            "processed": total,
            "total": total,
            "progress": 92,
        }

        jobs_dicts = [self._job_post_to_dict(jp) for jp in enriched]
        saved_info = self.repo.upsert_jobs(
            jobs_dicts,
            stage="applied",
            update_existing=False,
        )
        inserted_info = [
            item for item in saved_info
            if item.get("status") != "skipped_existing"
        ]

        yield {
            "type": "finished",
            "stage": "finished",
            "message": f"Smart sync inserted {len(inserted_info)} applied jobs",
            "synced_count": len(inserted_info),
            "details": saved_info,
            "progress": 100,
        }

    def sync_selected_applied_jobs(self, job_ids: List[str]) -> Dict[str, Any]:
        """
        FullSync: refresh existing applied jobs selected by the user.
        """
        cleaned_ids = self._clean_existing_applied_ids(job_ids)

        if not cleaned_ids:
            return {
                "status": "success",
                "synced_count": 0,
                "details": [],
            }

        enriched = [
            self.proxy.batch_enricher.enrich_job(job_id)
            for job_id in cleaned_ids
        ]
        jobs_dicts = [self._job_post_to_dict(jp) for jp in enriched]
        saved_info = self.repo.upsert_jobs(
            jobs_dicts,
            stage="applied",
            update_existing=True,
        )

        return {
            "status": "success",
            "synced_count": len(saved_info),
            "details": saved_info,
        }

    def sync_selected_applied_jobs_stream(self, job_ids: List[str]) -> Iterator[Dict[str, Any]]:
        """
        FullSync stream: refresh selected existing applied jobs and emit a diff report.
        """
        cleaned_ids = self._clean_existing_applied_ids(job_ids)
        total = len(cleaned_ids)
        report = {
            "updated": [],
            "unchanged": [],
            "failed": [],
            "skipped": [],
        }

        yield {
            "type": "progress",
            "stage": "starting",
            "message": f"Preparing {total} selected jobs",
            "processed": 0,
            "total": max(total, 1),
            "progress": 3,
        }

        if not cleaned_ids:
            yield {
                "type": "finished",
                "stage": "finished",
                "message": "No existing applied jobs selected",
                "synced_count": 0,
                "report": report,
                "progress": 100,
            }
            return

        before_by_id = self.repo.get_applied_jobs_by_ids(cleaned_ids)

        for index, job_id in enumerate(cleaned_ids, start=1):
            before = before_by_id.get(job_id)

            if before is None:
                report["skipped"].append({
                    "job_id": job_id,
                    "reason": "not_applied_or_not_found",
                })
                continue

            title = before.get("title") or f"Job {job_id}"
            company = self._company_name_from_job(before)

            yield {
                "type": "progress",
                "stage": "enriching",
                "message": f"Refreshing {company} - {title}",
                "processed": index - 1,
                "total": total,
                "job_id": job_id,
                "title": title,
                "company": company,
                "progress": 5 + round(((index - 1) / total) * 85),
            }

            try:
                enriched_job = self.proxy.batch_enricher.enrich_job(job_id)
                enriched_dict = self._job_post_to_dict(enriched_job)
                self.repo.upsert_jobs([enriched_dict], stage="applied", update_existing=True)

                row_report = self._build_full_sync_row_report(
                    job_id=job_id,
                    before=before,
                    after=enriched_dict,
                )
                target_bucket = "updated" if row_report["changes"] else "unchanged"
                report[target_bucket].append(row_report)

                yield {
                    "type": "progress",
                    "stage": "updated" if row_report["changes"] else "unchanged",
                    "message": self._format_full_sync_message(row_report),
                    "processed": index,
                    "total": total,
                    "job_id": job_id,
                    "title": row_report["title"],
                    "company": row_report["company"],
                    "row": row_report,
                    "progress": 5 + round((index / total) * 85),
                }
            except Exception as exc:
                failed_row = {
                    "job_id": job_id,
                    "title": title,
                    "company": company,
                    "error": str(exc),
                }
                report["failed"].append(failed_row)

                yield {
                    "type": "progress",
                    "stage": "failed",
                    "message": f"Failed {company} - {title}",
                    "processed": index,
                    "total": total,
                    "job_id": job_id,
                    "title": title,
                    "company": company,
                    "row": failed_row,
                    "progress": 5 + round((index / total) * 85),
                }

        synced_count = len(report["updated"]) + len(report["unchanged"])

        yield {
            "type": "finished",
            "stage": "finished",
            "message": f"Full sync checked {synced_count} jobs",
            "synced_count": synced_count,
            "report": report,
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

    def _clean_existing_applied_ids(self, job_ids: List[str]) -> List[str]:
        cleaned_ids = []
        seen_ids = set()
        existing_ids = self.repo.get_applied_urns(limit=None)

        for raw_id in job_ids:
            job_id = re.sub(r"\D", "", str(raw_id))
            if not job_id or job_id in seen_ids or job_id not in existing_ids:
                continue
            seen_ids.add(job_id)
            cleaned_ids.append(job_id)

        return cleaned_ids

    @staticmethod
    def _company_name_from_job(job: Dict[str, Any]) -> str:
        company = job.get("company")
        if isinstance(company, dict):
            return company.get("name") or "Unknown"
        if isinstance(company, str):
            return company
        return "Unknown"

    @staticmethod
    def _get_after_value(after: Dict[str, Any], *keys: str):
        for key in keys:
            if key in after:
                return after.get(key)
        return None

    def _build_full_sync_row_report(
        self,
        *,
        job_id: str,
        before: Dict[str, Any],
        after: Dict[str, Any],
    ) -> Dict[str, Any]:
        title = after.get("title") or before.get("title") or f"Job {job_id}"
        company = after.get("company") or self._company_name_from_job(before)
        checks = [
            ("applicants", before.get("applicants"), self._get_after_value(after, "applicants", "applicants_total")),
            ("job_state", before.get("job_state"), after.get("job_state")),
            ("application_closed", before.get("application_closed"), after.get("application_closed")),
            ("expire_at", before.get("expire_at"), after.get("expire_at")),
        ]

        changes = {}
        unchanged = {}

        for key, old_value, new_value in checks:
            if new_value is None:
                unchanged[key] = {
                    "from": old_value,
                    "to": old_value,
                }
                continue

            if old_value != new_value:
                changes[key] = {
                    "from": old_value,
                    "to": new_value,
                }
            else:
                unchanged[key] = {
                    "from": old_value,
                    "to": new_value,
                }

        return {
            "job_id": job_id,
            "title": title,
            "company": company,
            "changes": changes,
            "unchanged": unchanged,
        }

    @staticmethod
    def _format_full_sync_message(row_report: Dict[str, Any]) -> str:
        applicants_change = row_report.get("changes", {}).get("applicants")
        prefix = f"{row_report.get('company')} - {row_report.get('title')}"

        if applicants_change:
            return f"{prefix}: applicants {applicants_change.get('from')} -> {applicants_change.get('to')}"

        applicants_unchanged = row_report.get("unchanged", {}).get("applicants")
        if applicants_unchanged:
            return f"{prefix}: applicants unchanged at {applicants_unchanged.get('to')}"

        return f"{prefix}: checked"
