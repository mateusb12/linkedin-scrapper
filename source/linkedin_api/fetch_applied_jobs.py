#!/usr/bin/env python3
"""
fetch_applied_jobs.py

Parses curl.txt into a structured CurlRequest, validates it, builds a session,
then paginates through a LinkedIn GraphQL endpoint with full debug output.
"""

import logging
import math
import time
from typing import Optional
from urllib.parse import quote_plus, urlparse

import requests

from source.linkedin_api.curl_builder import CurlRequest
from source.path.file_content_loader import load_curl_file

# ──────────────────────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────────────────────
CURL_FILE = "curl.txt"
RETRY_SEC = 3
MAX_RETRIES = 3

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
    # DEBUG: log exactly what went over the wire
    logging.debug("SENT URL:     %s", r.request.url)
    logging.debug("SENT HEADERS: %s", r.request.headers)
    logging.debug("↪ status %d", r.status_code)

    try:
        r.raise_for_status()
        return r.json()
    except requests.HTTPError as he:
        logging.error("HTTP %s – %.200s", he, r.text.replace("\n", " "))
    except requests.RequestException as re:
        logging.error("Request failed: %s", re)
    return None


def iterate_all(session: requests.Session, base_url: str,
                query_id: str, var_tpl: str) -> None:
    page_size = 10
    start = 0

    # 1) Initial fetch to discover total
    data = fetch_page(session, base_url, query_id, var_tpl, start)
    if not data:
        logging.critical("Initial fetch failed—exiting")
        return

    # 2) Compute total items and pages
    total = data["data"]["data"]["searchDashClustersByAll"]["paging"]["total"]
    total_pages = math.ceil(total / page_size)
    logging.info("Total items: %d — %d pages", total, total_pages)

    # 3) Loop through all pages
    while start < total:
        current_page = start // page_size + 1
        logging.info(
            "→ Fetching page %d/%d (items %d–%d)",
            current_page,
            total_pages,
            start + 1,
            min(start + page_size, total),
        )

        elems = data["data"]["data"]["searchDashClustersByAll"]["elements"]
        for cluster in elems:
            for item in cluster.get("items", []):
                job = item["item"]["*entityResult"]
                logging.info(" • %s", job)
                print(job)

        # advance
        start += page_size
        if start >= total:
            break

        # retry logic for next page
        for attempt in range(1, MAX_RETRIES + 1):
            data = fetch_page(session, base_url, query_id, var_tpl, start)
            if data:
                break
            logging.warning("Retry %d/%d in %ds", attempt, MAX_RETRIES, RETRY_SEC)
            time.sleep(RETRY_SEC)
        else:
            logging.critical("Exceeded retries—aborting")
            return


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
    iterate_all(session, base_url, req.query_id, req.variables_template)


if __name__ == "__main__":
    main()
