#!/usr/bin/env python3
# linkedin_from_curl.py

import shlex
import re
import logging
import time
import requests

from urllib.parse import urlparse, parse_qs, quote_plus, unquote_plus

from source.path.file_content_loader import load_curl_file

# ──────────────────────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────────────────────
CURL_FILE = "curl.txt"
RETRY_SEC = 3
MAX_RETRIES = 3

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)


# ──────────────────────────────────────────────────────────────────────────────
# UTILITIES
# ──────────────────────────────────────────────────────────────────────────────

def percent_encode_non_latin1(s: str) -> str:
    """
    Turn any non-Latin-1 byte into %XX escapes.
    """
    out = []
    for b in s.encode("utf-8"):
        if b <= 0xFF:
            out.append(chr(b))
        else:
            out.append(f"%{b:02X}")
    return "".join(out)


def parse_raw_cookies(raw: str) -> dict[str, str]:
    """
    "foo=bar; baz=qux" → {"foo":"bar","baz":"qux"}
    """
    jar = {}
    for part in raw.split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            jar[k.strip()] = v.strip().strip('"')
    return jar


def parse_curl_from_string(txt: str):
    """
    Read a single-line (or backslash-continuation) curl command
    and extract:
      • URL
      • all -H/--header tokens into a dict
      • the -b/--cookie token (as one big string)
    """
    # join backslash-continued lines
    txt = txt.replace("\\\n", " ")
    tokens = shlex.split(txt)

    url = None
    headers = {}
    cookie_s = None

    for i, tok in enumerate(tokens):
        if tok == "curl" and i + 1 < len(tokens) and not tokens[i + 1].startswith("-"):
            url = tokens[i + 1]
        if tok in ("-H", "--header") and i + 1 < len(tokens):
            hdr = tokens[i + 1]
            k, v = hdr.split(":", 1)
            headers[k.strip()] = v.strip()
        if tok in ("-b", "--cookie") and i + 1 < len(tokens):
            cookie_s = tokens[i + 1]

    return url, headers, parse_raw_cookies(cookie_s or "")


# ──────────────────────────────────────────────────────────────────────────────
# MAIN LOGIC
# ──────────────────────────────────────────────────────────────────────────────

def main():
    # 1. parse your curl.txt
    raw_curl = load_curl_file(CURL_FILE)
    full_url, raw_headers, raw_cookies = parse_curl_from_string(raw_curl)
    if not full_url:
        raise RuntimeError("Could not find the URL in curl.txt")

    # 2. split out queryId and variables
    parsed = urlparse(full_url)
    base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    qs = parse_qs(parsed.query)
    QUERY_ID = qs.get("queryId", [None])[0]
    VARS_RAW = qs.get("variables", [None])[0]
    if not QUERY_ID or not VARS_RAW:
        raise RuntimeError("Missing queryId or variables in the URL")

    # unescape and turn start:N into start:{start}
    VARS_UNQ = unquote_plus(VARS_RAW)
    VARS_TPL = re.sub(r"start\s*:\s*\d+", "start:{start}", VARS_UNQ)

    # 3. build requests.Session
    session = requests.Session()

    # 3a. clean & percent-encode any non-latin1 header values
    clean_hdrs = {}
    for k, v in raw_headers.items():
        try:
            v.encode("latin-1")
            clean_hdrs[k] = v
        except UnicodeEncodeError:
            logging.warning("Header %r contains non-Latin-1; percent-encoding", k)
            clean_hdrs[k] = percent_encode_non_latin1(v)
    session.headers.update(clean_hdrs)
    session.cookies.update(raw_cookies)

    # 4. fetch/​paginate with retry & logging
    def fetch_page(start: int = 0) -> dict | None:
        vars_filled = VARS_TPL.format(start=start)
        params = {"queryId": QUERY_ID, "variables": vars_filled}
        preview_url = f"{base_url}?queryId={QUERY_ID}&variables={quote_plus(vars_filled)}"
        logging.info("GET %s", preview_url)

        try:
            r = session.get(base_url, params=params, timeout=15)
            logging.info("↪ status %d", r.status_code)
            r.raise_for_status()
            return r.json()
        except requests.HTTPError as he:
            logging.error("HTTP %s – %.200s", he, r.text.replace("\n", " "))
        except requests.RequestException as re:
            logging.error("Request failed: %s", re)
        return None

    def iterate_all():
        start = 0
        data = fetch_page(start)
        if not data:
            logging.critical("Initial fetch failed—exiting")
            return

        pag = data["data"]["data"]["searchDashClustersByAll"]["paging"]
        total = pag["total"]
        logging.info("Total items: %d", total)

        while start < total:
            elems = data["data"]["data"]["searchDashClustersByAll"]["elements"]
            for cluster in elems:
                for item in cluster.get("items", []):
                    print(item["item"]["*entityResult"])

            start += 10
            if start >= total:
                break

            # retry loop
            for attempt in range(1, MAX_RETRIES + 1):
                data = fetch_page(start)
                if data:
                    break
                logging.warning("Retry %d/%d after %ds", attempt, MAX_RETRIES, RETRY_SEC)
                time.sleep(RETRY_SEC)
            else:
                logging.critical("Exceeded %d retries—aborting", MAX_RETRIES)
                return

    iterate_all()


if __name__ == "__main__":
    main()
