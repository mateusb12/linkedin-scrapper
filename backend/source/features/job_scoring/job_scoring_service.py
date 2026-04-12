from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from source.features.job_scoring.domain import JobPosting
from source.features.job_scoring.mappers import (
    score_input_to_job_posting,
    score_result_to_payload,
)
from source.features.job_scoring.schemas import (
    JobScoringBatchRequest,
    JobScoringDBRankRequest,
    JobScoringItemInput,
    JobScoringSimpleBatchRequest,
)
from source.features.job_scoring.scorers.hybrid_scorer import HybridScorer
from source.features.job_scoring.utils.text_utils import parse_jsonish_list
from source.features.jobs.job_repository import JobRepository
from models.job_models import Job


@dataclass(slots=True)
class RankedJobScore:
    input_index: int
    payload: dict[str, Any]
    total_score: float


class JobScoringService:
    def __init__(
        self,
        *,
        scorer: HybridScorer | None = None,
    ) -> None:
        self.scorer = scorer or HybridScorer()

    def score_job(self, item: JobScoringItemInput, *, input_index: int = 0) -> dict[str, Any]:
        job = score_input_to_job_posting(item, fallback_urn=f"input-{input_index}")
        result = self.scorer.score_job(job)
        return score_result_to_payload(
            result,
            id=item.id,
            external_id=item.external_id,
            input_index=input_index,
            metadata=item.metadata,
        )

    def rank_jobs(self, request: JobScoringBatchRequest) -> dict[str, Any]:
        ranked = self._rank_items(request.items)
        return {
            "items": [item.payload for item in ranked],
            "metadata": {
                "count": len(ranked),
                "scorer": self.scorer.scorer_name,
                "sorted_by": "total_score_desc",
                "stable_tiebreak": "input_order",
            },
        }

    def rank_simple_jobs(self, request: JobScoringSimpleBatchRequest) -> dict[str, Any]:
        adapted_items = [
            JobScoringItemInput(
                title=item.title,
                description_full=item.description,
                id=item.id,
                external_id=item.external_id,
                metadata=item.metadata,
            )
            for item in request.items
        ]
        ranked = self._rank_items(adapted_items)
        return {
            "items": [item.payload for item in ranked],
            "metadata": {
                "count": len(ranked),
                "scorer": self.scorer.scorer_name,
                "sorted_by": "total_score_desc",
                "stable_tiebreak": "input_order",
                "input_shape": "title_description_only",
            },
        }

    def rank_db_jobs(self, request: JobScoringDBRankRequest) -> dict[str, Any]:
        jobs = JobRepository.get_jobs_for_scoring(
            has_applied=request.has_applied,
            work_remote_allowed=request.work_remote_allowed,
            company_urn=request.company_urn,
            application_status=request.application_status,
            limit=request.limit,
        )
        ranked = self._rank_job_postings([self._orm_job_to_job_posting(job) for job in jobs])
        return {
            "items": [item.payload for item in ranked],
            "metadata": {
                "count": len(ranked),
                "scorer": self.scorer.scorer_name,
                "source": "local_sqlite_jobs",
                "filters": {
                    "has_applied": request.has_applied,
                    "work_remote_allowed": request.work_remote_allowed,
                    "company_urn": request.company_urn,
                    "application_status": request.application_status,
                    "limit": request.limit,
                },
            },
        }

    @staticmethod
    def _orm_job_to_job_posting(job: Job) -> JobPosting:
        return JobPosting(
            urn=str(job.urn),
            title=job.title or "",
            location=job.location,
            description_full=job.description_full,
            description_snippet=job.description_snippet,
            qualifications=parse_jsonish_list(job.qualifications),
            responsibilities=parse_jsonish_list(job.responsibilities),
            keywords=parse_jsonish_list(job.keywords),
            programming_languages=parse_jsonish_list(job.programming_languages),
            premium_title=job.premium_title,
            premium_description=job.premium_description,
            experience_level=job.experience_level,
            work_remote_allowed=job.work_remote_allowed,
            has_applied=job.has_applied,
            application_status=job.application_status,
            company_urn=job.company_urn,
            created_at=job.created_at.isoformat() if isinstance(job.created_at, datetime) else None,
            updated_at=job.updated_at.isoformat() if isinstance(job.updated_at, datetime) else None,
        )

    def _rank_items(self, items: list[JobScoringItemInput]) -> list[RankedJobScore]:
        job_postings = [
            score_input_to_job_posting(item, fallback_urn=f"input-{index}")
            for index, item in enumerate(items)
        ]
        return self._rank_job_postings(
            job_postings,
            inputs=items,
        )

    def _rank_job_postings(
        self,
        jobs: list[JobPosting],
        *,
        inputs: list[JobScoringItemInput] | None = None,
    ) -> list[RankedJobScore]:
        scored: list[RankedJobScore] = []
        for index, job in enumerate(jobs):
            result = self.scorer.score_job(job)
            input_item = inputs[index] if inputs else None
            payload = score_result_to_payload(
                result,
                id=input_item.id if input_item else None,
                external_id=input_item.external_id if input_item else None,
                input_index=index,
                metadata=input_item.metadata if input_item else None,
            )
            scored.append(
                RankedJobScore(
                    input_index=index,
                    payload=payload,
                    total_score=result.total_score,
                )
            )

        ranked = sorted(scored, key=lambda item: item.total_score, reverse=True)
        for rank, item in enumerate(ranked, start=1):
            item.payload["rank"] = rank
        return ranked
