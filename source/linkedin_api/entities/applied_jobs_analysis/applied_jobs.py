#!/usr/bin/env python3
"""
get_applied_jobs_details.py

Refactored to use a command-builder and executor approach for applied jobs.
Reads a GraphQL curl template, pages through applied-job endpoints,
fetches each page, then extracts and aggregates AppliedJob records.
"""
import re
import json
import time
import logging
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv

from source.linkedin_api.data_fetching.curl_txt_reader import CurlRequest
from source.path.file_content_loader import load_curl_file
from source.path.path_reference import get_data_folder_path

# Configurable paths
CURL_TEMPLATE_FILE = "applied_jobs_curl_example.txt"
OUTPUT_CLEAN = "applied_jobs_clean.json"
# Delay between requests (seconds)
SLEEP_SEC = 1

_RE_APPLIED = re.compile(r"Applied\s+(\d+)([a-zA-Z]+)\s+ago")


@dataclass
class AppliedJob:
    job_id: int
    title: Optional[str]
    company: Optional[str]
    location: Optional[str]
    applied_on: Optional[str]


@dataclass
class Command:
    method: str
    url: str
    headers: Dict[str, str]
    cookies: Dict[str, str]
    page_idx: int


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
    jid = None
    if "jobPosting" in urn:
        match = re.search(r"jobPosting:(\d+)", urn)
        jid = int(match.group(1)) if match else None

    def _text(field: str) -> Optional[str]:
        v = job.get(field) or {}
        return v.get("text") if isinstance(v, dict) else None

    insights = job.get("insightsResolutionResults") or []
    applied = None
    if insights:
        applied = (insights[0].get("simpleInsight") or {}).get("title", {}).get("text")

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
    clusters = data.get("data", {}).get("data", {})
    clusters = clusters.get("searchDashClustersByAll", {}).get("elements", [])

    results: List[AppliedJob] = []
    for cl in clusters:
        for item in cl.get("items", []):
            raw = included.get(item.get("item", {}).get("*entityResult"), {})
            results.append(_trim(raw))
    return results


def _first_page_json(
    req: CurlRequest,
    page_size: int
) -> Any:
    # replicate initial ping to get pagination
    parsed = req.url.split('?', 1)[0]
    first_url = f"{parsed}?queryId={req.query_id}&variables={req.variables_template.format(start=0)}"
    sess = req.build_session()
    resp = sess.get(first_url, timeout=15)
    resp.raise_for_status()
    return {
        "json": resp.json(),
        "headers": dict(sess.headers),  # type: ignore
        "cookies": sess.cookies.get_dict()
    }


def get_initial_ping(
    req: CurlRequest,
    override_page_size: int = 10
) -> (Any, int, int):
    first = _first_page_json(req, override_page_size)
    data = first["json"].get("data", {})
    paging = None
    # Strategy A
    try:
        inner = data.get("data", {})
        for section in inner.values():
            if isinstance(section, dict) and "paging" in section:
                paging = section["paging"]
                break
    except Exception:
        pass
    # Strategy B
    if not paging:
        paging = data.get("paging")
    # Strategy C
    if not paging:
        for v in data.values():
            if isinstance(v, dict) and "paging" in v:
                paging = v["paging"]
                break
    # Fallback
    if not paging:
        elems = data.get("elements") or []
        paging = {"total": len(elems), "count": len(elems)}
    total = paging.get("total", 0)
    per_page = paging.get("count", override_page_size)
    from math import ceil
    pages = ceil(total / per_page) if per_page else 0
    return first, per_page, pages


def build_commands() -> List[Command]:
    raw_curl = Path(CURL_TEMPLATE_FILE).read_text(encoding='utf-8').strip()
    template = CurlRequest.from_curl_text(raw_curl)
    errs = template.validate()
    errs = [e for e in errs if "variables_template missing '{start}'" not in e]
    if errs:
        raise ValueError(f"Invalid curl template: {errs}")

    first_page, page_sz, total_pages = get_initial_ping(template, override_page_size=None)
    base = template.url.split('?', 1)[0]
    url_tpl = f"{base}?queryId={template.query_id}&variables={template.variables_template}"

    commands: List[Command] = []
    for idx in range(total_pages):
        start = idx * page_sz
        url = url_tpl.format(start=start)
        commands.append(Command(
            method="GET",
            url=url,
            headers=first_page["headers"],
            cookies=first_page["cookies"],
            page_idx=idx
        ))
    return commands


def execute_commands(cmds: List[Command]) -> List[AppliedJob]:
    all_jobs: List[AppliedJob] = []
    for idx, cmd in enumerate(cmds, start=1):
        print(f"[{idx}/{len(cmds)}] Fetching page {cmd.page_idx}...")
        try:
            resp = requests.request(cmd.method, cmd.url, headers=cmd.headers, cookies=cmd.cookies, timeout=15)
            resp.raise_for_status()
            raw = resp.json()
            jobs = extract_applied_jobs(raw)
        except Exception as e:
            logging.warning("Failed fetch page %s: %s", cmd.page_idx, e)
            jobs = []
        all_jobs.extend(jobs)
        time.sleep(SLEEP_SEC)
    return all_jobs


def main():
    load_dotenv()
    commands = build_commands()
    applied_jobs = execute_commands(commands)

    data_folder = get_data_folder_path()
    out_path = Path(data_folder, OUTPUT_CLEAN)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump([asdict(j) for j in applied_jobs], f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(applied_jobs)} applied-job records to {out_path}")


if __name__ == '__main__':
    main()
