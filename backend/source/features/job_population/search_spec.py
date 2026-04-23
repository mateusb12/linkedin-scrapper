from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable


def normalize_excluded_keywords(value: Iterable[str] | str | None) -> list[str]:
    if value is None:
        return []

    if isinstance(value, str):
        items = value.split(",")
    else:
        items = list(value)

    normalized: list[str] = []
    for item in items:
        token = str(item).strip()
        if token:
            normalized.append(token)
    return normalized


@dataclass
class PipelineSearchSpec:
    keywords: str | None = None
    excluded_keywords: list[str] = field(default_factory=list)
    geo_id: str | None = None
    distance: float | None = None
    count: int | None = None

    def is_active(self) -> bool:
        return any(
            [
                bool((self.keywords or "").strip()),
                bool(self.excluded_keywords),
                bool((self.geo_id or "").strip()),
                self.distance is not None,
                self.count is not None,
            ]
        )

    def build_linkedin_keywords(self) -> str | None:
        base = (self.keywords or "").strip()
        excluded = [token for token in self.excluded_keywords if token]

        if not base and not excluded:
            return None

        parts: list[str] = []
        if base:
            parts.append(base)

        for token in excluded:
            parts.append(f"NOT {token}")

        return " ".join(parts).strip() or None
