import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from dateutil.relativedelta import relativedelta

_RE_APPLIED = re.compile(r"Applied\s+(\d+)([a-zA-Z]+)\s+ago")


@dataclass
class AppliedJob:
    job_id: int
    title: Optional[str]
    company: Optional[str]
    location: Optional[str]
    applied_on: Optional[str]


def _applied_to_dt(txt: str) -> datetime:
    m = _RE_APPLIED.match(txt or "")
    if not m:
        return datetime.now()
    val, unit = int(m.group(1)), m.group(2).lower()
    delta_map = {
        "mo": {"months": val},
        "y": {"years": val},
        "w": {"weeks": val},
        "d": {"days": val},
        "h": {"hours": val},
    }
    for prefix, kwargs in delta_map.items():
        if unit.startswith(prefix):
            return datetime.now() - relativedelta(**kwargs)
    return datetime.now()


def _trim(job: Dict[str, Any]) -> AppliedJob:
    urn = job.get("entityUrn", job.get("trackingUrn", ""))
    jid = int(re.search(r"jobPosting:(\d+)", urn).group(1)) if "jobPosting" in urn else None

    def _text(field: str) -> Optional[str]:
        v = job.get(field) or {}
        return v.get("text") if isinstance(v, dict) else None

    insights = job.get("insightsResolutionResults") or []
    applied = (insights[0].get("simpleInsight") or {}).get("title", {}).get("text") if insights else None

    return AppliedJob(
        job_id=jid,
        title=_text("title"),
        company=_text("primarySubtitle"),
        location=_text("secondarySubtitle"),
        applied_on=applied,
    )


def extract_applied_jobs(data: Dict[str, Any]) -> List[AppliedJob]:
    included = {
        inc.get("entityUrn") or inc.get("$id"): inc
        for inc in data.get("included", [])
        if isinstance(inc, dict)
    }
    clusters = data["data"]["data"]["searchDashClustersByAll"]["elements"]
    return [
        _trim(included.get(item["item"]["*entityResult"], {"entityUrn": item["item"]["*entityResult"]}))
        for cl in clusters for item in cl.get("items", [])
    ]
