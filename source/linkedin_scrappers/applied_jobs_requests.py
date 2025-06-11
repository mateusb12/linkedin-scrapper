"""
linkedin_applied_jobs.py
Replays the LinkedIn GraphQL call shown in curl.txt, then walks through the
entire result set (10 items per page) printing each job-posting URN.

⚠️  IMPORTANT
    • You are sending your own session cookies and CSRF token to LinkedIn.
      Treat them as passwords: never share them, never commit them to Git.
    • Using unofficial APIs may break without notice and can violate
      LinkedIn’s Terms of Service. Use at your own risk.
"""
import logging
import time

import requests
from urllib.parse import quote_plus

from requests import HTTPError, RequestException

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)

# ---------------------------------------------------------------------------
# 1.  STATIC INFORMATION FROM YOUR curl COMMAND
# ---------------------------------------------------------------------------

BASE_URL = "https://www.linkedin.com/voyager/api/graphql"
QUERY_ID = "voyagerSearchDashClusters.52fec77d08aa4598c8a056ca6bce6c11"

# All fixed HTTP request headers (copy-pasted from curl.txt)
HEADERS = {
    "accept": "application/vnd.linkedin.normalized+json+2.1",
    "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
    # >>>  DO **NOT** CHANGE THE CSRF TOKEN UNLESS YOUR COOKIE CHANGES
    "csrf-token": "ajax:2584240299603910567",
    "dnt": "1",
    "priority": "u=1, i",
    "referer": "https://www.linkedin.com/my-items/saved-jobs/?cardType=APPLIED",
    "sec-ch-prefers-color-scheme": "dark",
    "sec-ch-ua": "\"Microsoft Edge\";v=\"137\", \"Chromium\";v=\"137\", \"Not/A)Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0"
    ),
    "x-li-lang": "en_US",
    "x-li-page-instance": "urn:li:page:d_flagship3_myitems_savedjobs;JTmDPXswQfS4r2+VnJeGRg==",
    "x-li-pem-metadata": "Voyager - My Items=myitems-saved-jobs",
    "x-li-track": (
        "{\"clientVersion\":\"1.13.36262\",\"mpVersion\":\"1.13.36262\","
        "\"osName\":\"web\",\"timezoneOffset\":-3,\"timezone\":\"America/Fortaleza\","
        "\"deviceFormFactor\":\"DESKTOP\",\"mpName\":\"voyager-web\","
        "\"displayDensity\":1,\"displayWidth\":1920,\"displayHeight\":1080}"
    ),
    "x-restli-protocol-version": "2.0.0",
}

# Your entire cookie header from curl -b "...".  Paste it as-is below.
RAW_COOKIE_STRING = (
    "bcookie=\"v=2&8dbfbdc7-e798-40ce-8645-afc560856845\"; "
    "bscookie=\"v=1&2025021218502355028f04-83cc-48ed-8919-ec97e40bda49AQE-zsW9viyonHpVi4HpRFLzIsEFwyoJ\"; "
    # (rest of the cookie string …)
    "li_at=AQEFAHUBAAAAABSqG7UAAAGXXzKSSAAAAZeDPxZITQAAGHVy…"
)


# ---------------------------------------------------------------------------
# 2.  HELPER: TURN THE RAW COOKIE STRING INTO A DICT
# ---------------------------------------------------------------------------

def parse_raw_cookies(raw: str) -> dict[str, str]:
    jar = {}
    for part in raw.split(";"):
        if "=" in part:
            key, value = part.split("=", 1)
            jar[key.strip()] = value.strip().strip('"')
    return jar


# ---------------------------------------------------------------------------
# 3.  CORE REQUEST/LOOP LOGIC
# ---------------------------------------------------------------------------

# Template for the GraphQL `variables` query-string parameter
VARIABLES_TMPL = (
    "(start:{start},"
    "query:(flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER,"
    "queryParameters:List((key:cardType,value:List(APPLIED)))))"
)

session = requests.Session()
session.headers.update(HEADERS)
session.cookies.update(parse_raw_cookies(RAW_COOKIE_STRING))

RETRY_SECONDS = 3
MAX_RETRIES = 3


def fetch_page(start: int = 0) -> dict | None:
    """Download one page (10 records). Returns dict on success, None on failure."""
    variables = VARIABLES_TMPL.format(start=start)
    params = {"queryId": QUERY_ID, "variables": variables}

    # `requests` will build the final URL for us, but showing it helps debugging
    full_url = f"{BASE_URL}?queryId={QUERY_ID}&variables={quote_plus(variables)}"
    logging.info("GET %s", full_url)

    try:
        resp = session.get(BASE_URL, params=params, timeout=15)
        logging.info("↪ status %s", resp.status_code)
        resp.raise_for_status()
        return resp.json()

    except HTTPError as he:
        # The server DID reply (4xx or 5xx).  Print body for clues.
        logging.error("Server error: %s – %s", he, resp.text[:300])
    except RequestException as re:
        # Anything else (DNS failure, timeout, connection reset, etc.)
        logging.error("Request failed: %s", re)
    return None


def iterate_all_results() -> None:
    """Stream through every job result – with retry logic."""
    start, page_size, failures = 0, 10, 0

    # First request: also discover total number of results
    payload = fetch_page(start)
    if payload is None:
        logging.critical("Initial request never succeeded. Exiting.")
        return

    paging = payload["data"]["data"]["searchDashClustersByAll"]["paging"]
    total  = paging["total"]
    logging.info("Found %d total items", total)

    while start < total:
        clusters = payload["data"]["data"]["searchDashClustersByAll"]["elements"]
        for cluster in clusters:
            for item in cluster.get("items", []):
                urn = item["item"]["*entityResult"]
                print(urn)                          # ← do your real work here

        start += page_size
        if start >= total:
            break

        # -------- next page with retry loop --------
        for attempt in range(1, MAX_RETRIES + 1):
            payload = fetch_page(start)
            if payload is not None:
                failures = 0
                break
            failures += 1
            if failures >= MAX_RETRIES:
                logging.critical("Giving up after %d consecutive failures.", failures)
                return
            logging.warning("Retrying in %d s…  (attempt %d/%d)",
                            RETRY_SECONDS, attempt, MAX_RETRIES)
            time.sleep(RETRY_SECONDS)


if __name__ == "__main__":
    result = fetch_page()
    pass
