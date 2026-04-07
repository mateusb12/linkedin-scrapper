import json
import logging
import os
import sys
import requests
import re
from abc import ABC
from typing import Any, Optional, Tuple
from urllib.parse import quote

from source.core.debug_mode import is_debug

logger = logging.getLogger(__name__)

REDIRECT_STATUSES = {301, 302, 303, 307, 308}
AUTH_REDIRECT_MARKERS = ("/login", "/checkpoint", "/challenge", "/authwall")


def _build_auth_expired_error(status_code: int, location: str) -> RuntimeError:
    from source.features.enrich_jobs.linkedin_http_job_enricher import AuthExpiredError

    return AuthExpiredError(
        operation="linkedin_http_request",
        status_code=status_code,
        message=(
            "LinkedIn session expired or invalid "
            f"(redirected to {location or 'an auth wall'}). "
            "Please refresh li_at and JSESSIONID cookies."
        ),
    )


def perform_linkedin_request(
        session: requests.Session,
        *,
        method: str,
        url: str,
        headers: dict[str, str],
        timeout: int = 15,
        json_body: Any = None,
        data: bytes | None = None,
) -> requests.Response:
    response = session.request(
        method=method,
        url=url,
        headers=headers,
        json=json_body,
        data=data,
        timeout=timeout,
        allow_redirects=False,
    )

    if response.status_code in REDIRECT_STATUSES:
        location = response.headers.get("location", "")
        logger.warning("LinkedIn redirect detected -> %s", location or "<missing>")

        normalized_location = location.lower()
        if any(marker in normalized_location for marker in AUTH_REDIRECT_MARKERS):
            raise _build_auth_expired_error(response.status_code, location)

        raise RuntimeError(f"Unexpected redirect from LinkedIn API: {location or '<missing>'}")

    return response

# --- Add project root to path ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
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
        self.debug = debug if debug is not None else is_debug()

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

        response = perform_linkedin_request(
            session,
            method=self.method,
            url=self.url,
            headers=merged_headers,
            json_body=self._body,
            timeout=timeout,
        )

        if self.debug:
            print("STATUS:", response.status_code)
            print("RESPONSE (first 800 chars):")
            print(response.text[:800])
            print("=" * 80)

        return response


class VoyagerGraphQLRequest(LinkedInRequest):
    def __init__(self, base_url: str, query_id: str, variables: str, debug: bool = False):
        separator = "&" if "?" in base_url else "?"
        # variables often contains JSON-like text, so URL-encode it
        final_url = f"{base_url}{separator}variables={quote(variables, safe='')}&queryId={quote(query_id, safe='')}"
        super().__init__("GET", final_url, debug=debug)


class SduiPaginationRequest(LinkedInRequest):
    def __init__(self, base_url: str, body: dict, debug: bool = False):
        super().__init__("POST", base_url, debug=debug)
        self.set_body(body)


# ============================================================
# LINKEDIN CLIENT
# ============================================================

class LinkedInClient:
    def __init__(self, config_name: str, slim_mode: bool = False):
        """
        :param config_name: Nome da configuração no banco de dados (FetchCurl).
        :param slim_mode: Se True, remove headers e cookies não essenciais para evitar detecção.
        """
        self.config_name = config_name
        self.slim_mode = slim_mode
        self.session = requests.Session()
        self.config = self._load_config()
        self.csrf_token = None

        if self.config:
            headers = self.config.get("headers", {})

            # --- LÓGICA SLIM ---
            if self.slim_mode:
                headers = self._apply_slim_filtering(headers)
                if self.debug_mode_active():
                    print(f"🧹 [LinkedInClient] SLIM MODE ATIVADO. Headers limpos: {list(headers.keys())}")

            # update session headers first
            self.session.headers.update(headers)

            # then hydrate cookies from Cookie header (if present)
            self._hydrate_cookies_from_header()

            # derive csrf token from JSESSIONID and force it (prevents mismatches)
            self.csrf_token = self._extract_csrf()
            if self.csrf_token:
                self.session.headers["csrf-token"] = self.csrf_token

    def debug_mode_active(self):
        return is_debug()

    # ============================================================
    # 🧹 SLIM MODE FILTER
    # ============================================================

    def _apply_slim_filtering(self, headers: dict) -> dict:
        """
        Implementa uma Allowlist estrita. Remove tudo que não for essencial.
        """
        ALLOWED_HEADERS = {
            "content-type",
            "csrf-token",
            "cookie",
            "referer",
            "user-agent",
            "x-li-rsc-stream",
        }

        ALLOWED_COOKIES = {"li_at", "jsessionid"}
        allowed_cookies_lower = {c.lower() for c in ALLOWED_COOKIES}

        clean_headers = {}

        for key, value in headers.items():
            if key.lower() not in ALLOWED_HEADERS:
                continue

            if key.lower() == "cookie":
                cookies_list = value.split(";")
                kept_cookies = []

                for cookie in cookies_list:
                    if "=" not in cookie:
                        continue
                    cookie_name = cookie.split("=")[0].strip()
                    if cookie_name.lower() in allowed_cookies_lower:
                        kept_cookies.append(cookie.strip())

                if kept_cookies:
                    clean_headers[key] = "; ".join(kept_cookies)
            else:
                clean_headers[key] = value

        return clean_headers

    # ============================================================
    # HELPERS
    # ============================================================

    def _hydrate_cookies_from_header(self):
        """
        Se existir header 'Cookie', popula também session.cookies.
        Normaliza valores (ex: remove aspas do JSESSIONID) pra evitar mismatch.
        """
        cookie_header = self.session.headers.get("Cookie")
        if not cookie_header:
            return

        for part in cookie_header.split(";"):
            if "=" not in part:
                continue
            name, value = part.strip().split("=", 1)
            name = name.strip()
            value = value.strip().strip('"')  # normalize: remove quotes if present
            self.session.cookies.set(name, value)

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

        if "Cookie" not in headers_dict:
            print(f"⚠️ Warning: No 'Cookie' header found in config '{self.config_name}'")

        config = {
            "base_url": record.base_url,
            "query_id": record.query_id,
            "headers": headers_dict,
            "referer": record.referer,
        }

        db.close()
        return config

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
    # EXECUTION
    # ============================================================

    def execute(self, request: LinkedInRequest, timeout=15) -> requests.Response:
        return request.execute(self.session, timeout=timeout)

    def execute_parsed(self, request: LinkedInRequest, timeout=15) -> ParsedResponse:
        raw = request.execute(self.session, timeout=timeout)
        content_type = raw.headers.get("Content-Type", "")

        if "application/octet-stream" in content_type:
            return ParsedResponse("rsc", raw.content.decode("utf-8", errors="replace"))

        try:
            return ParsedResponse("voyager", raw.json())
        except Exception:
            return ParsedResponse("voyager", {})


# ============================================================
# LEGACY HELPERS
# ============================================================

def get_linkedin_fetch_artefacts() -> Optional[Tuple[requests.Session, dict]]:
    """
    Mantido para retrocompatibilidade.
    Se quiser ativar o modo slim globalmente aqui, mude para slim_mode=True.
    """
    client = LinkedInClient("LinkedIn_Saved_Jobs_Scraper", slim_mode=False)
    if not client.config:
        return None
    return client.session, client.config
