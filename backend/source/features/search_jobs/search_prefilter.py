from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from typing import Any


def _unique(values: list[str] | None) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []

    for value in values or []:
        normalized = str(value).strip()
        if not normalized:
            continue

        key = _normalize_match_text(normalized)
        if key in seen:
            continue

        seen.add(key)
        result.append(normalized)

    return result


def _normalize_text(value: Any) -> str:
    text = str(value or "").lower()
    text = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn")


def _normalize_match_text(value: Any) -> str:
    return re.sub(r"\s+", " ", _normalize_text(value)).strip()


def _keyword_matches_text(text: str, keyword: str) -> bool:
    normalized_keyword = _normalize_match_text(keyword)
    if not normalized_keyword:
        return False

    pattern = re.compile(
        rf"(^|[^a-z0-9]){re.escape(normalized_keyword)}(?=$|[^a-z0-9])",
        re.IGNORECASE,
    )
    return bool(pattern.search(_normalize_match_text(text)))


def _string_items(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _build_strict_keyword_text(job: dict[str, Any]) -> str:
    raw = job.get("raw") if isinstance(job.get("raw"), dict) else {}
    items = [
        job.get("title"),
        job.get("description"),
        job.get("description_full"),
        job.get("description_snippet"),
        job.get("premium_title"),
        job.get("premium_description"),
        *_string_items(raw.get("qualifications")),
        *_string_items(raw.get("responsibilities")),
        *_string_items(raw.get("programming_languages")),
    ]
    return " ".join(str(item) for item in items if isinstance(item, str))


@dataclass
class JobSearchPrefilter:
    must_have_keywords: list[str] = field(default_factory=list)
    negative_keywords: list[str] = field(default_factory=list)
    negative_companies: list[str] = field(default_factory=list)
    max_applicants: int | None = None
    drop_rejected: bool = True
    enabled: bool = True

    def __post_init__(self) -> None:
        self.must_have_keywords = _unique(self.must_have_keywords)
        self.negative_keywords = _unique(self.negative_keywords)
        self.negative_companies = _unique(self.negative_companies)

    @property
    def has_rules(self) -> bool:
        return any(
            [
                self.must_have_keywords,
                self.negative_keywords,
                self.negative_companies,
                self.max_applicants is not None,
            ]
        )

    def evaluate(self, job: dict[str, Any]) -> dict[str, Any]:
        strict_text = _build_strict_keyword_text(job)

        missing_must_have = [
            keyword
            for keyword in self.must_have_keywords
            if not _keyword_matches_text(strict_text, keyword)
        ]
        matched_negative = [
            keyword
            for keyword in self.negative_keywords
            if _keyword_matches_text(strict_text, keyword)
        ]

        company_name = str(
            job.get("company")
            or job.get("company_name")
            or ""
        ).strip()
        normalized_company = _normalize_match_text(company_name)
        negative_company_set = {
            _normalize_match_text(company)
            for company in self.negative_companies
        }
        company_excluded = bool(
            normalized_company and normalized_company in negative_company_set
        )

        applicants = job.get("applicants_total")
        if applicants is None:
            applicants = job.get("applicants")
        too_many_applicants = (
            self.max_applicants is not None
            and isinstance(applicants, int)
            and applicants > self.max_applicants
        )

        reasons: list[str] = []
        reason_codes: list[str] = []
        if missing_must_have:
            reasons.append(f"Missing: {', '.join(missing_must_have)}")
            reason_codes.append("missing_must_have")
        if matched_negative:
            reasons.append(f"Negative: {', '.join(matched_negative)}")
            reason_codes.append("negative_keyword")
        if company_excluded:
            reasons.append("Company excluded")
            reason_codes.append("company_excluded")
        if too_many_applicants:
            reasons.append(f">{self.max_applicants} applicants")
            reason_codes.append("too_many_applicants")

        return {
            "accepted": not reasons,
            "reasons": reasons,
            "reason_codes": reason_codes,
            "missing_must_have_keywords": missing_must_have,
            "matched_negative_keywords": matched_negative,
        }


def build_prefilter_audit(
    *,
    total: int,
    accepted: list[dict[str, Any]],
    rejected: list[dict[str, Any]],
    prefilter: JobSearchPrefilter,
) -> dict[str, Any]:
    reason_counter: Counter[str] = Counter()
    missing_counter: Counter[str] = Counter()
    negative_counter: Counter[str] = Counter()

    for job in rejected:
        evaluation = job.get("prefilter_evaluation") or {}
        reason_counter.update(evaluation.get("reason_codes") or [])
        missing_counter.update(evaluation.get("missing_must_have_keywords") or [])
        negative_counter.update(evaluation.get("matched_negative_keywords") or [])

    return {
        "enabled": prefilter.enabled,
        "drop_rejected": prefilter.drop_rejected,
        "rules": {
            "must_have_keywords": prefilter.must_have_keywords,
            "negative_keywords": prefilter.negative_keywords,
            "negative_companies": prefilter.negative_companies,
            "max_applicants": prefilter.max_applicants,
        },
        "cards_checked": total,
        "accepted_for_expensive_enrichment": len(accepted),
        "rejected_before_expensive_enrichment": len(rejected),
        "reason_counts": dict(reason_counter),
        "missing_must_have_counts": dict(missing_counter),
        "matched_negative_counts": dict(negative_counter),
        "sample_rejected": [
            {
                "job_id": job.get("job_id"),
                "title": job.get("title"),
                "company": job.get("company") or job.get("company_name"),
                "reasons": (job.get("prefilter_evaluation") or {}).get("reasons") or [],
            }
            for job in rejected[:10]
        ],
        "rejected_jobs": [
            {
                "job_id": job.get("job_id"),
                "title": job.get("title"),
                "company": job.get("company") or job.get("company_name"),
                "location": job.get("location") or job.get("location_text"),
                "job_url": job.get("job_url"),
                "reasons": (job.get("prefilter_evaluation") or {}).get("reasons") or [],
                "reason_codes": (job.get("prefilter_evaluation") or {}).get("reason_codes") or [],
                "missing_must_have_keywords": (
                    (job.get("prefilter_evaluation") or {}).get("missing_must_have_keywords")
                    or []
                ),
                "matched_negative_keywords": (
                    (job.get("prefilter_evaluation") or {}).get("matched_negative_keywords")
                    or []
                ),
                "details_unavailable": bool(
                    (job.get("prefilter_evaluation") or {}).get("details_unavailable")
                ),
                "details_error": job.get("prefilter_details_error"),
            }
            for job in rejected
        ],
    }
