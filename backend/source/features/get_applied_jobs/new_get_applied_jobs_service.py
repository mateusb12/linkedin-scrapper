# /home/mateus/Desktop/Javascript/linkedin-scrapper/backend/source/features/get_applied_jobs/new_get_applied_jobs_service.py

import json
import re
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Iterable, Tuple

import requests
from requests import Session

from database.database_connection import get_db_session
from models.fetch_models import FetchCurl
from source.features.fetch_curl.linkedin_http_client import LinkedInClient, LinkedInRequest

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

        csrf = session.cookies.get("JSESSIONID")
        if csrf:
            csrf = csrf.replace('"', "")

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

            return {
                "applied_at": applied_dt.isoformat() if applied_dt else None,
                "applicants": data.get("applies"),
                "job_state": data.get("jobState"),
                "expire_at": expire_dt.isoformat() if expire_dt else None,
                "experience_level": data.get("formattedExperienceLevel") or "",
                "employment_status": data.get("employmentStatus"),
                "application_closed": applying_info.get("closed"),
                "work_remote_allowed": data.get("workRemoteAllowed"),
                "description_full": description_text,
            }
        except Exception:
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
    def fetch_jobs(self, stage: str = "saved") -> Dict[str, Any]:
        target_url = self.saved_url
        target_body = self.saved_body

        if stage != "saved":
            target_url = target_url.replace("stage=saved", f"stage={stage}")
            if target_body:
                target_body = target_body.replace('"stage":"saved"', f'"stage":"{stage}"')

        req = RawStringRequest(self.saved_method, target_url, target_body, clean_headers=False)
        response = self.client.execute(req)

        if response.status_code != 200:
            raise Exception(f"Erro LinkedIn (Listagem): {response.status_code}")

        stream_items = parse_linkedin_stream(response.text)

        all_candidates = []
        for item in stream_items:
            all_candidates.extend(find_job_objects_recursive(item))

        clean_jobs = []
        seen_ids = set()
        for data in all_candidates:
            job_id = data.get("jobId")
            if not job_id or job_id in seen_ids:
                continue
            seen_ids.add(job_id)
            clean_jobs.append(data)

        results = []
        for job_data in clean_jobs:
            job_id = job_data.get("jobId")

            job = {
                "title": job_data.get("title"),
                "company": job_data.get("companyName"),
                "location": job_data.get("formattedLocation"),
                "job_id": job_id,
                "job_url": f"https://www.linkedin.com/jobs/view/{job_id}/",
            }

            if stage == "applied":
                details = self.fetch_job_details(job_id)
                job.update(details)

                premium = self.fetch_premium_insights(job_id)
                job.update(premium)

                job = self._enrich_job(job)

                time.sleep(REQUEST_DELAY_SECONDS)

            results.append(job)

        return {
            "count": len(results),
            "jobs": results,
            "stage": stage,
        }
