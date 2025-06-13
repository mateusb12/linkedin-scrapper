#!/usr/bin/env python3
# curl_command_builder.py
"""
Converte o curl.txt em uma lista de Command objects.
Nenhuma requisição HTTP é feita aqui – só preparação.
"""

from dataclasses import dataclass
from typing import Dict, List
from urllib.parse import urlparse

from source.linkedin_api.curl_txt_reader import CurlRequest
from source.path.file_content_loader import load_curl_file


@dataclass
class Command:
    """Representa uma chamada GET paginável do LinkedIn."""
    method: str
    url_template: str
    headers: Dict[str, str]
    cookies: Dict[str, str]
    page_size: int = 10


def build_commands(curl_file: str = "curl.txt", page_size: int = 10) -> List[Command]:
    raw = load_curl_file(curl_file)
    req = CurlRequest.from_curl_text(raw)

    errs = req.validate()
    if errs:
        raise ValueError(f"Validation errors on curl.txt: {errs}")

    # Monta a URL‐base com placeholder {start}
    parsed = urlparse(req.url)
    base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    url_tmpl = f"{base_url}?queryId={req.query_id}&variables={req.variables_template}"

    # Headers / cookies já vêm do próprio CurlRequest
    session = req.build_session()

    cmd = Command(
        method="GET",
        url_template=url_tmpl,
        headers=dict(session.headers),
        cookies=session.cookies.get_dict(),
        page_size=page_size,
    )
    return [cmd]  # mantido como lista para futura extensibilidade


def main():
    curl_file = "curl.txt"
    commands = build_commands(curl_file)
    return


if __name__ == "__main__":
    main()
