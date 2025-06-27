#!/usr/bin/env python3
"""
Fetch full LinkedIn job-detail sections for every URN found in
structured_pagination_results.json and save them all to job_details.json
"""

import json
import os
import re
import time
from pathlib import Path
from typing import Dict, Any, List
from urllib.parse import unquote, quote

import requests

# This assumes you have a local module for loading the file.
# If the script is in the same directory as the file loader, this should work.
from backend.path.file_content_loader import load_pagination_file

# ---------- 1. CONFIG --------------------------------------------------------

MAIN_CURL = """
curl 'https://www.linkedin.com/voyager/api/graphql?variables=(cardSectionTypes:List(MARKETPLACE_PROMO_CARD),jobPostingUrn:urn%3Ali%3Afsd_jobPosting%3A4242592810,includeSecondaryActionsV2:true)&queryId=voyagerJobsDashJobPostingDetailSections.d5e26c6a0b129827c0cfd9d5a714c5e7' \
  -H 'accept: application/vnd.linkedin.normalized+json+2.1' \
  -H 'accept-language: en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7' \
  -b 'bcookie="v=2&8dbfbdc7-e798-40ce-8645-afc560856845"; bscookie="v=1&2025021218502355028f04-83cc-48ed-8919-ec97e40bda49AQE-zsW9viyonHpVi4HpRFLzIsEFwyoJ"; g_state={"i_l":0}; liap=true; JSESSIONID="ajax:2584240299603910567"; dfpfpt=02f41f47dbb840f9b833d6e8dfc0b0f4; li_ep_auth_context=AM9hcHA9YWNjb3VudENlbnRlckh1YixhaWQ9Mjc4NDA2MDY2LGlpZD0zMjQzMzI2NTAscGlkPTI3NjY4NDk4NixleHA9MTc0MjUzNjIwNTc0NyxjdXI9dHJ1ZXxhcHA9c2FsZXNOYXZpZ2F0b3IsYWlkPTI3ODQwNjA2NixpaWQ9NDIwODYxNDY1LHBpZD0yNzY2ODQ5ODYsZXhwPTE3NDUwOTk5ODI2ODcsY3VyPXRydWUsc2lkPTE1Mjk0MTEwMDQsY2lkPTIwMTAwNDU2NzQBf0iA5XMh-eRvJ2QB4KS5KK8SUNQ; li_theme=dark; li_theme_set=user; timezone=America/Fortaleza; sdui_ver=sdui-flagship:0.1.6871+sdui-flagship.production; lang=v=2&lang=en-us; li_at=AQEFAHUBAAAAABSqG7UAAAGXXzKSSAAAAZfQlkN3TQAAGHVybjpsaTptZW1iZXI6MTAyNjk0MzMwNWYm1DqJn9kEYGnmmj4HkCVrpl3L5eJp6SCHmQzh2UvTrNb4ZCrO6KrDqSahqKv352NrmK4nJ1ykljhPY1R_9fkxPKDDuXtFCJ252bFBMOqLHvgD4aER9aFWxI8uVrqQ-XclO2lS7kCDkElsJKBhmnizusR5CU2Vp131PBgPeO4t3b3NWk0VPkYPH7fgogE7wmRuSTI; lidc="b=VB05:s=V:r=V:a=V:p=V:g=7865:u=301:x=1:i=1751049807:t=1751136207:v=2:sig=AQH6C-mDLo0Y-9rIPqjQWgxsHxv19WR1"; __cf_bm=WnaKB5VywiaFAXx5cA5iFpWE_cbPfjF2P_WI2swbQWE-1751049808-1.0.1.1-g38N8e8Q6siDYZqtR5GHg80ATPycsGJmp3yaRMNO1NrAW1SOYChLl7SaPYjOC6AZmAppQE0F9qQ_UKHAyuOJQ8TZMF8Q5WnjnRBoQph1jBI; UserMatchHistory=AQIcXnTONGRR0QAAAZeys6_tXWVMH4g-KhgLSXM5YBq-kwvbnWhoffj3T5SS-Bo4pvkWNTDrj136CqiGNZPxuIEBjGNHqAB0_M5Nssxek7yVdrWIhbr5zTiN4VwgXsafZPym3BCx3A43oTpq8bUFtSrnrgMbzRNzUcihACF57iClpJa-ZC9uv-Dt2RHK1CvmZFvUWsseVijLrVPbKACTK8k3McoJ0PalyCd6q6VZ5wgUOjDWx6VyooB8k34W4MLajimf7R4WZzKlIufqONDGgJplpsbpR5nquGK7DM82YQgaemWFVHAnV0mt6H8t482LuWSnn6b2G8c4lOk4gfRZ; fptctx2=taBcrIH61PuCVH7eNCyH0FWPWMZs3CpAZMKmhMiLe%252bGSJM5F%252bTt2yo01yfcQpUp%252bXn7iyTiojlnIHsNNj29I4nZhkbIIfSGaS1yuiC9b2DS691Q5rnDgBPPHGmgmOkxJhNIPRxzb69mDGCSS6KMaJn35EQA1I4AHJosb1V%252fo5Lfn7ET83DBWpW35rctKLplLDsY%252fK9ZIii2Wuv9R9yfQM%252bdt%252btxI0AQv%252bxadJ%252bmBjm0VLMxpOnsC6fCNcHvfHmb294FcaBAKsWpVaJzosSzjkV0luQwCLlTJeENQcSGolkYW6cGL0fvZOiyiuuqnqIM3og5fyg%252b7Y%252fihSXP2qhavwXN2CGjxaeb6%252bG3ed9DZB04%253d' \
  -H 'csrf-token: ajax:2584240299603910567' \
  -H 'dnt: 1' \
  -H 'priority: u=1, i' \
  -H 'referer: https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4242592810&discover=recommended&discoveryOrigin=JOBS_HOME_JYMBII&start=24' \
  -H 'sec-ch-prefers-color-scheme: dark' \
  -H 'sec-ch-ua: "Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0' \
  -H 'x-li-lang: en_US' \
  -H 'x-li-page-instance: urn:li:page:d_flagship3_job_collections_discovery_landing;R2XO7GA+SDyM3+nq0Z4vRg==' \
  -H 'x-li-pem-metadata: Voyager - Services Marketplace=job-details-smp-promo' \
  -H 'x-li-track: {"clientVersion":"1.13.36800","mpVersion":"1.13.36800","osName":"web","timezoneOffset":-3,"timezone":"America/Fortaleza","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":1,"displayWidth":1920,"displayHeight":1080}' \
  -H 'x-restli-protocol-version: 2.0.0'
"""


# --- Extract parameters from MAIN_CURL string ---
def get_curl_param(pattern: str, text: str) -> str | None:
    """Helper to run regex and return group 1 or None."""
    match = re.search(pattern, text, re.IGNORECASE)  # Ignore case for header names
    return match.group(1).strip() if match else None


# The JSESSIONID cookie is formatted as: JSESSIONID="ajax:..."
CSRF_TOKEN = get_curl_param(r'JSESSIONID="ajax:([^;"]+)"', MAIN_CURL)
# The li_at cookie is formatted as: li_at=...;
LI_AT = get_curl_param(r"li_at=([^;]+)", MAIN_CURL)
# The bcookie is formatted as: bcookie="..."; - FIX: Don't capture the quotes
BCOOKIE = get_curl_param(r'bcookie="([^"]+)"', MAIN_CURL) or ""
# The user-agent is in a header: -H 'user-agent: ...'
USER_AGENT = get_curl_param(r"-H 'user-agent: (.*?)'", MAIN_CURL)
# The referer header is often crucial
REFERER = get_curl_param(r"-H 'referer: (.*?)'", MAIN_CURL)

INPUT_FILE: dict = load_pagination_file("structured_pagination_results.json")
OUTPUT_FILE = Path("job_details.json")

# Card sections you care about – adjust freely
# FIX: The API endpoint returned errors for previous values.
# Mimicking the exact value from the provided MAIN_CURL to ensure a successful request.
CARD_SECTION_TYPES = ["MARKETPLACE_PROMO_CARD"]


# ---------------------------------------------------------------------------

def make_session() -> requests.Session:
    """Prime a requests session with all headers/cookies once."""
    s = requests.Session()
    s.headers.update(
        {
            "accept": "application/vnd.linkedin.normalized+json+2.1",
            "csrf-token": f"ajax:{CSRF_TOKEN}",
            "user-agent": USER_AGENT,
            "x-li-lang": "en_US",
            "x-restli-protocol-version": "2.0.0",
            "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
            "dnt": "1",
            "priority": "u=1, i",
            "sec-ch-ua": get_curl_param(r"-H 'sec-ch-ua: (.*?)'", MAIN_CURL),
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
        }
    )
    if REFERER:
        s.headers["referer"] = REFERER

    s.cookies.update(
        {
            "li_at": LI_AT,
            "JSESSIONID": f"ajax:{CSRF_TOKEN}",
        }
    )
    if BCOOKIE:
        s.cookies["bcookie"] = BCOOKIE
    return s


def fetch_detail(session: requests.Session, job_urn: str) -> Dict[str, Any]:
    """Return parsed JSON for one job’s detail-sections payload."""
    base_url = "https://www.linkedin.com/voyager/api/graphql"
    query_id = "voyagerJobsDashJobPostingDetailSections.d5e26c6a0b129827c0cfd9d5a714c5e7"

    card_list = ",".join(CARD_SECTION_TYPES)

    # Manually construct the variables string with selective encoding.
    # This is required because LinkedIn's API expects a non-standard URL encoding
    # where parentheses are not encoded, but values within them are.
    variables_str = (
        f"(cardSectionTypes:List({card_list}),"
        f"jobPostingUrn:{quote(job_urn)},"  # URL-encode only the URN value
        f"includeSecondaryActionsV2:true)"
    )

    # Assemble the final URL manually
    full_url = f"{base_url}?variables={variables_str}&queryId={query_id}"

    # --- START DEBUGGING BLOCK ---
    print("-" * 80)
    print(f"Making request for: {job_urn}")
    print(f"URL (Manual Encode): {full_url}")
    print("\n[HEADERS SENT]")
    for key, value in session.headers.items():
        print(f"  {key}: {value}")
    print("\n[COOKIES SENT]")
    for key, value in session.cookies.items():
        print(f"  {key}: {value}")
    print("-" * 80)
    # --- END DEBUGGING BLOCK ---

    # Pass the fully constructed URL directly, without using the `params` argument
    r = session.get(full_url, timeout=15)

    if r.status_code != 200:
        error_message = f"{job_urn} → HTTP {r.status_code} for URL: {r.url}"
        try:
            response_json = r.json()
            error_message += f"\nResponse: {json.dumps(response_json, indent=2)}"
        except json.JSONDecodeError:
            error_message += f"\nResponse: {r.text}"
        raise RuntimeError(error_message)

    text = r.text.lstrip("for(;;);")
    return json.loads(text)


def main() -> None:
    urns = [j["urn"] for j in INPUT_FILE["jobs"] if j.get("urn")]
    sess = make_session()
    results = []

    # --- DEBUG LIMITER ---
    # Process only the first 2 URNs for faster testing.
    # Comment out or remove the next line to process all jobs.
    urns = urns[:2]
    print(f"DEBUG MODE: Processing only the first {len(urns)} jobs.")
    # --- END DEBUG LIMITER ---

    for idx, urn in enumerate(urns, start=1):
        try:
            print(f"\n[{idx}/{len(urns)}] fetching {urn} … ", end="", flush=True)
            data = fetch_detail(sess, urn)
            results.append({"jobPostingUrn": urn, "detailSections": data})
            print("✓ SUCCESS")
            time.sleep(1.2)
        except Exception as exc:
            print(f"FAILED → {exc}")

    if results:
        OUTPUT_FILE.write_text(json.dumps(results, indent=2, ensure_ascii=False))
        print(f"\nSaved {len(results)} jobs to {OUTPUT_FILE}")
    else:
        print("\nNo jobs were successfully fetched.")


if __name__ == "__main__":
    missing = [
        var_name
        for var_name, var_value in {
            "LI_AT": LI_AT,
            "CSRF_TOKEN": CSRF_TOKEN,
            "USER_AGENT": USER_AGENT,
            "REFERER": REFERER,
        }.items()
        if not var_value
    ]
    if missing:
        raise SystemExit(
            f"Could not parse the following from the cURL string: {', '.join(missing)}"
        )
    print("--- Initial Parameters Parsed ---")
    print(f"LI_AT: ...{LI_AT[-10:]}")
    print(f"CSRF_TOKEN: {CSRF_TOKEN}")
    print(f"BCOOKIE: {BCOOKIE}")
    print(f"USER_AGENT: {USER_AGENT}")
    print(f"REFERER: {REFERER}")
    print("-" * 33 + "\n")

    main()
