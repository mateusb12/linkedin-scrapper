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
        return (
            self.session.query(Job)
            .filter(Job.description_full.isnot(None), incomplete_job_condition())
            .count()
        )

    # Fetch a batch of incomplete jobs
    def fetch_incomplete_batch(self, batch_size: int, last_urn: Optional[str] = None) -> list[Type[Job]]:
        query = (
            self.session.query(Job)
            .options(joinedload(Job.company))
            .filter(Job.description_full.isnot(None), incomplete_job_condition())
        )
        if last_urn:
            query = query.filter(Job.urn < last_urn)
        return (
            query.order_by(desc(Job.urn))
            .limit(batch_size)
            .all()
        )

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

    # Commit and rollback
    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()
