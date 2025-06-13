#!/usr/bin/env python3
"""
fetch_applied_jobs.py

Parses curl.txt into a structured CurlRequest, validates it, builds a session,
then paginates through a LinkedIn GraphQL endpoint with full debug output,
and saves all fetched job entities to a JSON file.
"""

import logging
import math
import re
import time
import json
from datetime import datetime
from typing import Optional, List, Dict
from urllib.parse import urlparse

import requests
from dateutil.relativedelta import relativedelta

from source.linkedin_api.curl_builder import CurlRequest
from source.path.file_content_loader import load_curl_file
from source.path.path_reference import get_data_folder_path

# ──────────────────────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────────────────────
CURL_FILE = "curl.txt"
OUTPUT_FILE = f"{get_data_folder_path()}/results.json"
RETRY_SEC = 3
MAX_RETRIES = 3
PAGE_SIZE = 10
DATE_FILTER = {"years": 0, "months": 6, "days": 0}

# Turn on DEBUG to see headers, cookies, and request details
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)


# ──────────────────────────────────────────────────────────────────────────────
# FETCH & PAGINATE
# ──────────────────────────────────────────────────────────────────────────────

def fetch_page(session: requests.Session, base_url: str, query_id: str,
               var_tpl: str, start: int = 0) -> Optional[dict]:
    filled = var_tpl.format(start=start)
    full_url = f"{base_url}?queryId={query_id}&variables={filled}"
    logging.info("→ GET %s", full_url)

    r = session.get(full_url, timeout=15)
    logging.debug("SENT URL:     %s", r.request.url)
    logging.debug("SENT HEADERS: %s", r.request.headers)
    logging.debug("↪ status %d", r.status_code)

    try:
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logging.error("Fetch error: %s", e)
        return None


def convert_timestamp_string(text: str) -> datetime:
    """
    Given 'Applied 7mo ago', returns a datetime object.
    """
    m = re.match(r'Applied\s+(\d+)([a-zA-Z]+)\s+ago', text)
    if not m:
        return datetime.now()
    num, unit = int(m.group(1)), m.group(2).lower()
    now = datetime.now()
    if unit.startswith('mo'):
        return now - relativedelta(months=num)
    if unit.startswith('y'):
        return now - relativedelta(years=num)
    if unit.startswith('w'):
        return now - relativedelta(weeks=num)
    if unit.startswith('d'):
        return now - relativedelta(days=num)
    if unit.startswith('h'):
        return now - relativedelta(hours=num)
    return now


def iterate_all(
        session: requests.Session,
        base_url: str,
        query_id: str,
        var_tpl: str,
        time_filter: Optional[Dict[str, int]] = None
) -> List[Dict]:
    """
    Fetches all pages, but if time_filter is provided (e.g. {'months':6}),
    stops as soon as it sees an 'applied_on' older than now - time_filter.
    """
    jobs: List[Dict] = []
    start = 0

    if time_filter:
        threshold = datetime.now() - relativedelta(**time_filter)
        logging.info("Will stop at jobs older than %s", threshold.isoformat())
    else:
        threshold = None

    data = fetch_page(session, base_url, query_id, var_tpl, start)
    if not data:
        logging.critical("Initial fetch failed—exiting")
        return jobs

    included_idx = {
        inc.get("entityUrn") or inc.get("$id"): inc
        for inc in data.get("included", [])
        if isinstance(inc, dict)
    }

    total = data["data"]["data"]["searchDashClustersByAll"]["paging"]["total"]
    total_pages = math.ceil(total / PAGE_SIZE)
    logging.info("Total items: %d — %d pages", total, total_pages)

    stop = False
    while start < total and not stop:
        current_page = start // PAGE_SIZE + 1
        logging.info("→ page %d/%d (items %d–%d)",
                     current_page, total_pages,
                     start + 1, min(start + PAGE_SIZE, total))

        elems = data["data"]["data"]["searchDashClustersByAll"]["elements"]
        for cluster in elems:
            for item in cluster.get("items", []):
                job = included_idx.get(
                    item["item"]["*entityResult"],
                    {"entityUrn": item["item"]["*entityResult"]}
                )

                if threshold is not None:
                    trimmed = trim_job(job)
                    applied_str = trimmed.get("applied_on")
                    if applied_str:
                        applied_dt = convert_timestamp_string(applied_str)
                        if applied_dt < threshold:
                            logging.info(
                                "Encountered %s (%s) — older than threshold; stopping.",
                                trimmed["title"], applied_str
                            )
                            stop = True
                            break

                jobs.append(job)

            if stop:
                break
        if stop:
            break

        start += PAGE_SIZE
        for attempt in range(1, MAX_RETRIES + 1):
            data = fetch_page(session, base_url, query_id, var_tpl, start)
            if data:
                included_idx.update({
                    inc.get("entityUrn") or inc.get("$id"): inc
                    for inc in data.get("included", [])
                    if isinstance(inc, dict)
                })
                break
            logging.warning("Retry %d/%d in %ds", attempt, MAX_RETRIES, RETRY_SEC)
            time.sleep(RETRY_SEC)
        else:
            logging.critical("Exceeded retries—aborting")
            break

    return jobs


def trim_job(job: dict) -> dict:
    """
    Given a full EntityResultViewModel dict, return only the key info:
      - job_id       (int)
      - title        (str)
      - company      (str)
      - location     (str)
      - applied_on   (str)
      - url          (str)
    """
    urn = job.get("entityUrn", job.get("trackingUrn", ""))
    m = re.search(r"jobPosting:(\d+)", urn)
    job_id = int(m.group(1)) if m else urn

    def text_of(field):
        v = job.get(field) or {}
        return v.get("text") if isinstance(v, dict) else None

    applied_on = None
    insights = job.get("insightsResolutionResults") or []
    if insights:
        simp = insights[0].get("simpleInsight") or {}
        title = simp.get("title") or {}
        applied_on = title.get("text")

    return {
        "job_id": job_id,
        "title": text_of("title"),
        "company": text_of("primarySubtitle"),
        "location": text_of("secondarySubtitle"),
        "applied_on": applied_on,
        "url": job.get("navigationUrl"),
    }


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main():
    # 1) Load and parse curl.txt
    raw_curl = load_curl_file(CURL_FILE)
    req = CurlRequest.from_curl_text(raw_curl)

    # 2) Validate
    errs = req.validate()
    if errs:
        logging.error("Validation errors: %s", errs)
        return

    # 3) Show the reconstructed curl for manual testing
    print("\n--- reconstructed curl ---")
    print(req.to_curl())
    print("--- end curl ---\n")

    # 4) Build session and inspect it
    session = req.build_session()
    logging.debug("SESSION HEADERS:\n%s", session.headers)
    logging.debug("SESSION COOKIES:\n%s", session.cookies.get_dict())

    # 5) Extract base_url, query_id, and variables_template
    parsed = urlparse(req.url)
    base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

    # 6) Fetch all jobs
    jobs = iterate_all(session=session, base_url=base_url, query_id=req.query_id, var_tpl=req.variables_template,
                       time_filter=DATE_FILTER)

    # 7) Save results to JSON file
    trimmed = [trim_job(j) for j in jobs]

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(trimmed, f, ensure_ascii=False, indent=2)
    logging.info("Saved %d jobs to %s", len(jobs), OUTPUT_FILE)


if __name__ == "__main__":
    main()
