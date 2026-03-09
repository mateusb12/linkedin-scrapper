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
from collections import Counter
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class LinkedInJob:
    # --- Core Job Information ---
    job_id: str  # Extracted from jobPostingUrn
    title: Optional[str] = None
    description_snippet: Optional[str] = None

    # --- Company & Location ---
    company_name: Optional[str] = None
    location: Optional[str] = None
    company_logo_url: Optional[str] = None

    # --- Insights / Metadata ---
    workplace_type: Optional[str] = None  # Remote / Hybrid / On-site
    employment_type: Optional[str] = None  # Full-time / Contract etc
    promoted_status: Optional[str] = None  # Promoted / Skill match etc

    # --- Apply / Interaction ---
    apply_method: Optional[str] = None  # "easy_apply" or "external"
    company_apply_url: Optional[str] = None  # External apply link if exists

    # --- Timing ---
    posted_time: Optional[str] = None  # "1 week ago"


# ---------------------------------------------------------------------------
# SESSION CONSTANTS (⚠️ THESE EXPIRE FREQUENTLY)
# ---------------------------------------------------------------------------
# Update these if you start receiving 401 / 403 errors

SESSION = {
    # Extracted from header 'csrf-token'
    "csrf_token": "ajax:2777072973261931503",

    # Extracted from header 'Cookie'
    "cookie": (
        'bcookie="v=2&06a00d93-90e5-4ec0-8bee-f68d7c1c1d9f"; '
        'bscookie="v=1&202602091233361bc29369-d82d-4513-8c0c-bde03df081a2AQHxsH3xoCuk4BmYRXnlfBaz8McjnZz8"; '
        'li_rm=AQGiGtBE_pOr3QAAAZxCZKYNd-Xu0HyppOttaOUvQNmZ-HWvMBthXFnWKpDy4UAtwUCcBtootY5AtrQ5DBeflbr7zSxUbcaUodrjOwAbPF1a9CAPGKH7dTWl; '
        'g_state={"i_l":0}; '
        'timezone=America/Fortaleza; '
        'li_theme=system; '
        'li_theme_set=user; '
        'UserMatchHistory=AQJ1rTP0PefV7wAAAZzUBM29E_Wl8rwR-yNCmDQsj8ouXPA1G6LezqFwcw8gKpzJH3ez8joU-ApYISapeu04zaygwf2GDLcF1fdhNO71_Jrm2KqoQtm3QlOaG0wBWL5PJp6TSYt6822gz830RE0bKL9WQeiexPJIe_TvRThoy1H9DlE4hCqeleq-yF8CY0nN7Z8JcAYqsaT6Sy5WZnjm9v-zKfTubIIn_FsmbBW_BFIqw6dYgn8Ho6LoiXoqwKkIipK0juXI48OPG7prwvoCJQ9VwhIuQ7WEU_K8rNNc2MtlpttcX_tn3RsrRnRqPNMdbUONuY1jLGYdrk_zBdqU; '
        'dfpfpt=77f99deb2144437ab82f05269fe4a036; '
        'sdui_ver=sdui-flagship:0.1.30243+SduiFlagship0; '
        '_pxvid=8e02eed5-05b3-11f1-855d-85f84338a619; '
        'visit=v=1&M; '
        'JSESSIONID="ajax:2777072973261931503"; '
        'li_at=AQEDAT016UkA2kzbAAABnLWy_BEAAAGc2b-AEU0AeCarHPFpq8noGEAStRJiOmwuKQEhik6SrxpIxyFGN0CDlXsf1Bv8dH3N9Te5KKMgZl3cwU3BAH8anP3HvWie6d5i5XVPwhaWCCKeGMIOQEZ_ydxq; '
        'liap=true; '
        'lang=v=2&lang=en-us; '
        'fptctx2=taBcrIH61PuCVH7eNCyH0FC0izOzUpX5wN2Z%252b5egc%252f53DRZaA4bKNdO9yJFow6lfKKgdq%252bxDje%252b9f9azVSoveqEn9i3koReTtGyAHcHqrEoymTsEmtmwZBeFFofyIfO4UFWpS7yUPmaKxxCuk3dT6APrGjeGHAzam%252bKqt4Qs8466impXUOdG2KSxE%252b2mxmZr42ThySYhdPMTFXPgKvdsBjhGezOG9CIPB74EEjlFauk4MiQ%252fVFrUGfmI14A7B%252fAvVgabfTkA9nQGBV0zk3If0nNiUO6OSvDTQC%252fxanh3j2iDFk6qLU7BICtsltp4fszP9uatavu2tKtrpswlPQK%252blzemlFEHijRkqREBTEZezh9TLeGbXtnxGcrIunXRcnDj3mS3BaB%252ba%252bZY%252bDuB4TwbxA%253d%253d; '
        '_px3=1624fe839c7acd99f3c112f0e23dfbf8e3b080bcdfcf8dfa5f8f75edf8f3f1c1:EIDoBXglSmkeqLKsg2pQmfcgP2LlQzIK10PZA9VAPMTR+5ZJMA37XJt6BTgqs8bEGDDCDbjtpxHycriqzflZIQ==:1000:Y3P9a3iPrB6BCFcjw4JloYBukj/c0R8drMig4QZ7A7H80ppWcGzkm50+h0Jr7c1ySjetyuoQMX+wYfO6KkmXlxUv8HBvRs48KXOpASK4nqb5M0UhF7S0HeeOqNxnSrkiGhn5Gxi8EckRsM8Oym8P6aNWSyjHUC8dHmkj86W8lTSNIR0xI9+yfxmJ5hoS8o0Ymkc7Oo1Ji+QBO9DYowXzMIKOXRWoPcqic4Qqip6BNz5Vftaxpn8qllzLO9MzBJhsLdfvHha33Ktwe+OJPWkdahPliv7N242bENLI33AI8bqyL5o4XYgnqjhNBXQJFWF8ST4dlLYPZsjvUY50MpoeIUnMlFjrFfXeeaKKtixlGwdtk5EsnudY75rvy8YNHiGc/dybms//GYR9HWh4KxL0/B2yGPjr7cF+loOs0YdyaLA7pzVYAmiw9tPho5pZEynl56x/3ZgwKAH79VYFw7VUVc9n3WO7g6IBYKAvXcp69r0mmKg5NFq3eb2YuDz5QHQt; '
        'lidc="b=VB05:s=V:r=V:a=V:p=V:g=7980:u=396:x=1:i=1773095765:t=1773182137:v=2:sig=AQEr4iKOh5EIYeEjC_f_HpzsNp8Y0tjl"; '
        '__cf_bm=7mD9OwuPOBSn6uSmjuYydldhxZk7fjFpcqnhj3lk53E-1773095766-1.0.1.1-2DZvwgZHamv1cxVQ.94F0uBmnhzZV5My_5dMzhxXCTVuTeJ5PTBWGChZjw5GieY7ZfYjE0Q3ewqdOQngVuMjVrIereRGMXbaadvugX9H3_U'
    ),

    # Extracted from header 'x-li-page-instance'
    "page_instance": (
        "urn:li:page:d_flagship3_search_srp_jobs;JAZY0R6vSCePjhIv793OGw=="
    ),

    # Extracted from header 'x-li-track' json block
    "client_version": "1.13.42707",
}

# ---------------------------------------------------------------------------
# REQUEST CONSTANTS (mostly stable)
# ---------------------------------------------------------------------------

QUERY_ID = "voyagerJobsDashJobCards.11efe66ab8e00aabdc31cf0a7f095a32"

REFERER = (
    "https://www.linkedin.com/jobs/search/"
    "?currentJobId=4378839371&f_TPR=r604800"
    "&origin=JOB_SEARCH_PAGE_JOB_FILTER"
)

# Replace URNs here if you want to inspect different jobs
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
    f"&queryId={QUERY_ID}"
)

# ---------------------------------------------------------------------------
# HEADERS
# ---------------------------------------------------------------------------

HEADERS = {
    "sec-ch-ua-platform": '"Linux"',
    "sec-ch-ua": '"Chromium";v="145", "Not:A-Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-prefers-color-scheme": "light",

    "user-agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/123 Safari/537.36"
    ),

    "accept": "application/vnd.linkedin.normalized+json+2.1",

    "referer": REFERER,

    "csrf-token": SESSION["csrf_token"],

    "x-li-page-instance": SESSION["page_instance"],

    "x-li-track": (
        f'{{"clientVersion":"{SESSION["client_version"]}",'
        f'"mpVersion":"{SESSION["client_version"]}",'
        '"osName":"web","timezoneOffset":-3,"timezone":"America/Fortaleza",'
        '"deviceFormFactor":"DESKTOP","mpName":"voyager-web",'
        '"displayDensity":1,"displayWidth":1280,"displayHeight":720}}'
    ),

    "x-li-lang": "en_US",
    "x-li-prefetch": "1",
    "x-restli-protocol-version": "2.0.0",

    "cookie": SESSION["cookie"],
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
# Diagnostic helpers
# ---------------------------------------------------------------------------

def _json_preview(obj: Any, max_chars: int = 1200) -> str:
    try:
        text = json.dumps(obj, indent=2, ensure_ascii=False)
    except Exception:
        text = repr(obj)

    if len(text) > max_chars:
        return text[:max_chars] + "\n... [truncated]"
    return text


def _type_summary(obj: Any, depth: int = 0, max_depth: int = 3) -> str:
    indent = "  " * depth

    if isinstance(obj, dict):
        if depth >= max_depth:
            return f"{{dict, {len(obj)} keys: {list(obj.keys())[:8]}}}"

        lines = [f"dict ({len(obj)} keys):"]
        for k, v in list(obj.items())[:15]:
            lines.append(
                f"{indent}  {k!r}: {_type_summary(v, depth + 1, max_depth)}"
            )

        if len(obj) > 15:
            lines.append(f"{indent}  ... ({len(obj) - 15} more keys)")

        return "\n".join(lines)

    if isinstance(obj, list):
        if not obj:
            return "[] (empty list)"

        if depth >= max_depth:
            return (
                f"[list, {len(obj)} items, "
                f"first type={type(obj[0]).__name__}]"
            )

        sample = _type_summary(obj[0], depth + 1, max_depth)
        return (
            f"list ({len(obj)} items), first item:\n"
            f"{indent}  {sample}"
        )

    if isinstance(obj, str):
        preview = obj[:120].replace("\n", "\\n")
        return f"str({len(obj)}): {preview!r}"

    return f"{type(obj).__name__}: {str(obj)[:80]}"


def _walk(obj: Any, path: str = "$"):
    yield path, obj

    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from _walk(v, f"{path}.{k}")
    elif isinstance(obj, list):
        # cap list traversal a bit so console debug doesn't explode
        for i, v in enumerate(obj[:100]):
            yield from _walk(v, f"{path}[{i}]")


def _extract_text(value: Any, max_parts: int = 8) -> str | None:
    parts: list[str] = []

    def rec(v: Any):
        if len(parts) >= max_parts:
            return

        if isinstance(v, str):
            text = " ".join(v.split())
            if text and text not in parts:
                parts.append(text)
            return

        if isinstance(v, dict):
            # preferred text-like keys first
            for key in (
                    "text",
                    "rawText",
                    "formattedText",
                    "accessibilityText",
                    "title",
                    "name",
                    "companyName",
                    "subtitle",
                    "description",
            ):
                if key in v:
                    rec(v[key])
                    if len(parts) >= max_parts:
                        return

            for _, sub in list(v.items())[:10]:
                rec(sub)
                if len(parts) >= max_parts:
                    return
            return

        if isinstance(v, list):
            for sub in v[:8]:
                rec(sub)
                if len(parts) >= max_parts:
                    return

    rec(value)

    if not parts:
        return None

    joined = " | ".join(parts)
    if len(joined) > 1000:
        joined = joined[:1000] + "..."
    return joined


def _find_first_text_for_keys(obj: Any, target_keys: list[str]) -> str | None:
    wanted = {k.lower() for k in target_keys}

    for _, node in _walk(obj):
        if not isinstance(node, dict):
            continue

        for k, v in node.items():
            if str(k).lower() in wanted:
                text = _extract_text(v)
                if text:
                    return text

    return None


def _find_key_matches(obj: Any, keywords: list[str], max_results: int = 20):
    keywords = [k.lower() for k in keywords]
    matches = []

    for path, node in _walk(obj):
        if not isinstance(node, dict):
            continue

        hit_keys = [
            str(k) for k in node.keys()
            if any(word in str(k).lower() for word in keywords)
        ]

        if hit_keys:
            matches.append((path, hit_keys, node))
            if len(matches) >= max_results:
                break

    return matches


def _entity_type(node: dict) -> str:
    return (
            node.get("$type")
            or node.get("entityType")
            or node.get("type")
            or "__unknown__"
    )


def _collect_entities(resp: dict) -> list[tuple[str, dict]]:
    entities: list[tuple[str, dict]] = []

    included = resp.get("included")
    if isinstance(included, list):
        for i, item in enumerate(included):
            if isinstance(item, dict):
                entities.append((f"$.included[{i}]", item))

    data_root = resp.get("data")
    if isinstance(data_root, dict):
        for k, v in data_root.items():
            if isinstance(v, dict):
                entities.append((f"$.data.{k}", v))
            elif isinstance(v, list):
                for i, item in enumerate(v):
                    if isinstance(item, dict):
                        entities.append((f"$.data.{k}[{i}]", item))

    return entities


def _extract_job_candidates(entities: list[tuple[str, dict]], max_results: int = 10):
    results = []
    seen = set()

    for path, node in entities:
        blob = _json_preview(node, max_chars=4000).lower()

        if not any(
                term in blob
                for term in (
                        "description",
                        "jobposting",
                        "jobtitle",
                        "companyname",
                        "formatteddescription",
                        "jobpostingcard",
                )
        ):
            continue

        urn = (
                _extract_text(node.get("entityUrn"))
                or _extract_text(node.get("trackingUrn"))
                or _find_first_text_for_keys(node, ["entityUrn", "trackingUrn"])
        )

        title = (
                _extract_text(node.get("title"))
                or _extract_text(node.get("jobTitle"))
                or _find_first_text_for_keys(node, ["title", "jobTitle", "listedAt"])
        )

        company = (
                _extract_text(node.get("companyName"))
                or _extract_text(node.get("company"))
                or _extract_text(node.get("subtitle"))
                or _find_first_text_for_keys(node, ["companyName", "company", "subtitle"])
        )

        description = (
                _extract_text(node.get("description"))
                or _extract_text(node.get("formattedDescription"))
                or _extract_text(node.get("jobPostingDescription"))
                or _find_first_text_for_keys(
            node,
            [
                "description",
                "formattedDescription",
                "jobPostingDescription",
                "descriptionText",
            ],
        )
        )

        entity_type = _entity_type(node)

        signature = (urn, title, company, description[:120] if description else None)
        if signature in seen:
            continue
        seen.add(signature)

        if title or company or description:
            results.append(
                {
                    "path": path,
                    "type": entity_type,
                    "urn": urn,
                    "title": title,
                    "company": company,
                    "description": description,
                }
            )

        if len(results) >= max_results:
            break

    return results


def inspect_response(resp: dict):
    print("\n" + "=" * 80)
    print("RESPONSE SHAPE")
    print("=" * 80)

    print("Top-level keys:", list(resp.keys()))

    if "meta" in resp:
        print("\nmeta summary:")
        print(_type_summary(resp["meta"], max_depth=2))

    if "data" in resp:
        print("\ndata summary:")
        print(_type_summary(resp["data"], max_depth=2))
        if isinstance(resp["data"], dict):
            print("data keys:", list(resp["data"].keys())[:30])

    if "included" in resp:
        included = resp["included"]
        print("\nincluded summary:")
        print(_type_summary(included, max_depth=2))
        if isinstance(included, list):
            print(f"included count: {len(included)}")

    entities = _collect_entities(resp)

    print("\n" + "=" * 80)
    print("ENTITY TYPE COUNTS")
    print("=" * 80)

    type_counts = Counter(
        _entity_type(node)
        for _, node in entities
    )

    if type_counts:
        for entity_type, count in type_counts.most_common(20):
            print(f"{count:>4}  {entity_type}")
    else:
        print("No dict-like entities found.")

    print("\n" + "=" * 80)
    print("LIKELY INTERESTING NODES (keys containing description/title/company/job)")
    print("=" * 80)

    matches = _find_key_matches(
        resp,
        keywords=["description", "title", "company", "job"],
        max_results=15,
    )

    if not matches:
        print("No obvious matching keys found.")
    else:
        for idx, (path, hit_keys, node) in enumerate(matches, start=1):
            print(f"\n[{idx}] PATH: {path}")
            print("Matching keys:", hit_keys)
            print(_json_preview(node, max_chars=1000))

    print("\n" + "=" * 80)
    print("BEST-EFFORT PARSED JOB CANDIDATES")
    print("=" * 80)

    candidates = _extract_job_candidates(entities, max_results=10)

    if not candidates:
        print("No job-like entities were parsed.")
    else:
        for idx, item in enumerate(candidates, start=1):
            print(f"\n[{idx}] {item['path']}")
            print(f"Type:        {item['type']}")
            print(f"URN:         {item['urn'] or '-'}")
            print(f"Title:       {item['title'] or '-'}")
            print(f"Company:     {item['company'] or '-'}")
            print(f"Description: {(item['description'] or '-')[:800]}")

    print("\n" + "=" * 80)
    print("RAW ROOT SNIPPET")
    print("=" * 80)
    print(_json_preview(resp, max_chars=1500))


def parse_linkedin_graphql(response_json):
    """
    Parses the normalized LinkedIn GraphQL response into a clean list of jobs.
    """
    included = response_json.get("included", [])

    # 1. CREATE LOOKUP TABLE (Resolves 'URN' pointers)
    urn_map = {}
    for item in included:
        urn = item.get("entityUrn") or item.get("urn")
        if urn:
            urn_map[urn] = item

    results = []

    # 2. EXTRACT EXACTLY 'JobPosting'
    for item in included:
        entity_type = item.get("$type", "")

        # STRICT MATCH: Fixes the 46 duplicates/empty rows issue
        if entity_type == "com.linkedin.voyager.dash.jobs.JobPosting":

            # --- 1. TITLE ---
            title = item.get("title", "Unknown Title")

            # --- 2. COMPANY ---
            company_name = "Unknown Company"

            # Check direct string fields first
            if item.get("companyName"):
                company_name = item["companyName"]
            elif "companyDetails" in item:
                cd = item["companyDetails"]

                # Check if it's a nested dictionary
                if isinstance(cd.get("company"), dict) and cd["company"].get("name"):
                    company_name = cd["company"]["name"]
                else:
                    # Follow URN pointers like '*company' or '*companyResolutionResult'
                    for key, val in cd.items():
                        if key.startswith("*") and isinstance(val, str) and val in urn_map:
                            resolved = urn_map[val]
                            if resolved.get("name"):
                                company_name = resolved["name"]
                                break

            # --- 3. DESCRIPTION ---
            description_text = ""
            desc_urn = item.get("*description")

            if desc_urn and desc_urn in urn_map:
                desc_obj = urn_map[desc_urn]

                # Depending on LinkedIn's A/B testing, text is stored differently
                desc_val = desc_obj.get("description") or desc_obj.get("text")

                if isinstance(desc_val, str):
                    description_text = desc_val
                elif isinstance(desc_val, dict):
                    description_text = desc_val.get("text", "") or desc_val.get("rawText", "")

            # --- BUILD RESULT ---
            job = {
                "title": title,
                "company": company_name,
                "urn": item.get("entityUrn"),
                "description_snippet": description_text[:100].replace('\n', ' ') + "...",
                "full_description": description_text
            }
            results.append(job)

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":

    print(
        "Fetching GraphQL JOB_DETAILS prefetch "
        "(24 job URNs, count=5)..."
    )

    print(
        "⚠️  Update SESSION constants if you get "
        "401 / 403 errors\n"
    )

    try:
        data = fetch_raw()

    except RuntimeError as e:
        print(f"[ERROR] {e}")
        raise SystemExit(1)

    print("\nTop-level keys:", list(data.keys()))

    clean_jobs = parse_linkedin_graphql(data)
    print(f"\nSuccessfully extracted {len(clean_jobs)} structured jobs:")
    for job in clean_jobs:
        print(f"- {job['title']} at {job['company']}")

    with open("/tmp/linkedin_graphql_response.json", "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)

    print("\nSaved full response to /tmp/linkedin_graphql_response.json")

    inspect_response(data)
