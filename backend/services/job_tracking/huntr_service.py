import os
import re
import requests
import pandas as pd
from dotenv import load_dotenv

# === CONFIGURATION ===
load_dotenv()
BOARD_ID = "688d5d88d8a7600057f5edbc"
COOKIE_ENV = "HUNTR_FULL_COOKIE"


def get_fresh_token() -> str:
    """
    Fetches a new Chrome‐extension token and returns the raw JWT string.
    """
    session_id = "sess_30hzlLOPQc3Rf56LJISDFEcLTM8"
    cookie = os.getenv("HUNTR_FULL_COOKIE")
    if not cookie:
        raise ValueError("HUNTR_FULL_COOKIE not set")

    url = (
        f"https://clerk.huntr.co/v1/client/sessions/"
        f"{session_id}/tokens/huntr-chrome-extension"
        "?_clerk_js_version=4.73.14"
    )
    headers = {
        "Accept": "*/*",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookie,
        # (other headers omitted for brevity)…
    }

    resp = requests.post(url, headers=headers, data={})
    resp.raise_for_status()
    data = resp.json()

    # <-- pull the “jwt” field now
    token = data.get("jwt")
    if not token:
        raise ValueError(f"No token found in response: {data}")
    return token


def load_board(token: str, board_id: str) -> dict:
    """
    Uses the raw JWT to fetch board data.
    """
    url = f"https://api.huntr.co/api/board/{board_id}/load"
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
        "Authorization": f"Bearer {token}",
        "DNT": "1",
        "Origin": "https://huntr.co",
        "Referer": "https://huntr.co/",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"
        ),
    }
    resp = requests.get(url, headers=headers)
    resp.raise_for_status()
    return resp.json()


def extract_jobs(data: dict) -> list[dict]:
    jobs = []
    for job_id, job in data["jobs"].items():
        title = job.get("title", "Untitled")
        company_id = job.get("_company")
        company = data["companies"].get(company_id, {}).get("name", "Unknown")
        activity_id = job.get("_applicationActivity")
        applied_at_raw = (
            data["activities"]
            .get(activity_id, {})
            .get("completedAt")
            if activity_id else None
        )

        # Try parsing date to datetime
        try:
            applied_at = pd.to_datetime(applied_at_raw)
            formatted_applied = applied_at.strftime("%d/%b/%Y at %H:%M")
            # lowercase month
            formatted_applied = re.sub(r"(?<=\d{2}/)([A-Za-z]{3})(?=/)", lambda m: m.group(1).lower(), formatted_applied)
        except Exception:
            applied_at = None
            formatted_applied = None

        jobs.append({
            "title": title,
            "company": company,
            "appliedAt": applied_at_raw,
            "formattedAppliedDate": formatted_applied
        })

    # Sort by raw datetime, descending
    return sorted(jobs, key=lambda j: j["appliedAt"] or "", reverse=True)


def main():
    try:
        print("🔄 Fetching fresh extension token…")
        token = get_fresh_token()
        print("📥 Loading board data…")
        data = load_board(token, BOARD_ID)
        jobs = extract_jobs(data)

        print("📋 Applied jobs:")
        for job in jobs:
            print(f"{job['formattedAppliedDate']:>20} | {job['title']} at {job['company']}")
    except Exception as e:
        print("❌", e)


if __name__ == "__main__":
    main()
