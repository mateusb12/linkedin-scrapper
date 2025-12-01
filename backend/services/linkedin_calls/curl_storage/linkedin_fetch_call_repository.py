# backend/services/linkedin_calls/curl_storage/linkedin_fetch_call_repository.py

import json
import os
import sys
import requests
from typing import Dict, Any, Optional, Tuple

# --- Add project root to path to allow imports from backend ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
# -------------------------------------------------------------

# This dictionary contains all the static headers for the LinkedIn request.
HEADERS_DICT = {
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
    'accept-language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
    'csrf-token': 'ajax:2584240299603910567',
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
    'x-li-track': '{"clientVersion":"1.13.37702","mpVersion":"1.13.37702","osName":"web","timezoneOffset":-3,'
                  '"timezone":"America/Fortaleza","deviceFormFactor":"DESKTOP","mpName":"voyager-web",'
                  '"displayDensity":1,"displayWidth":1920,"displayHeight":1080}',
    'x-restli-protocol-version': '2.0.0'
}


def get_linkedin_fetch_artefacts() -> Optional[Tuple[requests.Session, Dict[str, Any]]]:
    from .linkedin_fetch_call_repository import load_linkedin_config

    config = load_linkedin_config('LinkedIn_Saved_Jobs_Scraper')
    if not config:
        print("❌ Critical error: Could not load API configuration 'LinkedIn_Saved_Jobs_Scraper'.")
        return None

    session = requests.Session()
    session.headers.update(config.get('headers', {}))
    return session, config


def save_linkedin_config_to_db():
    """
    Saves the LinkedIn request configuration to the database using the FetchCurl model.
    """
    from database.database_connection import get_db_session
    from models.fetch_models import FetchCurl

    session = get_db_session()

    config_name = "LinkedIn_Saved_Jobs_Scraper"
    existing_record = session.query(FetchCurl).filter_by(name=config_name).first()
    if existing_record:
        print(f"✅ Configuration '{config_name}' already exists in the database. No action taken.")
        session.close()
        return

    print(f"🔧 Creating new configuration record for '{config_name}'...")
    new_record = FetchCurl(
        name=config_name,
        base_url="https://www.linkedin.com/voyager/api/graphql",
        query_id="voyagerSearchDashClusters.5ba32757c00b31aea747c8bebb92855c",
        method="GET",
        headers=json.dumps(HEADERS_DICT, indent=2),
        referer=HEADERS_DICT.get('referer')
    )

    session.add(new_record)
    session.commit()
    session.close()
    print(f"💾 Successfully saved '{config_name}' configuration to the database.")


def load_linkedin_config(config_name: str) -> dict | None:
    """
    Loads a specific request configuration from the database by name.
    """
    from database.database_connection import get_db_session
    from models.fetch_models import FetchCurl
    from path.file_content_loader import load_cookie_value

    session = get_db_session()

    print(f"🔎 Attempting to load configuration '{config_name}' from the database...")
    record = session.query(FetchCurl).filter_by(name=config_name).first()

    if not record:
        print(f"❌ Configuration '{config_name}' not found in the database.")
        session.close()
        return None

    print(f"[DEBUG] Scraper READ record -> ID {record.id}, Name {record.name}")

    headers_dict = json.loads(record.headers)
    cookie_to_use = record.cookies

    # If cookie missing, load from file
    if not cookie_to_use:
        raise RuntimeError(
            f"❌ ERROR: No cookie found in database for '{config_name}'. "
            "File-based cookie loading is disabled."
        )

    else:
        print("🍪 Using cookie from DB.")

    # Inject cookie into headers
    if cookie_to_use:
        headers_dict["Cookie"] = cookie_to_use

    config = {
        "name": record.name,
        "base_url": record.base_url,
        "query_id": record.query_id,
        "method": record.method,
        "headers": headers_dict,
        "referer": record.referer
    }

    session.close()
    return config
