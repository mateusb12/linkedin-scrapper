import json
import os
import sys
import requests
import re
from abc import ABC
from typing import Dict, Any, Optional, Tuple

# --- Add project root to path ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


# ============================================================
# ParsedResponse
# ============================================================

class ParsedResponse:
    def __init__(self, fmt: str, data: Any):
        self.format = fmt
        self.data = data


# ============================================================
# REQUEST BASE
# ============================================================

class LinkedInRequest(ABC):

    def __init__(self, method: str, url: str, debug: bool = False):
        self.method = method
        self.url = url
        self._headers = {}
        self._body = None
        self.debug = debug

    def set_headers(self, headers: dict):
        self._headers = headers
        return self

    def set_body(self, body: dict):
        self._body = body
        return self

    def execute(self, session: requests.Session, timeout=15) -> requests.Response:
        merged_headers = session.headers.copy()
        merged_headers.update(self._headers)

        if self.debug:
            print("\n" + "=" * 80)
            print("🚀 LINKEDIN REQUEST DEBUG")
            print("=" * 80)
            print("METHOD:", self.method)
            print("URL:", self.url)
            print("HEADERS:", merged_headers)
            print("SESSION COOKIES:", session.cookies.get_dict())
            print("BODY:", self._body)
            print("=" * 80)

        response = session.request(
            method=self.method,
            url=self.url,
            headers=merged_headers,
            json=self._body,
            timeout=timeout
        )

        if self.debug:
            print("STATUS:", response.status_code)
            print("RESPONSE (first 800 chars):")
            print(response.text[:800])
            print("=" * 80)

        return response


class VoyagerGraphQLRequest(LinkedInRequest):
    def __init__(self, base_url: str, query_id: str, variables: str):
        separator = "&" if "?" in base_url else "?"
        final_url = f"{base_url}{separator}variables={variables}&queryId={query_id}"
        super().__init__("GET", final_url)


class SduiPaginationRequest(LinkedInRequest):
    def __init__(self, base_url: str, body: dict, debug: bool = False):
        super().__init__("POST", base_url, debug=debug)
        self.set_body(body)


# ============================================================
# LINKEDIN CLIENT (CORRIGIDO)
# ============================================================

class LinkedInClient:

    def __init__(self, config_name: str):
        self.config_name = config_name
        self.session = requests.Session()
        self.config = self._load_config()
        self.csrf_token = None

        if self.config:
            self.session.headers.update(self.config.get("headers", {}))
            self._hydrate_cookies_from_header()
            self.csrf_token = self._extract_csrf()

    # ============================================================
    # 🔥 FIX PRINCIPAL AQUI
    # ============================================================

    def _hydrate_cookies_from_header(self):
        """
        Se existir header 'Cookie', popula também session.cookies
        Isso faz session.cookies.get("JSESSIONID") funcionar.
        """
        cookie_header = self.session.headers.get("Cookie")
        if not cookie_header:
            return

        for part in cookie_header.split(";"):
            if "=" in part:
                name, value = part.strip().split("=", 1)
                self.session.cookies.set(name.strip(), value.strip())

    # ============================================================

    def _load_config(self) -> Optional[dict]:
        from database.database_connection import get_db_session
        from models.fetch_models import FetchCurl

        db = get_db_session()
        print(f"🔎 [LinkedInClient] Loading config '{self.config_name}' from DB...")

        record = db.query(FetchCurl).filter_by(name=self.config_name).first()

        if not record:
            print(f"❌ Configuration '{self.config_name}' not found.")
            db.close()
            return None

        try:
            headers_dict = json.loads(record.headers) if record.headers else {}
        except Exception as e:
            print("❌ Failed to parse headers JSON:", e)
            headers_dict = {}

        # 🔥 NÃO dependemos mais de record.cookies
        # Se o header já contém Cookie, isso basta

        if "Cookie" not in headers_dict:
            print(f"⚠️ Warning: No 'Cookie' header found in config '{self.config_name}'")

        config = {
            "base_url": record.base_url,
            "query_id": record.query_id,
            "headers": headers_dict,
            "referer": record.referer
        }

        db.close()
        return config

    # ============================================================

    def _extract_csrf(self) -> Optional[str]:
        """
        Extrai JSESSIONID do cookie corretamente.
        """
        jsession = self.session.cookies.get("JSESSIONID")
        if jsession:
            return jsession.strip('"')

        cookie_header = self.session.headers.get("Cookie", "")
        match = re.search(r'JSESSIONID="?([^";]+)', cookie_header)
        return match.group(1) if match else None

    # ============================================================

    def execute(self, request: LinkedInRequest) -> requests.Response:
        return request.execute(self.session)

    # ============================================================
    # Opcional: modo parsed (mantido)
    # ============================================================

    def execute_parsed(self, request: LinkedInRequest, timeout=15) -> ParsedResponse:
        raw = request.execute(self.session, timeout=timeout)
        content_type = raw.headers.get("Content-Type", "")

        if "application/octet-stream" in content_type:
            return ParsedResponse("rsc", raw.text)

        try:
            return ParsedResponse("voyager", raw.json())
        except:
            return ParsedResponse("voyager", {})


# ============================================================
# LEGACY HELPERS (INALTERADOS)
# ============================================================

def get_linkedin_fetch_artefacts() -> Optional[Tuple[requests.Session, Dict[str, Any]]]:
    client = LinkedInClient('LinkedIn_Saved_Jobs_Scraper')
    if not client.config:
        return None
    return client.session, client.config
