
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
    def update_config_from_parsed(name: str, parsed) -> bool:
        """
        Updates a FetchCurl record using a parsed cURL structure.
        """
        if isinstance(parsed, tuple):
            method, url, headers, cookies = parsed
            parsed = {
                "base_url": url,
                "method": method.upper() if method else None,
                "headers": headers or {},
                "cookies": cookies or {},
                "query_id": "",
                "variables_count": 0,
                "body": "",
                "referer": "",
            }

        cookies_dict = parsed.get("cookies", {})
        headers_dict = parsed.get("headers", {})

        if cookies_dict and "Cookie" not in headers_dict and "cookie" not in headers_dict:
            cookie_str = "; ".join([f"{k}={v}" for k, v in cookies_dict.items()])
            headers_dict["Cookie"] = cookie_str
            parsed["headers"] = headers_dict

        headers_json = json.dumps(headers_dict)
        cookies_json = json.dumps(cookies_dict)

        body_content = parsed.get("body", "")
        if isinstance(body_content, (dict, list)):
            body_content = json.dumps(body_content)

        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == name).first()

            if not record:
                record = FetchCurl(name=name)
                db.add(record)

            record.base_url = parsed.get("base_url")
            record.query_id = parsed.get("query_id")
            record.method = parsed.get("method")
            record.headers = headers_json
            record.cookies = cookies_json
            record.referer = parsed.get("referer")
            record.body = body_content  

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
        base_url = "https://www.linkedin.com/voyager/api/graphql"

        if 'variables' in params and 'queryId' in params:
            query_string = f"?variables={params['variables']}&queryId={params['queryId']}"
            full_url = base_url + query_string
            return FetchService._internal_request(full_url, params=None)

        return FetchService._internal_request(base_url, params=params)

    @staticmethod
    def _internal_request(
            url: str,
            params: Optional[Dict[str, str]] = None,
            debug: bool = False
    ) -> Optional[Any]:
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

            cookies = {}
            if record.cookies:
                try:
                    cookies = json.loads(record.cookies)
                except:
                    pass

            req = requests.Request('GET', url, headers=headers, cookies=cookies, params=params)
            prepared = req.prepare()

            session = requests.Session()
            response = session.send(prepared, timeout=15)

            content_type = response.headers.get("Content-Type", "")

            if debug:
                print("\n" + "=" * 60)
                print("📡 INTERNAL REQUEST DEBUG")
                print("URL:", prepared.url)
                print("Status:", response.status_code)
                print("Content-Type:", content_type)
                print("=" * 60)

            if response.status_code != 200:
                if debug:
                    print("❌ RESPONSE:", response.text[:500])
                return None

            if "application/json" in content_type:
                return response.json()

            if "application/octet-stream" in content_type:
                decoded = response.content.decode("utf-8")
                if debug:
                    print("📦 RSC RAW (first 1000 chars):")
                    print(decoded[:1000])
                return decoded

            return response.text

        except Exception as e:
            print(f"❌ [FetchService] Request failed: {e}")
            return None
        finally:
            db.close()

    @staticmethod
    def delete_curl_config(name: str) -> bool:
        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == name).first()
            if not record:
                return False

            db.delete(record)
            db.commit()
            return True
        except Exception as e:
            print(f"❌ Error deleting config '{name}': {e}")
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def execute_dynamic_profile_fetch(config_name: str, target_vanity_name: str) -> Optional[Any]:
        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == config_name).first()
            if not record:
                print(f"❌ [FetchService] Configuração '{config_name}' não encontrada.")
                return None

            TEMPLATE_VANITY = "monicasbusatta"

            headers = {}
            if record.headers:
                try:
                    headers = json.loads(record.headers)
                    for k, v in headers.items():
                        if isinstance(v, str):
                            headers[k] = v.replace(TEMPLATE_VANITY, target_vanity_name)
                except Exception:
                    pass

            cookies = {}
            if record.cookies:
                try:
                    cookies = json.loads(record.cookies)
                except Exception:
                    pass

            url = record.base_url.replace(TEMPLATE_VANITY, target_vanity_name)

            body_bytes = None
            if record.body:
                body_str = record.body.replace(TEMPLATE_VANITY, target_vanity_name)
                body_bytes = body_str.encode('utf-8')

            method = record.method or "GET"

            req = requests.Request(
                method=method,
                url=url,
                headers=headers,
                cookies=cookies,  
                data=body_bytes
            )
            prepared = req.prepare()
            session = requests.Session()
            response = session.send(prepared, timeout=15)

            content_type = response.headers.get("Content-Type", "")

            if response.status_code != 200:
                print(f"❌ Status {response.status_code}: {response.text[:200]}")
                return None

            if "application/json" in content_type:
                return response.json()

            if "application/octet-stream" in content_type:
                return response.content.decode("utf-8")

            return response.text

        except Exception as e:
            print(f"❌ [FetchService] Erro no dynamic fetch: {e}")
            return None
        finally:
            db.close()
