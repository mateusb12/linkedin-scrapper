# backend/scripts/save_linkedin_config.py

import json
import os
import sys

# --- Add project root to path to allow imports from backend ---
# This ensures that we can import 'app', 'db', and 'models'
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
# -------------------------------------------------------------

# NOTE: We removed the top-level imports of app, db, and FetchCurl to prevent circular dependencies.
# They are now imported locally within the functions that need them.

# --- The headers from your original setup_session ---
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


def save_linkedin_config_to_db():
    """
    Saves the LinkedIn request configuration to the database using the FetchCurl model.
    This function runs within the Flask application context to ensure it has access
    to the configured database session.
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
    """
    # Local imports to prevent circular dependency
    from app import app
    from database.extensions import db
    from models.fetch_models import FetchCurl

    with app.app_context():
        print(f"🔎 Attempting to load configuration '{config_name}' from the database...")
        record = db.session.query(FetchCurl).filter_by(name=config_name).first()

        if record:
            print(f"✅ Configuration '{config_name}' found.")
            headers_dict = json.loads(record.headers)
            return {
                "name": record.name,
                "base_url": record.base_url,
                "query_id": record.query_id,
                "method": record.method,
                "headers": headers_dict,
                "referer": record.referer
            }
        else:
            print(f"❌ Configuration '{config_name}' not found in the database.")
            return None


if __name__ == "__main__":
    config_name = "LinkedIn_Saved_Jobs_Scraper"
    # To run this script directly, you might need to ensure the app context is set up correctly.
    # Depending on your project structure, this might need more setup.
    # For now, we assume it's called from within the app's lifecycle.
    # save_linkedin_config_to_db()
    loaded_config = load_linkedin_config(config_name=config_name)
    print("Loaded configuration:", loaded_config)