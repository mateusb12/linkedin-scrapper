import json
import os
import re
import sys

# --- Add project root to path ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from database.database_connection import get_db_session
from models.fetch_models import FetchCurl
from source.features.fetch_curl.linkedin_http_client import LinkedInClient, LinkedInRequest


class RawStringRequest(LinkedInRequest):
    def __init__(self, method: str, url: str, body_str: str, debug: bool = False):
        super().__init__(method, url, debug=debug)
        self.body_str = body_str

    def execute(self, session, timeout=15):
        merged_headers = session.headers.copy()
        merged_headers.update(self._headers)
        return session.request(
            method=self.method,
            url=self.url,
            headers=merged_headers,
            data=self.body_str.encode("utf-8") if self.body_str else None,
            timeout=timeout
        )


class VoyagerJobsLiteFetcher:
    def __init__(self, page: int = 1, count: int | None = None, debug: bool = False):
        if page < 1:
            raise ValueError("page must be >= 1")

        self.debug = debug
        self.page = page
        self.client = LinkedInClient("JobCardsLite")

        if not self.client.config:
            raise ValueError("Configuração 'JobCardsLite' não encontrada no banco.")

        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "JobCardsLite").first()
            if not record:
                raise ValueError("Record 'JobCardsLite' not found in database.")

            self.original_url = record.base_url
            self.method = record.method or "GET"
            self.base_body_str = record.body or ""

            detected_count = self._extract_query_param_int(self.original_url, "count", default=7)
            self.count = count if count is not None else detected_count
            self.start = (self.page - 1) * self.count
            self.url = self._replace_or_append_query_param(self.original_url, "start", str(self.start))
            self.url = self._replace_or_append_query_param(self.url, "count", str(self.count))
        finally:
            db.close()

    @staticmethod
    def _extract_query_param_int(url: str, param_name: str, default: int) -> int:
        match = re.search(rf"([?&]){re.escape(param_name)}=(\d+)", url)
        if match:
            return int(match.group(2))
        return default

    @staticmethod
    def _replace_or_append_query_param(url: str, param_name: str, param_value: str) -> str:
        pattern = rf"([?&]){re.escape(param_name)}=[^&]*"
        if re.search(pattern, url):
            return re.sub(pattern, rf"\1{param_name}={param_value}", url, count=1)

        separator = "&" if "?" in url else "?"
        return f"{url}{separator}{param_name}={param_value}"

    def fetch_raw(self) -> dict:
        req = RawStringRequest(
            method=self.method,
            url=self.url,
            body_str=self.base_body_str,
            debug=self.debug
        )

        try:
            response = self.client.execute(req)

            if response.status_code != 200:
                raise RuntimeError(
                    f"HTTP {response.status_code} — cookies probably expired or invalid request."
                )

            content_type = response.headers.get("Content-Type", "")
            raw_body = response.content.decode("utf-8", errors="replace")

            if "application/octet-stream" in content_type:
                return {"rsc_dump": raw_body}

            clean_text = raw_body.lstrip()
            if clean_text.startswith(")]}'"):
                clean_text = clean_text.split("\n", 1)[-1]

            return json.loads(clean_text)

        except Exception as exc:
            raise RuntimeError(f"Failed to fetch JobCardsLite data: {exc}") from exc


def fetch_and_save(page: int = 1, count: int | None = None, debug: bool = False) -> dict:
    fetcher = VoyagerJobsLiteFetcher(page=page, count=count, debug=debug)
    data = fetcher.fetch_raw()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, f"linkedin_graphql_response_page_{page}.json")

    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)

    print(f"✅ Successfully saved response to: {output_path}")
    print(f"Resolved count={fetcher.count}, start={fetcher.start}")
    print(f"Final URL: {fetcher.url}")

    return data


if __name__ == "__main__":
    # =========================
    # CONFIG
    # =========================
    PAGE = 1  # page 1, 2, 3...
    COUNT = None  # None = use count from DB URL, or set e.g. 7
    DEBUG = False

    print("Fetching GraphQL JOB_DETAILS prefetch using DB config...")
    print(f"Page: {PAGE}")

    try:
        fetch_and_save(page=PAGE, count=COUNT, debug=DEBUG)
    except Exception as e:
        print(f"❌ [ERROR] {e}")
        raise SystemExit(1)
