#!/usr/bin/env python3
"""
get_recommended_jobs_details.py   (lean version)

Builds a Command per job-id in recommended_jobs.json, then re-uses
utils.curl_commands.run_commands() for the heavy lifting.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus

from dotenv import load_dotenv

from source.linkedin_api.data_fetching.curl_commands import run_commands, Command
from source.linkedin_api.data_fetching.curl_txt_reader import CurlRequest
from source.path.path_reference import get_data_folder_path

# ─── CONFIG ────────────────────────────────────────────────────────────────
CURL_TEMPLATE_FILE = "recommended_job_curl_example.txt"
INPUT_FILE = "recommended_jobs.json"
OUTPUT_FILE = "job_details_summary.json"
LIMIT = 30
SLEEP_SEC = 0.8
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ─── RecommendedJobCard dataclass + extract logic (unchanged) ─────────────
# ... (same @dataclass + helper functions you posted) ...
import re
from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(slots=True)
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


def _index_included(
        included: List[Dict[str, Any]]
) -> Tuple[Dict[str, Dict], List[Dict]]:
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


def _parse_time_ago(txt: str) -> Optional[str]:
    # plug in your existing “n weeks ago” → datetime logic here if you like;
    # for now we just return the raw string
    return txt.strip() if txt else None


def _extract_recommended_jobs(payload: Dict[str, Any]) -> List[RecommendedJobCard]:
    postings, cards = _index_included(payload.get("included", []))
    results: List[RecommendedJobCard] = []

    for card in cards:
        urn = card.get("*jobPosting")
        if not urn:
            continue
        post = postings.get(urn, {})

        # ── Title & Salary ───────────────────────────────────────────────
        title = card.get("jobPostingTitle", "")
        m = re.search(r"\b(?:R\$|BRL|\$|USD|€|£)\s?[\d.,]+\s?[kKmM]?\b", title)
        salary = m.group(0).replace(" ", "") if m else None

        # ── Company ──────────────────────────────────────────────────────
        company = None
        if pd := card.get("primaryDescription"):
            company = pd.get("text", "").strip() or None

        # ── Tertiary text: split ALL segments ───────────────────────────
        tert_txt = card.get("tertiaryDescription", {}).get("text", "")
        segments = [seg.strip() for seg in tert_txt.split("·")]

        time_ago = None
        promo_flag = False
        remote_flag = False
        # any other segs we ignore, since we now pull location below
        for seg in segments:
            low = seg.lower()
            if "ago" in low or re.match(r"\d+\s+(day|week|month|year)", low):
                time_ago = seg
            elif "promoted" in low:
                promo_flag = True
            elif "remote" in low:
                remote_flag = True

        listed_at = _parse_time_ago(time_ago) if time_ago else None

        # ── Location ─────────────────────────────────────────────────────
        loc = (
            post
            .get("jobPostingLocation", {})
            .get("displayText")
            or post.get("formattedLocation")
            or (segments[0] if segments else None)
        )

        # ── Flags from the JobPosting node ──────────────────────────────
        easy = False
        if am := post.get("applyMethod"):
            # LinkedIn often gives applyMethod.name="EASY_APPLY" or type="EASY_APPLY"
            easy = (
                am.get("name", "").upper().startswith("EASY")
                or am.get("type", "").upper().startswith("EASY")
            )

        reposted = bool(post.get("repostedJob", False))

        results.append(
            RecommendedJobCard(
                job_id=_urn_to_id(urn),
                job_urn=urn,
                title=title,
                company=company,
                location=loc,
                salary_hint=salary,
                is_promoted=promo_flag,
                easy_apply=easy,
                listed_at=listed_at,
                reposted=reposted,
                is_remote=remote_flag
            )
        )

    return results


# ─── Builder: one Command per job in INPUT_FILE ────────────────────────────
def _build_job_commands() -> list[Command]:
    # 1) read your single-job curl template
    raw_tpl = Path(CURL_TEMPLATE_FILE).read_text(encoding="utf-8").strip()
    template = CurlRequest.from_curl_text(raw_tpl)

    # 2) load the list of jobs you scraped
    jobs_path = get_data_folder_path() / INPUT_FILE
    jobs = json.loads(jobs_path.read_text(encoding="utf-8"))
    if not jobs:
        raise RuntimeError(f"No jobs inside {jobs_path}")

    base = template.url.split("?", 1)[0]
    cmds: list[Command] = []

    for idx, row in enumerate(jobs):
        if LIMIT and idx >= LIMIT:
            break
        urn = row["job_urn"]  # e.g. "urn:li:fsd_jobPosting:4230148335"
        enc = quote_plus(urn)  # => "urn%3Ali%3Afsd_jobPosting%3A4230148335"

        # only replace the URN *value* in the existing variables string:
        variables = re.sub(
            r"(jobPostingUrn:)[^,)\s]+",
            r"\1" + enc,
            template.variables_template,
            count=1
        )

        url = f"{base}?queryId={template.query_id}&variables={variables}"

        cmds.append(Command(
            method="GET",
            url=url,
            headers=template.headers,
            cookies=template.cookies,
            meta={"job_id": row["job_id"]},
        ))

    # DEBUG: show the very first URL so you can verify it looks right
    if cmds:
        print("→ DEBUG first URL:\n", cmds[0].url, "\n")

    return cmds


# ─── main ──────────────────────────────────────────────────────────────────
def main() -> None:
    load_dotenv()
    commands = _build_job_commands()
    logging.info("Prepared %d job-detail requests", len(commands))

    cards = run_commands(commands, _extract_recommended_jobs, sleep_sec=SLEEP_SEC)
    logging.info("Fetched %d RecommendedJobCard objects", len(cards))

    out_file = Path(get_data_folder_path(), OUTPUT_FILE)
    out_file.write_text(
        json.dumps([asdict(c) for c in cards], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {len(cards)} recommended-job cards → {out_file}")


if __name__ == "__main__":
    main()
