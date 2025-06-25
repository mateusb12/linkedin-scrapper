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

from backend.linkedin_api.data_fetching.curl_commands import run_commands, build_paged_commands, RequestCommand
from backend.linkedin_api.data_fetching.curl_txt_reader import CurlRequest
from backend.path.path_reference import get_data_folder_path
from backend.utils.json_utils import save_json_local

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
    listed_date: Optional[str] = None
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
    # 1) peel off the inner data block
    data_block = raw_response.get("data", {}) or {}
    payload = data_block.get("data", data_block) or {}

    # 2) index the included list
    included = raw_response.get("included", []) or []
    postings_map, cards_list = _index_included(included)
    cards_map = {card.get("entityUrn", ""): card for card in cards_list}

    results: List[RecommendedJobCard] = []
    block = payload.get("jobsDashJobCardsByJobCollections") or {}
    elements = block.get("elements", []) or []

    if not elements:
        logging.warning(
            "No elements in jobsDashJobCardsByJobCollections; available keys: %s",
            list(block.keys())
        )
        return []

    for el in elements:
        wrapper = el.get("jobCard") or {}
        card_urn = wrapper.get("*jobPostingCard")
        if not card_urn:
            logging.warning("No jobPostingCard URN in element: %s", el)
            continue

        card = cards_map.get(card_urn)
        if not card:
            logging.warning("No included card data for URN %s", card_urn)
            continue

        # find the underlying posting
        posting_urn = card.get("*jobPosting") or ""
        job_id = _urn_to_id(posting_urn)
        post = postings_map.get(posting_urn) or {}

        # title
        title_block = card.get("title") or {}
        title = title_block.get("text") or card.get("jobPostingTitle") or ""

        # tracking & repost
        tracking_urn = post.get("trackingUrn")
        reposted = bool(post.get("repostedJob"))

        # company & location
        company_block = card.get("primaryDescription") or {}
        company = company_block.get("text")
        location_block = card.get("secondaryDescription") or {}
        location = location_block.get("text")

        # footerItems → promoted + listed date
        footer_items = card.get("footerItems") or []
        is_promoted = any((f or {}).get("type") == "PROMOTED" for f in footer_items)

        listed_date: Optional[str] = None
        for f in footer_items:
            f = f or {}
            if f.get("type") == "LISTED_DATE" and f.get("timeAt"):
                dt = datetime.fromtimestamp(f["timeAt"] / 1000, tz=timezone.utc)
                listed_date = dt.isoformat()

        # connection insight (e.g. “1 school alum works here”)
        insight_block = card.get("relevanceInsight") or {}
        text_block = insight_block.get("text") or {}
        insight_txt = text_block.get("text") or ""
        num_connections = None
        m = re.match(r"(\d+)\b", insight_txt)
        if m:
            num_connections = int(m.group(1))

        # company logo URN
        logo_block = card.get("logo") or {}
        attrs = logo_block.get("attributes") or []
        company_logo_urn = None
        if attrs and isinstance(attrs, list):
            detail = (attrs[0] or {}).get("detailData") or {}
            company_logo_urn = detail.get("*companyLogo")

        # trackingId
        tracking_id = card.get("trackingId")

        results.append(
            RecommendedJobCard(
                job_id=job_id,
                job_urn=posting_urn,
                title=title.strip(),
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

    # build N paged requests
    commands = build_paged_commands(template, limit=LIMIT)
    logging.info("Prepared %d paged requests for recommended jobs", len(commands))

    # fire them all off
    raw_data = run_commands(commands, sleep_sec=SLEEP_SEC)

    # collect & flatten
    all_jobs: List[RecommendedJobCard] = []
    for page_resp in raw_data:
        page_jobs = _extract_recommended_jobs(page_resp)
        all_jobs.extend(page_jobs)

    # serialize
    out_path = Path(get_data_folder_path(), OUTPUT_FILE)
    out_path.write_text(
        json.dumps([asdict(job) for job in all_jobs], ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print(f"Wrote {len(all_jobs)} recommended-job cards → {out_path}")


if __name__ == "__main__":
    main()
