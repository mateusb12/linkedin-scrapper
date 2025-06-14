#!/usr/bin/env python3
"""
get_recommended_jobs_details.py   (lean version)

Builds one Command per page of recommended jobs (using build_paged_commands),
fetches them, and then extracts metadata into a JSON file via our dataclass.
This updated version also handles the special "jobsDashJobCardsByJobCollections" shape
and logs when expected fields are missing.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

from source.linkedin_api.data_fetching.curl_commands import run_commands, build_paged_commands, RequestCommand
from source.linkedin_api.data_fetching.curl_txt_reader import CurlRequest
from source.path.path_reference import get_data_folder_path

# ─── CONFIG ────────────────────────────────────────────────────────────────
CURL_TEMPLATE_FILE = "list_all_recommended_jobs_curl_example.txt"
OUTPUT_FILE = "all_recommended_jobs_metadata.json"
LIMIT = 5
SLEEP_SEC = 0.8

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


# ─── dataclass + extract logic ─────────────────────────────────────────────
@dataclass(slots=True)
class RecommendedJobCard:
    job_id: int
    job_urn: str
    title: str
    tracking_urn: Optional[str] = None
    reposted: bool = False
    company: Optional[str] = None
    location: Optional[str] = None
    is_promoted: bool = False
    listed_date: Optional[datetime] = None
    num_connections: Optional[int] = None
    company_logo_urn: Optional[str] = None
    tracking_id: Optional[str] = None


def _urn_to_id(urn: str) -> int:
    try:
        return int(urn.rsplit("#", 1)[-1] if "#" in urn else urn.rsplit(":", 1)[-1])
    except Exception:
        return 0


def _index_included(
    included: List[Dict[str, Any]]
) -> Tuple[Dict[str, Dict[str, Any]], List[Dict[str, Any]]]:
    postings: Dict[str, Dict] = {}
    cards: List[Dict] = []
    for item in included:
        t = item.get("$type", "")
        urn = item.get("entityUrn")
        if t.endswith(".JobPosting") and urn:
            postings[urn] = item
        elif t.endswith(".JobPostingCard"):
            cards.append(item)
    return postings, cards


def _extract_recommended_jobs(raw_response: Dict[str, Any]) -> List[RecommendedJobCard]:
    # Unwrap GraphQL nesting
    data_block = raw_response.get("data", {})
    payload = data_block.get("data", data_block)

    # Persist for debug
    debug_path = Path(get_data_folder_path(), "payload_debug.json")
    debug_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    results: List[RecommendedJobCard] = []

    # Handle LinkedIn's paged cards-by-collection shape
    if "jobsDashJobCardsByJobCollections" in payload:
        block = payload["jobsDashJobCardsByJobCollections"]
        elements = block.get("elements", [])
        if not elements:
            logging.warning(
                "No elements in jobsDashJobCardsByJobCollections; available keys: %s",
                list(block.keys())
            )
            return []
        for item in elements:
            # Extract URN and ID
            urn = item.get("entityUrn") or item.get("jobPostingUrn") or item.get("jobPosting", {}).get("entityUrn", "")
            if not urn:
                continue
            job_id = _urn_to_id(urn)

            # Core fields
            title = item.get("title") or item.get("jobPosting", {}).get("title", "")
            tracking_urn = item.get("trackingUrn")
            reposted = bool(
                item.get("repostedJob", False)
                or item.get("jobPosting", {}).get("repostedJob", False)
            )

            # Descriptions
            company = item.get("primaryDescription", {}).get("text")
            location = item.get("secondaryDescription", {}).get("text")

            # Footer items
            is_promoted = False
            listed_date: Optional[datetime] = None
            for f in item.get("footerItems", []):
                typ = f.get("type")
                if typ == "PROMOTED":
                    is_promoted = True
                elif typ == "LISTED_DATE" and f.get("timeAt"):
                    listed_date = datetime.fromtimestamp(f["timeAt"] / 1000, tz=timezone.utc)

            # Connection insight
            num_connections = None
            insight_txt = item.get("relevanceInsight", {}).get("text", {}).get("text", "")
            if insight_txt:
                m = re.match(r"(\d+)\s+connection", insight_txt)
                if m:
                    num_connections = int(m.group(1))

            # Logo & trackingId
            logo_data = item.get("logo", {}).get("attributes", {}).get("detailData", {})
            company_logo_urn = logo_data.get("companyLogo")
            tracking_id = item.get("trackingId")

            results.append(
                RecommendedJobCard(
                    job_id=job_id,
                    job_urn=urn,
                    title=title,
                    tracking_urn=tracking_urn,
                    reposted=reposted,
                    company=company,
                    location=location,
                    is_promoted=is_promoted,
                    listed_date=listed_date,
                    num_connections=num_connections,
                    company_logo_urn=company_logo_urn,
                    tracking_id=tracking_id
                )
            )
        return results

    # Fall back to GraphQL-style included processing
    included = payload.get("included", [])
    if not included:
        logging.warning(
            "No 'included' block found; available payload keys: %s",
            list(payload.keys())
        )
        return []

    postings, cards = _index_included(included)
    if not cards:
        logging.warning(
            "No JobPostingCard items in 'included'; total postings: %d",
            len(postings)
        )

    for card in cards:
        urn = card.get("jobPostingUrn") or card.get("jobPosting")
        if not urn or urn not in postings:
            continue
        post = postings[urn]

        job_id = _urn_to_id(urn)
        title = post.get("title", "").strip()
        tracking_urn = post.get("trackingUrn") or card.get("trackingUrn")
        reposted = bool(post.get("repostedJob", False))

        company = card.get("primaryDescription", {}).get("text")
        location = card.get("secondaryDescription", {}).get("text")

        is_promoted = False
        listed_date = None
        for f in card.get("footerItems", []):
            typ = f.get("type")
            if typ == "PROMOTED":
                is_promoted = True
            elif typ == "LISTED_DATE" and f.get("timeAt"):
                listed_date = datetime.fromtimestamp(f["timeAt"] / 1000, tz=timezone.utc)

        num_connections = None
        insight_txt = card.get("relevanceInsight", {}).get("text", {}).get("text", "")
        if insight_txt:
            m = re.match(r"(\d+)\s+connection", insight_txt)
            if m:
                num_connections = int(m.group(1))

        logo_data = card.get("logo", {}).get("attributes", {}).get("detailData", {})
        company_logo_urn = logo_data.get("companyLogo")
        tracking_id = card.get("trackingId")

        results.append(
            RecommendedJobCard(
                job_id=job_id,
                job_urn=urn,
                title=title,
                tracking_urn=tracking_urn,
                reposted=reposted,
                company=company,
                location=location,
                is_promoted=is_promoted,
                listed_date=listed_date,
                num_connections=num_connections,
                company_logo_urn=company_logo_urn,
                tracking_id=tracking_id
            )
        )
    return results


# ─── main ──────────────────────────────────────────────────────────────────
def main() -> None:
    load_dotenv()
    raw_tpl = Path(CURL_TEMPLATE_FILE).read_text(encoding="utf-8").strip()
    template = CurlRequest.from_curl_text(raw_tpl)
    commands: List[RequestCommand] = build_paged_commands(template, limit=LIMIT)
    logging.info("Prepared %d paged requests for recommended jobs", len(commands))

    raw_data = run_commands(commands, sleep_sec=SLEEP_SEC)
    job_pot = []
    for item in raw_data:
        jobs = _extract_recommended_jobs(item)
        job_pot.append(jobs)
    out_file = Path(get_data_folder_path(), OUTPUT_FILE)
    out_file.write_text(
        json.dumps([asdict(c) for c in cards], ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"Wrote {len(cards)} recommended-job cards → {out_file}")


if __name__ == "__main__":
    main()
