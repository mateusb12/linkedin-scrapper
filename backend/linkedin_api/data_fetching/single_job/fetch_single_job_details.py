#!/usr/bin/env python3
"""
Fetch full LinkedIn job-detail sections for every URN found in
structured_pagination_results.json and save them all to raw_job_details.json
"""

import json
import os
import re
import time
from pathlib import Path
from typing import Dict, Any, List
from urllib.parse import quote

import requests

# This assumes you have a local module for loading the file.
# If the script is in the same directory as the file loader, this should work.
from backend.path.file_content_loader import load_pagination_file

# ---------- 1. CONFIG --------------------------------------------------------

MAIN_CURL = """
curl 'https://www.linkedin.com/voyager/api/graphql?variables=(jobPostingDetailDescription_start:0,jobPostingDetailDescription_count:5,jobCardPrefetchQuery:(prefetchJobPostingCardUrns:List(urn%3Ali%3Afsd_jobPostingCard%3A%284242597525%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284256034728%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284248211110%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284256169451%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284253943175%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284256302256%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284252719618%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284256053387%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284145975757%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284257705883%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284237482675%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284211741059%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284110557647%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284247980291%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284258558200%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284255199664%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284256014659%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284253859908%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284244074136%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284231440062%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284233191422%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284256342253%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284244957699%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284251942415%2CJOB_DETAILS%29),jobUseCase:JOB_DETAILS,count:5),jobDetailsContext:(isJobSearch:false))&queryId=voyagerJobsDashJobCards.174f05382121bd73f2f133da2e4af893' \
  -H 'accept: application/vnd.linkedin.normalized+json+2.1' \
  -H 'accept-language: en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7' \
  -b 'bcookie="v=2&8dbfbdc7-e798-40ce-8645-afc560856845"; bscookie="v=1&2025021218502355028f04-83cc-48ed-8919-ec97e40bda49AQE-zsW9viyonHpVi4HpRFLzIsEFwyoJ"; g_state={"i_l":0}; liap=true; JSESSIONID="ajax:2584240299603910567"; dfpfpt=02f41f47dbb840f9b833d6e8dfc0b0f4; li_ep_auth_context=AM9hcHA9YWNjb3VudENlbnRlckh1YixhaWQ9Mjc4NDA2MDY2LGlpZD0zMjQzMzI2NTAscGlkPTI3NjY4NDk4NixleHA9MTc0MjUzNjIwNTc0NyxjdXI9dHJ1ZXxhcHA9c2FsZXNOYXZpZ2F0b3IsYWlkPTI3ODQwNjA2NixpaWQ9NDIwODYxNDY1LHBpZD0yNzY2ODQ5ODYsZXhwPTE3NDUwOTk5ODI2ODcsY3VyPXRydWUsc2lkPTE1Mjk0MTEwMDQsY2lkPTIwMTAwNDU2NzQBf0iA5XMh-eRvJ2QB4KS5KK8SUNQ; li_theme=dark; li_theme_set=user; timezone=America/Fortaleza; sdui_ver=sdui-flagship:0.1.6871+sdui-flagship.production; li_at=AQEFAHUBAAAAABSqG7UAAAGXXzKSSAAAAZfQlkN3TQAAGHVybjpsaTptZW1iZXI6MTAyNjk0MzMwNWYm1DqJn9kEYGnmmj4HkCVrpl3L5eJp6SCHmQzh2UvTrNb4ZCrO6KrDqSahqKv352NrmK4nJ1ykljhPY1R_9fkxPKDDuXtFCJ252bFBMOqLHvgD4aER9aFWxI8uVrqQ-XclO2lS7kCDkElsJKBhmnizusR5CU2Vp131PBgPeO4t3b3NWk0VPkYPH7fgogE7wmRuSTI; lidc="b=VB05:s=V:r=V:a=V:p=V:g=7865:u=301:x=1:i=1751049807:t=1751136207:v=2:sig=AQH6C-mDLo0Y-9rIPqjQWgxsHxv19WR1"; lang=v=2&lang=en-us; __cf_bm=utqI20WtDrwQ3xl85GHh3A1af1995ZBGao0OjbMyEMc-1751074230-1.0.1.1-OJ_5hDmPDTBuXcV7a.BuOXEkBWVCNMZLcHILV7sqqJxuo7SxBeFFxII0cfSuN9yu1nBZDgq7x.k2hGQ5IoiPlckgIgeAM1F0UoNpgD3qGPk; UserMatchHistory=AQLq-P1BE8SsYAAAAZe0KFamFp_dlZ7iBJEAnWnEJflYSQscMGbSrz2gCZhn5gRF9M1QpivteftcScSXjv_ExY8x_780p2agCfrTIpc4HDhQFvedQ4MnldYq-S1BQPfSkcqcwNQHFTyIUOKFqbdjH_FkaktVUCl0AN7oKZ4Qm2BRdiVvx-EurInIEt1pbr3uMh6ByzWzCMwPP0XGI5VVHeGQVIpHAgSO4hRA_pLt3vq9U5GQd-tOM2URnUEGPIh_41hQ84OOW3sPquznqY2nqMGJJXOah-x0Y7WExVlnLlx0jWqbqJE1kTv2mYQIAtesVdnQukBoaL3WR10LbI8p; fptctx2=taBcrIH61PuCVH7eNCyH0FWPWMZs3CpAZMKmhMiLe%252bGSJM5F%252bTt2yo01yfcQpUp%252bXn7iyTiojlnIHsNNj29I4nZhkbIIfSGaS1yuiC9b2DS691Q5rnDgBPPHGmgmOkxJhNIPRxzb69mDGCSS6KMaJhEpCQCg2SlTGmg7cAoi1N3NWNa8pwOGNDV6eCudhN4LOHqcloEXiddHefDVsOePEO%252bBHwi%252fCb%252bTHgsrRFi5%252bRmYNAfXZS%252ffyEon%252fhawoM4wHU8c8WTXlOeCgagI%252bcNn1cX%252bo%252bldY4SGdgQpPzE2Ss3tAxxuNJJShZDP3I4yTFBJuyJ6hhM%252fJHIZd86ZrivVMGV3lu%252bsTIeaN2QkwtWRoAw%253d' \
  -H 'csrf-token: ajax:2584240299603910567' \
  -H 'dnt: 1' \
  -H 'priority: u=1, i' \
  -H 'referer: https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4240087598&discover=recommended&discoveryOrigin=JOBS_HOME_JYMBII&start=24' \
  -H 'sec-ch-prefers-color-scheme: dark' \
  -H 'sec-ch-ua: "Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0' \
  -H 'x-li-lang: en_US' \
  -H 'x-li-page-instance: urn:li:page:d_flagship3_job_collections_discovery_landing;MEhZi+B5SdygiCqM5t9z0w==' \
  -H 'x-li-prefetch: 1' \
  -H 'x-li-track: {"clientVersion":"1.13.36800","mpVersion":"1.13.36800","osName":"web","timezoneOffset":-3,"timezone":"America/Fortaleza","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":1,"displayWidth":1920,"displayHeight":1080}' \
  -H 'x-restli-protocol-version: 2.0.0'
"""


# --- Extract parameters from MAIN_CURL string ---
def get_curl_param(pattern: str, text: str) -> str | None:
    """Helper to run regex and return group 1 or None."""
    match = re.search(pattern, text, re.IGNORECASE)  # Ignore case for header names
    return match.group(1).strip() if match else None


INPUT_FILE: dict = load_pagination_file("structured_pagination_results.json")
OUTPUT_FILE = Path("raw_job_details.json")


# ---------------------------------------------------------------------------

def make_session(curl_string: str) -> requests.Session:
    """Prime a requests session with all headers/cookies once."""
    CSRF_TOKEN = get_curl_param(r'JSESSIONID="ajax:([^;"]+)"', curl_string)
    LI_AT = get_curl_param(r"li_at=([^;]+)", curl_string)
    BCOOKIE = get_curl_param(r'bcookie="([^"]+)"', curl_string) or ""
    USER_AGENT = get_curl_param(r"-H 'user-agent: (.*?)'", curl_string)
    REFERER = get_curl_param(r"-H 'referer: (.*?)'", curl_string)

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
            # This header is now dynamically extracted
            "sec-ch-ua": get_curl_param(r"-H 'sec-ch-ua: (.*?)'", curl_string),
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


def fetch_job_detail(session: requests.Session, job_urn: str, debug: bool = False) -> Dict[str, Any]:
    """Return parsed JSON for one job’s detail-sections payload."""
    base_url = "https://www.linkedin.com/voyager/api/graphql"

    query_id = "voyagerJobsDashJobCards.174f05382121bd73f2f133da2e4af893"

    job_id_match = re.search(r'\d+$', job_urn)
    if not job_id_match:
        raise ValueError(f"Could not extract numeric ID from job URN: {job_urn}")
    job_id = job_id_match.group(0)

    prefetch_card_urn = f"urn:li:fsd_jobPostingCard:({job_id},JOB_DETAILS)"

    variables_str = (
        "(jobPostingDetailDescription_start:0,jobPostingDetailDescription_count:5,"
        "jobCardPrefetchQuery:(prefetchJobPostingCardUrns:List("
        f"{quote(prefetch_card_urn)}"
        "),jobUseCase:JOB_DETAILS,count:1),"
        "jobDetailsContext:(isJobSearch:false))"
    )

    full_url = f"{base_url}?variables={variables_str}&queryId={query_id}"

    # --- START DEBUGGING BLOCK ---
    if debug:
        print("-" * 80)
        print(f"Making request for: {job_urn}")
        print(f"URL (Mimicking MAIN_CURL): {full_url}")
        print("\n[HEADERS SENT]")
        for key, value in session.headers.items():
            print(f"  {key}: {value}")
        print("\n[COOKIES SENT]")
        for key, value in session.cookies.items():
            print(f"  {key}: {value}")
        print("-" * 80)
    # --- END DEBUGGING BLOCK ---

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


def main(curl_string: str) -> None:
    urns = [j["urn"] for j in INPUT_FILE.get("jobs", []) if j.get("urn")]
    if not urns:
        print("No job URNs found in the input file.")
        return

    sess = make_session(curl_string)
    results = []

    # --- DEBUG LIMITER ---
    urns_to_process = urns[:2]
    print(f"DEBUG MODE: Processing only the first {len(urns_to_process)} of {len(urns)} jobs.")
    # --- END DEBUG LIMITER ---

    for idx, urn in enumerate(urns_to_process, start=1):
        try:
            print(f"\n[{idx}/{len(urns_to_process)}] fetching {urn} … ", end="", flush=True)
            data = fetch_job_detail(sess, urn)
            results.append({"jobPostingUrn": urn, "detailResponse": data})
            print("✓ SUCCESS")
            time.sleep(1.5)
        except Exception as exc:
            print(f"FAILED → {exc}")

    if results:
        # --- FINAL FIX: Specify encoding when writing the file ---
        OUTPUT_FILE.write_text(
            json.dumps(results, indent=2, ensure_ascii=False),
            encoding='utf-8'
        )
        print(f"\nSaved {len(results)} jobs to {OUTPUT_FILE}")
    else:
        print("\nNo jobs were successfully fetched.")


if __name__ == "__main__":
    curl_string = MAIN_CURL
    main(curl_string)
