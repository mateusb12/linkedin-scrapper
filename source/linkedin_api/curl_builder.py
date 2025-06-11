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


@dataclass
class CurlRequest:
    url: str
    headers: Dict[str, str]
    cookies: Dict[str, str]
    query_id: str
    variables_template: str

    @classmethod
    def from_curl_text(cls, text: str) -> "CurlRequest":
        # 1. Remove backslash-newlines and CMD-carets for continuation
        lines = text.splitlines()
        cleaned_lines = []
        for line in lines:
            # strip trailing caret and whitespace
            cleaned = re.sub(r'\s*\^+\s*$', '', line)
            cleaned_lines.append(cleaned)
        one_line = " ".join(cleaned_lines)

        # 2. Remove any remaining stray carets
        one_line = one_line.replace("^", "")

        # 3. Tokenize with shlex (handles quoted segments)
        tokens = shlex.split(one_line)

        # 4. Extract first http(s) URL token
        url = next((t for t in tokens if t.startswith(("http://", "https://"))), "")
        if not url:
            raise ValueError("❌ No valid URL found in curl.txt")

        # 5. Parse out queryId and raw variables
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        qid = qs.get("queryId", [""])[0]
        rawv = qs.get("variables", [""])[0]
        unq = unquote_plus(rawv)
        # replace start:N with start:{start}
        var_t = re.sub(r"start\s*:\s*\d+", "start:{start}", unq)

        # 6. Extract all -H headers and the -b cookie string
        headers = {}
        cookie_str = ""
        for i, tok in enumerate(tokens):
            if tok in ("-H", "--header") and i + 1 < len(tokens):
                k, v = tokens[i + 1].split(":", 1)
                headers[k.strip().lower()] = v.strip()
            if tok in ("-b", "--cookie") and i + 1 < len(tokens):
                cookie_str = tokens[i + 1]

        # 7. Parse cookie string into dict
        cookies = {}
        for part in cookie_str.split(";"):
            if "=" in part:
                k, v = part.split("=", 1)
                cookies[k.strip().strip('"')] = v.strip().strip('"')

        return cls(
            url=url,
            headers=headers,
            cookies=cookies,
            query_id=qid,
            variables_template=var_t,
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
        # Percent-encode any header values that aren’t pure Latin-1
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


# Example usage
if __name__ == "__main__":
    CURL_FILE = "curl.txt"
    raw_curl = load_curl_file(CURL_FILE)
    req = CurlRequest.from_curl_text(raw_curl)
    errs = req.validate()
    if errs:
        print("Validation errors:")
        for e in errs:
            print(" -", e)
    else:
        print("Reconstructed curl command:")
        print(req.to_curl())
