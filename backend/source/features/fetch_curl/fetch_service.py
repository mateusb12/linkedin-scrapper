import math
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

            # The ORM handles the complex parsing logic now!
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
    def execute_fetch_page(page_number: int) -> Optional[Dict]:
        """
        1. Loads config from DB
        2. Constructs Request
        3. Pings LinkedIn
        4. Parses Result
        """
        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "Pagination").first()
            if not record:
                raise ValueError("Pagination cURL not configured.")

            # ORM constructs the valid URL/Headers
            url, headers = record.construct_request(page_number=page_number)

            print(f"🚀 Fetching Page {page_number}...")
            response = requests.get(url, headers=headers)
            response.raise_for_status()

            # Pure Logic Parser
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
        """Fetches page 1 to calculate total available pages."""
        data = FetchService.execute_fetch_page(1)
        if not data:
            return 0

        total_jobs = data.get('paging', {}).get('total', 0)
        count = data.get('paging', {}).get('count', 25)

        return math.ceil(total_jobs / count)

    @staticmethod
    def execute_fetch_page_raw(page_number: int) -> Optional[Dict]:
        """
        Executes the request and returns the RAW JSON response.
        Used by the job_population feature to handle its own parsing.
        """
        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "Pagination").first()
            if not record:
                # If this raises, the user sees "Pagination cURL not configured" in logs
                raise ValueError("Pagination cURL not configured in database.")

            # ORM constructs the valid URL/Headers based on the stored config
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