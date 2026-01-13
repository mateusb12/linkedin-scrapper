# backend/source/features/get_applied_jobs/fetch_linkedin_saved_jobs.py

import json
import time
import re
from typing import Optional

from source.features.get_applied_jobs.linkedin_fetch_call_repository import (
    get_linkedin_fetch_artefacts,
)

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
# CURL DEBUGGER
# ---------------------------------------------------------------------

def generate_curl(method, url, headers, cookies, body=None):
    parts = [f"curl -X {method} '{url}'"]
    for k, v in headers.items():
        parts.append(f"-H '{k}: {v}'")
    if cookies:
        cookie_str = "; ".join(f"{c.name}={c.value}" for c in cookies)
        parts.append(f"-H 'Cookie: {cookie_str}'")
    if body is not None:
        parts.append(f"--data '{json.dumps(body)}'")
    return " \\\n  ".join(parts)


# ---------------------------------------------------------------------
# VOYAGER FETCH
# ---------------------------------------------------------------------

def build_voyager_url(start: int, card_type: str) -> str:
    variables = (
        f"(start:{start},query:("
        "flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER,"
        f"queryParameters:List((key:cardType,value:List({card_type})))"
        "))"
    )
    return f"{BASE_URL}?variables={variables}&queryId={QUERY_ID}"


def fetch_voyager_page(ctx: LinkedInFetchContext, start: int, debug=False, debug_curls=None):
    url = build_voyager_url(start, ctx.card_type)

    if debug and debug_curls is not None:
        debug_curls.append(
            generate_curl("GET", url, ctx.session.headers, ctx.session.cookies)
        )

    resp = ctx.session.get(url, timeout=15)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------
# PAYLOAD PARSING
# ---------------------------------------------------------------------

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
# SDUI DESCRIPTION EXTRACTION (TARGETED)
# ---------------------------------------------------------------------


def _extract_text_nodes(node, out: list[str]):
    if isinstance(node, str):
        s = node.strip()
        if s:
            out.append(s)
        return

    if isinstance(node, list):
        # RSC node format: ["$", tag, meta, props]
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
    """
    Cleans React Flight / SDUI artifacts from extracted text.
    Safe to run on already-clean human text.
    """
    # 1. Remove React Flight references like $4:props:...
    text = re.sub(r"\$\d+:props:[^\s*]+", "", text)

    # 2. Remove generic $undefined tokens
    text = re.sub(r"\$undefined", "", text)

    # 3. Remove stray '**last**' used as fragment glue
    text = re.sub(r"\*\*last\*\*", "", text, flags=re.IGNORECASE)

    # 4. Remove 'and' when glued to removed artifacts
    text = re.sub(r"\band(?=\s*\*\*)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\band(?=\s*$)", "", text, flags=re.IGNORECASE)

    # 5. Normalize whitespace
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # 6. Clean broken markdown joins
    text = re.sub(r"\*\*\s*\*\*", "", text)

    return text.strip()

def merge_inline_bold_blocks(text: str) -> str:
    """
    Merges isolated bold lines back into surrounding paragraphs
    when they are clearly inline emphasis.
    """
    lines = text.splitlines()
    result = []
    buffer = None

    for line in lines:
        # Detect standalone bold like "**help customers.**"
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
    """
    Normalizes section headers so they always start on a new paragraph.
    Handles:
    - **Bold:** headers
    - Plain-text headers ending with :
    - Known LinkedIn headers like 'Join us at ...'
    """

    # 1️⃣ Fix bold headers glued to text
    text = re.sub(
        r"([^\n])(\*\*[^*\n]+:\*\*)",
        r"\1\n\n\2",
        text
    )

    text = re.sub(
        r"(\*\*[^*\n]+:\*\*)([^\n])",
        r"\1\n\n\2",
        text
    )

    # 2️⃣ Fix plain-text headers ending with ':' glued after sentences
    text = re.sub(
        r"([a-z]\.)\s+([A-Z][A-Za-z\s]+:)",
        r"\1\n\n**\2**",
        text
    )

    # 3️⃣ Fix 'Join us at X' even when missing colon
    text = re.sub(
        r"([a-z]\.)\s+(Join us at [A-Z][A-Za-z0-9\s]+),",
        r"\1\n\n**\2:**",
        text
    )

    # 4️⃣ Cleanup spacing
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()

def merge_inline_bold_sentences(text: str) -> str:
    """
    Merges bold fragments that were split from the previous sentence.
    Example:
      "systems that\n\n**help customers.**"
    becomes:
      "systems that **help customers.**"
    """

    text = re.sub(
        r"([a-zA-Z,])\n\n(\*\*[^*\n]+\.\*\*)",
        r"\1 \2",
        text
    )

    return text


def extract_description_from_sdui(blob: bytes) -> str:
    text = blob.decode("utf-8", errors="ignore")
    lines = text.splitlines()

    l5_json = None

    for line in lines:
        if '"$L5"' in line:
            try:
                _, json_part = line.split(":", 1)
                data = json.loads(json_part)
                l5_json = data
                break
            except Exception:
                continue

    if not l5_json:
        return ""

    props = l5_json[3] if isinstance(l5_json, list) and len(l5_json) > 3 else {}
    text_props = props.get("textProps", {})
    children = text_props.get("children", [])

    blocks: list[str] = []
    _extract_text_nodes(children, blocks)

    raw = normalize_blocks_to_markdown(blocks)

    clean = clean_sdui_text(raw)
    clean = merge_inline_bold_blocks(clean)
    clean = normalize_section_headers(clean)
    clean = merge_inline_bold_sentences(clean)
    return clean


# ---------------------------------------------------------------------
# ENRICH JOBS
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

        url = (
            "https://www.linkedin.com/flagship-web/rsc-action/actions/component"
            "?componentId=com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"
        )

        payload = {
            "clientArguments": {
                "payload": {"jobId": job_id, "renderAsCard": True},
                "states": [],
                "requestMetadata": {},
            },
            "screenId": "com.linkedin.sdui.flagshipnav.jobs.JobDetails",
        }

        headers = dict(ctx.session.headers)
        headers["csrf-token"] = ctx.csrf_token
        headers["Content-Type"] = "application/json"

        if debug and debug_curls is not None:
            debug_curls.append(
                generate_curl("POST", url, headers, ctx.session.cookies, payload)
            )

        resp = ctx.session.post(url, json=payload, headers=headers)

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


# ---------------------------------------------------------------------
# PUBLIC ENTRYPOINT
# ---------------------------------------------------------------------

def fetch_linkedin_saved_jobs(
    *,
    card_type: str,
    pagination: str = "1",
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

    if pagination == "all":
        start = start_override or 0
        while True:
            payload = fetch_voyager_page(ctx, start, debug, debug_curls)
            jobs = extract_jobs_from_payload(payload)
            if not jobs:
                break
            all_jobs.extend(jobs)
            pages_fetched.append(start // PAGE_SIZE + 1)
            start += PAGE_SIZE
            time.sleep(0.5)
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
