from datetime import datetime
from typing import List, Optional, Dict, Any, Union, Type, cast
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

    def fetch_internal_sql_jobs(self) -> list[Job]:
        return cast(
            list[Job],
            self.session.query(Job)
            .options(joinedload(Job.company))
            .filter(
                Job.has_applied.is_(True),
                Job.disabled.is_(False)
            )
            .all()
        )

    def fetch_applied_jobs(self) -> list[Job]:
        return cast(
            list[Job],
            self.session.query(Job)
            .options(joinedload(Job.company))
            .filter(
                Job.has_applied.is_(True),
                Job.description_full == "No description provided"
            )
            .all()
        )
    # Count incomplete jobs
    def count_incomplete(self) -> int:
        return (
            self.session.query(Job)
            .filter(
                or_(
                    Job.responsibilities == None,
                    Job.responsibilities == [],
                    Job.qualifications == None,
                    Job.qualifications == [],
                    Job.keywords == None,
                    Job.keywords == []
                )
            )
            .count()
        )

    # Fetch a batch of incomplete jobs
    def fetch_incomplete_batch(
            self, batch_size: int, last_urn: Optional[str] = None
    ) -> list[Job]:
        q = (
            self.session.query(Job)
            .options(joinedload(Job.company))
            .filter(
                or_(
                    Job.responsibilities == None,
                    Job.responsibilities == [],
                    Job.qualifications == None,
                    Job.qualifications == [],
                    Job.keywords == None,
                    Job.keywords == []
                )
            )
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
        description = job_dict.get("description_full") or "No description provided"
        is_processed = job_dict.get("processed", False)

        job_object = Job(
            urn=job_dict.get("urn"),
            title=job_dict.get("title"),
            location=job_dict.get("location"),
            # Allow overrides from enrichment, fallback to defaults
            workplace_type=job_dict.get("workplace_type", "Remote"),
            employment_type=job_dict.get("employment_type", "Full-time"),

            posted_on=job_dict.get("posted_on") or job_dict.get("timestamp"),
            job_url=job_dict.get("job_url"),

            description_full=description,
            applicants=job_dict.get("applicants", 0),
            description_snippet=job_dict.get("description_snippet", ""),
            easy_apply=job_dict.get("easy_apply", False),
            language="PTBR",
            disabled=False,
            processed=is_processed,

            responsibilities=[],
            qualifications=[],
            keywords=[],
            job_type="Full-stack",
            programming_languages=[],
            has_applied=False,

            # [CRITICAL FIX] Actually save the company link!
            company_urn=job_dict.get("company_urn")
        )

        self.session.add(job_object)
        self.session.commit()

        # Add job_object to session
        self.session.add(job_object)
        self.session.commit()

    def get_incomplete_jobs(self) -> list[Job]:
        """
        Fetches jobs that are considered incomplete:
        - description_full is "No description provided"
        - applied_on is NULL
        """
        return cast(list[Job],
                    self.session.query(Job)
                    .options(joinedload(Job.company))
                    .filter(
                        Job.description_full == "No description provided",
                        Job.applied_on.is_(None)
                    )
                    .all()
                    )

    # Commit and rollback
    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()

    def is_job_really_complete(job: Job) -> bool:
        return (
                isinstance(job.responsibilities, list) and len(job.responsibilities) > 0 and
                isinstance(job.qualifications, list) and len(job.qualifications) > 0 and
                isinstance(job.keywords, list) and len(job.keywords) > 0
        )

    def fetch_paginated_applied_jobs(self, page: int, limit: int) -> dict:
        """
        Fetches applied jobs with pagination logic.
        Returns a dict with data and metadata.
        """
        offset = (page - 1) * limit

        # Base query: Applied jobs, not disabled, description exists (optional filter based on your previous logic)
        base_query = self.session.query(Job).options(joinedload(Job.company)).filter(
            Job.has_applied.is_(True),
            Job.disabled.is_(False)
            # You can uncomment this if you only want jobs with descriptions
            # Job.description_full != "No description provided"
        )

        # Get total count for frontend math
        total_count = base_query.count()

        # Get the actual data sorted by Applied Date (Newest first)
        jobs = (
            base_query
            .order_by(desc(Job.applied_on))
            .offset(offset)
            .limit(limit)
            .all()
        )

        return {
            "jobs": jobs,
            "total": total_count,
            "page": page,
            "limit": limit
        }
