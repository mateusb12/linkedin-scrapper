import logging
from dataclasses import dataclass, field
from typing import Dict, Optional, List
import shlex
import re
from urllib.parse import urlparse, parse_qs, unquote_plus

import requests

from source.path.file_content_loader import load_curl_file


def percent_encode_non_latin1(s: str) -> str:
    """Percent-encode any character that fails Latin-1 encoding."""
    out = []
    for ch in s:
        try:
            ch.encode("latin-1")
            out.append(ch)
        except UnicodeEncodeError:
            for b in ch.encode("utf-8"):
                out.append(f"%{b:02X}")
    return "".join(out)


def parse_raw_cookies(raw: str) -> Dict[str, str]:
    """Parse a raw cookie string into a dict."""
    jar = {}
    for part in raw.split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            jar[k.strip().strip('"')] = v.strip().strip('"')
    return jar


def clean_line_continuations(text: str) -> list[str]:
    """
    Remove backslash-newlines and CMD caret continuations from each line.
    """
    lines = text.splitlines()
    cleaned = []
    for line in lines:
        line = re.sub(r"\\$", "", line)
        line = re.sub(r"\s*\^+\s*$", "", line)
        cleaned.append(line)
    return cleaned


def merge_into_one_line(lines: list[str]) -> str:
    """
    Join cleaned lines into a single string and strip stray carets.
    """
    cmd = " ".join(lines)
    return cmd.replace("^", "")


def tokenize(command: str) -> list[str]:
    """
    Split command string into tokens, respecting quotes.
    """
    return shlex.split(command)


def extract_url(tokens: list[str]) -> str:
    """
    Find the first HTTP/HTTPS URL in tokens.
    """
    for t in tokens:
        if t.startswith(("http://", "https://")):
            return t
    raise ValueError("❌ No valid URL found in curl.txt")


def parse_query_variables(url: str) -> tuple[str, str]:
    """
    Extract 'queryId' and template-formatted 'variables' from URL query string.
    """
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    query_id = qs.get("queryId", [""])[0]
    raw_vars = qs.get("variables", [""])[0]
    unquoted = unquote_plus(raw_vars)
    template = re.sub(r"start\s*:\s*\d+", "start:{start}", unquoted)
    return query_id, template


def extract_headers_and_cookie(tokens: list[str]) -> tuple[dict[str, str], str]:
    """
    Extract header key-values and raw cookie string from tokens.
    """
    headers: dict[str, str] = {}
    cookie_str = ""
    for idx, tok in enumerate(tokens):
        if tok in ("-H", "--header") and idx + 1 < len(tokens):
            key, val = tokens[idx + 1].split(":", 1)
            headers[key.strip().lower()] = val.strip()
        if tok in ("-b", "--cookie") and idx + 1 < len(tokens):
            cookie_str = tokens[idx + 1]
    return headers, cookie_str


def parse_cookies(cookie_str: str) -> dict[str, str]:
    """
    Split cookie string into individual cookies and return as dict.
    """
    cookies: dict[str, str] = {}
    for part in cookie_str.split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            cookies[k.strip().strip('"')] = v.strip().strip('"')
    return cookies


@dataclass
class CurlRequest:
    url: str
    headers: Dict[str, str]
    cookies: Dict[str, str]
    query_id: str
    variables_template: str

    @classmethod
    def from_curl_text(cls, text: str) -> "CurlRequest":
        cleaned: list[str] = clean_line_continuations(text)
        one_line: str = merge_into_one_line(cleaned)
        tokens: list[str] = tokenize(one_line)
        url: str = extract_url(tokens)
        query_id, variables_template = parse_query_variables(url)
        headers, cookie_str = extract_headers_and_cookie(tokens)
        cookies: dict = parse_cookies(cookie_str)

        return cls(
            url=url,
            headers=headers,
            cookies=cookies,
            query_id=query_id,
            variables_template=variables_template,
        )

    def validate(self) -> List[str]:
        errors: List[str] = []
        if not self.url.startswith(("http://", "https://")):
            errors.append("Invalid URL")
        if not self.headers:
            errors.append("No headers parsed")
        if not self.cookies:
            errors.append("No cookies parsed")
        if not self.query_id:
            errors.append("Missing query_id")
        if "{start}" not in self.variables_template:
            errors.append("variables_template missing '{start}'")
        return errors

    def to_curl(self) -> str:
        parts = [f'curl "{self.url}"']
        for k, v in self.headers.items():
            parts.append(f'-H "{k}: {v}"')
        if self.cookies:
            cookie_pairs = [f"{k}={v}" for k, v in self.cookies.items()]
            parts.append(f'-b "{"; ".join(cookie_pairs)}"')
        return " \\\n  ".join(parts)

    def build_session(self) -> requests.Session:
        sess = requests.Session()
        clean_h: Dict[str, str] = {}
        for k, v in self.headers.items():
            try:
                v.encode("latin-1")
                clean_h[k] = v
            except UnicodeEncodeError:
                enc = "".join(f"%{b:02X}" for b in v.encode("utf-8"))
                clean_h[k] = enc
                logging.warning("Header %r contained non-Latin1 → percent-encoded", k)
        sess.headers.update(clean_h)
        sess.cookies.update(self.cookies)
        return sess


def main():
    curl_file = "curl.txt"
    raw_curl = load_curl_file(curl_file)
    req = CurlRequest.from_curl_text(raw_curl)
    errs = req.validate()
    if errs:
        print("Validation errors:")
        for e in errs:
            print(" -", e)
    else:
        print("Reconstructed curl command:")
        print(req.to_curl())


# Example usage
if __name__ == "__main__":
    main()
