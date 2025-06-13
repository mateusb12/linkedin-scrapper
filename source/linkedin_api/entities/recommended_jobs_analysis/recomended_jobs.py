import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class RecommendedJobCard:
    job_id: int
    job_urn: str
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    salary_hint: Optional[str] = None
    is_promoted: bool = False
    easy_apply: bool = False
    listed_at: Optional[str] = None
    reposted: bool = False
    is_remote: bool = False

    def __str__(self) -> str:
        when = self.listed_at or "n/a"
        return f"{self.title} @ {self.company} ({self.location}) [{when}]"


def _index_included(included: List[Dict[str, Any]]) -> Tuple[Dict[str, Dict], List[Dict]]:
    postings, cards = {}, []
    for item in included:
        t = item.get("$type", "")
        if t.endswith(".JobPosting"):
            postings[item["entityUrn"]] = item
        elif t.endswith(".JobPostingCard"):
            cards.append(item)
    return postings, cards


def _urn_to_id(urn: str) -> int:
    return int(urn.rsplit(":", 1)[-1]) if urn else 0


def extract_recommended_jobs(
        payload: Dict[str, Any],
        debug: bool = False
) -> List[RecommendedJobCard]:
    postings, cards = _index_included(payload.get("included", []))
    results: List[RecommendedJobCard] = []
    skipped = 0

    for card in cards:
        urn = card.get("*jobPosting")
        if not urn:
            skipped += 1
            continue

        post = postings.get(urn, {})
        title = post.get("title") or card.get("jobPostingTitle") or ""
        footer = {fi["type"]: fi for fi in card.get("footerItems", [])}

        ts = (footer.get("LISTED_DATE") or {}).get("timeAt")
        if ts:
            listed_at_str = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat()
        else:
            listed_at_str = None

        m = re.search(r'\b(?:R\$|BRL|\$|USD|€|£)\s?[\d.,]+\s?[kKmM]?\b', title)
        salary = m.group(0).replace(" ", "") if m else None

        results.append(RecommendedJobCard(
            job_id=_urn_to_id(urn),
            job_urn=urn,
            title=title,
            company=(card.get("primaryDescription") or {}).get("text"),
            location=(card.get("secondaryDescription") or {}).get("text"),
            salary_hint=salary,
            is_promoted="PROMOTED" in footer,
            easy_apply="EASY_APPLY_TEXT" in footer,
            listed_at=listed_at_str,
            reposted=post.get("repostedJob", False),
            is_remote=bool(card.get("secondaryDescription") and re.search(
                r'\bremote\b',
                card["secondaryDescription"].get("text", ""),
                re.IGNORECASE
            )),
        ))

    if debug:
        print(f"[extract] total_cards={len(cards)} kept={len(results)} skipped={skipped}")

    return results
