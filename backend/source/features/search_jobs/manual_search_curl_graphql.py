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
from typing import Any

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

    elif isinstance(obj, list):
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

    elif isinstance(obj, str):
        preview = obj[:80].replace("\n", "\\n")
        return f"str({len(obj)}): {preview!r}"

    else:
        return f"{type(obj).__name__}: {str(obj)[:60]}"


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

    with open("/tmp/linkedin_graphql_response.json", "w") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)

    print("\nSaved full response to /tmp/linkedin_graphql_response.json")
