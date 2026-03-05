"""
linkedin_proxy.py — Pure LinkedIn HTTP layer.

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


# ──────────────────────────────────────────────────────────────
# Dataclasses (pure data, no ORM)
# ──────────────────────────────────────────────────────────────

@dataclass
class JobPost:
    job_id: str
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    job_url: Optional[str] = None
    applied_at: Optional[str] = None
    posted_at: Optional[str] = None
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


# ──────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────

PREMIUM_ENABLED = True
REQUEST_DELAY_SECONDS = 0.7
LOG = True


def _log(msg: str):
    if LOG:
        print(msg)


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

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


# ──────────────────────────────────────────────────────────────
# RawStringRequest (for SDUI/RSC bodies)
# ──────────────────────────────────────────────────────────────

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


# ──────────────────────────────────────────────────────────────
# PremiumParser
# ──────────────────────────────────────────────────────────────

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


# ──────────────────────────────────────────────────────────────
# LinkedInProxy — the public API
# ──────────────────────────────────────────────────────────────

class LinkedInProxy:
    """
    Pure LinkedIn HTTP proxy. Every method returns dicts or dataclasses.
    No SQL writes. No ORM imports.
    """

    def __init__(self, debug: bool = False, slim_mode: bool = True):
        self.debug = debug
        self.client = LinkedInClient("SavedJobs", slim_mode=slim_mode)
        self.premium_parser = PremiumParser()

        # Load curl configs (read-only DB access via LinkedInClient)
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
        finally:
            db.close()

    # ──────────────────────────────────────────
    # Single-job fetches (your debug building blocks)
    # ──────────────────────────────────────────

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
            return {}

        try:
            d = resp.json()

            applied_at_raw = d.get("applyingInfo", {}).get("appliedAt")
            if applied_at_raw and self.debug:
                dt_utc = ms_to_datetime(applied_at_raw)
                dt_brt = dt_utc.astimezone(timezone(timedelta(hours=-3)))
                _log(f"⏱️ Job {job_id} :: Applied At: {dt_utc} UTC / {dt_brt} BRT")

            company = (
                    d.get("companyDetails", {}).get("company", {}).get("name")
                    or d.get("company", {}).get("name")
                    or d.get("companyName")
                    or d.get("formattedCompanyName")
                    or "Unknown"
            )

            return {
                "title": d.get("title"),
                "company": company,
                "applied_at": ms_to_iso(d.get("applyingInfo", {}).get("appliedAt")),
                "posted_at": ms_to_iso(d.get("listedAt") or d.get("postedAt")),
                "applicants": d.get("applies"),
                "job_state": d.get("jobState"),
                "description_full": d.get("description", {}).get("text"),
                "work_remote_allowed": d.get("workRemoteAllowed"),
                "expire_at": ms_to_iso(d.get("expireAt")),
            }
        except Exception as e:
            _log(f"❌ fetch_job_details({job_id}) parse error: {e}")
            return {}

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

    # ──────────────────────────────────────────
    # Enrichment (combine details + premium)
    # ──────────────────────────────────────────

    def enrich_single_job(self, base_job_dict: Dict[str, Any]) -> JobPost:
        """
        Takes a basic dict (job_id, title, company, ...) and enriches
        with detail + premium fetches. Returns a JobPost dataclass.
        """
        jid = str(base_job_dict["job_id"])

        details = self.fetch_job_details(jid)

        # Preserve company from base if details returned "Unknown"
        if details.get("company") == "Unknown" and base_job_dict.get("company") not in [None, "Unknown"]:
            del details["company"]

        base_job_dict.update(details)

        prem = self.fetch_premium_insights(jid)
        base_job_dict.update(prem)

        # Use premium total if available
        app_tot = base_job_dict.get("applicants_total")
        if isinstance(app_tot, int) and app_tot > 0:
            base_job_dict["applicants"] = app_tot

        time.sleep(REQUEST_DELAY_SECONDS)
        return JobPost.from_dict(base_job_dict)

    # ──────────────────────────────────────────
    # Listing fetches (page-level)
    # ──────────────────────────────────────────

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

        # --- Attempt 1: structured JSON parsing ---
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

        # --- Attempt 2: regex fallback ---
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

        # Enrich each job
        job_objects = []
        should_enrich = stage in ["applied", "saved"]
        for base in all_base_jobs:
            if should_enrich:
                job_objects.append(self.enrich_single_job(base))
            else:
                job_objects.append(JobPost.from_dict(base))

        return JobServiceResponse(count=len(job_objects), stage=stage, jobs=job_objects)

    # ──────────────────────────────────────────
    # Search/resolve helpers (for debug endpoint)
    # ──────────────────────────────────────────

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

    # ──────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────

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
