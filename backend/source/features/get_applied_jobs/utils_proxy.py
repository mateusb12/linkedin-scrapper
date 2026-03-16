import json
import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Iterable, List, Optional, Set

from requests import Session
from source.core.debug_mode import is_debug
from source.features.fetch_curl.linkedin_http_client import LinkedInRequest

# ══════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════

PREMIUM_ENABLED = True
REQUEST_DELAY_SECONDS = 0.7
LOG = True


def log(msg: str):
    if LOG:
        print(msg)


# ══════════════════════════════════════════════════════════════
# DATA CLASSES
# ══════════════════════════════════════════════════════════════

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

    blacklisted: bool = False
    enrichment_skipped: bool = False
    enrichment_skip_reason: Optional[str] = None

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


# ══════════════════════════════════════════════════════════════
# REQUEST CLASSES
# ══════════════════════════════════════════════════════════════

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


# ══════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════

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
    """
    Parse LinkedIn's RSC (React Server Components) stream format.
    Format: ID:DATA where DATA can be JSON, array, or React refs ($L..., I[...], etc.)
    """
    print(f"\n[DEBUG] parse_linkedin_stream input: {len(raw_text)} chars")
    # print(f"[DEBUG] First 300 chars: {raw_text[:300]}")
    parsed_items = []
    for line in raw_text.split("\n"):
        if not line.strip():
            continue
        try:
            if ":" in line and line[0].isalnum():
                _, rest = line.split(":", 1)
                rest = rest.strip()
                if rest.startswith("I[") and rest.endswith("]"):
                    json_content = rest[2:-1]  # Remove I[ and ]
                    if json_content:
                        try:
                            parsed_items.append(json.loads(json_content))
                        except json.JSONDecodeError:
                            pass
                try:
                    parsed_items.append(json.loads(rest))
                except json.JSONDecodeError:
                    if rest and rest[0] in ["$", "L"]:
                        parsed_items.append(rest)
            else:
                try:
                    parsed_items.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
        except Exception:
            continue
    print(f"[DEBUG] parse_linkedin_stream returning: {len(parsed_items)} items")
    return parsed_items


def extract_job_ids_from_stream(raw_text: str) -> Set[str]:
    """
    🔑 PRIMARY JOB ID EXTRACTION via regex.
    Works on LinkedIn's React stream format where JSON parsing alone fails.
    """
    job_ids: Set[str] = set()

    # Pattern 1: "jobId": 4375526458
    for match in re.finditer(r'"jobId"\s*:\s*(\d+)', raw_text):
        job_ids.add(match.group(1))

    # Pattern 2: "jobId": "stringified number"
    for match in re.finditer(r'"jobId"\s*:\s*"(\d+)"', raw_text):
        job_ids.add(match.group(1))

    # Pattern 3: URN format (most reliable)
    for match in re.finditer(r'urn:li:(?:fs_)?jobPosting[":]*(\d+)', raw_text):
        job_ids.add(match.group(1))

    # Pattern 4: State binding keys
    for match in re.finditer(
            r'(?:web_opp_contacts|opportunity_tracker_(?:confirm_hear_back_is_visible|check_back|draft|clicked_apply)|job_notes_show_api)_(\d+)',
            raw_text
    ):
        jid = match.group(1)
        if 8 <= len(jid) <= 10:
            job_ids.add(jid)

    return job_ids


def _walk(obj: Any) -> Iterable[Any]:
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from _walk(v)
    elif isinstance(obj, list):
        for it in obj:
            yield from _walk(it)


def find_job_objects_recursive(data, depth=0) -> list:
    """
    Recursively find job objects with jobId or jobPostingUrn keys.
    SECONDARY: Fallback if JSON parsing succeeds.
    """
    found = []
    # indent = "  " * depth

    if isinstance(data, dict):
        if "jobId" in data or "jobPostingUrn" in data:
            # jid = data.get("jobId")
            # jurn = data.get("jobPostingUrn", "")
            # print(f"{indent}[FIND] ✓ Found job object: jobId={jid}, urn={jurn[:30]}...")
            found.append(data)

        for value in data.values():
            found.extend(find_job_objects_recursive(value, depth + 1))

    elif isinstance(data, list):
        for item in data:
            found.extend(find_job_objects_recursive(item, depth + 1))

    return found


def parse_notification_for_job(data: Dict[str, Any], target_job_id: str) -> Optional[NotificationEvent]:
    """
    Pure parsing function.
    Parse notification response and extract "Application viewed" event for target job ID.
    """
    try:
        elements = data.get("data", {}).get("*elements", [])
        if not elements:
            log("⚠️ No notification elements found")
            return None

        log(f"   Found {len(elements)} notification elements")

        for element_urn in elements:
            if not isinstance(element_urn, str):
                continue

            if "JOB_APPLICATION_VIEWED_V2" not in element_urn:
                continue

            log(f"   ✓ Found JOB_APPLICATION_VIEWED_V2 event in URN")
            # log(f"   URN: {element_urn}")

            included = data.get("included", [])
            card_data = None

            for inc_item in included:
                if isinstance(inc_item, dict):
                    entity_urn = inc_item.get("entityUrn", "")
                    if entity_urn == element_urn:
                        card_data = inc_item
                        log(f"   ✓ Found card data in included")
                        break

            if not card_data:
                log(f"   ⚠️ Card data not found in included, searching by type...")
                for inc_item in included:
                    if isinstance(inc_item, dict):
                        card_type = inc_item.get("$type", "")
                        if "JOB_APPLICATION_VIEWED_V2" in card_type:
                            card_data = inc_item
                            log(f"   ✓ Found card by $type match")
                            break

            if not card_data:
                log(f"   ⚠️ Card data still not found")
                continue

            # log(f"   Card data keys: {list(card_data.keys())}")

            headline = card_data.get("headline", {})
            headline_text = ""
            if isinstance(headline, dict):
                headline_text = headline.get("text", "")
            elif isinstance(headline, str):
                headline_text = headline

            log(f"   Headline: {headline_text}")

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
                log(f"   Job Application ID: {job_app_id}")
            elif object_urn:
                job_app_match = re.search(r"urn:li:jobApplication:(\d+)", object_urn)
                if job_app_match:
                    job_app_id = job_app_match.group(1)
                    log(f"   Job Application ID (from objectUrn): {job_app_id}")

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

        log(f"⚠️ No JOB_APPLICATION_VIEWED_V2 notification found for job {target_job_id}")
        return None

    except Exception as e:
        log(f"❌ parse_notification_for_job error: {e}")
        import traceback
        traceback.print_exc()
        return None


# ══════════════════════════════════════════════════════════════
# PREMIUM INSIGHTS PARSER
# ══════════════════════════════════════════════════════════════

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
