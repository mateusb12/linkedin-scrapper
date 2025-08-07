from datetime import datetime
from typing import List, Optional, Dict, Any, Union, Type
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, case, desc
from database.database_connection import get_db_session
from models import Job


# Condition to find jobs missing key fields
def incomplete_job_condition():
    return or_(
        Job.description_full.is_(None),
        Job.description_full == "",
        Job.responsibilities.is_(None),
        Job.responsibilities == [],
        Job.qualifications.is_(None),
        Job.qualifications == [],
        Job.keywords.is_(None),
        Job.keywords == [],
        Job.job_type.is_(None),
        Job.job_type == "",
        Job.programming_languages.is_(None),
        Job.programming_languages == [],
        Job.language.is_(None),
        Job.language == ""
    )


class JobRepository:
    def __init__(self, session: Optional[Session] = None):
        self.session = session or get_db_session()

    def close(self):
        self.session.close()

    # Fetch all jobs with company
    def get_all(self) -> list[Type[Job]]:
        return (
            self.session.query(Job)
            .options(joinedload(Job.company))
            .all()
        )

    # Fetch single job by URN
    def get_by_urn(self, urn: str) -> Optional[Job]:
        return self.session.query(Job).filter_by(urn=urn).first()

    def get_multiple_jobs_by_urn_list(self, urns: List[str]) -> Dict[str, Union[Job, bool]]:
        # 1) Pull back all matching jobs in one query
        jobs = (
            self.session.query(Job)
            .options(joinedload(Job.company))
            .filter(Job.urn.in_(urns))
            .all()
        )

        # 2) Build a lookup from URN → Job
        job_map = {job.urn: job for job in jobs}

        # 3) For each requested URN, return the Job or False if missing
        return {urn: job_map.get(urn, False) for urn in urns}

    # Update specified fields on a job
    def update(self, urn: str, updates: Dict[str, Any]) -> List[str]:
        job = self.get_by_urn(urn)
        if not job:
            raise KeyError(f"Job with URN '{urn}' not found")

        from sqlalchemy import inspect
        mapper = inspect(Job)
        updatable = {col.key for col in mapper.attrs if hasattr(col, 'columns') and not col.columns[0].primary_key}
        applied = []
        for key, value in updates.items():
            if key in updatable:
                setattr(job, key, value)
                applied.append(key)
        if not applied:
            raise ValueError("No valid fields to update")
        return applied

    # Mark job disabled
    def disable(self, urn: str) -> None:
        job = self.get_by_urn(urn)
        if not job:
            raise KeyError(f"Job with URN '{urn}' not found")
        job.disabled = True

    # Mark as applied
    def mark_applied(self, urn: str) -> None:
        job = self.get_by_urn(urn)
        if not job:
            raise KeyError(f"Job with URN '{urn}' not found")
        job.has_applied = True

    def fetch_applied_jobs(self) -> list[Job]:
        return (
            self.session.query(Job)
            .options(joinedload(Job.company))
            .filter(Job.has_applied.is_(True))
            .all()
        )

    # Count incomplete jobs
    def count_incomplete(self) -> int:
        return self.session.query(Job).filter(Job.processed.is_(False)).count()

    # Fetch a batch of incomplete jobs
    def fetch_incomplete_batch(
            self, batch_size: int, last_urn: Optional[str] = None
    ) -> list[Job]:
        q = (
            self.session.query(Job)
            .options(joinedload(Job.company))
            .filter(Job.processed.is_(False))
            .order_by(desc(Job.urn))
        )
        if last_urn:
            q = q.filter(Job.urn < last_urn)
        return q.limit(batch_size).all()

    # Helper to compute incompleteness score case expression
    def incompleteness_score_case(self):
        return (
                case((Job.responsibilities.is_(None), 1), else_=0) +
                case((Job.qualifications.is_(None), 1), else_=0) +
                case((Job.keywords.is_(None), 1), else_=0) +
                case((Job.job_type.is_(None), 1), else_=0) +
                case((Job.programming_languages.is_(None), 1), else_=0) +
                case((Job.language.is_(None), 1), else_=0)
        )

    def add_job_by_dict(self, job_dict: dict):
        print("a")

        job_object = Job(
            urn=job_dict.get("urn"),
            title=job_dict.get("title"),
            location=job_dict.get("location"),
            workplace_type="Remote",  # Hardcoded
            employment_type="Full-time",  # Hardcoded
            posted_on=job_dict.get("timestamp"),
            job_url=job_dict.get("url"),
            description_full="No description provided",  # Hardcoded
            applicants=0,  # Hardcoded
            description_snippet="",  # Hardcoded
            easy_apply=False,  # Hardcoded
            language="PTBR",  # Hardcoded
            disabled=True,
            processed=True,
            responsibilities=[],
            qualifications=[],
            keywords=[],
            job_type="Full-stack",
            programming_languages=[],
            has_applied=True,  # From your context, this is an "applied" job
            applied_on=datetime.fromisoformat(job_dict["timestamp"]) if "timestamp" in job_dict else None,
            company_urn=None  # Will be set separately if needed (e.g., after company is created)
        )

        # Add job_object to session
        self.session.add(job_object)
        self.session.commit()

    def fetch_easy_applied_jobs(self) -> list[Job]:
        """
        Fetches jobs marked as applied and with 'No description provided'.
        """
        return (
            self.session.query(Job)
            .options(joinedload(Job.company))
            .filter(
                Job.has_applied.is_(True),
                Job.description_full == "No description provided"
            )
            .all()
        )

    # Commit and rollback
    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()
