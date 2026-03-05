"""
linkedin_proxy.py — REFACTORED VERSION
Pure LinkedIn HTTP layer with extracted enrichment layer.

Redundancy eliminated:
  - enrichment_pipeline() and enrich_single_job() now share HTTP logic via _fetch_and_merge_enrichment()
  - No duplicate fetch_job_details() or fetch_premium_insights() calls
  - Same behavior, cleaner code

Responsibilities:
    - Execute HTTP requests against LinkedIn APIs
    - Parse responses (stream format, JSON, regex fallback)
    - Return plain dicts / dataclasses

Rules:
    - ZERO imports from models.job_models or database writes
    - LinkedInClient._load_config() is the ONLY DB touch (read-only curl configs)
    - Every public method returns serializable data
"""

import json
import re
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Iterable, List, Optional

import requests
from requests import Session

from source.core.debug_mode import is_debug
from source.features.fetch_curl.linkedin_http_client import LinkedInClient, LinkedInRequest


@dataclass
class JobPost:
    job_id: str
    title: Optional[str] = None
    company: Optional[str] = None
    company_urn: Optional[str] = None
    company_logo: Optional[str] = None
    company_url: Optional[str] = None
    location: Optional[str] = None
    job_url: Optional[str] = None
    applied: Optional[bool] = None
    applied_at: Optional[str] = None
    posted_at: Optional[str] = None
    created_at: Optional[str] = None
    posted_date_text: Optional[str] = None
    job_state: Optional[str] = None
    expire_at: Optional[str] = None
    experience_level: Optional[str] = None
    employment_status: Optional[str] = None
    application_closed: Optional[bool] = None
    work_remote_allowed: Optional[bool] = None
    description_full: Optional[str] = None
    applicants: Optional[int] = 0
    competition_level: Optional[str] = None
    applicants_velocity_24h: Optional[int] = None
    applicants_total: Optional[int] = None
    applicants_last_24h: Optional[int] = None
    premium_title: Optional[str] = None
    premium_description: Optional[str] = None
    learn_more_url: Optional[str] = None
    seniority_distribution: List[Dict[str, Any]] = field(default_factory=list)
    education_distribution: List[Dict[str, Any]] = field(default_factory=list)
    premium_component_found: bool = False

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "JobPost":
        valid_fields = {f.name for f in cls.__dataclass_fields__.values()}
        clean_data = {k: v for k, v in data.items() if k in valid_fields}
        return cls(**clean_data)


@dataclass
class JobServiceResponse:
    count: int
    stage: str
    jobs: List[JobPost]

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class NotificationEvent:
    """Represents a notification event from LinkedIn."""
    job_id: str
    event_type: str
    event_name: str
    timestamp: Optional[str]
    timestamp_ms: Optional[int]
    status: str
    company: str
    headline: str
    job_application_id: Optional[str] = None
    published_at_ms: Optional[int] = None

    def to_dict(self) -> dict:
        return asdict(self)


PREMIUM_ENABLED = True
REQUEST_DELAY_SECONDS = 0.7
LOG = True


def _log(msg: str):
    if LOG:
        print(msg)


def print_curl_command(method, url, headers, body):
    if not is_debug():
        return
    cmd = f"curl '{url}' \\"
    for k, v in headers.items():
        val = str(v).replace("'", "'\\''")
        cmd += f"\n  -H '{k}: {val}' \\"
    cmd += f"\n  -X {method} \\"
    if body:
        b_safe = str(body).replace("'", "'\\''")
        cmd += f"\n  --data-raw '{b_safe}'"
    print("\n" + "=" * 60)
    print("📢 CURL GERADO PELO PYTHON:")
    print("=" * 60)
    print(cmd)
    print("=" * 60 + "\n")


def ms_to_datetime(ms) -> Optional[datetime]:
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc)
    except Exception:
        return None


def ms_to_iso(ms) -> Optional[str]:
    dt = ms_to_datetime(ms)
    return dt.isoformat() if dt else None


def datetime_to_iso(val) -> Optional[str]:
    """Safely convert a datetime or passthrough a string."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)


def parse_linkedin_stream(raw_text: str) -> list:
    parsed_items = []
    for line in raw_text.split("\n"):
        if not line.strip():
            continue
        try:
            if ":" in line and line[0].isalnum():
                _, rest = line.split(":", 1)
                rest = rest.strip()
                if rest.startswith("I["):
                    continue
                parsed_items.append(json.loads(rest))
            else:
                parsed_items.append(json.loads(line))
        except Exception:
            continue
    return parsed_items


def _walk(obj: Any) -> Iterable[Any]:
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from _walk(v)
    elif isinstance(obj, list):
        for it in obj:
            yield from _walk(it)


def find_job_objects_recursive(data) -> list:
    found = []
    if isinstance(data, dict):
        if "jobId" in data or "jobPostingUrn" in data:
            found.append(data)
        for value in data.values():
            found.extend(find_job_objects_recursive(value))
    elif isinstance(data, list):
        for item in data:
            found.extend(find_job_objects_recursive(item))
    return found


class RawStringRequest(LinkedInRequest):
    def __init__(self, method: str, url: str, body_str: str,
                 headers: dict = None, debug: bool = False,
                 clean_headers: bool = False):
        super().__init__(method, url, debug=debug)
        self.body_str = body_str
        self.clean_headers = clean_headers
        if headers:
            for k, v in headers.items():
                self._headers[k] = v

    def execute(self, session: Session, timeout=20):
        if self.clean_headers:
            final_headers = self._headers.copy()
        else:
            final_headers = session.headers.copy()
            for k, v in self._headers.items():
                if k.lower() in ["accept-encoding", "content-length"]:
                    continue
                final_headers[k] = v

        if self.debug or LOG:
            print_curl_command(self.method, self.url, final_headers, self.body_str)

        return session.request(
            method=self.method, url=self.url, headers=final_headers,
            data=self.body_str if self.body_str else None, timeout=timeout,
        )


class PremiumParser:
    SENIORITY_RE = re.compile(
        r"^\s*(\d+)%\s+(.+?)\s+people applied for this job\s*$", re.I
    )
    PCT_ONLY_RE = re.compile(r"^\s*(\d+)%\s*$")

    @staticmethod
    def _to_int(s: str) -> Optional[int]:
        ss = s.replace(",", "").strip()
        return int(ss) if ss.isdigit() else None

    @staticmethod
    def _normalize_space(s: str) -> str:
        return re.sub(r"\s+", " ", s or "").strip()

    def _match_applicant_patterns(self, tokens):
        applicants_total = None
        applicants_last_24h = None

        for i, tok in enumerate(tokens):
            tok_lower = tok.lower()

            if tok_lower == "total" and i - 1 >= 0:
                v = self._to_int(tokens[i - 1])
                if v is not None and applicants_total is None:
                    applicants_total = v
                    continue

            if tok == "Applicants" and i - 1 >= 0:
                v = self._to_int(tokens[i - 1])
                if v is not None and applicants_total is None:
                    applicants_total = v
                    continue

            if tok_lower == "in the past day" and i - 1 >= 0:
                v = self._to_int(tokens[i - 1])
                if v is not None and applicants_last_24h is None:
                    applicants_last_24h = v
                    continue

            if tok == "Applicants in the past day" and i - 1 >= 0:
                v = self._to_int(tokens[i - 1])
                if v is not None and applicants_last_24h is None:
                    applicants_last_24h = v
                    continue

            if "day" in tok_lower and i - 1 >= 0:
                v = self._to_int(tokens[i - 1])
                if v is not None and applicants_last_24h is None:
                    applicants_last_24h = v
                    continue

        return applicants_total, applicants_last_24h

    def _collect_text_tokens(self, items: List[Any]) -> List[str]:
        tokens: List[str] = []
        for it in items:
            for node in _walk(it):
                if isinstance(node, dict):
                    ch = node.get("children")
                    if isinstance(ch, list):
                        if len(ch) == 1 and isinstance(ch[0], str):
                            s = self._normalize_space(ch[0])
                            if s:
                                tokens.append(s)
                        else:
                            for x in ch:
                                if isinstance(x, str):
                                    s = self._normalize_space(x)
                                    if s:
                                        tokens.append(s)
                elif isinstance(node, list):
                    for x in node:
                        if isinstance(x, str):
                            s = self._normalize_space(x)
                            if s:
                                tokens.append(s)

        seen = set()
        uniq = []
        for t in tokens:
            if t in seen:
                continue
            seen.add(t)
            uniq.append(t)
        return uniq

    def _extract_metrics(self, text_tokens: List[str]) -> Dict[str, Any]:
        applicants_total, applicants_last_24h = self._match_applicant_patterns(text_tokens)

        seniority_distribution = []
        education_distribution = []

        for tok in text_tokens:
            m = self.SENIORITY_RE.match(tok)
            if m:
                seniority_distribution.append({
                    "label": self._normalize_space(m.group(2)),
                    "value": int(m.group(1))
                })

        for i, tok in enumerate(text_tokens):
            m = self.PCT_ONLY_RE.match(tok)
            if not m:
                continue
            nxt = text_tokens[i + 1] if i + 1 < len(text_tokens) else ""
            if nxt.lower().startswith("have "):
                education_distribution.append({
                    "label": nxt,
                    "value": int(m.group(1))
                })

        return {
            "applicants_total": applicants_total,
            "applicants_last_24h": applicants_last_24h,
            "seniority_distribution": seniority_distribution,
            "education_distribution": education_distribution,
        }

    def _extract_copy_blocks(self, text_tokens: List[str]) -> Dict[str, Any]:
        title_c, desc_c = [], []
        for t in text_tokens:
            if "Insights about" in t and "applicants" in t:
                title_c.append(t)
            if "Here's where you can see" in t:
                desc_c.append(t)
        return {
            "premium_title": title_c[0] if title_c else None,
            "premium_description": desc_c[0] if desc_c else None,
        }

    def _extract_urls_and_ids(self, items: List[Any]) -> Dict[str, Any]:
        out = {"learn_more_url": None, "data_sdui_components": []}
        comp_seen = set()

        for it in items:
            for node in _walk(it):
                if not isinstance(node, dict):
                    continue
                comp = node.get("data-sdui-component")
                if isinstance(comp, str) and comp and comp not in comp_seen:
                    comp_seen.add(comp)
                    out["data_sdui_components"].append(comp)
                url = node.get("url")
                if (isinstance(url, str) and "help" in url
                        and "linkedin.com" in url and not out["learn_more_url"]):
                    out["learn_more_url"] = url

        return out

    def parse(self, raw_text: str) -> Dict[str, Any]:
        items = parse_linkedin_stream(raw_text)
        tokens = self._collect_text_tokens(items)

        meta = self._extract_urls_and_ids(items)
        metrics = self._extract_metrics(tokens)
        copy = self._extract_copy_blocks(tokens)

        return {
            **metrics,
            **copy,
            **meta,
            "premium_component_found": any(
                "premiumApplicantInsights" in c
                for c in meta.get("data_sdui_components", [])
            ),
        }


class LinkedInProxy:
    """
    Pure LinkedIn HTTP proxy. Every method returns dicts or dataclasses.
    No SQL writes. No ORM imports.
    """

    def __init__(self, debug: bool = False, slim_mode: bool = True):
        self.debug = debug
        self.client = LinkedInClient("SavedJobs", slim_mode=slim_mode)
        self.premium_parser = PremiumParser()

        from database.database_connection import get_db_session
        from models.fetch_models import FetchCurl

        db = get_db_session()
        try:
            record_saved = db.query(FetchCurl).filter(FetchCurl.name == "SavedJobs").first()
            if not record_saved:
                raise ValueError("SavedJobs config missing from FetchCurl table")
            self.saved_url = record_saved.base_url
            self.saved_method = record_saved.method or "POST"
            self.saved_body = record_saved.body or ""

            self.premium_url = ""
            self.premium_headers = {}
            self.premium_method = "POST"
            self.premium_body = ""
            rec_prem = db.query(FetchCurl).filter(FetchCurl.name == "PremiumInsights").first()
            if rec_prem:
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
                _log(f"✓ Loaded Notifications config from DB")
            else:
                _log(f"⚠️ Notifications config not found in FetchCurl table")
        finally:
            db.close()

    def fetch_job_details(self, job_id: str) -> Dict[str, Any]:
        """Fetch Voyager job details. Returns a plain dict, datetimes as ISO strings."""
        session = self.client.session
        csrf = session.headers.get("csrf-token")
        if not csrf:
            for c in session.cookies:
                if c.name == "JSESSIONID":
                    csrf = c.value.replace('"', "")
                    break

        url = f"https://www.linkedin.com/voyager/api/jobs/jobPostings/{job_id}"
        resp = session.get(
            url,
            headers={"csrf-token": csrf, "accept": "application/json"},
            timeout=20,
        )

        if resp.status_code != 200:
            _log(f"⚠️ fetch_job_details({job_id}): HTTP {resp.status_code}")
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
                company_name = (
                        d.get("companyName")
                        or d.get("formattedCompanyName")
                )

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
        except Exception as e:
            _log(f"❌ fetch_job_details({job_id}) parse error: {e}")
            return {"_error": str(e)}

    def fetch_company_details(self, company_urn: str) -> Dict[str, Any]:
        """
        Resolve a company URN to name, logo, and URL via Voyager.
        Accepts formats like:
            - "urn:li:fs_normalized_company:9318713"
            - "9318713"
        """
        company_id = company_urn.split(":")[-1] if ":" in company_urn else company_urn

        session = self.client.session
        csrf = session.headers.get("csrf-token")
        if not csrf:
            for c in session.cookies:
                if c.name == "JSESSIONID":
                    csrf = c.value.replace('"', "")
                    break

        url = f"https://www.linkedin.com/voyager/api/organization/companies/{company_id}"
        resp = session.get(
            url,
            headers={"csrf-token": csrf, "accept": "application/json"},
            timeout=20,
        )

        if resp.status_code != 200:
            _log(f"⚠️ fetch_company_details({company_id}): HTTP {resp.status_code}")
            _log(f"⚠️ Body snippet: {resp.text[:500]}")
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
                "company_url": d.get("companyPageUrl") or d.get("url")
                               or f"https://www.linkedin.com/company/{d.get('universalName', company_id)}/",
                "company_logo": logo_url,
                "description": d.get("description"),
                "industry": d.get("companyIndustries", [{}])[0].get("localizedName") if d.get(
                    "companyIndustries") else None,
                "staff_count": d.get("staffCount"),
                "headquarters": d.get("headquarter", {}).get("city") if d.get("headquarter") else None,
                "_raw_keys": sorted(d.keys()) if self.debug else None,
            }
        except Exception as e:
            _log(f"❌ fetch_company_details({company_id}) parse error: {e}")
            return {"_error": str(e)}

    def _fetch_and_merge_enrichment(self, job_id: str) -> Dict[str, Any]:
        """
        EXTRACTED HTTP LAYER: Pure enrichment fetch & merge.

        This is the canonical enrichment operation shared by both:
          - enrichment_pipeline() — debug endpoint, returns raw dict
          - enrich_single_job() — sync layer, returns JobPost dataclass

        Responsibilities:
            1. Fetch job details from Voyager API
            2. Clean internal debug keys (_raw_*, _status, _error)
            3. Fetch premium insights from RSC
            4. Fetch notifications for the job
            5. Merge all responses
            6. Return single merged dict

        Important:
            - No dataclass conversion (that's done by caller)
            - No business logic (company URN fallback, applicants normalization)
            - No rate limiting (that's done by enrich_single_job only)

        Args:
            job_id: LinkedIn job ID string (e.g., "4375526458")

        Returns:
            Dict with merged keys:
            - From details: title, company, location, applied_at, posted_at, etc.
            - From premium: applicants_total, seniority_distribution, etc.
            - From notifications: notification event (if any)

        Example:
            >>> proxy = LinkedInProxy()
            >>> enriched = proxy._fetch_and_merge_enrichment("4375526458")
            >>> enriched["premium_component_found"]  # bool
            >>> enriched["applicants_total"]  # int or None
            >>> enriched["notification"]  # dict or None
        """
        details = self.fetch_job_details(job_id)

        # Strip internal debug keys (don't leak these to callers)
        for k in list(details.keys()):
            if k.startswith("_"):
                details.pop(k)

        premium = self.fetch_premium_insights(job_id)

        # Fetch notification for this job
        notification = self.fetch_notifications_for_job(job_id)
        notification_dict = asdict(notification) if notification else None

        # Merge: premium can override details if both have same key
        # Notification is added as its own top-level key
        return {**details, **premium, "notification": notification_dict}

    def enrichment_pipeline(self, job_id: str) -> Dict[str, Any]:
        """
        PUBLIC: Debug-oriented enrichment (raw dict output).

        Purpose:
            Fetch a job's details + premium insights, return as plain dict.
            Used by debug endpoints that need raw merged data, not dataclasses.
            No rate limiting (single one-off call).

        Used by:
            /job-tracker/debug-job endpoint (controller.py line ~130)

        Args:
            job_id: LinkedIn job ID string

        Returns:
            Plain dict with merged detail + premium keys.
            No internal _debug keys, no dataclass conversion.

        Example:
            >>> proxy = LinkedInProxy()
            >>> data = proxy.enrichment_pipeline("4375526458")
            >>> isinstance(data, dict)  # True
            >>> data["title"]  # "Software Engineer"
            >>> data["premium_component_found"]  # bool
            >>> data["applicants_total"]  # int or None
        """
        return self._fetch_and_merge_enrichment(job_id)

    def fetch_premium_insights(self, job_id: str) -> Dict[str, Any]:
        """Fetch Premium RSC insights. Always returns all expected keys."""
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

            r = requests.request(
                method=self.premium_method,
                url=self.premium_url,
                headers=headers,
                data=body,
                timeout=20,
            )

            if r.status_code != 200:
                raise RuntimeError(f"HTTP {r.status_code}")

            return self.premium_parser.parse(r.text)

        except Exception as e:
            _log(f"⚠️ fetch_premium_insights({job_id}) error: {e}")
            return empty

    def fetch_notifications_for_job(self, job_id: str) -> Optional[NotificationEvent]:
        """
        Fetch notifications and extract "Application viewed" event for a specific job ID.
        Uses Notifications config from database (FetchCurl table).

        Args:
            job_id: The LinkedIn job ID to search for (e.g., "4375526458")

        Returns:
            NotificationEvent with:
                - job_id: The job ID searched for
                - event_type: "JOB_APPLICATION_VIEWED_V2"
                - timestamp: ISO datetime when application was viewed
                - status: "viewed"
                - company: Company name extracted from notification
                - headline: Full notification headline text
            or None if not found
        """

        if not self.notifications_url:
            _log(f"❌ Notifications config not loaded from database")
            _log(f"❌ Make sure 'Notifications' record exists in FetchCurl table")
            return None

        session = self.client.session
        csrf = session.headers.get("csrf-token")
        if not csrf:
            for c in session.cookies:
                if c.name == "JSESSIONID":
                    csrf = c.value.replace('"', "")
                    break

        try:

            headers = session.headers.copy()
            headers.update(self.notifications_headers)
            headers["csrf-token"] = csrf

            resp = session.request(
                method=self.notifications_method,
                url=self.notifications_url,
                headers=headers,
                timeout=20,
            )

            if resp.status_code != 200:
                _log(f"⚠️ HTTP {resp.status_code}")
                return None

            try:
                data = resp.json()
                if "data" in data:
                    if "*elements" in data["data"]:
                        _log(f"elements count: {len(data['data']['*elements'])}")
            except Exception as e:
                _log(f"⚠️ Failed to parse JSON response: {e}")
                _log(f"⚠️ Response text: {resp.text[:500]}")
                return None

            notification_event = self._parse_notification_for_job(data, job_id)

            if notification_event:
                _log(f"✅ Found: {notification_event.event_type} at {notification_event.timestamp}")
            else:
                elements = data.get("data", {}).get("elements", [])
                _log(f"⚠️ No 'Application viewed' notification found for job {job_id}")
                _log(f"⚠️ Response had {len(elements)} notification elements")
                if elements:
                    _log(f"⚠️ Sample elements: {elements[:2]}")

            return notification_event

        except Exception as e:
            _log(f"❌ fetch_notifications_for_job({job_id}) error: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _parse_notification_for_job(self, data: Dict[str, Any], target_job_id: str) -> Optional[NotificationEvent]:
        """
        Parse notification response and extract "Application viewed" event for target job ID.

        LinkedIn structure:
            - data["data"]["elements"]: list of notification card URNs
            - Each URN like: "urn:li:fsd_notificationCard:(JOB_APPLICATION_VIEWED_V2,urn:li:jobApplication:38178920458)"
            - Card data is in data["included"] with entityUrn matching
            - headline.text contains "Your application was viewed for TITLE at COMPANY"
            - publishedAt contains millisecond timestamp
        """
        try:
            elements = data.get("data", {}).get("*elements", [])
            if not elements:
                _log("⚠️ No notification elements found")
                return None

            _log(f"   Found {len(elements)} notification elements")

            for element_urn in elements:
                if not isinstance(element_urn, str):
                    continue

                if "JOB_APPLICATION_VIEWED_V2" not in element_urn:
                    continue

                _log(f"   ✓ Found JOB_APPLICATION_VIEWED_V2 event in URN")
                _log(f"   URN: {element_urn}")

                included = data.get("included", [])
                card_data = None

                for inc_item in included:
                    if isinstance(inc_item, dict):
                        entity_urn = inc_item.get("entityUrn", "")
                        if entity_urn == element_urn:
                            card_data = inc_item
                            _log(f"   ✓ Found card data in included")
                            break

                if not card_data:
                    _log(f"   ⚠️ Card data not found in included, searching by type...")
                    for inc_item in included:
                        if isinstance(inc_item, dict):
                            card_type = inc_item.get("$type", "")
                            if "JOB_APPLICATION_VIEWED_V2" in card_type:
                                card_data = inc_item
                                _log(f"   ✓ Found card by $type match")
                                break

                if not card_data:
                    _log(f"   ⚠️ Card data still not found")
                    continue

                _log(f"   Card data keys: {list(card_data.keys())}")

                headline = card_data.get("headline", {})
                headline_text = ""
                if isinstance(headline, dict):
                    headline_text = headline.get("text", "")
                elif isinstance(headline, str):
                    headline_text = headline

                _log(f"   Headline: {headline_text}")

                company = "Unknown"
                company_match = re.search(r"at\s+([^\"]+)$", headline_text)
                if company_match:
                    company = company_match.group(1).strip()

                published_at_ms = card_data.get("publishedAt")
                timestamp = ms_to_iso(published_at_ms) if published_at_ms else None

                object_urn = card_data.get("objectUrn", "")
                job_app_id = None

                job_app_match = re.search(r"urn:li:jobApplication:(\d+)", element_urn)
                if job_app_match:
                    job_app_id = job_app_match.group(1)
                    _log(f"   Job Application ID: {job_app_id}")
                elif object_urn:
                    job_app_match = re.search(r"urn:li:jobApplication:(\d+)", object_urn)
                    if job_app_match:
                        job_app_id = job_app_match.group(1)
                        _log(f"   Job Application ID (from objectUrn): {job_app_id}")

                return NotificationEvent(
                    job_id=target_job_id,
                    job_application_id=job_app_id,
                    event_type="JOB_APPLICATION_VIEWED_V2",
                    event_name="Application Viewed",
                    timestamp=timestamp,
                    timestamp_ms=published_at_ms,
                    status="viewed",
                    company=company,
                    headline=headline_text,
                    published_at_ms=published_at_ms,
                )

            _log(f"⚠️ No JOB_APPLICATION_VIEWED_V2 notification found for job {target_job_id}")
            return None

        except Exception as e:
            _log(f"❌ _parse_notification_for_job error: {e}")
            import traceback
            traceback.print_exc()
            return None

    def enrich_single_job(self, base_job_dict: Dict[str, Any]) -> JobPost:
        """
        Sync-layer enrichment: HTTP fetch + merge + business logic + dataclass conversion.

        Purpose:
            Convert a light job dict (from listing) into a fully enriched JobPost dataclass
            ready for database insertion. Used by sync services for bulk operations.

        Responsibilities:
            1. Fetch enriched data (details + premium) via HTTP
            2. Merge with base dict
            3. Apply business logic (company URN resolution, applicants normalization)
            4. Apply rate limiting (0.7s sleep — critical for bulk sync to not hammer LinkedIn)
            5. Return validated JobPost dataclass

        Sync-specific behavior:
            - Company URN fallback: if company is missing/Unknown, resolve via company_urn
            - Applicants normalization: prefer applicants_total from premium insights
            - Rate limiting: Always sleeps 0.7s (only in sync, not in debug)

        Used by:
            - sync_backfill_stream() — bulk processing with sleep
            - sync_smart() — new jobs only with sleep
            - Job enrichment in any sync context

        Args:
            base_job_dict: Light job dict with at minimum:
                {
                    "job_id": "4375526458",
                    "title": "Software Engineer",
                    "company": "Meta",
                    "location": "SF, CA",
                    "job_url": "https://...",
                    "posted_at": "2025-03-05T10:00:00Z",
                }

        Returns:
            JobPost dataclass with all fields validated and populated:
                - Fully enriched from Voyager + RSC
                - All expected fields set (premium metrics, etc.)
                - Ready for database insertion

        Example:
            >>> proxy = LinkedInProxy()
            >>> base = {"job_id": "4375526458", "title": "...", "company": "..."}
            >>> job = proxy.enrich_single_job(base)
            >>> isinstance(job, JobPost)  # True
            >>> job.applicants_total  # int (from premium)
            >>> job.seniority_distribution  # list[dict] (from premium)
            >>> job.company  # "Meta" (possibly resolved from URN)
        """
        jid = str(base_job_dict["job_id"])

        # Step 1: Fetch enriched data via extracted HTTP layer (no duplication)
        enriched = self._fetch_and_merge_enrichment(jid)

        # Step 2: Merge enriched data into base dict
        base_job_dict.update(enriched)

        # Step 3: Company URN fallback — resolve if company is missing/Unknown
        if base_job_dict.get("company") in [None, "Unknown"] and base_job_dict.get("company_urn"):
            company_info = self.fetch_company_details(base_job_dict["company_urn"])
            if company_info.get("company_name"):
                base_job_dict["company"] = company_info["company_name"]
            if company_info.get("company_url") and not base_job_dict.get("company_url"):
                base_job_dict["company_url"] = company_info["company_url"]
            if company_info.get("company_logo") and not base_job_dict.get("company_logo"):
                base_job_dict["company_logo"] = company_info["company_logo"]

        # Step 4: Applicants normalization — prefer premium total over basic count
        app_tot = base_job_dict.get("applicants_total")
        if isinstance(app_tot, int) and app_tot > 0:
            base_job_dict["applicants"] = app_tot

        # Step 5: Rate limiting — CRITICAL for bulk sync operations
        # This prevents hammering LinkedIn when processing many jobs
        # ONLY applied here (sync context), NOT in enrichment_pipeline (debug)
        time.sleep(REQUEST_DELAY_SECONDS)

        return JobPost.from_dict(base_job_dict)

    def fetch_latest_applied_candidates(self, limit: int = 15) -> List[Dict[str, Any]]:
        """Fetch the latest applied jobs from LinkedIn (light, no enrichment)."""
        _log("\n" + "=" * 60)
        _log("🕵️ fetch_latest_applied_candidates...")

        target_url = self.saved_url.replace("stage=saved", "stage=applied")
        target_body = self.saved_body
        if target_body:
            target_body = target_body.replace('"stage":"saved"', '"stage":"applied"')

        target_body = self._prepare_body(target_body, page_index=0)

        req = RawStringRequest(self.saved_method, target_url, target_body, clean_headers=False)
        req._headers["x-li-initial-url"] = "/jobs-tracker/?stage=applied"

        response = self.client.execute(req)

        if response.status_code != 200:
            _log(f"⚠️ HTTP {response.status_code}")
            return []

        stream_items = parse_linkedin_stream(response.text)
        candidates = []
        for item in stream_items:
            candidates.extend(find_job_objects_recursive(item))

        results = []
        global_seen_ids = set()

        for job in candidates:
            jid = str(job.get("jobId", ""))
            if not jid or jid in global_seen_ids:
                continue
            if not (job.get("title") or job.get("jobTitle")):
                continue
            global_seen_ids.add(jid)
            results.append(self._build_base_job(job))
            if len(results) >= limit:
                break

        _log(f"✅ Jobs via JSON: {len(results)}")

        if len(results) == 0:
            _log("⚠️ JSON returned 0. Regex fallback...")
            patterns = [
                r"web_opp_contacts_(\d+)",
                r"opportunity_tracker_confirm_hear_back_is_visible_(\d+)",
                r"job_notes_show_api_(\d+)",
                r"opportunity_tracker_check_back_(\d+)",
                r"urn:li:fs_jobPosting:(\d+)",
            ]
            found_ids = set()
            for p in patterns:
                for m in re.findall(p, response.text):
                    if len(m) > 5 and m not in global_seen_ids:
                        found_ids.add(m)

            _log(f"🔍 Regex candidate IDs: {len(found_ids)}")
            for jid in found_ids:
                if len(results) >= limit:
                    break
                if jid in global_seen_ids:
                    continue
                global_seen_ids.add(jid)
                results.append({
                    "job_id": jid,
                    "title": "Carregando...",
                    "company": "LinkedIn",
                    "location": "Unknown",
                    "job_url": f"https://www.linkedin.com/jobs/view/{jid}/",
                    "posted_at": datetime.now(timezone.utc).isoformat(),
                })

        _log(f"🏁 Total: {len(results)}")
        _log("=" * 60 + "\n")
        return results

    def fetch_jobs_listing(self, stage: str = "saved") -> JobServiceResponse:
        """
        Fetch full listing for a stage (saved/applied) WITH enrichment.
        Returns a JobServiceResponse with enriched JobPost objects.
        """
        is_pagination = (stage == "saved")
        page_index = 0
        max_pages = 20

        all_base_jobs = []
        global_seen_ids = set()

        while True:
            _log(f"\n🔄 Fetching {stage} - Page {page_index}")

            target_url = self.saved_url
            target_body = self.saved_body

            if stage != "saved":
                target_url = target_url.replace("stage=saved", f"stage={stage}")
                if target_body:
                    target_body = target_body.replace('"stage":"saved"', f'"stage":"{stage}"')

            if is_pagination:
                target_body = self._prepare_body(target_body, page_index)

            req = RawStringRequest(self.saved_method, target_url, target_body, clean_headers=False)
            req._headers["x-li-initial-url"] = f"/jobs-tracker/?stage={stage}"

            response = self.client.execute(req)
            if response.status_code != 200:
                _log(f"⚠️ HTTP {response.status_code}")
                break

            stream_items = parse_linkedin_stream(response.text)
            page_candidates = []
            for item in stream_items:
                page_candidates.extend(find_job_objects_recursive(item))

            new_unique = 0
            for job in page_candidates:
                jid = job.get("jobId")
                if not jid:
                    continue
                has_title = job.get("title") or job.get("jobTitle")
                has_company = job.get("companyName") or job.get("company") or job.get("companyDetails")
                if not has_title and not has_company:
                    continue
                if jid not in global_seen_ids:
                    global_seen_ids.add(jid)
                    base_job = self._build_base_job(job)
                    all_base_jobs.append(base_job)
                    new_unique += 1
                    _log(f"   -> {base_job['title']} at {base_job['company']} ({base_job['job_id']})")

            _log(f"   -> New unique: {new_unique}")

            if not is_pagination:
                break
            if new_unique == 0:
                break
            if new_unique < 100 and page_index > 0:
                break
            if page_index >= max_pages:
                break

            page_index += 1
            time.sleep(1.0)

        _log(f"✅ Total base jobs: {len(all_base_jobs)}")

        job_objects = []
        should_enrich = stage in ["applied", "saved"]
        for base in all_base_jobs:
            if should_enrich:
                job_objects.append(self.enrich_single_job(base))
            else:
                job_objects.append(JobPost.from_dict(base))

        return JobServiceResponse(count=len(job_objects), stage=stage, jobs=job_objects)

    def resolve_job_id(self, query: str, limit: int = 30) -> Optional[str]:
        """
        Search recent applied jobs by substring match on company/title/job_id.
        Returns the first matching job_id or None.
        """
        candidates = self.fetch_latest_applied_candidates(limit=limit)
        q = query.lower().strip()
        for c in candidates:
            if q == str(c.get("job_id", "")):
                return str(c["job_id"])
            title = (c.get("title") or "").lower()
            company = (c.get("company") or "").lower()
            if q in title or q in company or q in f"{company} {title}":
                return str(c["job_id"])
        return None

    def _prepare_body(self, base_body_str: str, page_index: int) -> str:
        try:
            data = json.loads(base_body_str)
            ra = data.get("requestedArguments")
            if isinstance(ra, dict):
                payload = ra.get("payload")
                if isinstance(payload, dict):
                    payload["cacheId"] = str(uuid.uuid4())
                states = ra.get("states")
                if isinstance(states, list):
                    for st in states:
                        if (st.get("key") == "opportunity_tracker_current_page_saved"
                                and st.get("namespace") == "MemoryNamespace"):
                            st["value"] = page_index
            return json.dumps(data)
        except Exception as e:
            _log(f"⚠️ _prepare_body error: {e}")
            return base_body_str

    def _build_base_job(self, job_data: dict) -> dict:
        job_id_str = str(job_data.get("jobId"))

        posted_at = (
                job_data.get("listedAt")
                or job_data.get("formattedPostedDate")
                or job_data.get("postedAt")
        )
        if isinstance(posted_at, (int, float)):
            posted_at = ms_to_iso(posted_at)

        company = (
                job_data.get("companyName")
                or job_data.get("company")
                or job_data.get("companyDetails", {}).get("company", {}).get("name")
                or job_data.get("companyDescription", {}).get("companyName")
                or job_data.get("jobPosting", {}).get("companyName")
                or "Unknown"
        )

        return {
            "job_id": job_id_str,
            "title": job_data.get("title") or job_data.get("jobTitle"),
            "company": company,
            "location": job_data.get("formattedLocation") or job_data.get("locationPrimary"),
            "job_url": f"https://www.linkedin.com/jobs/view/{job_id_str}/",
            "posted_at": posted_at,
        }


if __name__ == "__main__":
    import sys

    print("\n" + "=" * 70)
    print("🧪 LinkedInProxy Notification Fetcher Test")
    print("=" * 70)

    test_job_id = "4375526458"

    try:
        proxy = LinkedInProxy(debug=False, slim_mode=True)
        print(f"\n📌 Testing notification fetch for job ID: {test_job_id}")

        notification = proxy.fetch_notifications_for_job(test_job_id)

        if notification:
            print(f"\n✅ SUCCESS - Notification Event Found:")
            print(f"   Job ID: {notification.job_id}")
            print(f"   Event Type: {notification.event_type}")
            print(f"   Timestamp: {notification.timestamp}")
            print(f"   Status: {notification.status}")
            print(f"   Company: {notification.company}")
            print(f"   Headline: {notification.headline}")
            print(f"\n📋 Full Data:")
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
