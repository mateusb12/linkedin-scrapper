from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any


@dataclass(slots=True)
class JobPosting:
    urn: str
    title: str
    location: str | None = None
    description_full: str | None = None
    description_snippet: str | None = None
    qualifications: list[str] = field(default_factory=list)
    responsibilities: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    programming_languages: list[str] = field(default_factory=list)
    premium_title: str | None = None
    premium_description: str | None = None
    experience_level: str | None = None
    work_remote_allowed: bool | None = None
    has_applied: bool | None = None
    application_status: str | None = None
    company_urn: str | None = None
    created_at: str | None = None
    updated_at: str | None = None

    def combined_text_parts(self) -> dict[str, str]:
        return {
            "title": self.title or "",
            "description_full": self.description_full or "",
            "description_snippet": self.description_snippet or "",
            "qualifications": " ".join(self.qualifications),
            "responsibilities": " ".join(self.responsibilities),
            "keywords": " ".join(self.keywords),
            "programming_languages": " ".join(self.programming_languages),
            "premium_title": self.premium_title or "",
            "premium_description": self.premium_description or "",
        }

    def combined_text(self) -> str:
        return "\n".join(
            part.strip()
            for part in self.combined_text_parts().values()
            if part and part.strip()
        )


@dataclass(slots=True)
class ScoreExplanation:
    matched_keywords: dict[str, list[str]] = field(default_factory=dict)
    bonus_reasons: list[str] = field(default_factory=list)
    penalty_reasons: list[str] = field(default_factory=list)
    evidence: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class ScoreBreakdownItem:
    label: str
    points: float
    source: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "points": round(self.points, 2),
            "source": self.source,
        }


@dataclass(slots=True)
class ScoreBreakdown:
    positive: list[ScoreBreakdownItem] = field(default_factory=list)
    negative: list[ScoreBreakdownItem] = field(default_factory=list)
    category_totals: dict[str, float] = field(default_factory=dict)
    final_score: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "positive": [item.to_dict() for item in self.positive],
            "negative": [item.to_dict() for item in self.negative],
            "category_totals": {
                key: round(value, 2)
                for key, value in self.category_totals.items()
            },
            "final_score": round(self.final_score, 2),
        }


@dataclass(slots=True)
class ScoreResult:
    scorer_name: str
    job: JobPosting
    total_score: float
    category_scores: dict[str, float]
    explanation: ScoreExplanation
    score_breakdown: ScoreBreakdown = field(default_factory=ScoreBreakdown)
    suspicious: bool = False
    suspicious_reasons: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    scored_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "scorer_name": self.scorer_name,
            "job": asdict(self.job),
            "total_score": round(self.total_score, 2),
            "category_scores": {
                key: round(value, 2)
                for key, value in self.category_scores.items()
            },
            "explanation": self.explanation.to_dict(),
            "score_breakdown": self.score_breakdown.to_dict(),
            "suspicious": self.suspicious,
            "suspicious_reasons": self.suspicious_reasons,
            "metadata": self.metadata,
            "scored_at": self.scored_at,
        }

    def to_flat_dict(self) -> dict[str, Any]:
        return {
            "scorer_name": self.scorer_name,
            "urn": self.job.urn,
            "title": self.job.title,
            "location": self.job.location,
            "has_applied": self.job.has_applied,
            "application_status": self.job.application_status,
            "total_score": round(self.total_score, 2),
            "python_primary": round(
                self.category_scores.get("python_primary", 0.0), 2
            ),
            "databases": round(self.category_scores.get("databases", 0.0), 2),
            "cloud_devops": round(
                self.category_scores.get("cloud_devops", 0.0), 2
            ),
            "benefits": round(self.category_scores.get("benefits", 0.0), 2),
            "penalties": round(self.category_scores.get("penalties", 0.0), 2),
            "suspicious": self.suspicious,
            "suspicious_reasons": " | ".join(self.suspicious_reasons),
            "bonus_reasons": " | ".join(self.explanation.bonus_reasons),
            "penalty_reasons": " | ".join(self.explanation.penalty_reasons),
            "evidence": " | ".join(self.explanation.evidence[:5]),
        }
