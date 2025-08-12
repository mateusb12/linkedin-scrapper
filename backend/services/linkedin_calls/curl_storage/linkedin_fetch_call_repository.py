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
    """
    Loads LinkedIn config, creates a session with the cookie from the config,
    and returns both.

    This function is the single source for getting everything needed to make a
    LinkedIn API call, encapsulating the session and cookie logic.

    Returns:
        A tuple containing:
        - A fully configured requests.Session object.
        - The configuration dictionary (containing base_url, query_id, etc.).
        Returns None if the configuration cannot be loaded.
    """
    config = load_linkedin_config('LinkedIn_Saved_Jobs_Scraper')
    if not config:
        print("❌ Critical error: Could not load API configuration 'LinkedIn_Saved_Jobs_Scraper'.")
        return None

    session = requests.Session()

    # The config dictionary now contains the headers with the correct cookie,
    # so we can just update the session directly.
    headers = config.get('headers', {})
    session.headers.update(headers)

    return session, config


def save_linkedin_config_to_db():
    """
    Saves the LinkedIn request configuration to the database using the FetchCurl model.
    """
    # Local imports to prevent circular dependency
    from app import app
    from database.extensions import db
    from models.fetch_models import FetchCurl

    with app.app_context():
        config_name = "LinkedIn_Saved_Jobs_Scraper"
        existing_record = db.session.query(FetchCurl).filter_by(name=config_name).first()
        if existing_record:
            print(f"✅ Configuration '{config_name}' already exists in the database. No action taken.")
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
        db.session.add(new_record)
        db.session.commit()
        print(f"💾 Successfully saved '{config_name}' configuration to the database.")


def load_linkedin_config(config_name: str) -> dict | None:
    """
    Loads a specific request configuration from the database by name.
    If the configuration is found but does not have a cookie stored, this function
    will load the cookie from the source file, update the database record, and
    then include it in the returned configuration dictionary.
    """
    # Local imports to prevent circular dependency
    from app import app
    from database.extensions import db
    from models.fetch_models import FetchCurl
    from path.file_content_loader import load_cookie_value

    with app.app_context():
        print(f"🔎 Attempting to load configuration '{config_name}' from the database...")
        record = db.session.query(FetchCurl).filter_by(name=config_name).first()

        if not record:
            print(f"❌ Configuration '{config_name}' not found in the database.")
            return None

        print(f"✅ Configuration '{config_name}' found.")
        headers_dict = json.loads(record.headers)
        cookie_to_use = record.cookies

        # If there's no cookie in the database, load it from the file and update the record.
        # This is a one-time operation per record without a cookie.
        if not cookie_to_use:
            print(f"🍪 No cookie found in DB for '{config_name}'. Loading from file...")
            cookie_from_file = load_cookie_value()
            if cookie_from_file:
                record.cookies = cookie_from_file
                db.session.commit()
                cookie_to_use = cookie_from_file
                print(f"💾 DB record for '{config_name}' updated with the new cookie.")
            else:
                print(f"⚠️ Warning: Could not load cookie from file for '{config_name}'. Proceeding without a cookie.")
        else:
            print("🍪 Using existing cookie from the database.")

        # Ensure the cookie is part of the headers for the request session.
        if cookie_to_use:
            headers_dict['Cookie'] = cookie_to_use

        return {
            "name": record.name,
            "base_url": record.base_url,
            "query_id": record.query_id,
            "method": record.method,
            "headers": headers_dict,
            "referer": record.referer
        }


if __name__ == "__main__":
    config_name = "LinkedIn_Saved_Jobs_Scraper"
    # To create the initial record if it doesn't exist:
    # from app import app
    # with app.app_context():
    #     save_linkedin_config_to_db()

    # To test loading the configuration:
    # from app import app
    # with app.app_context():
    #     loaded_config = load_linkedin_config(config_name=config_name)
    #     print("Loaded configuration:", json.dumps(loaded_config, indent=2))
