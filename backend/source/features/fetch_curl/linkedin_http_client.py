# backend/source/features/get_applied_jobs/linkedin_fetch_call_repository.py

import json
import os
import sys
import requests
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple

# --- Add project root to path ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
# -------------------------------------------------------------

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


# ---------------------------------------------------------------------
# REQUEST OBJECT BASE
# ---------------------------------------------------------------------

class LinkedInRequest(ABC):
    """
    Classe base abstrata para todas as requisições do LinkedIn.
    Cada URL construída é um objeto que sabe se executar e se transformar em cURL.
    """

    def __init__(self, method: str, url: str):
        self.method = method
        self.url = url
        self._headers = {}
        self._body = None

    def set_headers(self, headers: dict):
        self._headers = headers
        return self

    def set_body(self, body: dict):
        self._body = body
        return self

    def to_curl(self, cookies=None) -> str:
        parts = [f"curl -X {self.method} '{self.url}'"]
        for k, v in self._headers.items():
            parts.append(f"-H '{k}: {v}'")

        if cookies:
            cookie_str = "; ".join(f"{c.name}={c.value}" for c in cookies)
            parts.append(f"-H 'Cookie: {cookie_str}'")

        if self._body is not None:
            parts.append(f"--data '{json.dumps(self._body)}'")

        return " \\\n  ".join(parts)

    def execute(self, session: requests.Session, timeout=15) -> requests.Response:
        # Mescla headers da sessão com headers específicos do request
        merged_headers = session.headers.copy()
        merged_headers.update(self._headers)

        return session.request(
            method=self.method,
            url=self.url,
            headers=merged_headers,
            json=self._body,
            timeout=timeout
        )


# ---------------------------------------------------------------------
# CONCRETE VOYAGER REQUEST (SHARED)
# ---------------------------------------------------------------------

class VoyagerGraphQLRequest(LinkedInRequest):
    """
    Objeto especializado na busca principal (Voyager GraphQL).
    Usado tanto para 'Saved Jobs' quanto para 'Applied Jobs'.
    """

    def __init__(self, base_url: str, query_id: str, start: int, card_type: str):
        variables = (
            f"(start:{start},query:("
            "flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER,"
            f"queryParameters:List((key:cardType,value:List({card_type})))"
            "))"
        )
        final_url = f"{base_url}?variables={variables}&queryId={query_id}"
        super().__init__("GET", final_url)


# ---------------------------------------------------------------------
# ARTEFACTS LOADER
# ---------------------------------------------------------------------

def get_linkedin_fetch_artefacts() -> Optional[Tuple[requests.Session, Dict[str, Any]]]:
    from .linkedin_http_client import load_linkedin_config  # evitar import circular

    config = load_linkedin_config('LinkedIn_Saved_Jobs_Scraper')
    if not config:
        print("❌ Critical error: Could not load API configuration 'LinkedIn_Saved_Jobs_Scraper'.")
        return None

    session = requests.Session()
    session.headers.update(config.get('headers', {}))
    return session, config


def save_linkedin_config_to_db():
    from database.database_connection import get_db_session
    from models.fetch_models import FetchCurl

    session = get_db_session()
    config_name = "LinkedIn_Saved_Jobs_Scraper"
    existing_record = session.query(FetchCurl).filter_by(name=config_name).first()
    if existing_record:
        print(f"✅ Configuration '{config_name}' already exists.")
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
    print(f"💾 Successfully saved '{config_name}' to DB.")


def load_linkedin_config(config_name: str) -> dict | None:
    from database.database_connection import get_db_session
    from models.fetch_models import FetchCurl

    session = get_db_session()
    print(f"🔎 Attempting to load configuration '{config_name}'...")
    record = session.query(FetchCurl).filter_by(name=config_name).first()

    if not record:
        print(f"❌ Configuration '{config_name}' not found.")
        session.close()
        return None

    print(f"[DEBUG] Scraper READ record -> ID {record.id}, Name {record.name}")

    headers_dict = json.loads(record.headers)
    cookie_to_use = record.cookies

    if not cookie_to_use:
        raise RuntimeError(f"❌ ERROR: No cookie found for '{config_name}'.")
    else:
        print("🍪 Using cookie from DB.")

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