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
from typing import Any, Dict, List, Set

from sqlalchemy.orm import joinedload

from database.database_connection import get_db_session
from models.job_models import Job, Company
from models.email_models import Email


class JobRepository:
    """Pure database operations for jobs and companies."""

    # ──────────────────────────────────────────
    # Read operations
    # ──────────────────────────────────────────

    @staticmethod
    def _parse_datetime(value):
        if value is None:
            return None

        if isinstance(value, datetime):
            return value

        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return None

            # suporta ISO com Z ou +00:00
            raw = raw.replace("Z", "+00:00")
            return datetime.fromisoformat(raw)

        raise TypeError(
            f"Invalid datetime value for DB: {value!r} ({type(value).__name__})"
        )

    @staticmethod
    def get_applied_jobs() -> List[dict]:
        """
        Return all applied jobs ordered by applied_on desc.

        Each job will include:
            - company
            - emails (max 5 newest)
            - last_email
        """

        db = get_db_session()

        try:
            jobs = (
                db.query(Job)
                .options(joinedload(Job.company))
                .filter(Job.has_applied == True)
                .order_by(Job.applied_on.desc())
                .all()
            )

            job_urns = [j.urn for j in jobs]

            # Load emails for all jobs in ONE query
            emails = (
                db.query(Email)
                .filter(Email.job_urn.in_(job_urns))
                .order_by(Email.received_at.desc())
                .all()
            )

            # Group emails by job
            emails_by_job = {}

            for email in emails:
                emails_by_job.setdefault(email.job_urn, []).append(email)

            result = []

            for job in jobs:
                job_dict = job.to_dict()

                job_emails = emails_by_job.get(job.urn, [])

                job_dict["emails"] = [
                    e.to_dict()
                    for e in job_emails[:5]
                ]

                job_dict["last_email"] = (
                    job_emails[0].to_dict()
                    if job_emails
                    else None
                )

                result.append(job_dict)

            return result

        finally:
            db.close()

    @staticmethod
    def get_applied_urns(limit: int | None = 50) -> Set[str]:
        """Return a set of applied job URNs cleaned to their numeric LinkedIn IDs."""

        db = get_db_session()

        try:
            query = (
                db.query(Job.urn)
                .filter(Job.has_applied == True)
                .order_by(Job.applied_on.desc())
            )

            if limit is not None:
                query = query.limit(limit)

            rows = query.all()

            return {
                str(r.urn)
                .replace("urn:li:jobPosting:", "")
                .replace("urn:li:fs_jobPosting:", "")
                for r in rows
            }

        finally:
            db.close()

    @staticmethod
    def get_applied_jobs_by_ids(job_ids: List[str]) -> Dict[str, dict]:
        """Return applied jobs keyed by cleaned numeric LinkedIn job ID."""

        cleaned_ids = {
            str(job_id)
            .replace("urn:li:jobPosting:", "")
            .replace("urn:li:fs_jobPosting:", "")
            for job_id in job_ids
        }

        if not cleaned_ids:
            return {}

        lookup_ids = set(cleaned_ids)
        for job_id in cleaned_ids:
            lookup_ids.add(f"urn:li:jobPosting:{job_id}")
            lookup_ids.add(f"urn:li:fs_jobPosting:{job_id}")

        db = get_db_session()

        try:
            rows = (
                db.query(Job)
                .options(joinedload(Job.company))
                .filter(Job.has_applied == True)
                .filter(Job.urn.in_(lookup_ids))
                .all()
            )

            return {
                str(job.urn)
                .replace("urn:li:jobPosting:", "")
                .replace("urn:li:fs_jobPosting:", ""): job.to_dict()
                for job in rows
            }

        finally:
            db.close()

    @staticmethod
    def get_jobs_for_scoring(
        *,
        has_applied: bool | None = None,
        work_remote_allowed: bool | None = None,
        company_urn: str | None = None,
        application_status: str | None = None,
        limit: int | None = None,
    ) -> List[Job]:
        db = get_db_session()

        try:
            query = (
                db.query(Job)
                .filter(Job.disabled.is_(False))
                .order_by(Job.updated_at.desc(), Job.created_at.desc(), Job.urn.desc())
            )

            if has_applied is not None:
                query = query.filter(Job.has_applied.is_(has_applied))
            if work_remote_allowed is not None:
                query = query.filter(Job.work_remote_allowed.is_(work_remote_allowed))
            if company_urn:
                query = query.filter(Job.company_urn == company_urn)
            if application_status:
                query = query.filter(Job.application_status == application_status)
            if limit is not None:
                query = query.limit(limit)

            return query.all()
        finally:
            db.close()

    # ──────────────────────────────────────────
    # Write operations
    # ──────────────────────────────────────────

    @staticmethod
    def upsert_jobs(
        jobs_data: List[Dict[str, Any]],
        stage: str,
        *,
        update_existing: bool = True,
    ) -> List[dict]:
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

                # ─────────────────────────
                # Ensure company exists
                # ─────────────────────────

                c_name = j.get("company") or "Unknown"

                comp = (
                    db.query(Company)
                    .filter(Company.name == c_name)
                    .first()
                )

                if not comp:
                    comp = Company(
                        urn=f"urn:li:company:{uuid.uuid4()}",
                        name=c_name,
                    )

                    db.add(comp)
                    db.flush()

                # ─────────────────────────
                # Upsert job
                # ─────────────────────────

                job = (
                    db.query(Job)
                    .filter(Job.urn == job_id)
                    .first()
                )

                if job and not update_existing:
                    saved_details.append(
                        {
                            "id": job_id,
                            "company": c_name,
                            "title": job.title,
                            "status": "skipped_existing",
                        }
                    )
                    continue

                if not job:
                    job = Job(urn=job_id)
                    db.add(job)

                # ─────────────────────────
                # Update fields
                # ─────────────────────────

                job.title = j.get("title")
                job.posted_on = j.get("posted_at")
                job.company_urn = comp.urn
                job.location = j.get("location")
                job.description_full = j.get("description_full")
                job.applicants = j.get("applicants")
                job.premium_description = j.get("premium_description")
                job.job_url = j.get("job_url")
                job.job_state = j.get("job_state")
                job.expire_at = JobRepository._parse_datetime(j.get("expire_at"))
                job.application_closed = j.get("application_closed")
                job.work_remote_allowed = j.get("work_remote_allowed")

                if stage == "applied":
                    job.has_applied = True
                    job.applied_on = (
                            JobRepository._parse_datetime(j.get("applied_at"))
                            or job.applied_on
                    )

                saved_details.append(
                    {
                        "id": job_id,
                        "company": c_name,
                        "title": j.get("title"),
                        "status": "saved",
                    }
                )

            db.commit()

            return saved_details

        except Exception as e:

            db.rollback()

            raise e

        finally:

            db.close()
