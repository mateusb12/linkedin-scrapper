#!/usr/bin/env python3
# curl_command_executor.py
"""
Lê Command objects, dispara as requisições paginadas,
agrega os resultados e grava o JSON final.
"""

import json
import logging
import math
import re
import time
from datetime import datetime
from typing import Dict, List, Optional

import requests
from dateutil.relativedelta import relativedelta

from curl_command_builder import Command, build_commands
from source.path.path_reference import get_data_folder_path


# ─── CONFIG ──────────────────────────────────────────────────────────────────
RETRY_SEC   = 3
MAX_RETRIES = 3
DATE_FILTER = {"years": 0, "months": 6, "days": 0}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)


# ─── HELPERS ────────────────────────────────────────────────────────────────
_RE_APPLIED = re.compile(r"Applied\s+(\d+)([a-zA-Z]+)\s+ago")


def _applied_to_datetime(txt: str) -> datetime:
    m = _RE_APPLIED.match(txt or "")
    if not m:
        return datetime.now()
    val, unit = int(m.group(1)), m.group(2).lower()
    if unit.startswith("mo"):
        return datetime.now() - relativedelta(months=val)
    if unit.startswith("y"):
        return datetime.now() - relativedelta(years=val)
    if unit.startswith("w"):
        return datetime.now() - relativedelta(weeks=val)
    if unit.startswith("d"):
        return datetime.now() - relativedelta(days=val)
    if unit.startswith("h"):
        return datetime.now() - relativedelta(hours=val)
    return datetime.now()


def _trim(job: dict) -> dict:
    urn = job.get("entityUrn", job.get("trackingUrn", ""))
    m = re.search(r"jobPosting:(\d+)", urn)
    jid = int(m.group(1)) if m else urn

    to_text = lambda f: (job.get(f) or {}).get("text") if isinstance(job.get(f), dict) else None

    applied = None
    insights = job.get("insightsResolutionResults") or []
    if insights:
        simp = (insights[0].get("simpleInsight") or {}).get("title", {})
        applied = simp.get("text")

    return {
        "job_id": jid,
        "title": to_text("title"),
        "company": to_text("primarySubtitle"),
        "location": to_text("secondarySubtitle"),
        "applied_on": applied,
        "url": job.get("navigationUrl"),
    }


def _fetch(session: requests.Session, cmd: Command, start: int) -> Optional[dict]:
    url = cmd.url_template.format(start=start)
    logging.info("GET %s", url)
    res = session.get(url, timeout=15)
    try:
        res.raise_for_status()
        return res.json()
    except Exception as e:
        logging.error("Fetch error: %s", e)
        return None


def _run_paginated(session: requests.Session, cmd: Command,
                   time_filter: Optional[Dict[str, int]]) -> List[dict]:
    jobs, start, page_sz = [], 0, cmd.page_size
    thresh = datetime.now() - relativedelta(**time_filter) if time_filter else None
    data = _fetch(session, cmd, start)
    if not data:
        return jobs

    included = {
        (inc.get("entityUrn") or inc.get("$id")): inc
        for inc in data.get("included", [])
        if isinstance(inc, dict)
    }
    total = data["data"]["data"]["searchDashClustersByAll"]["paging"]["total"]
    pages = math.ceil(total / page_sz)
    logging.info("Total items: %d (~%d pages)", total, pages)

    stop = False
    while start < total and not stop:
        logging.info("→ page %d/%d", start // page_sz + 1, pages)
        clusters = data["data"]["data"]["searchDashClustersByAll"]["elements"]
        for cl in clusters:
            for it in cl.get("items", []):
                job = included.get(it["item"]["*entityResult"],
                                   {"entityUrn": it["item"]["*entityResult"]})
                if thresh:
                    appl = _trim(job).get("applied_on")
                    if appl and _applied_to_datetime(appl) < thresh:
                        logging.info("Hit threshold (%s) – stopping", appl)
                        stop = True
                        break
                jobs.append(job)
            if stop:
                break

        if stop:
            break
        start += page_sz
        for att in range(1, MAX_RETRIES + 1):
            data = _fetch(session, cmd, start)
            if data:
                included.update({
                    (inc.get("entityUrn") or inc.get("$id")): inc
                    for inc in data.get("included", [])
                    if isinstance(inc, dict)
                })
                break
            logging.warning("retry %d/%d in %ds", att, MAX_RETRIES, RETRY_SEC)
            time.sleep(RETRY_SEC)
        else:
            logging.critical("Exceeded retries – aborting")
            break

    return jobs


# ─── MAIN ────────────────────────────────────────────────────────────────────
def main(curl_file: str = "curl.txt",
         output: str = f"{get_data_folder_path()}/results.json"):
    cmds = build_commands(curl_file)
    if not cmds:
        logging.error("No commands to execute.")
        return

    all_jobs: List[dict] = []
    for cmd in cmds:
        sess = requests.Session()
        sess.headers.update(cmd.headers)
        for n, v in cmd.cookies.items():
            sess.cookies.set(n, v)

        all_jobs.extend(_run_paginated(sess, cmd, DATE_FILTER))

    with open(output, "w", encoding="utf-8") as fh:
        json.dump([_trim(j) for j in all_jobs], fh, ensure_ascii=False, indent=2)
    logging.info("Saved %d jobs → %s", len(all_jobs), output)


if __name__ == "__main__":
    main()
