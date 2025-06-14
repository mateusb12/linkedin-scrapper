#!/usr/bin/env python3
"""
get_applied_jobs_details.py   (lean version)

All curl/paging/looping logic lives in utils.curl_commands now.
This script keeps only:
    • AppliedJob dataclass
    • JSON-to-AppliedJob extraction
    • main() orchestration
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv

from source.linkedin_api.data_fetching.curl_commands import build_paged_commands, run_commands
from source.linkedin_api.data_fetching.curl_txt_reader import CurlRequest
from source.path.file_content_loader import load_curl_file
from source.path.path_reference import get_data_folder_path

# ─── CONFIG ────────────────────────────────────────────────────────────────
CURL_TEMPLATE_FILE = "applied_jobs_curl_example.txt"
OUTPUT_CLEAN = "applied_jobs_clean.json"
SLEEP_SEC = 1.0
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

_RE_APPLIED = re.compile(r"Applied\s+(\d+)([a-zA-Z]+)\s+ago")


# ─── Typed result ──────────────────────────────────────────────────────────
@dataclass(slots=True)
class AppliedJob:
    job_id: int
    title: Optional[str]
    company: Optional[str]
    location: Optional[str]
    applied_on: Optional[str]


# ─── Helpers ───────────────────────────────────────────────────────────────
def _applied_to_dt(txt: str | None) -> datetime:
    if not txt:
        return datetime.now()
    m = _RE_APPLIED.match(txt)
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
    for k, kwargs in delta_map.items():
        if unit.startswith(k):
            return datetime.now() - relativedelta(**kwargs)
    return datetime.now()


def _extract_applied_jobs(body: Dict[str, Any]) -> List[AppliedJob]:
    """Translate LinkedIn GraphQL response → list[AppliedJob]."""
    included = {
        inc.get("entityUrn") or inc.get("$id"): inc
        for inc in body.get("included", [])
        if isinstance(inc, dict)
    }
    clusters = (
        body.get("data", {})
        .get("data", {})
        .get("searchDashClustersByAll", {})
        .get("elements", [])
    )

    results: List[AppliedJob] = []
    for cl in clusters:
        for item in cl.get("items", []):
            raw = included.get(item.get("item", {}).get("*entityResult"), {})
            urn = raw.get("entityUrn", raw.get("trackingUrn", ""))
            jid = int(re.search(r"jobPosting:(\d+)", urn).group(1)) if "jobPosting" in urn else 0

            def _txt(field: str) -> Optional[str]:
                v = raw.get(field) or {}
                return v.get("text") if isinstance(v, dict) else None

            insights = raw.get("insightsResolutionResults") or []
            applied_txt = (
                (insights[0].get("simpleInsight") or {}).get("title", {}).get("text")
                if insights
                else None
            )

            results.append(
                AppliedJob(
                    job_id=jid,
                    title=_txt("title"),
                    company=_txt("primarySubtitle"),
                    location=_txt("secondarySubtitle"),
                    applied_on=applied_txt,
                )
            )
    return results


# ─── main ──────────────────────────────────────────────────────────────────
def main() -> None:
    load_dotenv()
    raw = Path(CURL_TEMPLATE_FILE).read_text(encoding="utf-8").strip()
    template = CurlRequest.from_curl_text(raw)

    commands = build_paged_commands(template)
    logging.info("Prepared %d GET requests", len(commands))

    jobs = run_commands(commands, _extract_applied_jobs, sleep_sec=SLEEP_SEC)
    logging.info("Fetched %d AppliedJob records", len(jobs))

    out_file = Path(get_data_folder_path(), OUTPUT_CLEAN)
    out_file.write_text(json.dumps([asdict(j) for j in jobs], ensure_ascii=False, indent=2))
    print(f"Wrote {len(jobs)} applied-job records → {out_file}")


if __name__ == "__main__":
    main()
