#!/usr/bin/env python3
"""
curl_commands.py

Shared helpers for:
    • Deriving paged Command objects from a single GraphQL curl capture.
    • Uniform command execution with retry/sleep logic.
Only entity-specific modules need to
    – create Command lists (any way they want), and
    – hand us “extract(json) -> List[T]”.
"""

from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterable, List, Sequence, TypeVar

import requests

from source.linkedin_api.data_fetching.curl_txt_reader import CurlRequest

T = TypeVar("T")  # generic return type from extractor


# ──────────────────────────────────────────────────────────────
# Command ─ a single HTTP request description
# ──────────────────────────────────────────────────────────────
@dataclass(slots=True)
class Command:
    method: str
    url: str
    headers: Dict[str, str]
    cookies: Dict[str, str]
    meta: Dict[str, Any] | None = None  # page idx, job id, etc.


# ──────────────────────────────────────────────────────────────
# Internal helpers for the common “paged GraphQL list” pattern
# ──────────────────────────────────────────────────────────────
def _first_page_json(req: CurlRequest, page_size: int | None) -> Dict[str, Any]:
    base, query = req.url.split("?", 1)
    first_url = f"{base}?queryId={req.query_id}&variables={req.variables_template.format(start=0)}"
    sess = req.build_session()
    resp = sess.get(first_url, timeout=15)
    resp.raise_for_status()
    return {
        "json": resp.json(),
        "headers": dict(sess.headers),  # type: ignore[arg-type]
        "cookies": sess.cookies.get_dict(),
    }


def _find_paging_block(data: Dict[str, Any]) -> Dict[str, Any] | None:
    """
    LinkedIn shuffles `paging` around; hunt for the first key that has it.
    """
    # common locations
    if "paging" in data:
        return data["paging"]
    if "elements" in data:
        return {"total": len(data["elements"]), "count": len(data["elements"])}
    # dive one level deep looking for paging
    for v in data.values():
        if isinstance(v, dict) and "paging" in v:
            return v["paging"]
    return None


def _get_initial_ping(
    req: CurlRequest, override_page_size: int | None = None
) -> tuple[Dict[str, Any], int, int]:
    first = _first_page_json(req, override_page_size)
    data_block = first["json"].get("data", {}).get("data", {}) or first["json"].get("data", {})
    paging = _find_paging_block(data_block) or {"total": 0, "count": override_page_size or 10}

    per_page = paging.get("count") or override_page_size or 10
    total_pages = math.ceil((paging.get("total") or 0) / per_page) if per_page else 0
    return first, per_page, total_pages


# ──────────────────────────────────────────────────────────────
# Public helper: build one Command per page
# ──────────────────────────────────────────────────────────────
def build_paged_commands(
    template: CurlRequest, override_page_size: int | None = None
) -> List[Command]:
    first_page, page_sz, total_pages = _get_initial_ping(template, override_page_size)

    base = template.url.split("?", 1)[0]
    url_tpl = f"{base}?queryId={template.query_id}&variables={template.variables_template}"

    cmds: List[Command] = []
    for idx in range(total_pages):
        url = url_tpl.format(start=idx * page_sz)
        cmds.append(
            Command(
                method="GET",
                url=url,
                headers=first_page["headers"],
                cookies=first_page["cookies"],
                meta={"page": idx},
            )
        )
    return cmds


# ──────────────────────────────────────────────────────────────
# Public helper: execute an iterable of Commands
# ──────────────────────────────────────────────────────────────
def run_commands(
    commands: Sequence[Command],
    extractor: Callable[[Dict[str, Any]], List[T]],
    sleep_sec: float = 1.0,
    log: logging.Logger | None = None,
) -> List[T]:
    """
    Fires each Command and pipes its JSON body through *extractor*.
    Collects and returns all extracted items.
    """
    log = log or logging.getLogger(__name__)
    results: List[T] = []

    for idx, cmd in enumerate(commands, start=1):
        log.info("Fetching %s of %s – %s", idx, len(commands), cmd.meta or cmd.url)
        try:
            resp = requests.request(
                cmd.method,
                cmd.url,
                headers=cmd.headers,
                cookies=cmd.cookies,
                timeout=15,
            )
            resp.raise_for_status()
            results.extend(extractor(resp.json()))
        except Exception as exc:  # noqa: BLE001
            log.warning("cmd failed (%s): %s", cmd.meta or cmd.url, exc)
        time.sleep(sleep_sec)

    return results
