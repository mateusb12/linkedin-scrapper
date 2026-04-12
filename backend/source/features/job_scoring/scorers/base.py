from __future__ import annotations

from abc import ABC, abstractmethod

from source.features.job_scoring.config.preferences import (
    DEFAULT_JOB_SCORING_CONFIG,
    JobScoringConfig,
)
from source.features.job_scoring.domain import (
    JobPosting,
    ScoreBreakdown,
    ScoreExplanation,
    ScoreResult,
)


class BaseJobScorer(ABC):
    scorer_name = "base"

    def __init__(self, config: JobScoringConfig | None = None) -> None:
        self.config = config or DEFAULT_JOB_SCORING_CONFIG

    @abstractmethod
    def score_job(self, job: JobPosting) -> ScoreResult:
        raise NotImplementedError

    def mark_suspicious(self, result: ScoreResult) -> ScoreResult:
        suspicious_reasons: list[str] = []
        if result.total_score >= self.config.suspicious_score_threshold:
            python_score = result.category_scores.get("python_primary", 0.0)
            penalties = result.category_scores.get("penalties", 0.0)
            if python_score < self.config.suspicious_python_floor:
                suspicious_reasons.append(
                    "score alto sem Python claramente central"
                )
            if penalties >= self.config.suspicious_penalty_threshold:
                suspicious_reasons.append("score alto apesar de penalidades relevantes")
        result.suspicious = bool(suspicious_reasons)
        result.suspicious_reasons = suspicious_reasons
        return result

    def build_result(
        self,
        *,
        job: JobPosting,
        category_scores: dict[str, float],
        explanation: ScoreExplanation,
        score_breakdown: ScoreBreakdown | None = None,
        metadata: dict | None = None,
    ) -> ScoreResult:
        total_score = sum(
            score
            for key, score in category_scores.items()
            if key != "penalties"
        ) - category_scores.get("penalties", 0.0)
        total_score = max(0.0, min(100.0, total_score))
        result = ScoreResult(
            scorer_name=self.scorer_name,
            job=job,
            total_score=total_score,
            category_scores={
                key: max(0.0, min(100.0, value))
                for key, value in category_scores.items()
            },
            explanation=explanation,
            score_breakdown=score_breakdown
            or ScoreBreakdown(
                category_totals={
                    key: max(0.0, min(100.0, value))
                    for key, value in category_scores.items()
                },
                final_score=total_score,
            ),
            metadata=metadata or {},
        )
        return self.mark_suspicious(result)
