#!/usr/bin/env python3
"""
curl_command_executor.py

Consome a lista de Command gerada pelo builder, faz as chamadas HTTP,
aplica filtro de data e grava o JSON final.
"""

import json
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional

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
    datefmt="%H:%M:%S",
)


# ─── HELPERS ────────────────────────────────────────────────────────────────
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


def _trim(job: dict) -> dict:
    urn = job.get("entityUrn", job.get("trackingUrn", ""))
    m = re.search(r"jobPosting:(\d+)", urn)
    jid = int(m.group(1)) if m else urn

    def _text(field: str):
        v = job.get(field) or {}
        return v.get("text") if isinstance(v, dict) else None

    applied = None
    insights = job.get("insightsResolutionResults") or []
    if insights:
        simp = (insights[0].get("simpleInsight") or {}).get("title", {})
        applied = simp.get("text")

    return {
        "job_id": jid,
        "title": _text("title"),
        "company": _text("primarySubtitle"),
        "location": _text("secondarySubtitle"),
        "applied_on": applied,
        "url": job.get("navigationUrl"),
    }


def _fetch_json(session: requests.Session, cmd: Command) -> Optional[dict]:
    logging.info("GET page %d → %s", cmd.page_idx + 1, cmd.url)
    try:
        resp = session.get(cmd.url, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logging.error("Erro no fetch: %s", e)
        return None


def execute_commands(commands: List[Command],
                     date_filter: Optional[Dict[str, int]] = None) -> List[dict]:
    if not commands:
        return []

    # Reaproveita headers/cookies do primeiro comando para a sessão
    sess = requests.Session()
    sess.headers.update(commands[0].headers)
    for n, v in commands[0].cookies.items():
        sess.cookies.set(n, v)

    threshold = datetime.now() - relativedelta(**date_filter) if date_filter else None
    jobs, stop = [], False

    for cmd in commands:
        if stop:
            break

        data = _fetch_json(sess, cmd)
        if not data:
            continue

        included_idx = {
            (inc.get("entityUrn") or inc.get("$id")): inc
            for inc in data.get("included", [])
            if isinstance(inc, dict)
        }

        clusters = data["data"]["data"]["searchDashClustersByAll"]["elements"]
        for cl in clusters:
            for it in cl.get("items", []):
                job = included_idx.get(
                    it["item"]["*entityResult"],
                    {"entityUrn": it["item"]["*entityResult"]},
                )
                trimmed = _trim(job)

                # filtro de data
                if threshold and trimmed["applied_on"]:
                    if _applied_to_dt(trimmed["applied_on"]) < threshold:
                        logging.info(
                            "Threshold atingido em '%s' – parando nas páginas restantes",
                            trimmed["applied_on"],
                        )
                        stop = True
                        break

                jobs.append(job)
            if stop:
                break

    return jobs


# ─── MAIN ────────────────────────────────────────────────────────────────────
def main(
    curl_file: str = "curl.txt",
    output: str = f"{get_data_folder_path()}/results.json",
):
    cmds = build_commands(curl_file)
    logging.info("Commands gerados: %d", len(cmds))

    raw_jobs = execute_commands(cmds, DATE_FILTER)

    with open(output, "w", encoding="utf-8") as fh:
        json.dump([_trim(j) for j in raw_jobs], fh, ensure_ascii=False, indent=2)
    logging.info("Gravou %d jobs em %s", len(raw_jobs), output)


if __name__ == "__main__":
    main()
