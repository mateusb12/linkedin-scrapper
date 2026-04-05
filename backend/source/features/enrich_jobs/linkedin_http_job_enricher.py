"""
linkedin_job_enricher.py — SINGLE JOB ENRICHMENT

Low-level single-job fetcher/parser.
This file should NOT own batch pacing, retry, or backoff logic.

Responsibilities:
    - fetch Voyager job details
    - fetch Premium insights
    - fetch Notifications
    - optionally resolve company details fallback
    - return one enriched JobPost

Cross-request concerns like retry / exponential backoff / jitter should live in
BatchEnrichmentService.
"""

import json
import re
import sys
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
from dataclasses import asdict

import requests

from source.features.fetch_curl.linkedin_http_client import LinkedInClient
from source.features.get_applied_jobs.utils_proxy import (
    JobPost,
    NotificationEvent,
    PremiumParser,
    ms_to_datetime,
    ms_to_iso,
    parse_notification_for_job,
    PREMIUM_ENABLED,
    log as _log,
)

RETRYABLE_HTTP_STATUSES = {429, 500, 502, 503, 504, 999}


class EnrichmentError(RuntimeError):
    def __init__(
            self,
            operation: str,
            status_code: Optional[int] = None,
            message: str = "",
    ):
        self.operation = operation
        self.status_code = status_code
        self.message = message
        super().__init__(self.__str__())

    def __str__(self) -> str:
        base = self.operation
        if self.status_code is not None:
            base += f" [HTTP {self.status_code}]"
        if self.message:
            base += f" {self.message}"
        return base


class RetryableEnrichmentError(EnrichmentError):
    pass


class NonRetryableEnrichmentError(EnrichmentError):
    pass


class AuthExpiredError(NonRetryableEnrichmentError):
    """Raised when LinkedIn rejects the request due to an expired/invalid session."""
    pass


class LinkedInJobEnricher:
    """
    Takes a job_urn as input and returns an enriched JobPost.

    Important:
    - This class is intentionally "low-level"
    - It does NOT do retry/backoff/jitter
    - BatchEnrichmentService should wrap this class for production batch flows
    """

    def __init__(self, debug: bool = False, slim_mode: bool = True):
        self.debug = debug
        self.client = LinkedInClient("SavedJobs", slim_mode=slim_mode)
        self.premium_parser = PremiumParser()
        self.premium_config_name = "PremiumInsights"
        self.premium_config_id: Optional[int] = None

        from database.database_connection import get_db_session
        from models.fetch_models import FetchCurl

        db = get_db_session()
        try:
            # SavedJobs is needed for standard Voyager requests
            record_saved = db.query(FetchCurl).filter(FetchCurl.name == "SavedJobs").first()
            if not record_saved:
                raise ValueError("SavedJobs config missing from FetchCurl table")

            self.premium_url = ""
            self.premium_headers = {}
            self.premium_method = "POST"
            self.premium_body = ""
            rec_prem = db.query(FetchCurl).filter(FetchCurl.name == "PremiumInsights").first()
            if rec_prem:
                self.premium_config_id = rec_prem.id
                self.premium_url = rec_prem.base_url
                self.premium_method = rec_prem.method
                self.premium_body = rec_prem.body
                self.premium_headers = json.loads(rec_prem.headers) if rec_prem.headers else {}

            self.notifications_url = ""
            self.notifications_headers = {}
            self.notifications_method = "GET"
            rec_notif = db.query(FetchCurl).filter(FetchCurl.name == "Notifications").first()
            if rec_notif:
                self.notifications_url = rec_notif.base_url
                self.notifications_method = rec_notif.method or "GET"
                self.notifications_headers = json.loads(rec_notif.headers) if rec_notif.headers else {}
                _log("✓ Loaded Notifications config from DB in Enricher")
            else:
                _log("⚠️ Notifications config not found in FetchCurl table")
        finally:
            db.close()

    def _get_csrf_token(self) -> Optional[str]:
        session = self.client.session
        csrf = session.headers.get("csrf-token")
        if csrf:
            return csrf

        for c in session.cookies:
            if c.name == "JSESSIONID":
                return c.value.replace('"', "")

        return None

    def _raise_http_error(self, operation: str, status_code: int, body: str = "") -> None:
        snippet = re.sub(r"\s+", " ", (body or "").strip())[:300]
        exc_cls = (
            RetryableEnrichmentError
            if status_code in RETRYABLE_HTTP_STATUSES
            else NonRetryableEnrichmentError
        )
        raise exc_cls(
            operation=operation,
            status_code=status_code,
            message=snippet,
        )

    def _preview_text(self, text: str, max_chars: int = 160) -> str:
        return re.sub(r"\s+", " ", (text or "").strip())[:max_chars]

    def _log_premium_payload_degraded(
            self,
            *,
            job_id: str,
            response_text: str,
            response_status: int,
            parsed: Dict[str, Any],
            marker: str,
            reason: str,
    ) -> None:
        _log(
            f"{marker} job_id={job_id} "
            f"fetch_config={self.premium_config_name}:{self.premium_config_id} "
            f"status={response_status} "
            f"premium_component_found={parsed.get('premium_component_found')} "
            f"has_undefined={'$undefined' in response_text} "
            f"applicants_total_extracted={parsed.get('applicants_total') is not None} "
            f"reason={reason} "
            f"preview={repr(self._preview_text(response_text))} "
            f"hint='premium payload degraded; stale li_at or stale auth cookie bundle is suspected'"
        )

    def fetch_job_details(self, job_id: str, raise_on_failure: bool = False) -> Dict[str, Any]:
        """Fetch Voyager job details. Returns a plain dict, datetimes as ISO strings."""
        session = self.client.session
        csrf = self._get_csrf_token()

        url = f"https://www.linkedin.com/voyager/api/jobs/jobPostings/{job_id}"

        try:
            resp = session.get(
                url,
                headers={"csrf-token": csrf, "accept": "application/json"},
                timeout=20,
                allow_redirects=False,
            )
        except requests.RequestException as e:
            if raise_on_failure:
                raise RetryableEnrichmentError(
                    operation=f"fetch_job_details({job_id})",
                    message=str(e),
                )
            _log(f"❌ fetch_job_details({job_id}) request error: {e}")
            return {"_error": str(e)}

        if resp.status_code in (301, 302):
            _log(f"🔒 fetch_job_details({job_id}): auth expired (HTTP {resp.status_code})")
            raise AuthExpiredError(
                operation=f"fetch_job_details({job_id})",
                status_code=resp.status_code,
                message="Session expired — LinkedIn redirected to login",
            )

        if resp.status_code != 200:
            _log(f"⚠️ fetch_job_details({job_id}): HTTP {resp.status_code}")
            if raise_on_failure:
                self._raise_http_error(
                    operation=f"fetch_job_details({job_id})",
                    status_code=resp.status_code,
                    body=resp.text,
                )
            return {"_raw": None, "_status": resp.status_code}

        try:
            d = resp.json()

            applied_at_raw = d.get("applyingInfo", {}).get("appliedAt")
            if applied_at_raw and self.debug:
                dt_utc = ms_to_datetime(applied_at_raw)
                dt_brt = dt_utc.astimezone(timezone(timedelta(hours=-3)))
                _log(f"⏱️ Job {job_id} :: Applied At: {dt_utc} UTC / {dt_brt} BRT")

            company_urn = None
            company_name = None

            company_details = d.get("companyDetails", {})

            voyager_wrapper = company_details.get(
                "com.linkedin.voyager.jobs.JobPostingCompany", {}
            )
            if voyager_wrapper:
                company_urn = voyager_wrapper.get("company")
                company_name = voyager_wrapper.get("companyName")

            if not company_name:
                nested_company = company_details.get("company")
                if isinstance(nested_company, dict):
                    company_name = nested_company.get("name")
                    if not company_urn:
                        company_urn = nested_company.get("entityUrn")

            company_desc = d.get("companyDescription", {})
            if not company_name and isinstance(company_desc, dict):
                company_name = company_desc.get("companyName")

            if not company_name:
                company_name = d.get("companyName") or d.get("formattedCompanyName")

            company_logo = None
            company_url = None
            if isinstance(company_desc, dict):
                company_url = company_desc.get("companyPageUrl")
                logo_obj = company_desc.get("logo") or company_desc.get("companyLogo")
                if isinstance(logo_obj, dict):
                    image = logo_obj.get("image") or logo_obj
                    root_url = image.get("rootUrl", "")
                    artifacts = image.get("artifacts", [])
                    if root_url and artifacts:
                        best = max(artifacts, key=lambda a: a.get("width", 0))
                        company_logo = root_url + best.get("fileIdentifyingUrlPathSegment", "")
                elif isinstance(logo_obj, str):
                    company_logo = logo_obj

            location = d.get("formattedLocation")

            return {
                "title": d.get("title"),
                "company": company_name or "Unknown",
                "company_urn": company_urn,
                "company_logo": company_logo,
                "company_url": company_url,
                "location": location,
                "applied": d.get("applyingInfo", {}).get("applied", False),
                "applied_at": ms_to_iso(d.get("applyingInfo", {}).get("appliedAt")),
                "posted_at": ms_to_iso(d.get("listedAt") or d.get("postedAt")),
                "created_at": ms_to_iso(d.get("createdAt")),
                "applicants": d.get("applies"),
                "job_state": d.get("jobState"),
                "description_full": d.get("description", {}).get("text"),
                "work_remote_allowed": d.get("workRemoteAllowed"),
                "expire_at": ms_to_iso(d.get("expireAt")),
                "_raw_keys": sorted(d.keys()) if self.debug else None,
                "_raw_company_details": company_details if self.debug else None,
                "_raw_company_description": company_desc if self.debug else None,
            }

        except (RetryableEnrichmentError, NonRetryableEnrichmentError):
            raise
        except Exception as e:
            if raise_on_failure:
                raise NonRetryableEnrichmentError(
                    operation=f"fetch_job_details({job_id})",
                    message=f"parse error: {e}",
                )
            _log(f"❌ fetch_job_details({job_id}) parse error: {e}")
            return {"_error": str(e)}

    def fetch_company_details(
            self,
            company_urn: str,
            raise_on_failure: bool = False,
    ) -> Dict[str, Any]:
        """Resolve a company URN to name, logo, and URL via Voyager."""
        company_id = company_urn.split(":")[-1] if ":" in company_urn else company_urn

        session = self.client.session
        csrf = self._get_csrf_token()

        url = f"https://www.linkedin.com/voyager/api/organization/companies/{company_id}"

        try:
            resp = session.get(
                url,
                headers={"csrf-token": csrf, "accept": "application/json"},
                timeout=20,
            )
        except requests.RequestException as e:
            if raise_on_failure:
                raise RetryableEnrichmentError(
                    operation=f"fetch_company_details({company_id})",
                    message=str(e),
                )
            _log(f"❌ fetch_company_details({company_id}) request error: {e}")
            return {"_error": str(e)}

        if resp.status_code != 200:
            _log(f"⚠️ fetch_company_details({company_id}): HTTP {resp.status_code}")
            _log(f"⚠️ Body snippet: {resp.text[:500]}")
            if raise_on_failure:
                self._raise_http_error(
                    operation=f"fetch_company_details({company_id})",
                    status_code=resp.status_code,
                    body=resp.text,
                )
            return {"_status": resp.status_code}

        try:
            d = resp.json()

            logo_url = None
            logo_obj = d.get("logo") or {}
            if isinstance(logo_obj, dict):
                vector = (
                        logo_obj.get("image", {}).get("com.linkedin.common.VectorImage")
                        or logo_obj.get("com.linkedin.common.VectorImage")
                        or {}
                )
                root_url = vector.get("rootUrl", "https://media.licdn.com/dms/image/")
                artifacts = vector.get("artifacts", [])
                if artifacts:
                    best = max(artifacts, key=lambda a: a.get("width", 0))
                    logo_url = root_url + best.get("fileIdentifyingUrlPathSegment", "")

            return {
                "company_id": company_id,
                "company_name": d.get("name") or d.get("universalName"),
                "company_url": d.get("companyPageUrl")
                               or d.get("url")
                               or f"https://www.linkedin.com/company/{d.get('universalName', company_id)}/",
                "company_logo": logo_url,
                "description": d.get("description"),
                "industry": (
                    d.get("companyIndustries", [{}])[0].get("localizedName")
                    if d.get("companyIndustries")
                    else None
                ),
                "staff_count": d.get("staffCount"),
                "headquarters": d.get("headquarter", {}).get("city") if d.get("headquarter") else None,
                "_raw_keys": sorted(d.keys()) if self.debug else None,
            }

        except (RetryableEnrichmentError, NonRetryableEnrichmentError):
            raise
        except Exception as e:
            if raise_on_failure:
                raise NonRetryableEnrichmentError(
                    operation=f"fetch_company_details({company_id})",
                    message=f"parse error: {e}",
                )
            _log(f"❌ fetch_company_details({company_id}) parse error: {e}")
            return {"_error": str(e)}

    def fetch_premium_insights(
            self,
            job_id: str,
            raise_on_failure: bool = False,
    ) -> Dict[str, Any]:
        """Fetch Premium RSC insights."""
        empty = {
            "premium_component_found": False,
            "applicants_total": None,
            "applicants_last_24h": None,
            "seniority_distribution": [],
            "education_distribution": [],
            "premium_title": None,
            "premium_description": None,
            "learn_more_url": None,
            "data_sdui_components": [],
        }

        try:
            if not PREMIUM_ENABLED or not self.premium_url:
                _log(f"[PREMIUM_SKIP] fetch_premium_insights({job_id}): skipped — "
                     f"PREMIUM_ENABLED={PREMIUM_ENABLED}, url_configured={bool(self.premium_url)}")
                return empty

            body = re.sub(
                r'("jobId"\s*:\s*)("\d+"|\d+)',
                f'\\1"{job_id}"',
                self.premium_body,
            )
            headers = self.premium_headers.copy()
            headers["Referer"] = f"https://www.linkedin.com/jobs/view/{job_id}/"
            headers.pop("Accept-Encoding", None)
            headers["Accept-Encoding"] = "identity"

            try:
                r = requests.request(
                    method=self.premium_method,
                    url=self.premium_url,
                    headers=headers,
                    data=body,
                    timeout=20,
                )
            except requests.RequestException as e:
                if raise_on_failure:
                    raise RetryableEnrichmentError(
                        operation=f"fetch_premium_insights({job_id})",
                        message=str(e),
                    )
                _log(f"⚠️ fetch_premium_insights({job_id}) request error: {e}")
                return empty

            if r.status_code != 200:
                if raise_on_failure:
                    self._raise_http_error(
                        operation=f"fetch_premium_insights({job_id})",
                        status_code=r.status_code,
                        body=r.text,
                    )
                raise RuntimeError(f"HTTP {r.status_code}")

            if r.text.lstrip()[:20].lower().startswith(("<!doctype", "<html")):
                _log(f"[PREMIUM_WARN] fetch_premium_insights({job_id}): HTTP 200 but response is HTML — likely auth redirect")

            # LinkedIn can return HTTP 200 plus the premium component shell while silently
            # degrading the actual metrics payload when auth context is stale.
            parsed = self.premium_parser.parse(r.text)

            premium_component_found = bool(parsed.get("premium_component_found"))
            applicants_total = parsed.get("applicants_total")
            has_undefined = "$undefined" in r.text
            has_concrete_metrics = any([
                applicants_total is not None,
                parsed.get("applicants_last_24h") is not None,
                bool(parsed.get("seniority_distribution")),
                bool(parsed.get("education_distribution")),
            ])

            if premium_component_found and applicants_total is None:
                self._log_premium_payload_degraded(
                    job_id=job_id,
                    response_text=r.text,
                    response_status=r.status_code,
                    parsed=parsed,
                    marker="[PREMIUM_METADATA_MISSING]",
                    reason="premium component shell present but applicants_total was not extracted",
                )

            if premium_component_found and (has_undefined or not has_concrete_metrics):
                self._log_premium_payload_degraded(
                    job_id=job_id,
                    response_text=r.text,
                    response_status=r.status_code,
                    parsed=parsed,
                    marker="[PREMIUM_PAYLOAD_DEGRADED]",
                    reason=(
                        "response contains $undefined"
                        if has_undefined
                        else "premium component shell present without concrete premium metrics"
                    ),
                )
            return parsed

        except (RetryableEnrichmentError, NonRetryableEnrichmentError):
            raise
        except Exception as e:
            if raise_on_failure:
                raise NonRetryableEnrichmentError(
                    operation=f"fetch_premium_insights({job_id})",
                    message=str(e),
                )
            _log(
                f"[PREMIUM_REQUEST_EXCEPTION] function=fetch_premium_insights "
                f"job_id={job_id} fetch_config={self.premium_config_name}:{self.premium_config_id} "
                f"error={e}"
            )
            return empty

    def fetch_notifications_for_job(
            self,
            job_id: str,
            raise_on_failure: bool = False,
    ) -> Optional[NotificationEvent]:
        """Fetch notifications and extract 'Application viewed' event for a specific job ID."""
        if not self.notifications_url:
            _log("❌ Notifications config not loaded from database")
            _log("❌ Make sure 'Notifications' record exists in FetchCurl table")
            return None

        session = self.client.session
        csrf = self._get_csrf_token()

        try:
            headers = session.headers.copy()
            headers.update(self.notifications_headers)
            headers["csrf-token"] = csrf

            try:
                resp = session.request(
                    method=self.notifications_method,
                    url=self.notifications_url,
                    headers=headers,
                    timeout=20,
                )
            except requests.RequestException as e:
                if raise_on_failure:
                    raise RetryableEnrichmentError(
                        operation=f"fetch_notifications_for_job({job_id})",
                        message=str(e),
                    )
                _log(f"❌ fetch_notifications_for_job({job_id}) request error: {e}")
                return None

            if resp.status_code != 200:
                _log(f"⚠️ HTTP {resp.status_code}")
                if raise_on_failure:
                    self._raise_http_error(
                        operation=f"fetch_notifications_for_job({job_id})",
                        status_code=resp.status_code,
                        body=resp.text,
                    )
                return None

            try:
                data = resp.json()
            except Exception as e:
                if raise_on_failure:
                    raise NonRetryableEnrichmentError(
                        operation=f"fetch_notifications_for_job({job_id})",
                        message=f"json parse error: {e}",
                    )
                _log(f"⚠️ Failed to parse JSON response: {e}")
                return None

            notification_event = parse_notification_for_job(data, job_id)

            if notification_event:
                _log(f"✅ Found: {notification_event.event_type} at {notification_event.timestamp}")
            else:
                _log(f"⚠️ No 'Application viewed' notification found for job {job_id}")

            return notification_event

        except (RetryableEnrichmentError, NonRetryableEnrichmentError):
            raise
        except Exception as e:
            if raise_on_failure:
                raise NonRetryableEnrichmentError(
                    operation=f"fetch_notifications_for_job({job_id})",
                    message=str(e),
                )
            _log(f"❌ fetch_notifications_for_job({job_id}) error: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _fetch_and_merge_enrichment(self, job_id: str) -> Dict[str, Any]:
        """EXTRACTED HTTP LAYER: Pure enrichment fetch & merge."""
        details = self.fetch_job_details(job_id)

        for k in list(details.keys()):
            if k.startswith("_"):
                details.pop(k)

        premium = self.fetch_premium_insights(job_id)

        notification = self.fetch_notifications_for_job(job_id)
        notification_dict = asdict(notification) if notification else None

        return {**details, **premium, "notification": notification_dict}

    def enrich_job(self, job_urn: str) -> JobPost:
        """
        Legacy single-job orchestration helper.

        Important:
        - no sleep here
        - no retry/backoff here
        - BatchEnrichmentService should be preferred for production flows
        """
        job_id = str(job_urn).split(":")[-1] if ":" in str(job_urn) else str(job_urn)

        base_job_dict = {
            "job_id": job_id,
            "job_url": f"https://www.linkedin.com/jobs/view/{job_id}/",
        }

        enriched = self._fetch_and_merge_enrichment(job_id)
        base_job_dict.update(enriched)

        if base_job_dict.get("company") in [None, "Unknown"] and base_job_dict.get("company_urn"):
            company_info = self.fetch_company_details(base_job_dict["company_urn"])
            if company_info.get("company_name"):
                base_job_dict["company"] = company_info["company_name"]
            if company_info.get("company_url") and not base_job_dict.get("company_url"):
                base_job_dict["company_url"] = company_info["company_url"]
            if company_info.get("company_logo") and not base_job_dict.get("company_logo"):
                base_job_dict["company_logo"] = company_info["company_logo"]

        app_tot = base_job_dict.get("applicants_total")
        if isinstance(app_tot, int) and app_tot > 0:
            base_job_dict["applicants"] = app_tot

        return JobPost.from_dict(base_job_dict)


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("🧪 LinkedInJobEnricher Notification Fetcher Test")
    print("=" * 70)

    test_job_id = "4375526458"

    try:
        enricher = LinkedInJobEnricher(debug=False, slim_mode=True)
        print(f"\n📌 Testing notification fetch for job ID: {test_job_id}")

        notification = enricher.fetch_notifications_for_job(test_job_id)

        if notification:
            print("\n✅ SUCCESS - Notification Event Found:")
            print(f"   Job ID: {notification.job_id}")
            print(f"   Event Type: {notification.event_type}")
            print(f"   Timestamp: {notification.timestamp}")
            print(f"   Status: {notification.status}")
            print(f"   Company: {notification.company}")
            print(f"   Headline: {notification.headline}")
            print("\n📋 Full Data:")
            print(notification.to_dict())
        else:
            print(f"\n⚠️  No notification found for job {test_job_id}")

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)

    print("\n" + "=" * 70)
    print("✨ Test completed")
    print("=" * 70 + "\n")
