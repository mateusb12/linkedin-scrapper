from __future__ import annotations

import sqlite3
from pathlib import Path

from source.features.job_scoring.domain import JobPosting
from source.features.job_scoring.utils.text_utils import parse_jsonish_list

DEFAULT_DB_PATH = Path("/app/db/linkedin.db")


class SQLiteJobRepository:
    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = Path(db_path) if db_path else DEFAULT_DB_PATH

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def fetch_jobs(self) -> list[JobPosting]:
        query = """
        SELECT
            urn,
            title,
            location,
            description_full,
            description_snippet,
            responsibilities,
            qualifications,
            keywords,
            programming_languages,
            has_applied,
            application_status,
            company_urn,
            experience_level,
            work_remote_allowed,
            premium_title,
            premium_description,
            created_at,
            updated_at
        FROM jobs
        WHERE COALESCE(disabled, 0) = 0
        ORDER BY updated_at DESC, created_at DESC, urn DESC
        """
        with self._connect() as connection:
            rows = connection.execute(query).fetchall()
        return [self._row_to_job(row) for row in rows]

    @staticmethod
    def _row_to_job(row: sqlite3.Row) -> JobPosting:
        return JobPosting(
            urn=str(row["urn"]),
            title=row["title"] or "",
            location=row["location"],
            description_full=row["description_full"],
            description_snippet=row["description_snippet"],
            responsibilities=parse_jsonish_list(row["responsibilities"]),
            qualifications=parse_jsonish_list(row["qualifications"]),
            keywords=parse_jsonish_list(row["keywords"]),
            programming_languages=parse_jsonish_list(row["programming_languages"]),
            premium_title=row["premium_title"],
            premium_description=row["premium_description"],
            experience_level=row["experience_level"],
            work_remote_allowed=bool(row["work_remote_allowed"])
            if row["work_remote_allowed"] is not None
            else None,
            has_applied=bool(row["has_applied"])
            if row["has_applied"] is not None
            else None,
            application_status=row["application_status"],
            company_urn=row["company_urn"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

