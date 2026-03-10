import json
import os
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
            data=self.body_str.encode('utf-8') if self.body_str else None,
            timeout=timeout
        )


class VoyagerJobsLiteFetcher:
    def __init__(self, debug: bool = False):
        self.debug = debug
        self.client = LinkedInClient("JobCardsLite")

        if not self.client.config:
            raise ValueError("Configuração 'JobCardsLite' não encontrada no banco.")

        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "JobCardsLite").first()
            if not record:
                raise ValueError("Record 'JobCardsLite' not found in database.")

            self.url = record.base_url
            self.method = record.method or "GET"
            self.base_body_str = record.body or ""
        finally:
            db.close()

    def fetch_raw(self) -> dict:
        req = RawStringRequest(method=self.method, url=self.url, body_str=self.base_body_str, debug=self.debug)

        try:
            response = self.client.execute(req)

            if response.status_code != 200:
                raise RuntimeError(f"HTTP {response.status_code} — cookies probably expired or invalid request.")

            # Handle potential RSC or Voyager JSON
            content_type = response.headers.get("Content-Type", "")
            raw_body = response.content.decode("utf-8", errors="replace")

            if "application/octet-stream" in content_type:
                # It's an RSC stream, we might need to handle it differently if needed,
                # but for now we try to return the raw body or a simple parsed version
                return {"rsc_dump": raw_body}
            else:
                clean_text = raw_body.lstrip()
                if clean_text.startswith(")]}'"):
                    clean_text = clean_text.split("\n", 1)[-1]
                return json.loads(clean_text)

        except Exception as exc:
            raise RuntimeError(f"Failed to fetch JobCardsLite data: {exc}") from exc


if __name__ == "__main__":
    print("Fetching GraphQL JOB_DETAILS prefetch using DB config...")

    try:
        fetcher = VoyagerJobsLiteFetcher(debug=False)
        data = fetcher.fetch_raw()

        # Save to the same folder as the script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_path = os.path.join(script_dir, "linkedin_graphql_response.json")

        with open(output_path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)

        print(f"✅ Successfully saved response to: {output_path}")

    except Exception as e:
        print(f"❌ [ERROR] {e}")
        raise SystemExit(1)
