"""
LinkedIn Jobs - Sniffer for:
  voyagerJobsDashJobCards  (JobSearchCardsCollectionLite-88, count=7, prefetch)

This is the LITE / prefetch variant that loads 7 cards alongside the current job.
Goal: understand the response structure before committing to a dataclass.
"""

import json
import gzip
import urllib.request
import urllib.error
from pprint import pformat
from typing import Any

# ---------------------------------------------------------------------------
# Hardcoded curl
# ---------------------------------------------------------------------------

URL = (
    "https://www.linkedin.com/voyager/api/voyagerJobsDashJobCards"
    "?decorationId=com.linkedin.voyager.dash.deco.jobs.search"
    ".JobSearchCardsCollectionLite-88"
    "&count=7"
    "&q=jobSearch"
    "&query=(currentJobId:4378839371,"
    "origin:JOB_SEARCH_PAGE_JOB_FILTER,"
    "selectedFilters:(timePostedRange:List(r604800)),"
    "spellCorrectionEnabled:true)"
    "&servedEventEnabled=false"
    "&start=0"
)

COOKIE = (
    'JSESSIONID="ajax:8938687136565013868"; '
    # paste your full cookie string here
),

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
    "x-li-page-instance": (
        "urn:li:page:d_flagship3_search_srp_jobs;vULb0Xl3QMyK7qZ3mKIRWg=="
    ),
    "x-li-deco-include-micro-schema": "true",
    "x-li-lang": "en_US",
    "sec-ch-prefers-color-scheme": "light",
    "accept": "application/vnd.linkedin.normalized+json+2.1",
    "user-agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/123 Safari/537.36"
    ),
    "x-li-pem-metadata": (
        "Voyager - Careers - Jobs Search=jobs-search-results-prefetch"
    ),
    # ⚠️  Replace with a fresh session cookie when this expires
    "cookie": COOKIE
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
# Smart diagnostic printers
# ---------------------------------------------------------------------------

def _type_summary(obj: Any, depth: int = 0, max_depth: int = 3) -> str:
    """Recursively summarise structure: type + keys (for dicts) or len (for lists)."""
    indent = "  " * depth
    if isinstance(obj, dict):
        if depth >= max_depth:
            return f"{{dict, {len(obj)} keys: {list(obj.keys())[:8]}}}"
        lines = [f"dict ({len(obj)} keys):"]
        for k, v in list(obj.items())[:15]:  # show first 15 keys
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

    # ---- Paging ----
    root = data.get("data", data)
    paging = root.get("paging", {})
    if paging:
        print("\n" + "─" * 70)
        print("  PAGING:", json.dumps(paging, indent=4))

    # ---- Elements ----
    elements = root.get("elements", [])
    print("\n" + "─" * 70)
    print(f"  ELEMENTS ({len(elements)} items)")
    for i, el in enumerate(elements[:5]):
        print(f"\n  [element {i}]")
        print("  " + _type_summary(el, depth=1, max_depth=4))

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

    # ---- Deep-dive into each $type (first example each) ----
    print("\n" + "─" * 70)
    print("  FIRST EXAMPLE OF EACH $type:")
    for t, items in sorted(type_buckets.items(), key=lambda x: -len(x[1])):
        print(f"\n  ── {t} ──")
        print("  " + _type_summary(items[0], depth=1, max_depth=5))

    # ---- Special: look for anything that might be a job description ----
    print("\n" + "─" * 70)
    print("  DESCRIPTION HUNT — keys containing 'descri', 'detail', 'text', 'content':")
    for item in included:
        for k, v in item.items():
            if any(kw in k.lower() for kw in ("descri", "detail", "content", "body")):
                t = item.get("$type", "?")
                urn = item.get("entityUrn", "?")
                val_preview = str(v)[:200] if v else "(empty)"
                print(f"\n    Type : {t}")
                print(f"    URN  : {urn}")
                print(f"    Key  : {k!r}")
                print(f"    Value: {val_preview}")


def dump_full_json(data: dict, path: str = "/tmp/lite_response.json") -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    print(f"\n  💾  Full response saved to: {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Fetching LITE job cards (count=7, prefetch)...")
    print("⚠️  Update HEADERS['cookie'] with a fresh session if you get 401/403\n")

    try:
        data = fetch_raw()
    except RuntimeError as e:
        print(f"[ERROR] {e}")
        raise SystemExit(1)

    print_structure(data)
    dump_full_json(data, "/tmp/linkedin_lite_response.json")

    print("\n✅  Done. Review the structure above, then share the output.")
    print("    Full JSON also saved to /tmp/linkedin_lite_response.json")
