"""
job_repository.py — Pure SQL/ORM layer.

Responsibilities:
    - Read/write Job and Company records
    - Query filters, ordering, pagination

Rules:
    - ZERO imports from linkedin_proxy or any HTTP logic
    - ZERO knowledge of LinkedIn API formats
    - Accepts plain dicts/dataclasses, returns ORM objects or plain dicts
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from database.database_connection import get_db_session
from models.job_models import Job, Company


class JobRepository:
    """Pure database operations for jobs and companies."""

    # ──────────────────────────────────────────
    # Read operations
    # ──────────────────────────────────────────

    @staticmethod
    def get_applied_jobs() -> List[dict]:
        """Return all applied jobs ordered by applied_on desc."""
        db = get_db_session()
        try:
            jobs = (
                db.query(Job)
                .filter(Job.has_applied == True)
                .order_by(Job.applied_on.desc())
                .all()
            )
            return [job.to_dict() for job in jobs]
        finally:
            db.close()

    @staticmethod
    def get_applied_urns(limit: int = 50) -> Set[str]:
        """Return a set of URNs (cleaned) for recently applied jobs."""
        db = get_db_session()
        try:
            rows = (
                db.query(Job.urn)
                .filter(Job.has_applied == True)
                .order_by(Job.applied_on.desc())
                .limit(limit)
                .all()
            )
            return {
                str(r.urn).replace("urn:li:jobPosting:", "")
                for r in rows
            }
        finally:
            db.close()

    # ──────────────────────────────────────────
    # Write operations
    # ──────────────────────────────────────────

    @staticmethod
    def upsert_jobs(jobs_data: List[Dict[str, Any]], stage: str) -> List[dict]:
        """
        Insert or update jobs from a list of plain dicts.

        Expected dict keys (all optional except job_id):
            job_id, title, company, location, description_full,
            applicants, premium_description, job_url, job_state,
            expire_at, application_closed, work_remote_allowed,
            applied_at, posted_at

        Returns a list of {id, company, title, status} for each job processed.
        """
        db = get_db_session()
        saved_details = []

        try:
            for j in jobs_data:
                job_id = str(j.get("job_id", ""))
                if not job_id:
                    continue

                # 1. Ensure company exists
                c_name = j.get("company") or "Unknown"
                comp = db.query(Company).filter(Company.name == c_name).first()
                if not comp:
                    comp = Company(
                        urn=f"urn:li:company:{uuid.uuid4()}",
                        name=c_name,
                    )
                    db.add(comp)
                    db.flush()

                # 2. Upsert job
                job = db.query(Job).filter(Job.urn == job_id).first()
                if not job:
                    job = Job(urn=job_id)
                    db.add(job)

                # 3. Update fields
                job.title = j.get("title")
                job.posted_on = j.get("posted_at")
                job.company_urn = comp.urn
                job.location = j.get("location")
                job.description_full = j.get("description_full")
                job.applicants = j.get("applicants")
                job.premium_description = j.get("premium_description")
                job.job_url = j.get("job_url")
                job.job_state = j.get("job_state")
                job.expire_at = j.get("expire_at")
                job.application_closed = j.get("application_closed")
                job.work_remote_allowed = j.get("work_remote_allowed")

                # 4. Stage-specific flags
                if stage == "applied":
                    job.has_applied = True
                    job.applied_on = j.get("applied_at") or None

                saved_details.append({
                    "id": job_id,
                    "company": c_name,
                    "title": j.get("title"),
                    "status": "saved",
                })

            db.commit()
            return saved_details

        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
