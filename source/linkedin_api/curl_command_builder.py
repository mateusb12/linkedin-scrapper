#!/usr/bin/env python3
"""
curl_command_builder.py

1. Converte curl.txt em CurlRequest.
2. Faz um 'ping' (start=0) para descobrir quantos itens/páginas há (com estratégias fallback).
3. Gera uma lista de Command (um por página) pronta para o executor.
"""

from dataclasses import dataclass
from math import ceil
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse
import json

from source.linkedin_api.curl_txt_reader import CurlRequest
from source.path.file_content_loader import load_curl_file


@dataclass
class Command:
    """Requisição HTTP real – já com o start resolvido."""
    method: str
    url: str
    headers: Dict[str, str]
    cookies: Dict[str, str]
    page_idx: int


@dataclass
class FirstPageResult:
    json: dict
    headers: Dict[str, str]
    cookies: Dict[str, str]


PAGE_SIZE_DEFAULT = 10


def _first_page_json(
    req: CurlRequest,
    page_size: int
) -> FirstPageResult:
    parsed = urlparse(req.url)
    base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    first_url = (
        f"{base_url}"
        f"?queryId={req.query_id}"
        f"&variables={req.variables_template.format(start=0)}"
    )
    sess = req.build_session()
    resp = sess.get(first_url, timeout=15)
    resp.raise_for_status()
    return FirstPageResult(
        json=resp.json(),
        headers=sess.headers,  # type: ignore[attr-defined]
        cookies=sess.cookies.get_dict()
    )


def get_initial_ping(
    req: CurlRequest,
    override_page_size: Optional[int] = None
) -> Tuple[FirstPageResult, int, int]:
    # executa ping inicial
    first_page = _first_page_json(req, override_page_size or PAGE_SIZE_DEFAULT)

    # DEBUG: exibe a resposta completa para análise
    print("DEBUG: first_page.json =", json.dumps(first_page.json, indent=2))

    data = first_page.json.get("data", {})
    print("DEBUG: data keys =", list(data.keys()))

    paging = None
    # Strategy A: nested under data.data.<key>.paging
    try:
        inner = data.get("data", {})
        for section_key, section in inner.items():
            if isinstance(section, dict) and "paging" in section:
                paging = section["paging"]
                print(f"DEBUG: found paging in data.data['{section_key}']")
                break
    except Exception as e:
        print("DEBUG: Strategy A failed:", e)

    # Strategy B: direct data.paging
    if paging is None:
        paging = data.get("paging")
        if paging:
            print("DEBUG: found paging in data['paging']")

    # Strategy C: scan top-level for any 'paging'
    if paging is None:
        for key, value in data.items():
            if isinstance(value, dict) and "paging" in value:
                paging = value["paging"]
                print(f"DEBUG: found paging in data['{key}']")
                break

    # Strategy D: fallback to count of elements
    if paging is None:
        elements = data.get("elements") or []
        count = len(elements)
        paging = {"total": count, "count": count}
        print("DEBUG: fallback to elements count, count =", count)

    total_items = paging.get("total", 0)
    page_sz = override_page_size or paging.get("count") or PAGE_SIZE_DEFAULT
    total_pages = ceil(total_items / page_sz) if page_sz > 0 else 0
    print(f"DEBUG: total_items={total_items}, page_sz={page_sz}, total_pages={total_pages}")

    return first_page, page_sz, total_pages


def build_commands(
    curl_file: str = "curl.txt",
    page_size: Optional[int] = None,
) -> List[Command]:
    raw = load_curl_file(curl_file)
    req = CurlRequest.from_curl_text(raw)
    errs = req.validate()
    if errs:
        raise ValueError(f"curl.txt inválido: {errs!r}")

    first_page, page_sz, total_pages = get_initial_ping(req, page_size)

    parsed = urlparse(req.url)
    base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    url_tmpl = (
        f"{base_url}"  
        f"?queryId={req.query_id}"  
        f"&variables={req.variables_template}"
    )
    commands: List[Command] = []
    for idx in range(total_pages):
        start = idx * page_sz
        commands.append(Command(
            method="GET",
            url=url_tmpl.format(start=start),
            headers=dict(first_page.headers),
            cookies=dict(first_page.cookies),
            page_idx=idx,
        ))
    return commands


def main():
    commands = build_commands("curl.txt", page_size=10)
    for cmd in commands:
        print(f"Command {cmd.page_idx + 1}: {cmd.url}")


if __name__ == "__main__":
    main()
