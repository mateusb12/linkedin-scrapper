"""
LinkedIn Jobs - Sniffer for:
  /voyager/api/graphql  (JOB_DETAILS prefetch, jobDetailsContext)

This is the GraphQL endpoint that prefetches JOB_DETAILS cards — likely
where job descriptions live. The URL contains a list of jobPostingCard URNs
and a jobDetailsContext flag.

Goal: understand the response structure before committing to a dataclass.
"""

import json
import gzip
import urllib.request
import urllib.error
from urllib.parse import urlencode
from typing import Any

# ---------------------------------------------------------------------------
# Hardcoded curl — GraphQL job details prefetch
# ---------------------------------------------------------------------------

# The variables string is long; keeping it readable as a raw string.
# Replace the URN list with whatever IDs you want to fetch.
_VARIABLES = (
    "(jobPostingDetailDescription_start:0,"
    "jobPostingDetailDescription_count:5,"
    "jobCardPrefetchQuery:("
    "jobUseCase:JOB_DETAILS,"
    "prefetchJobPostingCardUrns:List("
    "urn%3Ali%3Afsd_jobPostingCard%3A%284380370660%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284379046363%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284379877337%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284378114303%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284378880496%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284375963506%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284370477201%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284369660271%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284380359924%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284380373441%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284328143419%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284381428019%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284379698394%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284378921943%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284379316100%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284376422778%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284381113838%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284371147250%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284379511063%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284373151265%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284380792197%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284380466017%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284295908632%2CJOB_DETAILS%29,"
    "urn%3Ali%3Afsd_jobPostingCard%3A%284381468539%2CJOB_DETAILS%29"
    "),"
    "count:5"
    "),"
    "jobDetailsContext:(isJobSearch:true))"
)

URL = (
    "https://www.linkedin.com/voyager/api/graphql"
    "?includeWebMetadata=true"
    f"&variables={_VARIABLES}"
    "&queryId=voyagerJobsDashJobCards.11efe66ab8e00aabdc31cf0a7f095a32"
)

HEADERS = {
    "sec-ch-ua-platform": '"Linux"',
    "x-li-track": (
        '{"clientVersion":"1.13.42613","mpVersion":"1.13.42613",'
        '"osName":"web","timezoneOffset":-3,"timezone":"America/Fortaleza",'
        '"deviceFormFactor":"DESKTOP","mpName":"voyager-web",'
        '"displayDensity":1,"displayWidth":1280,"displayHeight":720}'
    ),
    "referer": (
        "https://www.linkedin.com/jobs/search/"
        "?currentJobId=4378839371&f_TPR=r604800"
        "&origin=JOB_SEARCH_PAGE_JOB_FILTER"
    ),
    "sec-ch-ua": '"Chromium";v="145", "Not:A-Brand";v="99"',
    "csrf-token": "ajax:8938687136565013868",
    "sec-ch-ua-mobile": "?0",
    "x-restli-protocol-version": "2.0.0",
    "x-li-prefetch": "1",
    "x-li-page-instance": (
        "urn:li:page:d_flagship3_search_srp_jobs;vULb0Xl3QMyK7qZ3mKIRWg=="
    ),
    "x-li-lang": "en_US",
    "sec-ch-prefers-color-scheme": "light",
    "accept": "application/vnd.linkedin.normalized+json+2.1",
    "user-agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/123 Safari/537.36"
    ),
    # ⚠️  Replace with a fresh session cookie when this expires
    "cookie": (
        'JSESSIONID="ajax:8938687136565013868"; '
        # paste your full cookie string here
    ),
}


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

def fetch_raw() -> dict:
    req = urllib.request.Request(URL, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read()
            try:
                text = gzip.decompress(raw).decode("utf-8")
            except OSError:
                text = raw.decode("utf-8")
            return json.loads(text)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(
            f"HTTP {exc.code} {exc.reason} — cookies probably expired."
        ) from exc


# ---------------------------------------------------------------------------
# Smart diagnostic printers  (same helpers as sniffer_lite.py)
# ---------------------------------------------------------------------------

def _type_summary(obj: Any, depth: int = 0, max_depth: int = 3) -> str:
    indent = "  " * depth
    if isinstance(obj, dict):
        if depth >= max_depth:
            return f"{{dict, {len(obj)} keys: {list(obj.keys())[:8]}}}"
        lines = [f"dict ({len(obj)} keys):"]
        for k, v in list(obj.items())[:15]:
            lines.append(f"{indent}  {k!r}: {_type_summary(v, depth + 1, max_depth)}")
        if len(obj) > 15:
            lines.append(f"{indent}  ... ({len(obj) - 15} more keys)")
        return "\n".join(lines)
    elif isinstance(obj, list):
        if not obj:
            return "[] (empty list)"
        if depth >= max_depth:
            return f"[list, {len(obj)} items, first type={type(obj[0]).__name__}]"
        sample = _type_summary(obj[0], depth + 1, max_depth)
        return f"list ({len(obj)} items), first item:\n{indent}  {sample}"
    elif isinstance(obj, str):
        preview = obj[:80].replace("\n", "\\n")
        return f"str({len(obj)}): {preview!r}"
    else:
        return f"{type(obj).__name__}: {str(obj)[:60]}"


def print_structure(data: dict) -> None:
    print("\n" + "═" * 70)
    print("  TOP-LEVEL KEYS")
    print("═" * 70)
    for k, v in data.items():
        print(f"\n  [{k!r}]")
        print("  " + _type_summary(v, depth=1, max_depth=3))

    # ---- data.data (GraphQL wraps differently) ----
    root = data.get("data", data)
    print("\n" + "─" * 70)
    print("  data.data keys:", list(root.keys()) if isinstance(root, dict) else type(root))

    # ---- Paging ----
    paging = root.get("paging", {}) if isinstance(root, dict) else {}
    if paging:
        print("\n  PAGING:", json.dumps(paging, indent=4))

    # ---- Elements ----
    elements = root.get("elements", []) if isinstance(root, dict) else []
    print("\n" + "─" * 70)
    print(f"  ELEMENTS ({len(elements)} items)")
    for i, el in enumerate(elements[:5]):
        print(f"\n  [element {i}]")
        print("  " + _type_summary(el, depth=1, max_depth=5))

    # ---- Included: catalogue by $type ----
    included = data.get("included", [])
    print("\n" + "─" * 70)
    print(f"  INCLUDED array — {len(included)} items")
    type_buckets: dict[str, list] = {}
    for item in included:
        t = item.get("$type", "UNKNOWN")
        type_buckets.setdefault(t, []).append(item)

    print(f"\n  Distinct $types found ({len(type_buckets)}):")
    for t, items in sorted(type_buckets.items(), key=lambda x: -len(x[1])):
        print(f"    {len(items):3d}x  {t}")

    # ---- Deep-dive into each $type ----
    print("\n" + "─" * 70)
    print("  FIRST EXAMPLE OF EACH $type:")
    for t, items in sorted(type_buckets.items(), key=lambda x: -len(x[1])):
        print(f"\n  ── {t} ──")
        print("  " + _type_summary(items[0], depth=1, max_depth=5))

    # ---- Description hunt ----
    print("\n" + "─" * 70)
    print("  DESCRIPTION HUNT — keys containing 'descri', 'detail', 'content', 'body', 'text':")
    hits = 0
    for item in included:
        for k, v in item.items():
            if any(kw in k.lower() for kw in ("descri", "detail", "content", "body")):
                t = item.get("$type", "?")
                urn = item.get("entityUrn", "?")
                val = str(v)[:300] if v else "(empty)"
                print(f"\n    [$type]  {t}")
                print(f"    [urn]    {urn}")
                print(f"    [key]    {k!r}")
                print(f"    [value]  {val}")
                hits += 1
    if hits == 0:
        print("    (none found — description may be in a nested field or separate request)")

    # ---- Hunt for long strings anywhere (likely description text) ----
    print("\n" + "─" * 70)
    print("  LONG STRING HUNT (>200 chars) — likely description or rich text:")
    long_hits = 0
    for item in included:
        _hunt_long_strings(item, item.get("$type", "?"), item.get("entityUrn", "?"))
        long_hits += 1
        if long_hits > 30:  # cap output
            break


def _hunt_long_strings(
        obj: Any,
        item_type: str,
        item_urn: str,
        path: str = "",
        min_len: int = 200,
        _seen: int = 0,
) -> int:
    """Recursively find strings longer than min_len and print them."""
    if isinstance(obj, str) and len(obj) > min_len:
        print(f"\n    [$type]  {item_type}")
        print(f"    [urn]    {item_urn}")
        print(f"    [path]   {path}")
        print(f"    [text]   {obj[:400]!r}")
        return _seen + 1
    elif isinstance(obj, dict):
        for k, v in obj.items():
            _seen = _hunt_long_strings(v, item_type, item_urn, f"{path}.{k}", min_len, _seen)
            if _seen > 10:
                return _seen
    elif isinstance(obj, list):
        for i, v in enumerate(obj[:5]):
            _seen = _hunt_long_strings(v, item_type, item_urn, f"{path}[{i}]", min_len, _seen)
            if _seen > 10:
                return _seen
    return _seen


def dump_full_json(data: dict, path: str = "/tmp/graphql_response.json") -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    print(f"\n  💾  Full response saved to: {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Fetching GraphQL JOB_DETAILS prefetch (24 job URNs, count=5)...")
    print("⚠️  Update HEADERS['cookie'] with a fresh session if you get 401/403\n")

    try:
        data = fetch_raw()
    except RuntimeError as e:
        print(f"[ERROR] {e}")
        raise SystemExit(1)

    print_structure(data)
    dump_full_json(data, "/tmp/linkedin_graphql_response.json")

    print("\n✅  Done. Review the structure above, then share the output.")
    print("    Full JSON also saved to /tmp/linkedin_graphql_response.json")
