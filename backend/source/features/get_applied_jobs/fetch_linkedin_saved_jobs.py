# backend/source/features/get_applied_jobs/fetch_linkedin_saved_jobs.py

import json
import time
import re
import random  # ADDED for jitter
from datetime import timezone, datetime
from typing import Optional

from source.features.get_applied_jobs.linkedin_fetch_call_repository import (
    get_linkedin_fetch_artefacts,
    LinkedInRequest,
    VoyagerGraphQLRequest
)
from source.features.job_population.enrichment_service import EnrichmentService

# ---------------------------------------------------------------------
# CONSTANTS
# ---------------------------------------------------------------------

BASE_URL = "https://www.linkedin.com/voyager/api/graphql"
QUERY_ID = "voyagerSearchDashClusters.ef3d0937fb65bd7812e32e5a85028e79"
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
# REQUEST OBJECTS (LOCAL SPECIFIC)
# ---------------------------------------------------------------------

class SduiEnrichmentRequest(LinkedInRequest):
    """
    Objeto responsável por buscar os detalhes do job via SDUI/Component.
    """

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

        # Headers específicos desta request
        self.set_headers({
            "csrf-token": csrf_token,
            "Content-Type": "application/json"
        })


# ---------------------------------------------------------------------
# CONTEXT OBJECT
# ---------------------------------------------------------------------

class LinkedInFetchContext:
    def __init__(self, session, card_type: str):
        self.session = session
        self.card_type = card_type
        self.page_ctx = PAGE_CONTEXT[card_type]
        self._apply_headers()
        self.csrf_token = self._extract_csrf()

    def _apply_headers(self):
        self.session.headers["x-li-page-instance"] = self.page_ctx["page_instance"]
        self.session.headers["x-li-pem-metadata"] = self.page_ctx["pem"]
        self.session.headers["Referer"] = self.page_ctx["referer"]

    def _extract_csrf(self) -> Optional[str]:
        if "JSESSIONID" in self.session.cookies:
            return self.session.cookies.get("JSESSIONID").strip('"')

        cookie_header = self.session.headers.get("Cookie", "")
        m = re.search(r'JSESSIONID="?([^";]+)', cookie_header)
        return m.group(1) if m else None


# ---------------------------------------------------------------------
# VOYAGER FETCH (REFACTORED TO OOP)
# ---------------------------------------------------------------------

def fetch_voyager_page(ctx: LinkedInFetchContext, start: int, debug=False, debug_curls=None):
    # Instancia o Objeto de Request
    request_obj = VoyagerGraphQLRequest(
        base_url=BASE_URL,
        query_id=QUERY_ID,
        start=start,
        card_type=ctx.card_type
    )

    if debug and debug_curls is not None:
        debug_curls.append(request_obj.to_curl(ctx.session.cookies))

    resp = request_obj.execute(ctx.session)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------
# PAYLOAD PARSING (UNCHANGED)
# ---------------------------------------------------------------------

def format_timestamp_ms(ms: int) -> str:
    if not ms:
        return None
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%d")


def extract_jobs_from_payload(payload: dict) -> list[dict]:
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

            image_attrs = entity.get("image", {}).get("attributes", [])
            company_urn = None
            if image_attrs:
                company_urn = image_attrs[0].get("detailData", {}).get("*companyLogo")

            insights = []
            for block in entity.get("insightsResolutionResults", []):
                simple = block.get("simpleInsight")
                if simple:
                    txt = simple.get("title", {}).get("text")
                    if txt:
                        insights.append(txt)

            jobs.append({
                "job_posting_urn": entity.get("trackingUrn"),
                "entity_urn": entity.get("entityUrn"),
                "title": entity.get("title", {}).get("text"),
                "company": {
                    "name": entity.get("primarySubtitle", {}).get("text"),
                    "urn": company_urn,
                },
                "location": entity.get("secondarySubtitle", {}).get("text"),
                "navigation_url": entity.get("navigationUrl"),
                "insights": insights,
            })

    return jobs


# ---------------------------------------------------------------------
# SDUI DESCRIPTION EXTRACTION (UNCHANGED HELPERS)
# ---------------------------------------------------------------------

def _extract_text_nodes(node, out: list[str]):
    if isinstance(node, str):
        s = node.strip()
        if s:
            out.append(s)
        return

    if isinstance(node, list):
        if len(node) >= 4 and isinstance(node[3], dict):
            tag = node[1]
            props = node[3]
            children = props.get("children")

            if tag in {"p", "$6"}:
                if children:
                    _extract_text_nodes(children, out)
                    out.append("\n")

            elif tag == "strong":
                out.append("**")
                _extract_text_nodes(props.get("children"), out)
                out.append("**\n")

            elif tag == "ul":
                for li in props.get("children", []):
                    out.append("- ")
                    _extract_text_nodes(li, out)
                    out.append("\n")

            elif tag == "li":
                _extract_text_nodes(props.get("children"), out)

            else:
                _extract_text_nodes(children, out)
        else:
            for item in node:
                _extract_text_nodes(item, out)


def normalize_blocks_to_markdown(blocks: list[str]) -> str:
    text = "".join(blocks)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def clean_sdui_text(text: str) -> str:
    text = re.sub(r"\$\d+:props:[^\s*]+", "", text)
    text = re.sub(r"\$undefined", "", text)
    text = re.sub(r"\*\*last\*\*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\band(?=\s*\*\*)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\band(?=\s*$)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\*\*[\s\n]+([^*]+)\*\*", r"**\1**", text)
    text = re.sub(r"\*\*([^*]+)[\s\n]+\*\*", r"**\1**", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"\*\*\s*\*\*", "", text)
    return text.strip()


def merge_inline_bold_blocks(text: str) -> str:
    lines = text.splitlines()
    result = []
    buffer = None
    for line in lines:
        if (
                line.startswith("**")
                and line.endswith("**")
                and len(line) < 80
                and buffer
                and not buffer.endswith(":")
        ):
            buffer = buffer.rstrip() + " " + line.strip("**")
            continue
        if buffer is not None:
            result.append(buffer)
        buffer = line
    if buffer is not None:
        result.append(buffer)
    return "\n".join(result)


def normalize_section_headers(text: str) -> str:
    text = re.sub(r"([^\n])\s*(\*\*[^*\n]+[:?,]\*\*)", r"\1\n\n\2", text)
    text = re.sub(r"(\*\*[^*\n]+[:?,]\*\*)([^\n])", r"\1\n\n\2", text)
    text = re.sub(r"([a-z]\.)\s*([A-Z][A-Za-z\s\']+:\s*)", r"\1\n\n**\2**", text)
    text = re.sub(r"([a-z]\.)\s*(Join us at [A-Z][A-Za-z0-9\s]+)[,:]", r"\1\n\n**\2:**", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def merge_inline_bold_sentences(text: str) -> str:
    text = re.sub(r"([a-zA-Z,])\n\n(\*\*[^*\n]+\.\*\*)", r"\1 \2", text)
    return text


def extract_description_from_sdui(blob: bytes) -> str:
    """
    Extrai texto de forma limpa do SDUI moderno do LinkedIn.
    """
    text = blob.decode("utf-8", errors="ignore")
    lines = text.splitlines()

    json_blobs = []

    # Extrai todos os JSON válidos
    for line in lines:
        if ":" not in line:
            continue
        try:
            _, json_part = line.split(":", 1)
            obj = json.loads(json_part)
            json_blobs.append(obj)
        except:
            continue

    blocks = []

    def walk(node):
        if node is None:
            return

        # --- FILTRO DE STRINGS LIXO ---
        if isinstance(node, str):
            s = node.strip()

            # Ignorar tags SDUI e placeholders
            if (
                    not s or
                    s.startswith("$L") or  # $L1 $L2 $L7...
                    s.startswith("$S") or  # $Sreact.fragment
                    s.startswith("$8") or  # $8, $8 0, $8 1...
                    s == "$undefined" or
                    s.isdigit() or  # números perdidos (0,1)
                    all(ch in "$ " for ch in s) or  # <<<<<< filtra "$ $ $ $$ $"
                    s in {"$", "$$", "$$$", "$span", "span"} or
                    re.fullmatch(r"\$+ span \$+", s) or  # "$ span $"
                    re.fullmatch(r"\$+", s)  # só símbolos
            ):
                return

            blocks.append(s)
            return

        if isinstance(node, list):
            for x in node:
                walk(x)
            return

        if isinstance(node, dict):

            # Texto real → textProps
            if "textProps" in node:
                children = node["textProps"].get("children", [])
                walk(children)
                return

            if "children" in node:
                walk(node["children"])
            return

    # Varre cada blob JSON válido
    for obj in json_blobs:
        walk(obj)

    # Junta com quebras limpas
    result = "\n".join(blocks)
    result = re.sub(r"\n{3,}", "\n\n", result)

    return result.strip()


# ---------------------------------------------------------------------
# ENRICH JOBS (REFACTORED TO OOP)
# ---------------------------------------------------------------------

def enrich_jobs_with_sdui(
        ctx: LinkedInFetchContext,
        jobs: list[dict],
        *,
        debug=False,
        trace=False,
        debug_curls=None,
        trace_info=None,
):
    if not ctx.csrf_token:
        return

    for job in jobs:
        urn = job.get("job_posting_urn")
        if not urn:
            continue

        m = re.search(r"jobPosting:(\d+)", urn)
        if not m:
            continue

        job_id = m.group(1)

        # Instancia o Objeto de Request SDUI
        req_obj = SduiEnrichmentRequest(job_id, ctx.csrf_token)

        if debug and debug_curls is not None:
            debug_curls.append(req_obj.to_curl(ctx.session.cookies))

        resp = req_obj.execute(ctx.session)

        if debug:
            print("\n" + "=" * 80)
            print(f"[SDUI RAW RESPONSE] job_id={job_id}")
            print(f"status={resp.status_code} bytes={len(resp.content or b'')}")
            print("-" * 80)
            print(resp.content.decode("utf-8", errors="replace"))
            print("=" * 80 + "\n")

        if trace and trace_info is not None:
            trace_info.append({
                "job_id": job_id,
                "status": resp.status_code,
                "len": len(resp.content or b""),
            })

        if resp.ok and resp.content:
            job["description"] = extract_description_from_sdui(resp.content)
        else:
            job["description"] = "Failed to fetch description."

        try:
            enrichment_data = EnrichmentService.fetch_single_job_details_enrichment(ctx.session, urn)

            applicants = enrichment_data.get("applicants")
            if applicants is not None:
                job["applicants"] = applicants
            else:
                job["applicants"] = None

        except Exception as e:
            job["applicants"] = None

        meta = fetch_job_posting_metadata(ctx.session, job_id)
        if meta:
            listed_at = meta.get("listedAt")
            created_at = meta.get("createdAt")
            expire_at = meta.get("expireAt")
            apply_method = meta.get("applyMethod")

            job["posted_at"] = listed_at
            job["posted_at_formatted"] = format_timestamp_ms(listed_at)

            job["created_at"] = created_at
            job["created_at_formatted"] = format_timestamp_ms(created_at)

            job["expire_at"] = expire_at
            job["expire_at_formatted"] = format_timestamp_ms(expire_at)

            job["apply_method"] = apply_method
        else:
            job["listed_at"] = None
            job["created_at"] = None
            job["expire_at"] = None
            job["apply_method"] = None


# ---------------------------------------------------------------------
# PUBLIC ENTRYPOINT (DEFAULT CHANGED TO "all")
# ---------------------------------------------------------------------

def fetch_linkedin_saved_jobs(
        *,
        card_type: str,
        pagination: str = "all",  # CHANGED DEFAULT
        start_override: Optional[int] = None,
        enrich: bool = True,
        debug: bool = False,
        trace: bool = False,
) -> dict:
    if card_type not in CARD_TYPE_MAP:
        raise ValueError(f"Invalid card_type: {card_type}")

    artefacts = get_linkedin_fetch_artefacts()
    if not artefacts:
        raise RuntimeError("LinkedIn artefacts not available")

    session, _ = artefacts
    ctx = LinkedInFetchContext(session, CARD_TYPE_MAP[card_type])

    debug_curls = []
    trace_info = []

    all_jobs = []
    pages_fetched = []

    # SAFETY: Track URNs to prevent infinite loops if API ignores 'start' param
    seen_urns = set()

    if pagination == "all":
        start = start_override or 0
        page_num = 1

        while True:
            # 1. Fetch Page
            payload = fetch_voyager_page(ctx, start, debug, debug_curls)

            # 2. Extract Jobs
            jobs = extract_jobs_from_payload(payload)
            if not jobs:
                break

            # 3. Duplicate Detection (Safety Mechanism)
            new_unique_jobs = []
            for job in jobs:
                urn = job.get("job_posting_urn")
                # Only add if we haven't seen this URN before
                if urn and urn not in seen_urns:
                    seen_urns.add(urn)
                    new_unique_jobs.append(job)

            # If we fetched jobs but ALL were duplicates, it means we are looping
            # (LinkedIn API ignored the 'start' param and sent Page 1 again).
            if not new_unique_jobs:
                if debug:
                    print(
                        f"[DEBUG] Infinite Loop Protection: Stopping at start={start}. All returned jobs were duplicates.")
                break

            all_jobs.extend(new_unique_jobs)
            pages_fetched.append(page_num)

            # 4. Prepare for next iteration
            start += PAGE_SIZE
            page_num += 1
            # Add jitter to avoid bot detection
            time.sleep(random.uniform(0.5, 1.5))

    else:
        page_num = max(1, int(pagination))
        start = start_override if start_override is not None else (page_num - 1) * PAGE_SIZE
        payload = fetch_voyager_page(ctx, start, debug, debug_curls)
        all_jobs = extract_jobs_from_payload(payload)
        pages_fetched.append(page_num)

    if enrich:
        enrich_jobs_with_sdui(
            ctx,
            all_jobs,
            debug=debug,
            trace=trace,
            debug_curls=debug_curls,
            trace_info=trace_info,
        )

    response = {
        "card_type": card_type,
        "pagination": pagination,
        "pages_fetched": pages_fetched,
        "count": len(all_jobs),
        "jobs": all_jobs,
    }

    if debug:
        response["debug"] = {
            "curl_count": len(debug_curls),
            "curls": debug_curls,
        }

    if trace:
        response["trace"] = {
            "count": len(trace_info),
            "items": trace_info,
        }

    return response


def fetch_job_posting_metadata(session, job_id):
    url = f"https://www.linkedin.com/voyager/api/jobs/jobPostings/{job_id}"
    resp = session.get(url, headers={
        "accept": "application/json",
        "x-restli-protocol-version": "2.0.0"
    })
    return resp.json() if resp.ok else None