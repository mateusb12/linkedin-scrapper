# /home/mateus/Desktop/Javascript/linkedin-scrapper/backend/source/features/get_applied_jobs/new_get_applied_jobs_service.py

import json
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Iterable, Tuple

import requests
from requests import Session

from database.database_connection import get_db_session
from models.fetch_models import FetchCurl
from source.features.fetch_curl.linkedin_http_client import LinkedInClient, LinkedInRequest


@dataclass
class DemographicMetric:
    """Helper for seniority and education distributions."""
    label: str
    value: int


@dataclass
class JobPost:
    # --- 1. Basic Identification ---
    job_id: str
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    job_url: Optional[str] = None

    # --- 2. Voyager Details (Applied Info) ---
    applied_at: Optional[str] = None  # ISO8601 String
    job_state: Optional[str] = None  # e.g., "LISTED", "CLOSED"
    expire_at: Optional[str] = None
    experience_level: Optional[str] = None
    employment_status: Optional[str] = None
    application_closed: Optional[bool] = None
    work_remote_allowed: Optional[bool] = None
    description_full: Optional[str] = None

    # --- 3. Derived Metrics (Enrichment) ---
    applicants: Optional[int] = 0
    competition_level: Optional[str] = None  # "HIGH", "MEDIUM", "LOW"
    applicants_velocity_24h: Optional[int] = None

    # --- 4. Premium Insights (Raw Data) ---
    applicants_total: Optional[int] = None
    applicants_last_24h: Optional[int] = None
    premium_title: Optional[str] = None
    premium_description: Optional[str] = None
    learn_more_url: Optional[str] = None

    # Complex Types (Lists)
    seniority_distribution: List[Dict[str, Any]] = field(default_factory=list)
    education_distribution: List[Dict[str, Any]] = field(default_factory=list)

    # Internal / Debug flags
    premium_component_found: bool = False

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "JobPost":
        """
        Safely creates a JobPost instance from a dictionary.
        Ignores keys in 'data' that are not defined in the dataclass fields
        (prevents crashes when the scraper adds new temp metadata).
        """
        # Get all valid field names for this dataclass
        valid_fields = {f.name for f in cls.__dataclass_fields__.values()}

        # Filter the input dictionary to only include valid fields
        clean_data = {k: v for k, v in data.items() if k in valid_fields}

        return cls(**clean_data)


@dataclass
class JobServiceResponse:
    """Final output structure for the endpoint."""
    count: int
    stage: str
    jobs: List[JobPost]


# ============================================================
# CONFIG (clean + low-noise)
# ============================================================

# Liga/desliga premium (mantém API estável)
PREMIUM_ENABLED = True

# Tempo entre vagas (evitar spam)
REQUEST_DELAY_SECONDS = 0.7

# Se Premium falhar, NÃO derruba o endpoint
PREMIUM_FAILURE_IS_FATAL = False

# Modo de request premium:
# - "curl_pure": usa requests.request direto com headers/cookies do DB (replica seu curl)
# - "session": usa self.client.session (cookiejar)
PREMIUM_MODE = "curl_pure"  # "curl_pure" é o que você comprovou que funciona

# Log minimal
LOG = True


def _log(msg: str):
    if LOG:
        print(msg)


# ============================================================
# STREAM PARSER (LinkedIn RSC / SDUI stream)
# ============================================================

def parse_linkedin_stream(raw_text: str) -> list:
    """
    LinkedIn RSC/SDUI stream vem em "linhas" tipo:
      1:I["..."]
      0:["$","div",...]
    A gente ignora as linhas I[...] e tenta json.loads no resto.
    """
    parsed_items = []
    for line in raw_text.split("\n"):
        if not line.strip():
            continue
        try:
            # linhas com prefixo "123:" (muito comum)
            if ":" in line and line[0].isalnum():
                _, rest = line.split(":", 1)
                rest = rest.strip()
                # ignora o "I[...]" (tabela de referências do RSC)
                if rest.startswith("I["):
                    continue
                parsed_items.append(json.loads(rest))
            else:
                parsed_items.append(json.loads(line))
        except Exception:
            continue
    return parsed_items


def _walk(obj: Any) -> Iterable[Any]:
    """DFS em dict/list."""
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from _walk(v)
    elif isinstance(obj, list):
        for it in obj:
            yield from _walk(it)


# ============================================================
# PREMIUM PARSER (advanced extraction)
# ============================================================

class PremiumParser:
    """
    Objetivo:
      - Extrair o máximo possível de info útil do componente premiumApplicantInsights
      - Sem desperdiçar tokens do stream
      - Retornar um dict pronto pra job.update()

    O stream contém muita estrutura React/SDUI. Estratégia:
      1) Parsear stream (json objects)
      2) Caminhar coletando:
         - tokens de texto (strings em children)
         - URLs/props relevantes
         - linhas que representam percentuais (educação/senioridade)
      3) Derivar métricas:
         - applicants_total
         - applicants_last_24h
         - seniority_distribution (% + label)
         - education_distribution (% + label)
      4) Capturar “extras”:
         - titles/descrições do card
         - learn_more_url
         - metadados (component ids, observabilityIdentifier, tracking ids se aparecerem)
    """

    SENIORITY_RE = re.compile(r"^\s*(\d+)%\s+(.+?)\s+people applied for this job\s*$", re.I)
    PCT_ONLY_RE = re.compile(r"^\s*(\d+)%\s*$")

    def __init__(self):
        pass

    @staticmethod
    def _to_int(s: str) -> Optional[int]:
        ss = s.replace(",", "").strip()
        return int(ss) if ss.isdigit() else None

    @staticmethod
    def _normalize_space(s: str) -> str:
        return re.sub(r"\s+", " ", s or "").strip()

    def _collect_text_tokens(self, items: List[Any]) -> List[str]:
        """
        Coleta strings que aparecem como:
          {"children": ["text aqui"]}
        E também strings soltas em listas (às vezes aparecem).
        """
        tokens: List[str] = []

        for it in items:
            for node in _walk(it):
                if isinstance(node, dict):
                    ch = node.get("children")
                    if isinstance(ch, list):
                        # Caso comum: ["texto"]
                        if len(ch) == 1 and isinstance(ch[0], str):
                            s = self._normalize_space(ch[0])
                            if s:
                                tokens.append(s)
                        else:
                            # às vezes tem strings misturadas
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

        # remove duplicatas preservando ordem
        seen = set()
        uniq = []
        for t in tokens:
            if t in seen:
                continue
            seen.add(t)
            uniq.append(t)
        return uniq

    def _extract_urls_and_ids(self, items: List[Any]) -> Dict[str, Any]:
        """
        Pega URLs úteis e alguns ids/identificadores.
        Não explode tudo: só o que costuma ser útil.
        """
        out: Dict[str, Any] = {
            "learn_more_url": None,
            "observability_identifiers": [],
            "data_sdui_components": [],
        }

        obs_seen = set()
        comp_seen = set()

        for it in items:
            for node in _walk(it):
                if not isinstance(node, dict):
                    continue

                # componente SDUI
                comp = node.get("data-sdui-component")
                if isinstance(comp, str) and comp and comp not in comp_seen:
                    comp_seen.add(comp)
                    out["data_sdui_components"].append(comp)

                # observability
                obs = node.get("observabilityIdentifier")
                if isinstance(obs, str) and obs and obs not in obs_seen:
                    obs_seen.add(obs)
                    out["observability_identifiers"].append(obs)

                # links (normalmente aparecem em NavigateToUrl url)
                url = node.get("url")
                if isinstance(url, str) and url.startswith("http"):
                    # tenta pegar o link "Learn more" (geralmente help.linkedin.com)
                    if out["learn_more_url"] is None and "help" in url and "linkedin.com" in url:
                        out["learn_more_url"] = url

        return out

    def _extract_metrics(self, text_tokens: List[str]) -> Dict[str, Any]:
        applicants_total = None
        applicants_last_24h = None
        seniority_distribution: List[Dict[str, Any]] = []
        education_distribution: List[Dict[str, Any]] = []

        # Heurística 1: "892" + "Applicants"
        # Heurística 2: "57" + "Applicants in the past day"
        for i, tok in enumerate(text_tokens):
            if tok == "Applicants" and i - 1 >= 0:
                v = self._to_int(text_tokens[i - 1])
                if v is not None:
                    applicants_total = v
            if tok == "Applicants in the past day" and i - 1 >= 0:
                v = self._to_int(text_tokens[i - 1])
                if v is not None:
                    applicants_last_24h = v

        # Seniority: "77% Entry level people applied for this job"
        for tok in text_tokens:
            m = self.SENIORITY_RE.match(tok)
            if m:
                pct = int(m.group(1))
                label = self._normalize_space(m.group(2))
                seniority_distribution.append({"label": label, "value": pct})

        # Education: geralmente vem como:
        #  "37%" + "have a Bachelor's Degree (Similar to you)"
        for i, tok in enumerate(text_tokens):
            m = self.PCT_ONLY_RE.match(tok)
            if not m:
                continue
            pct = int(m.group(1))
            nxt = text_tokens[i + 1] if i + 1 < len(text_tokens) else ""
            if nxt.lower().startswith("have "):
                education_distribution.append({"label": nxt, "value": pct})

        return {
            "applicants_total": applicants_total,
            "applicants_last_24h": applicants_last_24h,
            "seniority_distribution": seniority_distribution,
            "education_distribution": education_distribution,
        }

    def _extract_copy_blocks(self, text_tokens: List[str]) -> Dict[str, Any]:
        """
        Captura textos “humanos” úteis (título e descrição do card),
        sem trazer o stream inteiro.
        """
        # Exemplos observados:
        # - "Insights about this job’s applicants"
        # - "Here’s where you can see if this job is a good fit for you ..."
        title_candidates = []
        desc_candidates = []

        for t in text_tokens:
            if "Insights about" in t and "applicants" in t:
                title_candidates.append(t)
            if "Here’s where you can see" in t or "Here's where you can see" in t:
                desc_candidates.append(t)

        return {
            "premium_title": title_candidates[0] if title_candidates else None,
            "premium_description": desc_candidates[0] if desc_candidates else None,
        }

    def parse(self, raw_text: str) -> Dict[str, Any]:
        items = parse_linkedin_stream(raw_text)

        text_tokens = self._collect_text_tokens(items)
        meta = self._extract_urls_and_ids(items)
        metrics = self._extract_metrics(text_tokens)
        copy = self._extract_copy_blocks(text_tokens)

        # “não desperdiçar info”: devolve um pacote rico mas controlado
        return {
            **metrics,
            **copy,
            **meta,
            "premium_component_found": any(
                c == "com.linkedin.sdui.generated.premium.dsl.impl.premiumApplicantInsights"
                for c in meta.get("data_sdui_components", [])
            ),
        }


# ============================================================
# UTIL
# ============================================================

def ms_to_datetime(ms):
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc)
    except Exception:
        return None


def find_job_objects_recursive(data):
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


# ============================================================
# RAW REQUEST WRAPPER
# ============================================================

class RawStringRequest(LinkedInRequest):
    def __init__(
            self,
            method: str,
            url: str,
            body_str: str,
            headers: dict = None,
            debug: bool = False,
            clean_headers: bool = False,
    ):
        super().__init__(method, url, debug=debug)
        self.body_str = body_str
        self.clean_headers = clean_headers

        if headers:
            for k, v in headers.items():
                self._headers[k] = v

    def execute(self, session: Session, timeout=20):
        # Headers finais
        if self.clean_headers:
            final_headers = self._headers.copy()
        else:
            final_headers = session.headers.copy()
            for k, v in self._headers.items():
                if k.lower() in ["accept-encoding", "content-length"]:
                    continue
                final_headers[k] = v

        return session.request(
            method=self.method,
            url=self.url,
            headers=final_headers,
            data=self.body_str if self.body_str else None,
            timeout=timeout,
        )


# ============================================================
# FETCHER
# ============================================================

class JobTrackerFetcher:
    def __init__(self, debug: bool = False):
        self.debug = debug
        self.client = LinkedInClient("SavedJobs")
        self.premium_parser = PremiumParser()

        if not self.client.config:
            raise ValueError("Configuração 'SavedJobs' não encontrada no DB.")

        db = get_db_session()
        try:
            record_saved = db.query(FetchCurl).filter(FetchCurl.name == "SavedJobs").first()
            if not record_saved:
                raise ValueError("Registro 'SavedJobs' não existe.")

            self.saved_url = record_saved.base_url
            self.saved_method = record_saved.method or "POST"
            self.saved_body = record_saved.body or ""

            record_premium = db.query(FetchCurl).filter(FetchCurl.name == "PremiumInsights").first()
            if not record_premium:
                raise ValueError("Registro 'PremiumInsights' não existe.")

            self.premium_url = record_premium.base_url
            self.premium_method = record_premium.method or "POST"
            self.premium_body = record_premium.body or ""
            self.premium_headers = json.loads(record_premium.headers) if record_premium.headers else {}

        finally:
            db.close()

    # ----------------------------------------------------------
    # VOYAGER DETAILS (robusto e útil)
    # ----------------------------------------------------------
    def fetch_job_details(self, job_id: str) -> Dict[str, Any]:
        session = self.client.session

        # 1. Gestão de Cookies (Mantém o fix anterior)
        csrf = None
        for cookie in session.cookies:
            if cookie.name == "JSESSIONID":
                csrf = cookie.value.replace('"', "")
                break
        if not csrf:
            csrf = session.headers.get("csrf-token")

        url = f"https://www.linkedin.com/voyager/api/jobs/jobPostings/{job_id}"
        headers = {
            "accept": "application/json",
            "x-restli-protocol-version": "2.0.0",
            "csrf-token": csrf,
        }

        resp = session.get(url, headers=headers, timeout=20)
        if resp.status_code != 200:
            return {}

        try:
            data = resp.json()
            applying_info = data.get("applyingInfo", {})
            description_text = data.get("description", {}).get("text")

            applied_at = applying_info.get("appliedAt")
            applied_dt = ms_to_datetime(applied_at) if applied_at else None

            expire_at = data.get("expireAt")
            expire_dt = ms_to_datetime(expire_at) if expire_at else None

            # --- EXTRAÇÃO DE DADOS (IMPEDINDO "UNKNOWN") ---

            # 1. Título (Geralmente seguro na raiz)
            voyager_title = data.get("title")

            # 2. Empresa (Lógica de 3 Níveis)
            voyager_company = None

            # Nível A: Tenta pegar direto do nome da empresa (Vagas Onsite)
            company_details = data.get("companyDetails", {})
            c_obj = company_details.get("company", {})
            # Às vezes 'company' é um dict com 'name', às vezes é só uma string URN.
            if isinstance(c_obj, dict):
                voyager_company = c_obj.get("name")
            elif data.get("companyName"):
                voyager_company = data.get("companyName")

            # Nível B: Regex no texto de intro (Vagas Offsite/ATS)
            # Padrão: "... role at {Company}, and ..."
            if not voyager_company:
                intro_text = data.get("videoIntroSetupText", "")
                if intro_text and "role at " in intro_text:
                    try:
                        # Pega o que está entre "role at " e a vírgula ou " and"
                        start = intro_text.find("role at ") + 8
                        end = intro_text.find(",", start)
                        if end == -1: end = intro_text.find(" and", start)

                        if end > start:
                            extracted = intro_text[start:end].strip()
                            if len(extracted) < 50:  # Evita pegar frases inteiras por erro
                                voyager_company = extracted
                    except:
                        pass

            # Nível C: Domínio de Origem (Último recurso)
            if not voyager_company:
                voyager_company = data.get("sourceDomain")  # ex: metaltoad.bamboohr.com

            # Fallback final
            if not voyager_company:
                voyager_company = "Unknown Company"

            return {
                "title": voyager_title,
                "company": voyager_company,
                "applied_at": applied_dt.isoformat() if applied_dt else None,
                "applicants": data.get("applies"),
                "job_state": data.get("jobState"),
                "expire_at": expire_dt.isoformat() if expire_dt else None,
                "experience_level": data.get("formattedExperienceLevel") or "",
                "employment_status": data.get("formattedEmploymentStatus") or data.get("employmentStatus"),
                "application_closed": applying_info.get("closed"),
                "work_remote_allowed": data.get("workRemoteAllowed"),
                "description_full": description_text,
            }
        except Exception as e:
            _log(f"⚠️ Erro ao parsear detalhes da vaga {job_id}: {e}")
            return {}

    # ----------------------------------------------------------
    # PREMIUM INSIGHTS (clean + advanced parse)
    # ----------------------------------------------------------
    def _build_premium_body(self, job_id: str) -> str:
        return re.sub(
            r'("jobId"\s*:\s*)("\d+"|\d+)',
            f'\\1"{job_id}"',
            self.premium_body
        )

    def _premium_headers_for_job(self, job_id: str) -> Dict[str, str]:
        h = dict(self.premium_headers or {})
        h["Referer"] = f"https://www.linkedin.com/jobs/view/{job_id}/"

        # garante charset
        ct = h.get("Content-Type") or h.get("content-type") or "application/json"
        if "charset" not in ct.lower():
            h["Content-Type"] = "application/json; charset=utf-8"

        return h

    def fetch_premium_insights(self, job_id: str) -> Dict[str, Any]:
        if not PREMIUM_ENABLED:
            return {}

        body = self._build_premium_body(job_id)
        headers = self._premium_headers_for_job(job_id)

        try:
            if PREMIUM_MODE == "curl_pure":
                resp = requests.request(
                    method=self.premium_method,
                    url=self.premium_url,
                    headers=headers,
                    data=body,
                    timeout=20,
                )
            else:
                # fallback: usa session (cookiejar)
                req = RawStringRequest(
                    method=self.premium_method,
                    url=self.premium_url,
                    body_str=body,
                    headers=headers,
                    clean_headers=True,
                )
                resp = self.client.execute(req)

            if resp.status_code != 200:
                # sem barulho, sem derrubar tudo
                if PREMIUM_FAILURE_IS_FATAL:
                    raise Exception(f"PremiumInsights HTTP {resp.status_code}")
                return {}

            # importante: usar resp.text (requests já tenta decodificar o br via urllib3/brotli libs se tiver)
            raw_text = resp.text
            parsed = self.premium_parser.parse(raw_text)

            # enrichment extra: deixar alguns metadados úteis (sem guardar raw enorme)
            parsed["_premium_http"] = {
                "status": resp.status_code,
                "content_encoding": resp.headers.get("content-encoding"),
                "content_type": resp.headers.get("content-type"),
                "size_chars": len(raw_text),
            }

            return parsed

        except Exception as e:
            if PREMIUM_FAILURE_IS_FATAL:
                raise
            _log(f"⚠️ PremiumInsights failed for job {job_id}: {e}")
            return {}

    # ----------------------------------------------------------
    # ENRICHMENT
    # ----------------------------------------------------------
    @staticmethod
    def _enrich_job(job: Dict[str, Any]) -> Dict[str, Any]:
        """
        Faz merge inteligente:
          - se premium trouxe applicants_total, usa como applicants
          - mantém applicants_last_24h
          - pode derivar "competition_level" simples
        """
        applicants_total = job.get("applicants_total")
        applicants_last_24h = job.get("applicants_last_24h")

        # applicants do voyager às vezes vem 0 (ou None). premium é a fonte real nesse caso.
        if isinstance(applicants_total, int) and applicants_total > 0:
            if not isinstance(job.get("applicants"), int) or job.get("applicants") in (None, 0):
                job["applicants"] = applicants_total

        # um sinal simples de “competitividade”
        if isinstance(applicants_total, int):
            if applicants_total >= 500:
                job["competition_level"] = "HIGH"
            elif applicants_total >= 200:
                job["competition_level"] = "MEDIUM"
            elif applicants_total >= 1:
                job["competition_level"] = "LOW"
            else:
                job["competition_level"] = None

        # “velocity” (candidatos/dia) se last_24h existe
        if isinstance(applicants_last_24h, int) and applicants_last_24h >= 0:
            job["applicants_velocity_24h"] = applicants_last_24h

        return job

    # ----------------------------------------------------------
    # FETCH JOB LIST
    # ----------------------------------------------------------
    def fetch_jobs(self, stage: str = "saved") -> JobServiceResponse:
        """
        Fetches jobs, enriches them with details/premium data,
        and returns a strictly typed JobServiceResponse.
        """
        # 1. Prepare Request
        target_url = self.saved_url
        target_body = self.saved_body

        if stage != "saved":
            # Adjust URL/Body for 'applied', 'archived', etc.
            target_url = target_url.replace("stage=saved", f"stage={stage}")
            if target_body:
                target_body = target_body.replace('"stage":"saved"', f'"stage":"{stage}"')

        # 2. Execute Base List Request
        req = RawStringRequest(self.saved_method, target_url, target_body, clean_headers=False)
        response = self.client.execute(req)

        if response.status_code != 200:
            raise Exception(f"Erro LinkedIn (Listagem): {response.status_code}")

        # 3. Parse Stream & Extract IDs
        stream_items = parse_linkedin_stream(response.text)

        all_candidates = []
        for item in stream_items:
            all_candidates.extend(find_job_objects_recursive(item))

        # 4. Deduplicate
        clean_jobs_data = []
        seen_ids = set()
        for data in all_candidates:
            raw_id = data.get("jobId")
            if not raw_id or raw_id in seen_ids:
                continue
            seen_ids.add(raw_id)
            clean_jobs_data.append(data)

        # 5. Build Typed Result List
        job_objects: List[JobPost] = []

        for job_data in clean_jobs_data:
            job_id_str = str(job_data.get("jobId"))

            # A. Base Data
            # We map the raw LinkedIn keys to our clean Dataclass keys
            current_job_dict = {
                "job_id": job_id_str,
                "title": job_data.get("title"),
                "company": job_data.get("companyName"),
                "location": job_data.get("formattedLocation"),
                "job_url": f"https://www.linkedin.com/jobs/view/{job_id_str}/",
            }

            # B. If 'applied', fetch deep details
            if stage == "applied":
                # 1. Voyager Details (Description, State, Applied Date)
                details = self.fetch_job_details(job_id_str)

                if not current_job_dict.get("title") and details.get("title"):
                    current_job_dict["title"] = details["title"]

                if not current_job_dict.get("company") and details.get("company"):
                    current_job_dict["company"] = details["company"]

                current_job_dict.update(details)

                # 2. Premium Insights (Applicants, Seniority)
                premium = self.fetch_premium_insights(job_id_str)
                current_job_dict.update(premium)

                # 3. Enrich (Calculate competition, velocity)
                current_job_dict = self._enrich_job(current_job_dict)

                # Sleep to be kind to the API
                time.sleep(REQUEST_DELAY_SECONDS)

            # C. Convert Dictionary -> Dataclass
            # This safely filters out any junk keys (like internal logs)
            job_obj = JobPost.from_dict(current_job_dict)
            job_objects.append(job_obj)

        # 6. Return Structured Response
        return JobServiceResponse(
            count=len(job_objects),
            stage=stage,
            jobs=job_objects
        )
