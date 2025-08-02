import base64
import os
import re

import requests
import pandas as pd
import json
from dotenv import load_dotenv

# === CONFIGURATION ===
load_dotenv()
BOARD_ID = "688d5d88d8a7600057f5edbc"
cookie_str = os.getenv("HUNTR_FULL_COOKIE")
if not cookie_str:
    raise ValueError("❌ HUNTR_FULL_COOKIE not set. Add it to your .env file.")


def extract_session_id_from_cookie(cookie: str) -> str:
    """
    Extracts session ID (sess_...) directly from the full cookie string.
    """
    print("🔍 Scanning cookie for session ID...")
    session_match = re.search(r'sess_[a-zA-Z0-9]+', cookie)
    if session_match:
        print(f"✅ Found session ID: {session_match.group(0)}")
        return session_match.group(0)
    else:
        raise ValueError("❌ Session ID (sess_...) not found in cookie")


# === TOKEN RETRIEVAL (NO JWT PARSING) ===
def get_fresh_token():
    print("🔄 Getting fresh token using hardcoded session ID...")

    session_id = "sess_30hzlLOPQc3Rf56LJISDFEcLTM8"  # <-- hardcoded here
    cookie = os.getenv("HUNTR_FULL_COOKIE")
    if not cookie:
        raise ValueError("❌ Environment variable HUNTR_FULL_COOKIE is not set")

    url = (
        f"https://clerk.huntr.co/v1/client/sessions/"
        f"{session_id}/tokens/huntr-chrome-extension"
        "?_clerk_js_version=4.73.14"
    )

    headers = {
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
        "Content-Type": "application/x-www-form-urlencoded",
        "DNT": "1",
        "Origin": "https://huntr.co",
        "Referer": "https://huntr.co/",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"
        ),
        "Cookie": cookie,
    }

    resp = requests.post(url, headers=headers, data={})
    resp.raise_for_status()
    print("✅ Token retrieved!")
    return resp.json()


# === JOB DATA ===
def load_board(jwt, board_id):
    url = f"https://api.huntr.co/api/board/{board_id}/load"
    headers = {
        "authorization": f"Bearer {jwt}",
        "accept": "application/json, text/plain, */*",
        "origin": "https://huntr.co",
        "referer": "https://huntr.co/",
    }
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()


def extract_jobs(data):
    jobs = []
    for job_id, job in data["jobs"].items():
        title = job.get("title", "Untitled")
        company_id = job.get("_company")
        company = data["companies"].get(company_id, {}).get("name", "Unknown")
        activity_id = job.get("_applicationActivity")
        applied_at = data["activities"].get(activity_id, {}).get("completedAt") if activity_id else None

        jobs.append({
            "title": title,
            "company": company,
            "appliedAt": applied_at,
        })

    df = pd.DataFrame(jobs)
    df["appliedAt"] = pd.to_datetime(df["appliedAt"], errors="coerce")
    return df.sort_values(by="appliedAt")


# === MAIN ===
def main():
    try:
        print("🔄 Getting fresh token using raw cookie...")
        jwt = get_fresh_token()

        print("📥 Fetching board data...")
        data = load_board(jwt, BOARD_ID)

        print("📋 Applied jobs:")
        jobs_df = extract_jobs(data)
        print(jobs_df[["appliedAt", "title", "company"]])

    except Exception as e:
        print(str(e))


if __name__ == "__main__":
    main()
