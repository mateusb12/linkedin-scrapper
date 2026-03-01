import json
import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Iterable

import requests
from requests import Session

from database.database_connection import get_db_session
from models.fetch_models import FetchCurl
from source.features.fetch_curl.linkedin_http_client import LinkedInClient, LinkedInRequest


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


# ============================================================
# CONFIG
# ============================================================
PREMIUM_ENABLED = True
REQUEST_DELAY_SECONDS = 0.7
PREMIUM_FAILURE_IS_FATAL = False
PREMIUM_MODE = "curl_pure"
LOG = True


def _log(msg: str):
    if LOG:
        print(msg)


def print_curl_command(method, url, headers, body):
    """
    Imprime o CURL formatado no terminal para debug.
    """
    cmd = f"curl '{url}' \\"
    for k, v in headers.items():
        val = str(v).replace("'", "'\\''")
        cmd += f"\n  -H '{k}: {val}' \\"
    cmd += f"\n  -X {method} \\"
    if body:
        b_safe = str(body).replace("'", "'\\''")
        cmd += f"\n  --data-raw '{b_safe}'"

    print("\n" + "=" * 60)
    print("📢 CURL GERADO PELO PYTHON (Para Comparação):")
    print("=" * 60)
    print(cmd)
    print("=" * 60 + "\n")


# ============================================================
# PARSERS
# ============================================================
def parse_linkedin_stream(raw_text: str) -> list:
    parsed_items = []
    for line in raw_text.split("\n"):
        if not line.strip(): continue
        try:
            if ":" in line and line[0].isalnum():
                _, rest = line.split(":", 1)
                rest = rest.strip()
                if rest.startswith("I["): continue
                parsed_items.append(json.loads(rest))
            else:
                parsed_items.append(json.loads(line))
        except Exception:
            continue
    return parsed_items


def _walk(obj: Any) -> Iterable[Any]:
    if isinstance(obj, dict):
        yield obj
        for v in obj.values(): yield from _walk(v)
    elif isinstance(obj, list):
        for it in obj: yield from _walk(it)


class PremiumParser:
    SENIORITY_RE = re.compile(r"^\s*(\d+)%\s+(.+?)\s+people applied for this job\s*$", re.I)
    PCT_ONLY_RE = re.compile(r"^\s*(\d+)%\s*$")

    @staticmethod
    def _to_int(s: str) -> Optional[int]:
        ss = s.replace(",", "").strip()
        return int(ss) if ss.isdigit() else None

    @staticmethod
    def _normalize_space(s: str) -> str:
        return re.sub(r"\s+", " ", s or "").strip()

    def _collect_text_tokens(self, items: List[Any]) -> List[str]:
        tokens: List[str] = []
        for it in items:
            for node in _walk(it):
                if isinstance(node, dict):
                    ch = node.get("children")
                    if isinstance(ch, list):
                        if len(ch) == 1 and isinstance(ch[0], str):
                            s = self._normalize_space(ch[0])
                            if s: tokens.append(s)
                        else:
                            for x in ch:
                                if isinstance(x, str):
                                    s = self._normalize_space(x)
                                    if s: tokens.append(s)
                elif isinstance(node, list):
                    for x in node:
                        if isinstance(x, str):
                            s = self._normalize_space(x)
                            if s: tokens.append(s)
        seen = set()
        uniq = []
        for t in tokens:
            if t in seen: continue
            seen.add(t)
            uniq.append(t)
        return uniq

    def _extract_metrics(self, text_tokens: List[str]) -> Dict[str, Any]:
        applicants_total = None
        applicants_last_24h = None
        seniority_distribution = []
        education_distribution = []

        for i, tok in enumerate(text_tokens):
            if tok == "Applicants" and i - 1 >= 0:
                v = self._to_int(text_tokens[i - 1])
                if v is not None: applicants_total = v
            if tok == "Applicants in the past day" and i - 1 >= 0:
                v = self._to_int(text_tokens[i - 1])
                if v is not None: applicants_last_24h = v

        for tok in text_tokens:
            m = self.SENIORITY_RE.match(tok)
            if m:
                seniority_distribution.append({"label": self._normalize_space(m.group(2)), "value": int(m.group(1))})

        for i, tok in enumerate(text_tokens):
            m = self.PCT_ONLY_RE.match(tok)
            if not m: continue
            nxt = text_tokens[i + 1] if i + 1 < len(text_tokens) else ""
            if nxt.lower().startswith("have "):
                education_distribution.append({"label": nxt, "value": int(m.group(1))})

        return {
            "applicants_total": applicants_total,
            "applicants_last_24h": applicants_last_24h,
            "seniority_distribution": seniority_distribution,
            "education_distribution": education_distribution,
        }

    def _extract_copy_blocks(self, text_tokens: List[str]) -> Dict[str, Any]:
        title_c, desc_c = [], []
        for t in text_tokens:
            if "Insights about" in t and "applicants" in t: title_c.append(t)
            if "Here’s where you can see" in t or "Here's where you can see" in t: desc_c.append(t)
        return {"premium_title": title_c[0] if title_c else None, "premium_description": desc_c[0] if desc_c else None}

    def _extract_urls_and_ids(self, items: List[Any]) -> Dict[str, Any]:
        out = {"learn_more_url": None, "data_sdui_components": []}
        comp_seen = set()
        for it in items:
            for node in _walk(it):
                if not isinstance(node, dict): continue
                comp = node.get("data-sdui-component")
                if isinstance(comp, str) and comp and comp not in comp_seen:
                    comp_seen.add(comp)
                    out["data_sdui_components"].append(comp)
                url = node.get("url")
                if isinstance(url, str) and "help" in url and "linkedin.com" in url and not out["learn_more_url"]:
                    out["learn_more_url"] = url
        return out

    def parse(self, raw_text: str) -> Dict[str, Any]:
        items = parse_linkedin_stream(raw_text)
        tokens = self._collect_text_tokens(items)
        meta = self._extract_urls_and_ids(items)
        metrics = self._extract_metrics(tokens)
        copy = self._extract_copy_blocks(tokens)
        return {
            **metrics, **copy, **meta,
            "premium_component_found": any(
                "premiumApplicantInsights" in c for c in meta.get("data_sdui_components", []))
        }


def ms_to_datetime(ms):
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc)
    except:
        return None


def find_job_objects_recursive(data):
    found = []
    if isinstance(data, dict):
        if "jobId" in data or "jobPostingUrn" in data: found.append(data)
        for value in data.values(): found.extend(find_job_objects_recursive(value))
    elif isinstance(data, list):
        for item in data: found.extend(find_job_objects_recursive(item))
    return found


# ============================================================
# RAW REQUEST WRAPPER
# ============================================================
class RawStringRequest(LinkedInRequest):
    def __init__(self, method: str, url: str, body_str: str, headers: dict = None, debug: bool = False,
                 clean_headers: bool = False):
        super().__init__(method, url, debug=debug)
        self.body_str = body_str
        self.clean_headers = clean_headers
        if headers:
            for k, v in headers.items(): self._headers[k] = v

    def execute(self, session: Session, timeout=20):
        if self.clean_headers:
            final_headers = self._headers.copy()
        else:
            final_headers = session.headers.copy()
            for k, v in self._headers.items():
                if k.lower() in ["accept-encoding", "content-length"]: continue
                final_headers[k] = v

        # 🔥 AQUI ESTÁ O PRINT PARA VOCÊ CONFERIR 🔥
        if self.debug or LOG:
            print_curl_command(self.method, self.url, final_headers, self.body_str)

        return session.request(
            method=self.method, url=self.url, headers=final_headers,
            data=self.body_str if self.body_str else None, timeout=timeout,
        )


# ============================================================
# FETCHER
# ============================================================
class JobTrackerFetcher:
    def __init__(self, debug: bool = False):
        self.debug = debug
        self.client = LinkedInClient("SavedJobs")
        self.premium_parser = PremiumParser()

        db = get_db_session()
        try:
            record_saved = db.query(FetchCurl).filter(FetchCurl.name == "SavedJobs").first()
            if not record_saved: raise ValueError("SavedJobs missing")
            self.saved_url = record_saved.base_url
            self.saved_method = record_saved.method or "POST"
            self.saved_body = record_saved.body or ""

            # Premium
            self.premium_url = ""
            self.premium_headers = {}
            rec_prem = db.query(FetchCurl).filter(FetchCurl.name == "PremiumInsights").first()
            if rec_prem:
                self.premium_url = rec_prem.base_url
                self.premium_method = rec_prem.method
                self.premium_body = rec_prem.body
                self.premium_headers = json.loads(rec_prem.headers) if rec_prem.headers else {}
        finally:
            db.close()

    def fetch_job_details(self, job_id: str) -> Dict[str, Any]:
        session = self.client.session
        csrf = session.headers.get("csrf-token")
        for c in session.cookies:
            if c.name == "JSESSIONID": csrf = c.value.replace('"', ""); break

        url = f"https://www.linkedin.com/voyager/api/jobs/jobPostings/{job_id}"
        resp = session.get(url, headers={"csrf-token": csrf, "accept": "application/json"}, timeout=20)
        if resp.status_code != 200: return {}
        try:
            d = resp.json()
            return {
                "title": d.get("title"),
                "company": d.get("companyDetails", {}).get("company", {}).get("name") or d.get(
                    "companyName") or "Unknown",
                "posted_at": (ms_to_datetime(d.get("listedAt") or d.get("postedAt")) or datetime.now()).isoformat(),
                "applicants": d.get("applies"),
                "job_state": d.get("jobState"),
                "description_full": d.get("description", {}).get("text"),
                "work_remote_allowed": d.get("workRemoteAllowed"),
                "expire_at": ms_to_datetime(d.get("expireAt")).isoformat() if d.get("expireAt") else None
            }
        except:
            return {}

    def fetch_premium_insights(self, job_id: str):
        if not PREMIUM_ENABLED or not self.premium_url: return {}
        body = re.sub(r'("jobId"\s*:\s*)("\d+"|\d+)', f'\\1"{job_id}"', self.premium_body)
        h = self.premium_headers.copy()
        h["Referer"] = f"https://www.linkedin.com/jobs/view/{job_id}/"
        try:
            if PREMIUM_MODE == "curl_pure":
                r = requests.request(self.premium_method, self.premium_url, headers=h, data=body, timeout=20)
            else:
                r = self.client.execute(
                    RawStringRequest(self.premium_method, self.premium_url, body, h, clean_headers=True))
            return self.premium_parser.parse(r.text) if r.status_code == 200 else {}
        except Exception as e:
            _log(f"⚠️ Premium Error: {e}")
            return {}

    def _enrich_job(self, job):
        app_tot = job.get("applicants_total")
        if isinstance(app_tot, int) and app_tot > 0: job["applicants"] = app_tot
        return job

    # ----------------------------------------------------------
    # PREPARE BODY: REPLICA O COMPORTAMENTO DO BROWSER + BOOST
    # ----------------------------------------------------------
    def _prepare_body(self, base_body_str: str, page_index: int) -> str:
        try:
            data = json.loads(base_body_str)

            ra = data.get("requestedArguments")
            if isinstance(ra, dict):
                payload = ra.get("payload")
                if isinstance(payload, dict):
                    payload["cacheId"] = str(uuid.uuid4())
                    # NÃO force 100 agora. Primeiro faça paginação funcionar.
                    # payload["count"] = payload.get("count", "10")

                states = ra.get("states")
                if isinstance(states, list):
                    for st in states:
                        if st.get("key") == "opportunity_tracker_current_page_saved" and st.get(
                                "namespace") == "MemoryNamespace":
                            st["value"] = page_index

            return json.dumps(data)
        except Exception as e:
            _log(f"⚠️ Erro no body: {e}")
            return base_body_str

    # ----------------------------------------------------------
    # FETCH JOBS
    # ----------------------------------------------------------
    def fetch_jobs(self, stage: str = "saved") -> JobServiceResponse:
        is_pagination_enabled = (stage == "saved")

        # Paginação baseada em INDEX (0, 1, 2)
        page_index = 0
        max_pages = 20
        all_raw_job_data = []
        global_seen_ids = set()

        while True:
            _log(f"\n🔄 Fetching {stage} - Page Index: {page_index} (Pedindo 100 itens)")

            target_url = self.saved_url
            target_body = self.saved_body

            if stage != "saved":
                target_url = target_url.replace("stage=saved", f"stage={stage}")
                if target_body: target_body = target_body.replace('"stage":"saved"', f'"stage":"{stage}"')

            # Prepara body com UUID fresco, Page Index E count=100
            if is_pagination_enabled:
                target_body = self._prepare_body(target_body, page_index)

            req = RawStringRequest(self.saved_method, target_url, target_body, clean_headers=False)
            req._headers["x-li-initial-url"] = f"/jobs-tracker/?stage={stage}"

            # Executa
            response = self.client.execute(req)

            if response.status_code != 200:
                _log(f"⚠️ Erro: {response.status_code}")
                break

            stream_items = parse_linkedin_stream(response.text)
            page_candidates = []
            for item in stream_items:
                page_candidates.extend(find_job_objects_recursive(item))

            items_in_this_page = 0
            new_unique_items = 0

            for job in page_candidates:
                jid = job.get("jobId")
                if not jid: continue
                items_in_this_page += 1
                if jid not in global_seen_ids:
                    global_seen_ids.add(jid)
                    all_raw_job_data.append(job)
                    new_unique_items += 1

            _log(f"   -> Itens na página: {items_in_this_page} | Novos: {new_unique_items}")

            if not is_pagination_enabled: break

            # Se vieram 0 novos, acabou.
            if new_unique_items == 0:
                _log("   -> Fim (0 novos).")
                break

            # Se pedimos 100 e vieram menos que 100, é a última.
            # Como você tem 13, virão 13 novos e vai parar na próxima volta.
            if new_unique_items < 100 and page_index > 0:
                break

            if page_index >= max_pages: break

            page_index += 1
            time.sleep(1.0)

        _log(f"✅ Total Capturado: {len(all_raw_job_data)}")

        job_objects = []
        for job_data in all_raw_job_data:
            job_id_str = str(job_data.get("jobId"))

            # Base data
            c_job = {
                "job_id": job_id_str,
                "title": job_data.get("title"),
                "company": job_data.get("companyName"),
                "location": job_data.get("formattedLocation"),
                "job_url": f"https://www.linkedin.com/jobs/view/{job_id_str}/",
            }

            # Dates
            posted_at = (job_data.get("listedAt") or job_data.get("formattedPostedDate") or job_data.get("postedAt"))
            if isinstance(posted_at, (int, float)):
                dt = ms_to_datetime(posted_at)
                if dt: posted_at = dt.isoformat()
            c_job["posted_at"] = posted_at

            # Details & Premium
            if stage in ["applied", "saved"]:
                details = self.fetch_job_details(job_id_str)
                c_job.update(details)

                prem = self.fetch_premium_insights(job_id_str)
                c_job.update(prem)
                c_job = self._enrich_job(c_job)
                time.sleep(REQUEST_DELAY_SECONDS)

            job_objects.append(JobPost.from_dict(c_job))

        return JobServiceResponse(count=len(job_objects), stage=stage, jobs=job_objects)

    def save_results(self, response_data):
        from database.database_connection import get_db_session
        from models.job_models import Job, Company
        db = get_db_session()
        try:
            for j in response_data.jobs:
                c_name = j.company or "Unknown"
                comp = db.query(Company).filter(Company.name == c_name).first()
                if not comp:
                    comp = Company(urn=f"urn:li:company:{uuid.uuid4()}", name=c_name)
                    db.add(comp);
                    db.flush()

                job = db.query(Job).filter(Job.urn == j.job_id).first()
                if not job: job = Job(urn=j.job_id)
                db.add(job)

                job.title = j.title
                job.company_urn = comp.urn
                job.location = j.location
                job.description_full = j.description_full
                job.applicants = j.applicants
                job.premium_description = j.premium_description
            db.commit()
        except Exception as e:
            db.rollback();
            _log(f"Save error: {e}")
        finally:
            db.close()
