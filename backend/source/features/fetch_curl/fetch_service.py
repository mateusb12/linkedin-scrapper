import json
import requests
from dataclasses import asdict
from typing import Optional, Dict, Any

from models.fetch_models import FetchCurl
from database.database_connection import get_db_session
from source.features.fetch_curl.fetch_parser import parse_jobs_page


class FetchService:

    @staticmethod
    def get_curl_config(name: str) -> Optional[Dict]:
        """Retrieves a config by name."""
        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == name).first()
            if record:
                return record.to_dict()
            return None
        finally:
            db.close()

    @staticmethod
    def upsert_curl_config(name: str, raw_body: str) -> bool:
        """Parses raw input and saves it to DB."""
        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == name).first()
            if not record:
                record = FetchCurl(name=name)
                db.add(record)

            record.update_from_raw(raw_body)
            db.commit()
            return True
        except Exception as e:
            print(f"Error saving cURL: {e}")
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def update_config_from_parsed(name: str, parsed: dict) -> bool:
        """
        Updates a FetchCurl record using a parsed cURL structure.
        This is used for Pagination, SingleJob, Experience, etc.
        """
        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == name).first()
            if not record:
                raise ValueError(f"Config '{name}' not found.")

            # Parsed fields coming from your parse_curl() implementation
            record.base_url = parsed.get("base_url")
            record.query_id = parsed.get("query_id")
            record.method = parsed.get("method")
            record.headers = parsed.get("headers_json")
            record.cookies = parsed.get("cookies")
            record.referer = parsed.get("referer")

            db.commit()
            return True

        except Exception as e:
            print(f"❌ Error updating FetchCurl record: {e}")
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def execute_fetch_page(page_number: int) -> Optional[Dict]:
        """Loads config from DB and fetches a page."""
        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "Pagination").first()
            if not record:
                raise ValueError("Pagination cURL not configured.")

            url, headers = record.construct_request(page_number=page_number)

            print(f"🚀 Fetching Page {page_number}...")
            response = requests.get(url, headers=headers)
            response.raise_for_status()

            parsed_data = parse_jobs_page(response.json())
            if parsed_data:
                return asdict(parsed_data)
            return None

        except Exception as e:
            print(f"Fetch failed: {e}")
            return None
        finally:
            db.close()

    @staticmethod
    def get_total_pages() -> int:
        import math
        data = FetchService.execute_fetch_page(1)
        if not data:
            return 0
        total_jobs = data.get('paging', {}).get('total', 0)
        count = data.get('paging', {}).get('count', 25)
        return math.ceil(total_jobs / count)

    @staticmethod
    def execute_fetch_page_raw(page_number: int) -> Optional[Dict]:
        """Returns RAW JSON for population service."""
        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "Pagination").first()
            if not record:
                raise ValueError("Pagination cURL not configured.")

            url, headers = record.construct_request(page_number=page_number)

            print(f"🚀 [Raw Fetch] Page {page_number}...")
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"❌ [FetchService] Raw Fetch failed: {e}")
            return None
        finally:
            db.close()

    @staticmethod
    def execute_fetch_graphql(params: Dict[str, str]) -> Optional[Dict]:
        """
        Executes a GET request to the Voyager GraphQL endpoint.
        CRITICAL FIX: We manually construct the URL query string here.
        Passing 'variables' via standard requests params causes URL-encoding of
        parentheses (e.g. %28 instead of '('), which LinkedIn rejects with 400.
        """
        base_url = "https://www.linkedin.com/voyager/api/graphql"

        if 'variables' in params and 'queryId' in params:
            # Manually build string to preserve parenthesis structure
            # Note: The inner content of 'variables' should already be properly encoded by the caller
            query_string = f"?variables={params['variables']}&queryId={params['queryId']}"
            full_url = base_url + query_string
            return FetchService._internal_request(full_url, params=None)

        return FetchService._internal_request(base_url, params=params)

    @staticmethod
    def _internal_request(url: str, params: Optional[Dict[str, str]] = None) -> Optional[Dict]:
        """
        Executes a generic authenticated request reusing credentials from the 'Pagination' config.
        """
        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "Pagination").first()
            if not record:
                print("❌ [FetchService] No 'Pagination' record found.")
                return None

            headers = {}
            if record.headers:
                try:
                    headers = json.loads(record.headers)
                except:
                    pass

            # Use 'params' only if provided, otherwise assume URL is fully constructed
            req = requests.Request('GET', url, headers=headers, params=params)
            prepared = req.prepare()

            # --- DEBUG PRINT (Temporary) ---
            print(f"🐍 DEBUG URL: {prepared.url}")
            # -------------------------------

            response = requests.Session().send(prepared, timeout=10)

            if response.status_code != 200:
                print(f"❌ Status: {response.status_code}")
                # LinkedIn errors are often verbose html/json, print short snippet
                print(f"❌ Response: {response.text[:200]}")
                return None

            return response.json()

        except Exception as e:
            print(f"❌ [FetchService] Request failed: {e}")
            return None
        finally:
            db.close()