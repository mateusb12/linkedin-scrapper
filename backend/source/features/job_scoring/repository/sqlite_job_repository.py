from __future__ import annotations

from datetime import datetime

from database.database_connection import DB_FILE, get_db_session
from models.job_models import Job
from source.features.job_scoring.domain import JobPosting
from source.features.job_scoring.utils.text_utils import parse_jsonish_list

DEFAULT_DB_PATH = DB_FILE


def _serialize_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


class SQLiteJobRepository:
    """
    Legacy class name kept for compatibility with existing benchmark/scripts.

    The implementation is ORM-backed and follows the same session/model/query
    pattern already used by the rest of the backend for `jobs`.
    """

    def __init__(self, _db_path: str | None = None, session=None) -> None:
        self.session = session or get_db_session()

    def close(self) -> None:
        self.session.close()

    def fetch_jobs(self) -> list[JobPosting]:
        return self.fetch_jobs_filtered()

    def fetch_jobs_filtered(
        self,
        *,
        has_applied: bool | None = None,
        work_remote_allowed: bool | None = None,
        company_urn: str | None = None,
        application_status: str | None = None,
        limit: int | None = None,
    ) -> list[JobPosting]:
        try:
            query = (
                self.session.query(Job)
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

            jobs = query.all()
            return [self._model_to_job(job) for job in jobs]
        finally:
            self.close()

    @staticmethod
    def _model_to_job(job: Job) -> JobPosting:
        return JobPosting(
            urn=str(job.urn),
            title=job.title or "",
            location=job.location,
            description_full=job.description_full,
            description_snippet=job.description_snippet,
            responsibilities=parse_jsonish_list(job.responsibilities),
            qualifications=parse_jsonish_list(job.qualifications),
            keywords=parse_jsonish_list(job.keywords),
            programming_languages=parse_jsonish_list(job.programming_languages),
            premium_title=job.premium_title,
            premium_description=job.premium_description,
            experience_level=job.experience_level,
            work_remote_allowed=job.work_remote_allowed,
            has_applied=job.has_applied,
            application_status=job.application_status,
            company_urn=job.company_urn,
            created_at=_serialize_datetime(job.created_at),
            updated_at=_serialize_datetime(job.updated_at),
        )
