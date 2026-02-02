# backend/source/features/get_applied_jobs/fetch_linkedin_saved_jobs.py

import json
import time
import re
import random
from datetime import timezone, datetime
from typing import Optional, List
from dataclasses import dataclass, field

# IMPORTS REFATORADOS
from source.features.fetch_curl.linkedin_http_client import (
    LinkedInClient,
    LinkedInRequest,
    VoyagerGraphQLRequest
)
from source.features.job_population.enrichment_service import EnrichmentService


# =====================================================================
# 1) DATACLASSES (O "OURO")
# =====================================================================

@dataclass
class SavedJob:
    urn: str
    entity_urn: str
    title: str
    company_name: str
    location: str
    job_url: str
    insights: List[str] = field(default_factory=list)

    # Campos enriquecidos posteriormente
    description: str = ""
    posted_at: str = ""  # Timestamp bruto ou formatado
    posted_date_text: str = ""  # Texto amigável (Ex: 2 weeks ago)
    applicants: str = "N/A"
    apply_method: dict = field(default_factory=dict)

    def __repr__(self):
        # Formatação limpa para o terminal
        insights_str = ', '.join(self.insights[:3]) + ('...' if len(self.insights) > 3 else '')
        desc_preview = self.description[:100].replace('\n',
                                                      ' ') + "..." if self.description else "No description fetched."

        return (f"🏢 {self.company_name}\n"
                f"   💼 {self.title}\n"
                f"   📍 {self.location}\n"
                f"   📅 Posted: {self.posted_date_text} | Applicants: {self.applicants}\n"
                f"   🔗 {self.job_url}\n"
                f"   💡 Insights: {insights_str}\n"
                f"   📝 Desc: {desc_preview}\n")


# ---------------------------------------------------------------------
# CONSTANTS
# ---------------------------------------------------------------------

PAGE_SIZE = 10

CARD_TYPE_MAP = {
    "applied": "APPLIED",
    "saved": "SAVED",
    "in_progress": "IN_PROGRESS",
    "archived": "ARCHIVED",
}

PAGE_CONTEXT = {
    "APPLIED": {
        "page_instance": "urn:li:page:d_flagship3_myitems_appliedjobs",
        "referer": "https://www.linkedin.com/my-items/applied-jobs/",
        "pem": "Voyager - My Items=myitems-applied-jobs",
    },
    "SAVED": {
        "page_instance": "urn:li:page:d_flagship3_myitems_savedjobs",
        "referer": "https://www.linkedin.com/my-items/saved-jobs/",
        "pem": "Voyager - My Items=myitems-saved-jobs",
    },
    "IN_PROGRESS": {
        "page_instance": "urn:li:page:d_flagship3_myitems_savedjobs",
        "referer": "https://www.linkedin.com/my-items/saved-jobs/?cardType=IN_PROGRESS",
        "pem": "Voyager - My Items=myitems-saved-jobs",
    },
    "ARCHIVED": {
        "page_instance": "urn:li:page:d_flagship3_myitems_savedjobs",
        "referer": "https://www.linkedin.com/my-items/saved-jobs/?cardType=ARCHIVED",
        "pem": "Voyager - My Items=myitems-saved-jobs",
    },
}


# ---------------------------------------------------------------------
# REQUEST OBJECTS (Enrichment Only)
# ---------------------------------------------------------------------

class SduiEnrichmentRequest(LinkedInRequest):
    def __init__(self, job_id: str, csrf_token: str):
        url = (
            "https://www.linkedin.com/flagship-web/rsc-action/actions/component"
            "?componentId=com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"
        )
        super().__init__("POST", url)

        self.payload = {
            "clientArguments": {
                "payload": {"jobId": job_id, "renderAsCard": True},
                "states": [],
                "requestMetadata": {},
            },
            "screenId": "com.linkedin.sdui.flagshipnav.jobs.JobDetails",
        }
        self.set_body(self.payload)
        self.set_headers({
            "csrf-token": csrf_token,
            "Content-Type": "application/json"
        })


# ---------------------------------------------------------------------
# PARSERS (Mantidos intactos)
# ---------------------------------------------------------------------

def format_timestamp_ms(ms: int) -> str:
    if not ms:
        return ""
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%d")


def safe_get_text(obj, *keys):
    curr = obj
    try:
        for k in keys:
            if curr is None: return ""
            curr = curr[k]
        return curr if curr is not None else ""
    except Exception:
        return ""


def extract_jobs_from_payload(payload: dict) -> List[SavedJob]:
    included = payload.get("included", [])
    included_map = {i.get("entityUrn"): i for i in included}
    jobs = []

    clusters = (
        payload.get("data", {})
        .get("data", {})
        .get("searchDashClustersByAll", {})
        .get("elements", [])
    )

    for cluster in clusters:
        for item in cluster.get("items", []):
            ref = item.get("item", {}).get("*entityResult")
            if not ref:
                continue

            entity = included_map.get(ref)
            if not entity:
                continue

            # Extração de Campos Básicos
            urn = entity.get("trackingUrn")
            entity_urn = entity.get("entityUrn")
            title = safe_get_text(entity, "title", "text")
            company_name = safe_get_text(entity, "primarySubtitle", "text")
            location = safe_get_text(entity, "secondarySubtitle", "text")
            nav_url = entity.get("navigationUrl")

            # Insights
            insights = []
            for block in entity.get("insightsResolutionResults", []):
                txt = safe_get_text(block, "simpleInsight", "title", "text")
                if txt:
                    insights.append(txt)

            # Instancia o Objeto
            job = SavedJob(
                urn=urn,
                entity_urn=entity_urn,
                title=title,
                company_name=company_name,
                location=location,
                job_url=nav_url,
                insights=insights
            )
            jobs.append(job)

    return jobs


# ---------------------------------------------------------------------
# SDUI EXTRACTION (Helpers)
# ---------------------------------------------------------------------

def extract_description_from_sdui(blob: bytes) -> str:
    text = blob.decode("utf-8", errors="ignore")
    lines = text.splitlines()
    json_blobs = []

    for line in lines:
        if ":" not in line: continue
        try:
            _, json_part = line.split(":", 1)
            json_blobs.append(json.loads(json_part))
        except:
            continue

    blocks = []

    def walk(node):
        if node is None: return
        if isinstance(node, str):
            s = node.strip()
            # Filtros de sujeira do SDUI
            if (not s or s.startswith("$L") or s.startswith("$S") or s.startswith("$8")
                    or s == "$undefined" or all(ch in "$ " for ch in s)):
                return
            blocks.append(s)
            return

        if isinstance(node, list):
            for x in node: walk(x)
        elif isinstance(node, dict):
            if "textProps" in node:
                walk(node["textProps"].get("children", []))
            elif "children" in node:
                walk(node["children"])

    for obj in json_blobs:
        walk(obj)

    result = "\n".join(blocks)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


# ---------------------------------------------------------------------
# ENRICHMENT
# ---------------------------------------------------------------------

def enrich_jobs_with_sdui(client: LinkedInClient, jobs: List[SavedJob], debug=False):
    if not client.csrf_token:
        print("⚠️ No CSRF token found, skipping enrichment.")
        return

    for job in jobs:
        if not job.urn: continue

        # Extract Job ID
        m = re.search(r"jobPosting:(\d+)", job.urn)
        if not m: continue
        job_id = m.group(1)

        # 1. SDUI Request (Description)
        try:
            req = SduiEnrichmentRequest(job_id, client.csrf_token)
            resp = client.execute(req)
            if resp.ok and resp.content:
                job.description = extract_description_from_sdui(resp.content)
            else:
                job.description = "Failed to fetch description"
        except Exception as e:
            job.description = f"Error: {str(e)}"

        # 2. Enrichment Service (Applicants, etc)
        # Nota: EnrichmentService ainda espera uma session crua do requests,
        # então passamos client.session
        try:
            enrichment_data = EnrichmentService.fetch_single_job_details_enrichment(client.session, job.urn)
            applicants = enrichment_data.get("applicants")
            job.applicants = str(applicants) if applicants is not None else "N/A"
        except Exception:
            job.applicants = "Error"

        # 3. Metadata (Dates)
        try:
            meta = fetch_job_posting_metadata(client.session, job_id)
            if meta:
                listed_at = meta.get("listedAt")
                job.posted_at = format_timestamp_ms(listed_at)
                job.posted_date_text = job.posted_at  # Fallback simplificado
                job.apply_method = meta.get("applyMethod")
        except Exception:
            pass


def fetch_job_posting_metadata(session, job_id):
    url = f"https://www.linkedin.com/voyager/api/jobs/jobPostings/{job_id}"
    resp = session.get(url, headers={"accept": "application/json", "x-restli-protocol-version": "2.0.0"})
    return resp.json() if resp.ok else None


# ---------------------------------------------------------------------
# MAIN FUNCTION REFATORADA
# ---------------------------------------------------------------------

def fetch_linkedin_saved_jobs(
        *,
        card_type: str,
        pagination: str = "all",
        start_override: Optional[int] = None,
        enrich: bool = True,
        debug: bool = False,
) -> dict:
    if card_type not in CARD_TYPE_MAP:
        raise ValueError(f"Invalid card_type: {card_type}")

    # 1. INICIALIZA O CLIENTE
    client = LinkedInClient("LinkedIn_Saved_Jobs_Scraper")
    if not client.config:
        raise RuntimeError("LinkedIn config not available in DB (LinkedIn_Saved_Jobs_Scraper)")

    # 2. CONFIGURA CONTEXTO (HEADERS)
    mapped_type = CARD_TYPE_MAP[card_type]
    page_ctx = PAGE_CONTEXT.get(mapped_type, PAGE_CONTEXT["SAVED"])

    client.session.headers.update({
        "x-li-page-instance": page_ctx["page_instance"],
        "x-li-pem-metadata": page_ctx["pem"],
        "Referer": page_ctx["referer"]
    })

    all_jobs: List[SavedJob] = []
    seen_urns = set()

    start = start_override or 0
    page_num = 1
    max_pages = 100 if pagination == "all" else int(pagination)

    print(f"🚀 Starting fetch for '{card_type}' jobs...")

    while page_num <= max_pages:
        if debug: print(f"   Fetching page {page_num} (start={start})...")

        # 3. PREPARA VARIÁVEIS GRAPHQL
        variables = (
            f"(start:{start},query:("
            "flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER,"
            f"queryParameters:List((key:cardType,value:List({mapped_type})))"
            "))"
        )

        # 4. EXECUTA REQUEST
        req = VoyagerGraphQLRequest(
            base_url=client.config['base_url'],
            query_id=client.config['query_id'],
            variables=variables
        )

        if debug:
            print(f"[DEBUG] URL: {req.url}")

        resp = client.execute(req)
        resp.raise_for_status()
        payload = resp.json()

        # 5. PARSE E PAGINAÇÃO
        new_jobs = extract_jobs_from_payload(payload)

        if not new_jobs:
            break

        # Duplicate Check
        unique_batch = []
        for job in new_jobs:
            if job.urn not in seen_urns:
                seen_urns.add(job.urn)
                unique_batch.append(job)

        if not unique_batch:
            if debug: print("   Loop detected (all duplicates). Stopping.")
            break

        all_jobs.extend(unique_batch)

        if pagination != "all":
            break

        start += PAGE_SIZE
        page_num += 1
        time.sleep(random.uniform(0.5, 1.0))

    if enrich:
        print(f"✨ Enriching {len(all_jobs)} jobs with details...")
        enrich_jobs_with_sdui(client, all_jobs, debug=debug)

    return {
        "card_type": card_type,
        "count": len(all_jobs),
        "jobs": all_jobs
    }


# =====================================================================
# MAIN EXECUTION BLOCK (DATACLASS PREVIEW)
# =====================================================================

if __name__ == "__main__":
    # Teste rápido apenas com a primeira página
    try:
        results = fetch_linkedin_saved_jobs(
            card_type="saved",
            pagination="1",  # Puxa só 1 página para teste rápido
            enrich=True,
            debug=True
        )

        print(f"\n✅ SUCCESS! Found {results['count']} saved jobs.\n")

        for i, job in enumerate(results['jobs'], 1):
            print(f"--- JOB #{i} ---")
            print(job)  # Usa o __repr__ bonito da Dataclass
            print("-" * 50)

    except Exception as e:
        print(f"\n❌ Erro durante a execução: {e}")