from __future__ import annotations

from dataclasses import asdict
from typing import Any

from source.features.job_scoring.domain import JobPosting, ScoreResult
from source.features.job_scoring.schemas import (
    JobScoringItemInput,
    JobScoringSimpleItemInput,
)


def score_input_to_job_posting(item: JobScoringItemInput, *, fallback_urn: str) -> JobPosting:
    return JobPosting(
        urn=item.id or item.external_id or fallback_urn,
        title=item.title,
        location=item.location,
        description_full=item.description_full,
        description_snippet=item.description_snippet,
        qualifications=item.qualifications,
        responsibilities=item.responsibilities,
        keywords=item.keywords,
        programming_languages=item.programming_languages,
        premium_title=item.premium_title,
        premium_description=item.premium_description,
        experience_level=item.experience_level,
        work_remote_allowed=item.work_remote_allowed,
        has_applied=item.has_applied,
        application_status=item.application_status,
        company_urn=item.company_urn,
    )


def simple_input_to_job_posting(item: JobScoringSimpleItemInput, *, fallback_urn: str) -> JobPosting:
    return JobPosting(
        urn=item.id or item.external_id or fallback_urn,
        title=item.title,
        description_full=item.description,
    )


def score_result_to_payload(
    result: ScoreResult,
    *,
    id: str | None = None,
    external_id: str | None = None,
    rank: int | None = None,
    input_index: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    public_metadata = dict(result.metadata)
    if metadata:
        public_metadata["input_metadata"] = metadata

    payload = {
        "id": id,
        "external_id": external_id,
        "urn": result.job.urn,
        "title": result.job.title,
        "total_score": round(result.total_score, 2),
        "category_scores": {
            key: round(value, 2)
            for key, value in result.category_scores.items()
        },
        "archetype": result.metadata.get("archetype"),
        "matched_keywords": result.explanation.matched_keywords,
        "bonus_reasons": result.explanation.bonus_reasons,
        "penalty_reasons": result.explanation.penalty_reasons,
        "evidence": result.explanation.evidence,
        "suspicious": result.suspicious,
        "suspicious_reasons": result.suspicious_reasons,
        "metadata": public_metadata,
        "scored_at": result.scored_at,
    }
    if rank is not None:
        payload["rank"] = rank
    if input_index is not None:
        payload["input_index"] = input_index
    return payload


def job_posting_to_payload(job: JobPosting) -> dict[str, Any]:
    return asdict(job)
