# backend/source/features/fetch_curl/linkedin_http_client.py

import json
import os
import sys
import requests
import re
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple

# --- Add project root to path ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


# ---------------------------------------------------------------------
# 1) REQUEST ABSTRACTIONS
# ---------------------------------------------------------------------

class LinkedInRequest(ABC):
    """
    Classe base abstrata para todas as requisições do LinkedIn.
    """

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

        if self.debug:
            print("\n" + "="*80)
            print("🚀 LINKEDIN REQUEST DEBUG")
            print("="*80)

            print("\n📌 METHOD:")
            print(self.method)

            print("\n📌 URL:")
            print(self.url)

            print("\n📌 HEADERS (MERGED):")
            for k, v in merged_headers.items():
                print(f"{k}: {v}")

            print("\n📌 SESSION COOKIES:")
            for c in session.cookies:
                print(f"{c.name} = {c.value}")

            print("\n📌 RAW COOKIE HEADER:")
            print(merged_headers.get("Cookie"))

            print("\n📌 BODY:")
            if self._body:
                print(json.dumps(self._body, indent=2))
            else:
                print("None")

            print("\n📌 GENERATED CURL:")
            print(self.to_curl(session.cookies))

            print("="*80)
            print("📡 SENDING REQUEST...")
            print("="*80)

        response = session.request(
            method=self.method,
            url=self.url,
            headers=merged_headers,
            json=self._body,
            timeout=timeout
        )

        if self.debug:
            print("\n📥 RESPONSE STATUS:", response.status_code)
            print("\n📥 RESPONSE HEADERS:")
            for k, v in response.headers.items():
                print(f"{k}: {v}")

            print("\n📥 RESPONSE BODY (first 1000 chars):")
            print(response.text[:1000])

            print("="*80)
            print("🏁 END DEBUG")
            print("="*80 + "\n")

        return response


class VoyagerGraphQLRequest(LinkedInRequest):
    """
    Request genérico para a API Voyager GraphQL.
    Serve tanto para Jobs (SearchCluster) quanto para Profile (Components).
    """

    def __init__(self, base_url: str, query_id: str, variables: str):
        # Monta a URL no padrão Voyager: ?variables=(...)&queryId=...
        # Garante que não haja duplicidade de ? ou &
        separator = "&" if "?" in base_url else "?"
        final_url = f"{base_url}{separator}variables={variables}&queryId={query_id}"
        super().__init__("GET", final_url)

class SduiPaginationRequest(LinkedInRequest):
    """
    Request para endpoints SDUI (React Server Component pagination).
    Exige POST com JSON body.
    """

    def __init__(self, base_url: str, body: dict, debug: bool = False):
        super().__init__("POST", base_url, debug=debug)
        self.set_body(body)


# ---------------------------------------------------------------------
# 2) CLIENT MANAGER (The "Smart" Session)
# ---------------------------------------------------------------------

class LinkedInClient:
    """
    Gerencia a sessão, cookies e configurações do DB.
    Centraliza a lógica de conexão.
    """

    def __init__(self, config_name: str):
        self.config_name = config_name
        self.session = requests.Session()
        self.config = self._load_config()
        self.csrf_token = None

        if self.config:
            # Aplica headers base da configuração
            self.session.headers.update(self.config.get("headers", {}))
            # Tenta extrair CSRF
            self.csrf_token = self._extract_csrf()

    def _load_config(self) -> Optional[dict]:
        from database.database_connection import get_db_session
        from models.fetch_models import FetchCurl

        session_db = get_db_session()
        print(f"🔎 [LinkedInClient] Loading config '{self.config_name}' from DB...")

        record = session_db.query(FetchCurl).filter_by(name=self.config_name).first()

        if not record:
            print(f"❌ Configuration '{self.config_name}' not found.")
            session_db.close()
            return None

        # -------------------------
        # HEADERS
        # -------------------------
        try:
            headers_dict = json.loads(record.headers) if record.headers else {}
        except Exception as e:
            print("❌ Failed to parse headers JSON:", e)
            headers_dict = {}

        # -------------------------
        # COOKIES (FIX CRÍTICO)
        # -------------------------
        if record.cookies:
            try:
                cookie_dict = json.loads(record.cookies)

                def clean(value):
                    if isinstance(value, str):
                        return value.strip('"')
                    return value

                cookie_string = "; ".join(
                    f"{k}={clean(v)}" for k, v in cookie_dict.items()
                )

                headers_dict["Cookie"] = cookie_string
                print("🍪 Cookies applied from DB (formatted).")

            except Exception as e:
                print("❌ Failed to parse cookies JSON:", e)
        else:
            print(f"⚠️ Warning: No cookies found for {self.config_name}")

        config = {
            "base_url": record.base_url,
            "query_id": record.query_id,
            "headers": headers_dict,
            "referer": record.referer
        }

        session_db.close()
        return config


    def _extract_csrf(self) -> Optional[str]:
        """Tenta extrair o CSRF token (JSESSIONID) dos cookies"""
        # 1. Tenta direto do jar de cookies (se requests gerencia)
        if "JSESSIONID" in self.session.cookies:
            return self.session.cookies.get("JSESSIONID").strip('"')

        # 2. Tenta do header 'Cookie' bruto
        cookie_header = self.session.headers.get("Cookie", "")
        m = re.search(r'JSESSIONID="?([^";]+)', cookie_header)
        return m.group(1) if m else None

    def execute(self, request: LinkedInRequest) -> requests.Response:
        """Executa um request usando a sessão configurada"""
        return request.execute(self.session)


# ---------------------------------------------------------------------
# 3) LEGACY / HELPER FUNCTIONS (Mantidas para compatibilidade se necessário)
# ---------------------------------------------------------------------

def get_linkedin_fetch_artefacts() -> Optional[Tuple[requests.Session, Dict[str, Any]]]:
    """Helper legado caso algum outro script ainda use"""
    client = LinkedInClient('LinkedIn_Saved_Jobs_Scraper')
    if not client.config:
        return None
    return client.session, client.config


def save_linkedin_config_to_db():
    from database.database_connection import get_db_session
    from models.fetch_models import FetchCurl

    # Exemplo de headers padrão para salvar
    HEADERS_DICT = {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'csrf-token': 'ajax:2584240299603910567',  # Exemplo
        'x-li-lang': 'en_US',
        'x-restli-protocol-version': '2.0.0'
    }

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
        query_id="voyagerSearchDashClusters.ef3d0937fb65bd7812e32e5a85028e79",
        method="GET",
        headers=json.dumps(HEADERS_DICT, indent=2),
        referer="https://www.linkedin.com/my-items/saved-jobs/"
    )
    session.add(new_record)
    session.commit()
    session.close()
    print(f"💾 Successfully saved '{config_name}' to DB.")


def save_experience_config_to_db():
    from database.database_connection import get_db_session
    from models.fetch_models import FetchCurl

    CONFIG_NAME = "Experience"

    # Headers simplificados para exemplo
    EXPERIENCE_HEADERS = {
        "Accept": "application/vnd.linkedin.normalized+json+2.1",
        "x-restli-protocol-version": "2.0.0",
        "csrf-token": "ajax:2911536425343488140",
    }

    session = get_db_session()
    existing = session.query(FetchCurl).filter_by(name=CONFIG_NAME).first()

    if existing:
        print(f"✔ Config '{CONFIG_NAME}' already exists.")
        session.close()
        return

    print(f"🛠 Creating config '{CONFIG_NAME}'...")

    record = FetchCurl(
        name=CONFIG_NAME,
        base_url="https://www.linkedin.com/voyager/api/graphql",
        query_id="voyagerIdentityDashProfileComponents.c5d4db426a0f8247b8ab7bc1d660775a",
        method="GET",
        headers=json.dumps(EXPERIENCE_HEADERS, indent=2),
        referer="https://www.linkedin.com/in/me/details/experience/"
    )

    session.add(record)
    session.commit()
    session.close()
    print(f"💾 Saved config '{CONFIG_NAME}'.")