import json
import re
from urllib.parse import urlsplit, parse_qs, unquote_plus

# ---------- 1. quick detector -------------------------------------------------
FETCH_CALL_RE = re.compile(
    r"""\bfetch\s*     # the word “fetch”
        \(             # opening parenthesis
        \s*["']https?  # opening quote + http/https
        .*?            # anything until
        ["']\s*,\s*    # closing quote of the URL + the comma that starts the options object
        \{""",
    re.I | re.S | re.X,
)


def looks_like_node_fetch(text: str) -> bool:
    """True if the text probably contains a JS fetch(...) call."""
    return bool(FETCH_CALL_RE.search(text))


# ---------- 2. full parser ----------------------------------------------------
VARIABLE_KV_RE = re.compile(r'(\w+)\s*:\s*([^,()]+)')


def parse_fetch_to_dict(fetch_str: str, row_id: int | None = None) -> dict | None:
    """
    Parse a Node-style fetch() string into a dict matching your CSV layout.
    Returns None if no fetch() call is found.
    """
    # 2.1 extract the argument list ------------------------------------------------
    m = re.search(
        r'fetch\(\s*(".*?")\s*,\s*({.*?})\s*\)', fetch_str, re.S
    )
    if not m:
        return None

    raw_url, raw_opts = m.group(1), m.group(2)
    url = json.loads(raw_url)  # evaluated safely
    opts = json.loads(raw_opts)  # headers/body/method

    # 2.2 break down the URL -------------------------------------------------------
    split = urlsplit(url)
    base_url = f"{split.scheme}://{split.netloc}{split.path}"
    qs = parse_qs(split.query, keep_blank_values=True)

    query_id = qs.get("queryId", [""])[0]
    variables = unquote_plus(qs.get("variables", [""])[0])

    # variables=(count:24,jobCollectionSlug:recommended,query:(origin:GENERIC_JOB_COLLECTIONS_LANDING),start:48)
    var_dict: dict[str, str] = {
        k: v for k, v in VARIABLE_KV_RE.findall(variables)
    }
    count = int(var_dict.get("count", "0") or 0)
    slug = var_dict.get("jobCollectionSlug", "")
    origin_match = re.search(r'origin:([A-Z_]+)', variables)
    origin = origin_match.group(1) if origin_match else ""
    start = int(var_dict.get("start", "0") or 0)

    # 2.3 headers / body / method --------------------------------------------------
    headers = opts.get("headers", {})
    body = opts.get("body")
    method = (opts.get("method") or "GET").upper()
    referer = headers.get("Referer") or headers.get("referer")

    # 2.4 derive a simple “type” like your CSV (“Pagination”, “SingleJob”)
    req_type = "Pagination" if start else "SingleJob"

    # 2.5 assemble the record ------------------------------------------------------
    record = {
        "name": req_type,
        "base_url": base_url,
        "query_id": query_id,
        "variables_count": int(count),
        "variables_job_collection_slug": slug,
        "variables_query_origin": origin,
        "variables_start": int(start),
        "method": method,
        "headers": json.dumps(headers, ensure_ascii=False),
        "body": json.dumps(body, ensure_ascii=False) if body is not None else None,
        "referer": referer,
    }
    return record


# ---------------- example usage -----------------------------------------------
if __name__ == "__main__":
    with open("example_fetch.txt", encoding="utf-8") as fh:
        txt = fh.read()

    if looks_like_node_fetch(txt):
        parsed = parse_fetch_to_dict(txt, row_id=1)
        from pprint import pprint

        pprint(parsed)
    else:
        print("No fetch() call detected.")
