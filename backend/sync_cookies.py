import json
import re
import sys
from pathlib import Path

# Ensure backend modules can be imported
sys.path.append(str(Path(__file__).parent))

from database.database_connection import get_db_session
from models.fetch_models import FetchCurl

def sync_har_to_db():
    print("--- 🍪 Syncing Cookies from HAR to DB ---")

    # 1. Locate HAR File
    har_path = Path("linkedin.har")
    if not har_path.exists():
        # Check Downloads
        har_path = Path.home() / "Downloads" / "linkedin.har"

    if not har_path.exists():
        print("❌ Error: 'linkedin.har' not found in root or Downloads.")
        return

    print(f"📂 Reading credentials from: {har_path}")

    # 2. Extract Credentials
    with open(har_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    li_at_match = re.search(r'li_at=([^;"]+)', content)
    jsession_match = re.search(r'JSESSIONID=?[\\"]*ajax:([0-9]+)', content)

    if not li_at_match or not jsession_match:
        print("❌ Error: Could not extract li_at or JSESSIONID from HAR.")
        return

    li_at = li_at_match.group(1)
    csrf_token = f"ajax:{jsession_match.group(1)}"

    # 3. Construct Headers & Cookies
    # We must update the CSRF token in the headers to match the cookie!
    new_headers = {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'accept-language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
        'csrf-token': csrf_token,  # <--- CRITICAL UPDATE
        'priority': 'u=1, i',
        'referer': 'https://www.linkedin.com/my-items/saved-jobs/',
        'sec-ch-prefers-color-scheme': 'dark',
        'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-li-lang': 'en_US',
        'x-li-page-instance': 'urn:li:page:d_flagship3_myitems_savedjobs;gGeMib0KRoGTbXxHpSSTfg==',
        'x-li-pem-metadata': 'Voyager - My Items=myitems-saved-jobs',
        'x-li-track': '{"clientVersion":"1.13.37702","mpVersion":"1.13.37702","osName":"web","timezoneOffset":-3,"deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":1,"displayWidth":1920,"displayHeight":1080}',
        'x-restli-protocol-version': '2.0.0'
    }

    # Cookie string format required by requests
    new_cookie_str = f'li_at={li_at}; JSESSIONID="{csrf_token}"'

    # 4. Update Database
    session = get_db_session()
    config_name = "LinkedIn_Saved_Jobs_Scraper"

    try:
        record = session.query(FetchCurl).filter_by(name=config_name).first()

        if not record:
            print(f"⚠️ Record '{config_name}' not found. Creating it...")
            record = FetchCurl(name=config_name)
            session.add(record)

        # Update fields
        record.headers = json.dumps(new_headers)
        record.cookies = new_cookie_str

        session.commit()
        print(f"✅ Successfully updated DB record '{config_name}'")
        print(f"   CSRF: {csrf_token}")
        print(f"   LI_AT: {li_at[:15]}...")

    except Exception as e:
        session.rollback()
        print(f"❌ Database Error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    sync_har_to_db()