#!/usr/bin/env python3
"""
curl_command_builder.py

1. Converte curl.txt em CurlRequest.
2. Faz um 'ping' (start=0) para descobrir quantos itens/páginas há.
3. Gera uma lista de Command (um por página) pronta para o executor.
"""

from dataclasses import dataclass
from math import ceil
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

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
    """
    Dispara a requisição start=0 e devolve:
      - os dados JSON
      - headers iniciais
      - cookies iniciais
    """
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
        headers=sess.headers,              # type: ignore[attr-defined]
        cookies=sess.cookies.get_dict()
    )


def build_commands(
    curl_file: str = "curl.txt",
    page_size: Optional[int] = None,
) -> List[Command]:
    """Retorna a lista completa de Command – um por página."""
    raw = load_curl_file(curl_file)
    req = CurlRequest.from_curl_text(raw)

    errs = req.validate()
    if errs:
        raise ValueError(f"curl.txt inválido: {errs!r}")

    # ── ping inicial ─────────────────────────────────────────────────────────
    first_page = _first_page_json(req, PAGE_SIZE_DEFAULT)

    paging = (
        first_page.json["data"]
                       ["data"]
                       ["searchDashClustersByAll"]
                       ["paging"]
    )
    total_items = paging["total"]
    page_sz = page_size or paging.get("count") or PAGE_SIZE_DEFAULT
    total_pages = ceil(total_items / page_sz)

    # ── monta comandos ──────────────────────────────────────────────────────
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
