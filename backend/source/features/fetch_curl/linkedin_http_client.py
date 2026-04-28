import json
import logging
import os
import sys
import requests
import re
from abc import ABC
from dataclasses import dataclass
from typing import Any, Optional, Tuple
from urllib.parse import quote

from source.core.debug_mode import is_debug

logger = logging.getLogger(__name__)

REDIRECT_STATUSES = {301, 302, 303, 307, 308}
AUTH_REDIRECT_MARKERS = ("/login", "/checkpoint", "/challenge", "/authwall")
AUTH_HEADER_NAMES = {"cookie", "csrf-token"}
DEFAULT_LINKEDIN_IDENTITY_CONFIG = "Experience"


@dataclass(frozen=True)
class LinkedInIdentity:
    li_at: str
    jsessionid: str
    csrf_token: str
    user_agent: str | None = None


def _parse_cookie_header(cookie_header: str | None) -> dict[str, str]:
    cookies = {}
    if not cookie_header:
        return cookies

    for part in cookie_header.split(";"):
        if "=" not in part:
            continue
        name, value = part.strip().split("=", 1)
        cookies[name.strip()] = value.strip().strip('"')

    return cookies


def _get_header_case_insensitive(headers: dict[str, str], name: str) -> str | None:
    lower_name = name.lower()
    for key, value in headers.items():
        if key.lower() == lower_name:
            return value
    return None


def extract_linkedin_identity(headers: dict[str, str]) -> LinkedInIdentity:
    cookie_header = _get_header_case_insensitive(headers, "Cookie")
    cookies = _parse_cookie_header(cookie_header)
    cookies_by_lower = {key.lower(): value for key, value in cookies.items()}

    li_at = cookies_by_lower.get("li_at")
    jsessionid = cookies_by_lower.get("jsessionid")
    if not li_at or not jsessionid:
        raise ValueError("LinkedIn identity requires li_at and JSESSIONID cookies")

    csrf_token = jsessionid.strip('"')
    return LinkedInIdentity(
        li_at=li_at,
        jsessionid=csrf_token,
        csrf_token=csrf_token,
        user_agent=_get_header_case_insensitive(headers, "User-Agent"),
    )


def strip_auth_headers(headers: dict[str, str]) -> dict[str, str]:
    return {
        key: value
        for key, value in headers.items()
        if key.lower() not in AUTH_HEADER_NAMES
    }


def build_cookie_header(identity: LinkedInIdentity) -> str:
    return f'li_at={identity.li_at}; JSESSIONID="{identity.jsessionid}"'


def get_linkedin_identity_config_name(identity_name: str | None = None) -> str:
    return (
            identity_name
            or os.getenv("LINKEDIN_IDENTITY_CONFIG")
            or DEFAULT_LINKEDIN_IDENTITY_CONFIG
    )


def apply_identity_to_headers(
        headers: dict[str, str],
        identity: LinkedInIdentity,
) -> dict[str, str]:
    headers = strip_auth_headers(headers)
    headers["Cookie"] = build_cookie_header(identity)
    headers["csrf-token"] = identity.csrf_token

    if identity.user_agent and not _get_header_case_insensitive(headers, "User-Agent"):
        headers["User-Agent"] = identity.user_agent

    return headers


def apply_identity_to_session(
        session: requests.Session,
        identity: LinkedInIdentity,
) -> None:
    session.cookies.set("li_at", identity.li_at)
    session.cookies.set("JSESSIONID", identity.jsessionid)
    session.headers.update(apply_identity_to_headers(session.headers.copy(), identity))


def load_linkedin_identity(source_config_name: str) -> LinkedInIdentity:
    from database.database_connection import get_db_session
    from models.fetch_models import FetchCurl

    db = get_db_session()
    try:
        record = db.query(FetchCurl).filter_by(name=source_config_name).first()
        if not record:
            raise ValueError(f"LinkedIn identity source '{source_config_name}' not found")

        try:
            headers = json.loads(record.headers) if record.headers else {}
        except Exception as e:
            raise ValueError(
                f"Failed to parse headers for identity source '{source_config_name}'"
            ) from e

        return extract_linkedin_identity(headers)
    finally:
        db.close()


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
        config_name: str | None = None,
) -> requests.Response:
    config_name = config_name or getattr(
        session,
        "_linkedin_config_name",
        "unknown"
    )

    response = session.request(
        method=method,
        url=url,
        headers=headers,
        json=json_body,
        data=data,
        timeout=timeout,
        allow_redirects=False,
    )

    if response.status_code == 200:
        return response

    # ==============================
    # DEBUG ONLY ON ERROR
    # ==============================

    location = response.headers.get("location")

    print("\n--- LINKEDIN REQUEST FAILED ---")

    print("config:", config_name)
    print("status:", response.status_code)

    print("\nurl:")
    print(url)

    print("\nlocation:")
    print(location)

    print("\nheaders sent:")
    for k, v in headers.items():
        print(f"{k}: {v}")

    print("\nsession cookies:")
    print(session.cookies.get_dict())

    print("\ncsrf-token:")
    print(headers.get("csrf-token"))

    print("\nresponse headers:")
    for k, v in response.headers.items():
        print(f"{k}: {v}")

    print("\nresponse preview:")
    print(response.text[:800])

    print("--- END DEBUG ---\n")

    # ==============================

    if response.status_code in REDIRECT_STATUSES:

        if location and any(m in location.lower() for m in AUTH_REDIRECT_MARKERS):
            raise _build_auth_expired_error(
                response.status_code,
                location
            )

        raise RuntimeError(
            f"linkedin redirect {response.status_code} -> {location}"
        )

    raise RuntimeError(
        f"linkedin request failed status={response.status_code}"
    )


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
            config_name=getattr(session, "_linkedin_config_name", None),
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
    def __init__(
            self,
            config_name: str,
            slim_mode: bool = False,
            identity_name: str | None = None,
    ):
        """
        :param config_name: Nome da configuração no banco de dados (FetchCurl).
        :param slim_mode: Se True, remove headers e cookies não essenciais para evitar detecção.
        :param identity_name: Optional FetchCurl row to use only as the auth identity source.
        """
        self.config_name = config_name
        self.slim_mode = slim_mode
        self.identity_name = identity_name
        self.session = requests.Session()
        self.session._linkedin_config_name = config_name
        self.config = self._load_config()
        self.csrf_token = None

        if self.config:
            headers = self.config.get("headers", {})

            if self.identity_name:
                headers = strip_auth_headers(headers)

            # --- LÓGICA SLIM ---
            if self.slim_mode:
                headers = self._apply_slim_filtering(headers)
                if self.debug_mode_active():
                    print(f"🧹 [LinkedInClient] SLIM MODE ATIVADO. Headers limpos: {list(headers.keys())}")

            # update session headers first
            self.session.headers.update(headers)

            if self.identity_name:
                identity = load_linkedin_identity(self.identity_name)
                apply_identity_to_session(self.session, identity)
                self.csrf_token = identity.csrf_token
                return

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
