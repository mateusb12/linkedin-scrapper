#!/usr/bin/env python3
"""
curl_command_executor.py

Consome a lista de Command gerada pelo builder, faz as chamadas HTTP,
aplica filtro de data e grava o JSON final.
"""

import json
import logging
import re
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import requests
from dateutil.relativedelta import relativedelta

from curl_command_builder import Command, build_commands
from source.path.path_reference import get_data_folder_path

# ─── CONFIG ──────────────────────────────────────────────────────────────────
DATE_FILTER = {"years": 0, "months": 6, "days": 0}
LOGLEVEL = logging.INFO

logging.basicConfig(
    level=LOGLEVEL,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%(H:%M:%S")


# ─── DOMAIN MODEL ─────────────────────────────────────────────────────────────
@dataclass
class AppliedJob:
    job_id: int
    title: Optional[str]
    company: Optional[str]
    location: Optional[str]
    applied_on: Optional[str]


# ─── HELPERS ──────────────────────────────────────────────────────────────────
_RE_APPLIED = re.compile(r"Applied\s+(\d+)([a-zA-Z]+)\s+ago")


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


def _trim(job: dict) -> AppliedJob:
    urn = job.get("entityUrn", job.get("trackingUrn", ""))
    m = re.search(r"jobPosting:(\d+)", urn)
    jid = int(m.group(1)) if m else None

    def _text(field: str) -> Optional[str]:
        v = job.get(field) or {}
        return v.get("text") if isinstance(v, dict) else None

    applied = None
    insights = job.get("insightsResolutionResults") or []
    if insights:
        simp = (insights[0].get("simpleInsight") or {}).get("title", {})
        applied = simp.get("text")

    return AppliedJob(
        job_id=jid,
        title=_text("title"),
        company=_text("primarySubtitle"),
        location=_text("secondarySubtitle"),
        applied_on=applied,
    )


def _fetch_json(session: requests.Session, cmd: Command) -> Optional[dict]:
    logging.info("GET page %d → %s", cmd.page_idx + 1, cmd.url)
    try:
        resp = session.get(cmd.url, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logging.error("Erro no fetch: %s", e)
        return None


# ─── EXTRACTION LOGIC ─────────────────────────────────────────────────────────
def _extract_jobs_from_response(data: dict) -> List[AppliedJob]:
    """
    Extrai AppliedJob de um JSON de resposta.
    """
    included_idx = {
        (inc.get("entityUrn") or inc.get("$id")): inc
        for inc in data.get("included", [])
        if isinstance(inc, dict)
    }
    clusters = data["data"]["data"]["searchDashClustersByAll"]["elements"]
    extracted: List[AppliedJob] = []

    for cl in clusters:
        for it in cl.get("items", []):
            job_dict = included_idx.get(
                it["item"]["*entityResult"],
                {"entityUrn": it["item"]["*entityResult"]},
            )
            extracted.append(_trim(job_dict))

    return extracted


# ─── EXECUTION ─────────────────────────────────────────────────────────────────
def execute_commands(
        commands: List[Command],
        date_filter: Optional[Dict[str, int]] = None
) -> List[AppliedJob]:
    """
    Executa a lista de comandos, aplica filtro de data e retorna jobs como AppliedJob.
    """
    if not commands:
        return []

    sess = requests.Session()
    sess.headers.update(commands[0].headers)
    for n, v in commands[0].cookies.items():
        sess.cookies.set(n, v)

    threshold = datetime.now() - relativedelta(**date_filter) if date_filter else None
    results: List[AppliedJob] = []
    stop = False

    for cmd in commands:
        if stop:
            break

        data = _fetch_json(sess, cmd)
        if not data:
            continue

        jobs = _extract_jobs_from_response(data)
        for job in jobs:
            if threshold and job.applied_on:
                if _applied_to_dt(job.applied_on) < threshold:
                    logging.info(
                        "Threshold atingido em '%s' – parando nas páginas restantes",
                        job.applied_on,
                    )
                    stop = True
                    break

            results.append(job)
        if stop:
            break

    return results


# ─── MAIN ────────────────────────────────────────────────────────────────────
def main(
        curl_file: str = "curl.txt",
        output: str = f"{get_data_folder_path()}/recommended_jobs.json",
):
    cmds = build_commands(curl_file)
    logging.info("Commands gerados: %d", len(cmds))

    jobs = execute_commands(cmds, DATE_FILTER)

    with open(output, "w", encoding="utf-8") as fh:
        json.dump([asdict(job) for job in jobs], fh, ensure_ascii=False, indent=2)
    logging.info("Gravou %d jobs em %s", len(jobs), output)


if __name__ == "__main__":
    main()
