
import json
import re
import requests
from dataclasses import asdict
from typing import Optional, Dict, Any

from models.fetch_models import FetchCurl
from database.database_connection import get_db_session
from source.features.fetch_curl.fetch_parser import parse_jobs_page
from source.features.job_population.search_spec import PipelineSearchSpec
from source.features.search_jobs.curl_voyager_jobs_fetch import (
    JobSearchTuning,
    VoyagerJobsLiteFetcher,
)
from source.features.fetch_curl.linkedin_http_client import (
    apply_identity_to_headers,
    get_linkedin_identity_config_name,
    load_linkedin_identity,
)
from source.features.get_applied_jobs.new_get_applied_jobs_service import (
    find_job_objects_recursive,
    parse_linkedin_stream,
)


class FetchService:
    @staticmethod
    def _headers_with_shared_identity(headers: Dict[str, str]) -> Dict[str, str]:
        identity_name = get_linkedin_identity_config_name()
        identity = load_linkedin_identity(identity_name)
        return apply_identity_to_headers(headers, identity)

    @staticmethod
    def _build_search_tuning(search_spec: Optional[PipelineSearchSpec]) -> Optional[JobSearchTuning]:
        if not search_spec or not search_spec.is_active():
            return None

        return JobSearchTuning(
            keywords=search_spec.build_linkedin_keywords(),
            geo_id=search_spec.geo_id,
            distance=search_spec.distance,
        )

    @staticmethod
    def validate_search_reference(with_meta: bool = False) -> Optional[Dict]:
        try:
            fetcher = VoyagerJobsLiteFetcher(page=1)
            payload = fetcher.fetch_raw()

            if with_meta:
                return {
                    "success": True,
                    "page": 1,
                    "curl": "JobCardsLite",
                    "status": 200,
                    "data": payload,
                }

            return payload
        except Exception as e:
            error_message = str(e)
            if with_meta:
                error_type = "network_error"
                if "401" in error_message or "403" in error_message:
                    error_type = "auth_error"
                elif "400" in error_message:
                    error_type = "http_error"

                return {
                    "success": False,
                    "page": 1,
                    "curl": "JobCardsLite",
                    "error_type": error_type,
                    "error": "Stored JobCardsLite reference replay failed",
                    "details": error_message,
                }
            return None

    @staticmethod
    def diagnose_linkedin_auth() -> Dict[str, Any]:
        identity_config = get_linkedin_identity_config_name()
        result: Dict[str, Any] = {
            "ok": False,
            "status": "unknown",
            "identityConfig": identity_config,
            "referenceConfig": "SavedJobs",
            "refreshConfig": identity_config,
            "networkFilter": "sdui.pagers.profile.details.experience",
            "checks": [],
            "message": "",
        }

        def add_check(name: str, ok: bool, details: str = ""):
            result["checks"].append({
                "name": name,
                "ok": ok,
                "details": details,
            })

        try:
            identity = load_linkedin_identity(identity_config)
            add_check(
                "identity_config",
                True,
                f"Loaded li_at and JSESSIONID from '{identity_config}'.",
            )
        except Exception as e:
            add_check("identity_config", False, str(e))
            result.update({
                "status": "identity_missing_or_invalid",
                "message": f"Refresh the '{identity_config}' cURL. It must include fresh li_at and JSESSIONID cookies.",
            })
            return result

        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "SavedJobs").first()
        finally:
            db.close()

        if not record:
            add_check("reference_config", False, "No FetchCurl row named 'SavedJobs'.")
            result.update({
                "status": "reference_missing",
                "message": "Configure the 'SavedJobs' cURL before running the applied jobs auth check.",
                "refreshConfig": "SavedJobs",
                "networkFilter": "/jobs-tracker/?stage=saved",
            })
            return result

        add_check("reference_config", True, "Loaded SavedJobs request skeleton.")

        target_url = (record.base_url or "").replace("stage=saved", "stage=applied")
        target_body = record.body or ""
        if target_body:
            target_body = target_body.replace('"stage":"saved"', '"stage":"applied"')

        try:
            headers = json.loads(record.headers) if record.headers else {}
        except Exception:
            headers = {}

        headers = apply_identity_to_headers(headers, identity)
        headers["x-li-initial-url"] = "/jobs-tracker/?stage=applied"
        headers.pop("Accept-Encoding", None)
        headers["Accept-Encoding"] = "identity"

        try:
            response = requests.request(
                method=record.method or "POST",
                url=target_url,
                headers=headers,
                data=target_body if target_body else None,
                timeout=20,
                allow_redirects=False,
            )
        except requests.Timeout as e:
            add_check("applied_probe", False, str(e))
            result.update({
                "status": "timeout",
                "message": "LinkedIn applied jobs probe timed out. Try again before refreshing cURLs.",
            })
            return result
        except requests.RequestException as e:
            add_check("applied_probe", False, str(e))
            result.update({
                "status": "network_error",
                "message": "LinkedIn applied jobs probe failed before receiving a response.",
            })
            return result

        result["httpStatus"] = response.status_code
        result["contentType"] = response.headers.get("Content-Type", "")

        location = response.headers.get("location", "")
        if response.status_code in (301, 302, 303, 307, 308):
            add_check("applied_probe", False, f"Redirected to {location or 'unknown location'}.")
            result.update({
                "status": "auth_redirect",
                "message": f"Refresh the '{identity_config}' cURL. LinkedIn redirected the applied jobs probe to an auth flow.",
            })
            return result

        if response.status_code in (401, 403):
            add_check("applied_probe", False, f"HTTP {response.status_code}.")
            result.update({
                "status": "auth_error",
                "message": f"Refresh the '{identity_config}' cURL. LinkedIn rejected the shared auth cookies.",
            })
            return result

        if response.status_code != 200:
            add_check("applied_probe", False, f"HTTP {response.status_code}.")
            result.update({
                "status": "http_error",
                "message": f"SavedJobs applied probe returned HTTP {response.status_code}. Inspect the SavedJobs request skeleton if the Experience cURL is fresh.",
                "refreshConfig": "SavedJobs",
                "networkFilter": "/jobs-tracker/?stage=saved",
            })
            return result

        stream_items = parse_linkedin_stream(response.text)
        json_candidates = []
        for item in stream_items:
            json_candidates.extend(find_job_objects_recursive(item))

        regex_patterns = [
            r"web_opp_contacts_(\d+)",
            r"opportunity_tracker_confirm_hear_back_is_visible_(\d+)",
            r"job_notes_show_api_(\d+)",
            r"opportunity_tracker_check_back_(\d+)",
            r"urn:li:fs_jobPosting:(\d+)",
        ]
        regex_ids = set()
        for pattern in regex_patterns:
            regex_ids.update(re.findall(pattern, response.text))

        result["jsonCandidateCount"] = len(json_candidates)
        result["regexIdCount"] = len(regex_ids)
        add_check(
            "applied_probe",
            True,
            f"HTTP 200, JSON candidates={len(json_candidates)}, regex IDs={len(regex_ids)}.",
        )

        if not json_candidates and not regex_ids:
            result.update({
                "status": "possible_stale_auth",
                "message": f"Refresh the '{identity_config}' cURL. The applied jobs probe returned HTTP 200 but no job identifiers.",
            })
            return result

        result.update({
            "ok": True,
            "status": "healthy",
            "message": "LinkedIn shared auth is working for the applied jobs probe.",
        })
        return result


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
            headers = FetchService._headers_with_shared_identity(headers)

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
    def execute_fetch_page_raw(
        page_number: int,
        with_meta: bool = False,
        search_spec: Optional[PipelineSearchSpec] = None,
    ) -> Optional[Dict]:
        """Returns RAW JSON for population service."""
        if search_spec and search_spec.is_active():
            return FetchService._execute_search_page_raw(
                page_number=page_number,
                with_meta=with_meta,
                search_spec=search_spec,
            )

        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "Pagination").first()
            if not record:
                if with_meta:
                    return {
                        "success": False,
                        "page": page_number,
                        "curl": "Pagination",
                        "error_type": "config_missing",
                        "error": "Pagination cURL not configured.",
                        "details": "No FetchCurl record named 'Pagination' was found.",
                    }
                raise ValueError("Pagination cURL not configured.")

            url, headers = record.construct_request(page_number=page_number)
            headers = FetchService._headers_with_shared_identity(headers)

            print(f"🚀 [Raw Fetch] Page {page_number}...")
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code != 200:
                body_excerpt = (response.text or "")[:250]
                error = f"LinkedIn pagination request returned HTTP {response.status_code}"
                error_type = "http_error"
                if response.status_code in (401, 403):
                    error = "Forbidden - likely expired cookie"
                    error_type = "auth_error"
                elif response.status_code == 429:
                    error = "Rate limited by LinkedIn"
                    error_type = "rate_limit"

                if with_meta:
                    return {
                        "success": False,
                        "page": page_number,
                        "curl": "Pagination",
                        "status": response.status_code,
                        "error_type": error_type,
                        "error": error,
                        "details": error if not body_excerpt else f"{error}. Response excerpt: {body_excerpt}",
                    }
                return None

            try:
                payload = response.json()
            except ValueError:
                if with_meta:
                    content_type = response.headers.get("Content-Type", "unknown")
                    body_excerpt = (response.text or "")[:250]
                    return {
                        "success": False,
                        "page": page_number,
                        "curl": "Pagination",
                        "status": response.status_code,
                        "error_type": "malformed_response",
                        "error": "LinkedIn pagination response was not valid JSON",
                        "details": f"Content-Type: {content_type}. Response excerpt: {body_excerpt}",
                    }
                return None

            if with_meta:
                return {
                    "success": True,
                    "page": page_number,
                    "curl": "Pagination",
                    "status": response.status_code,
                    "data": payload,
                }

            return payload
        except requests.Timeout as e:
            print(f"❌ [FetchService] Raw Fetch timeout: {e}")
            if with_meta:
                return {
                    "success": False,
                    "page": page_number,
                    "curl": "Pagination",
                    "error_type": "timeout",
                    "error": "LinkedIn pagination request timed out",
                    "details": str(e),
                }
            return None
        except requests.RequestException as e:
            print(f"❌ [FetchService] Raw Fetch request failed: {e}")
            if with_meta:
                response = getattr(e, "response", None)
                status = response.status_code if response is not None else None
                return {
                    "success": False,
                    "page": page_number,
                    "curl": "Pagination",
                    "status": status,
                    "error_type": "network_error",
                    "error": "LinkedIn pagination network request failed",
                    "details": str(e),
                }
            return None
        except Exception as e:
            print(f"❌ [FetchService] Raw Fetch failed: {e}")
            if with_meta:
                return {
                    "success": False,
                    "page": page_number,
                    "curl": "Pagination",
                    "error_type": "unexpected_error",
                    "error": "Unexpected pagination fetch failure",
                    "details": str(e),
                }
            return None
        finally:
            db.close()

    @staticmethod
    def _execute_search_page_raw(
        page_number: int,
        with_meta: bool = False,
        search_spec: Optional[PipelineSearchSpec] = None,
    ) -> Optional[Dict]:
        try:
            tuning = FetchService._build_search_tuning(search_spec)
            fetcher = VoyagerJobsLiteFetcher(
                page=page_number,
                count=(search_spec.count if search_spec else None),
                tuning=tuning,
            )
            payload = fetcher.fetch_raw()

            if with_meta:
                return {
                    "success": True,
                    "page": page_number,
                    "curl": "JobCardsLite",
                    "status": 200,
                    "data": payload,
                }

            return payload
        except Exception as e:
            print(f"❌ [FetchService] Search fetch failed: {e}")
            if with_meta:
                error_message = str(e)
                error_type = "network_error"
                if "401" in error_message or "403" in error_message:
                    error_type = "auth_error"
                elif "400" in error_message:
                    error_type = "http_error"

                return {
                    "success": False,
                    "page": page_number,
                    "curl": "JobCardsLite",
                    "error_type": error_type,
                    "error": "LinkedIn search request failed",
                    "details": error_message,
                }
            return None

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
            headers = FetchService._headers_with_shared_identity(headers)

            req = requests.Request('GET', url, headers=headers, params=params)
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
            headers = FetchService._headers_with_shared_identity(headers)

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
