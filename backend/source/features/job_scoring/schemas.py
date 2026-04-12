from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


class JobScoringValidationError(ValueError):
    """Raised when an HTTP payload cannot be adapted to the scoring domain."""


def _require_non_empty_string(value: Any, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise JobScoringValidationError(f"Field '{field_name}' must be a non-empty string.")
    return value.strip()


def _optional_string(value: Any, field_name: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise JobScoringValidationError(f"Field '{field_name}' must be a string.")
    cleaned = value.strip()
    return cleaned or None


def _optional_bool(value: Any, field_name: str) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    raise JobScoringValidationError(f"Field '{field_name}' must be a boolean.")


def _optional_string_list(value: Any, field_name: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise JobScoringValidationError(f"Field '{field_name}' must be an array of strings.")

    items: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise JobScoringValidationError(f"Field '{field_name}' must contain only strings.")
        cleaned = item.strip()
        if cleaned:
            items.append(cleaned)
    return items


def _optional_dict(value: Any, field_name: str) -> dict[str, Any]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise JobScoringValidationError(f"Field '{field_name}' must be an object.")
    return value


def _ensure_textual_signal(item: "JobScoringItemInput") -> None:
    if any(
        (
            item.description_full,
            item.description_snippet,
            item.qualifications,
            item.responsibilities,
            item.keywords,
            item.programming_languages,
            item.premium_title,
            item.premium_description,
        )
    ):
        return
    raise JobScoringValidationError(
        "Payload must include at least one descriptive field besides 'title'."
    )


@dataclass(slots=True)
class JobScoringItemInput:
    title: str
    description_full: str | None = None
    description_snippet: str | None = None
    qualifications: list[str] = field(default_factory=list)
    responsibilities: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    programming_languages: list[str] = field(default_factory=list)
    premium_title: str | None = None
    premium_description: str | None = None
    location: str | None = None
    experience_level: str | None = None
    work_remote_allowed: bool | None = None
    has_applied: bool | None = None
    application_status: str | None = None
    company_urn: str | None = None
    id: str | None = None
    external_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: Any) -> "JobScoringItemInput":
        if not isinstance(payload, dict):
            raise JobScoringValidationError("Request body must be a JSON object.")

        item = cls(
            title=_require_non_empty_string(payload.get("title"), "title"),
            description_full=_optional_string(payload.get("description_full"), "description_full"),
            description_snippet=_optional_string(payload.get("description_snippet"), "description_snippet"),
            qualifications=_optional_string_list(payload.get("qualifications"), "qualifications"),
            responsibilities=_optional_string_list(payload.get("responsibilities"), "responsibilities"),
            keywords=_optional_string_list(payload.get("keywords"), "keywords"),
            programming_languages=_optional_string_list(
                payload.get("programming_languages"),
                "programming_languages",
            ),
            premium_title=_optional_string(payload.get("premium_title"), "premium_title"),
            premium_description=_optional_string(payload.get("premium_description"), "premium_description"),
            location=_optional_string(payload.get("location"), "location"),
            experience_level=_optional_string(payload.get("experience_level"), "experience_level"),
            work_remote_allowed=_optional_bool(payload.get("work_remote_allowed"), "work_remote_allowed"),
            has_applied=_optional_bool(payload.get("has_applied"), "has_applied"),
            application_status=_optional_string(payload.get("application_status"), "application_status"),
            company_urn=_optional_string(payload.get("company_urn"), "company_urn"),
            id=_optional_string(payload.get("id"), "id"),
            external_id=_optional_string(payload.get("external_id"), "external_id"),
            metadata=_optional_dict(payload.get("metadata"), "metadata"),
        )
        _ensure_textual_signal(item)
        return item


@dataclass(slots=True)
class JobScoringBatchRequest:
    items: list[JobScoringItemInput]

    @classmethod
    def from_dict(cls, payload: Any) -> "JobScoringBatchRequest":
        if not isinstance(payload, dict):
            raise JobScoringValidationError("Request body must be a JSON object.")
        raw_items = payload.get("items")
        if raw_items is None:
            raise JobScoringValidationError("Field 'items' is required.")
        if not isinstance(raw_items, list):
            raise JobScoringValidationError("Field 'items' must be an array.")
        return cls(items=[JobScoringItemInput.from_dict(item) for item in raw_items])


@dataclass(slots=True)
class JobScoringSimpleItemInput:
    title: str
    description: str
    id: str | None = None
    external_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: Any) -> "JobScoringSimpleItemInput":
        if not isinstance(payload, dict):
            raise JobScoringValidationError("Request body must be a JSON object.")
        return cls(
            title=_require_non_empty_string(payload.get("title"), "title"),
            description=_require_non_empty_string(payload.get("description"), "description"),
            id=_optional_string(payload.get("id"), "id"),
            external_id=_optional_string(payload.get("external_id"), "external_id"),
            metadata=_optional_dict(payload.get("metadata"), "metadata"),
        )


@dataclass(slots=True)
class JobScoringSimpleBatchRequest:
    items: list[JobScoringSimpleItemInput]

    @classmethod
    def from_dict(cls, payload: Any) -> "JobScoringSimpleBatchRequest":
        if not isinstance(payload, dict):
            raise JobScoringValidationError("Request body must be a JSON object.")
        raw_items = payload.get("items")
        if raw_items is None:
            raise JobScoringValidationError("Field 'items' is required.")
        if not isinstance(raw_items, list):
            raise JobScoringValidationError("Field 'items' must be an array.")
        return cls(items=[JobScoringSimpleItemInput.from_dict(item) for item in raw_items])


@dataclass(slots=True)
class JobScoringDBRankRequest:
    limit: int = 25
    has_applied: bool | None = None
    work_remote_allowed: bool | None = None
    company_urn: str | None = None
    application_status: str | None = None

    @classmethod
    def from_dict(cls, payload: Any) -> "JobScoringDBRankRequest":
        if payload is None:
            payload = {}
        if not isinstance(payload, dict):
            raise JobScoringValidationError("Request body must be a JSON object.")

        limit = payload.get("limit", 25)
        if not isinstance(limit, int) or limit < 0:
            raise JobScoringValidationError("Field 'limit' must be an integer greater than or equal to 0.")

        return cls(
            limit=limit,
            has_applied=_optional_bool(payload.get("has_applied"), "has_applied"),
            work_remote_allowed=_optional_bool(payload.get("work_remote_allowed"), "work_remote_allowed"),
            company_urn=_optional_string(payload.get("company_urn"), "company_urn"),
            application_status=_optional_string(payload.get("application_status"), "application_status"),
        )
