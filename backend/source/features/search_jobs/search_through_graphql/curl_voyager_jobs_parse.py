import json
import os
import re
from collections import Counter
from dataclasses import dataclass, asdict, fields as dataclass_fields
from datetime import datetime, timezone
from typing import Any, Optional


@dataclass
class LinkedInJob:
    # --- Core Job Information ---
    job_id: str
    title: Optional[str] = None
    description_snippet: Optional[str] = None

    # --- Company & Location ---
    company_name: Optional[str] = None
    location: Optional[str] = None
    company_logo_url: Optional[str] = None

    # --- Insights / Metadata ---
    workplace_type: Optional[str] = None
    employment_type: Optional[str] = None
    promoted_status: Optional[str] = None

    # --- Apply / Interaction ---
    apply_method: Optional[str] = None
    company_apply_url: Optional[str] = None

    # --- Timing ---
    posted_time: Optional[str] = None


FIELD_DEBUG_KEYWORDS = {
    "company_name": ["company", "name", "organization"],
    "location": ["location", "geo", "formatted", "primarydescription", "secondarydescription"],
    "company_logo_url": ["logo", "image", "vector", "artwork", "picture", "rooturl"],
    "workplace_type": ["workplace", "remote", "hybrid", "onsite"],
    "employment_type": ["employment", "jobtype", "job_type", "full-time", "part-time", "contract"],
    "promoted_status": ["promot", "sponsored"],
    "apply_method": ["apply", "easy", "offsite"],
    "company_apply_url": ["apply", "offsite", "url", "link"],
    "posted_time": ["listed", "posted", "created", "time", "date"],
}

WORKPLACE_TYPE_ID_MAP = {
    "1": "On-site",
    "2": "Remote",
    "3": "Hybrid",
}


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------

def _json_preview(obj: Any, max_chars: int = 1200) -> str:
    try:
        text = json.dumps(obj, indent=2, ensure_ascii=False)
    except Exception:
        text = repr(obj)

    if len(text) > max_chars:
        return text[:max_chars] + "\n... [truncated]"
    return text


def _walk(obj: Any, path: str = "$"):
    yield path, obj

    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from _walk(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj[:200]):
            yield from _walk(v, f"{path}[{i}]")


def _clean_text(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_text(value: Any, max_parts: int = 12) -> Optional[str]:
    """
    Conservative text extractor.
    Avoids pulling $type / $recipeTypes / other metadata noise.
    """
    parts: list[str] = []

    preferred_keys = (
        "text",
        "rawText",
        "formattedText",
        "accessibilityText",
        "title",
        "name",
        "companyName",
        "subtitle",
        "description",
        "defaultLocalizedName",
        "localizedName",
        "abbreviatedLocalizedName",
        "postedOnText",
        "formattedEmploymentStatus",
        "employmentStatus",
    )

    ignored_keys = {
        "$type",
        "$recipeTypes",
        "entityUrn",
        "trackingUrn",
        "trackingId",
        "objectUrn",
    }

    def add_part(text: str):
        text = _clean_text(text)
        if text and text not in parts:
            parts.append(text)

    def rec(v: Any):
        if len(parts) >= max_parts or v is None:
            return

        if isinstance(v, str):
            add_part(v)
            return

        if isinstance(v, (int, float)):
            parts.append(str(v))
            return

        if isinstance(v, dict):
            for key in preferred_keys:
                if key in v:
                    rec(v[key])
                    if len(parts) >= max_parts:
                        return

            for k, sub in list(v.items())[:20]:
                if k in ignored_keys:
                    continue
                if isinstance(k, str) and (k.startswith("$") or k.startswith("*")):
                    continue
                rec(sub)
                if len(parts) >= max_parts:
                    return
            return

        if isinstance(v, list):
            for sub in v[:12]:
                rec(sub)
                if len(parts) >= max_parts:
                    return

    rec(value)

    if not parts:
        return None

    joined = " | ".join(parts)
    return joined[:2000] + ("..." if len(joined) > 2000 else "")


def _normalize_scalar_text(value: Any) -> Optional[str]:
    text = _extract_text(value)
    if not text:
        return None
    text = _clean_text(text)
    return text or None


def _extract_plain_text(value: Any) -> Optional[str]:
    """
    Prefer direct user-visible text only.
    Useful for CTA / label objects like applyCtaText.
    """
    if value is None:
        return None

    if isinstance(value, str):
        text = _clean_text(value)
        return text or None

    if isinstance(value, dict):
        for key in ("accessibilityText", "text", "rawText", "formattedText"):
            raw = value.get(key)
            if isinstance(raw, str):
                raw = _clean_text(raw)
                if raw:
                    return raw

    return None


def _extract_job_id_from_urn(urn: Optional[str]) -> Optional[str]:
    if not isinstance(urn, str):
        return None
    match = re.search(r"[:(](\d+)(?:,|\)|$)", urn)
    return match.group(1) if match else None


def _entity_type(node: dict) -> str:
    return node.get("$type") or node.get("entityType") or node.get("type") or "__unknown__"


def _build_urn_map(included: list[dict]) -> dict[str, dict]:
    urn_map: dict[str, dict] = {}
    for item in included:
        if not isinstance(item, dict):
            continue

        for key in ("entityUrn", "urn", "trackingUrn"):
            urn = item.get(key)
            if isinstance(urn, str):
                urn_map[urn] = item
    return urn_map


def _deep_find_first_value_by_keys(obj: Any, target_keys: list[str]) -> Any:
    wanted = {k.lower() for k in target_keys}

    for _, node in _walk(obj):
        if not isinstance(node, dict):
            continue

        for k, v in node.items():
            if str(k).lower() in wanted and v is not None:
                return v

    return None


def _find_key_matches(obj: Any, keywords: list[str], max_results: int = 20):
    keywords = [k.lower() for k in keywords]
    matches = []

    for path, node in _walk(obj):
        if not isinstance(node, dict):
            continue

        hit_keys = [
            str(k) for k in node.keys()
            if any(word in str(k).lower() for word in keywords)
        ]

        if hit_keys:
            matches.append((path, hit_keys, node))
            if len(matches) >= max_results:
                break

    return matches


def _node_contains_job_id(node: Any, job_id: str) -> bool:
    for _, value in _walk(node):
        if isinstance(value, str) and job_id in value:
            return True
    return False


def _find_related_entities(included: list[dict], entity_type: str, job_id: str) -> list[dict]:
    results = []
    for item in included:
        if not isinstance(item, dict):
            continue
        if item.get("$type") != entity_type:
            continue
        if _node_contains_job_id(item, job_id):
            results.append(item)
    return results


def _is_http_url(value: Any) -> bool:
    return isinstance(value, str) and value.startswith(("http://", "https://"))


def _is_probable_image_url(value: Any) -> bool:
    if not isinstance(value, str):
        return False

    lower = value.lower()

    if any(lower.endswith(ext) for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg")):
        return True

    if "media.licdn.com" in lower:
        return True

    return False


def _build_best_vector_image_url(obj: Any) -> Optional[str]:
    best_url = None
    best_width = -1

    for _, node in _walk(obj):
        if not isinstance(node, dict):
            continue

        root_url = node.get("rootUrl")
        artifacts = node.get("artifacts")

        if not isinstance(root_url, str) or not isinstance(artifacts, list):
            continue

        for art in artifacts:
            if not isinstance(art, dict):
                continue

            segment = (
                    art.get("fileIdentifyingUrlPathSegment")
                    or art.get("fileIdentifyingUrlPath")
                    or art.get("pathSegment")
            )

            if not isinstance(segment, str):
                continue

            width = art.get("width") or 0
            try:
                width = int(width)
            except Exception:
                width = 0

            full_url = root_url + segment
            if width > best_width:
                best_width = width
                best_url = full_url

    return best_url


def _format_epoch_millis(value: Any) -> Optional[str]:
    if value is None:
        return None

    if isinstance(value, str) and value.isdigit():
        value = int(value)

    if isinstance(value, (int, float)):
        try:
            dt = datetime.fromtimestamp(value / 1000, tz=timezone.utc)
            return dt.strftime("%Y-%m-%d")
        except Exception:
            return None

    return None


# ---------------------------------------------------------------------------
# Entity resolvers
# ---------------------------------------------------------------------------

def _resolve_job_card(job_id: str, urn_map: dict[str, dict]) -> Optional[dict]:
    return urn_map.get(f"urn:li:fsd_jobPostingCard:({job_id},JOB_DETAILS)")


def _resolve_job_description_node(job_id: str, urn_map: dict[str, dict], job_card: Optional[dict]) -> Optional[dict]:
    direct = urn_map.get(f"urn:li:fsd_jobDescription:{job_id}")
    if isinstance(direct, dict):
        return direct

    if isinstance(job_card, dict):
        for _, node in _walk(job_card):
            if not isinstance(node, dict):
                continue
            desc_urn = node.get("*jobDescription") or node.get("jobDescription")
            if isinstance(desc_urn, str):
                resolved = urn_map.get(desc_urn)
                if isinstance(resolved, dict):
                    return resolved

    return None


def _resolve_company_node(item: dict, urn_map: dict[str, dict]) -> Optional[dict]:
    company_details = item.get("companyDetails")
    if not isinstance(company_details, dict):
        return None

    job_company = company_details.get("jobCompany")
    if isinstance(job_company, dict):
        company_urn = job_company.get("*company") or job_company.get("company")
        if isinstance(company_urn, str):
            resolved = urn_map.get(company_urn)
            if isinstance(resolved, dict):
                return resolved

    company_ref = _deep_find_first_value_by_keys(company_details, ["*company", "company"])
    if isinstance(company_ref, str):
        resolved = urn_map.get(company_ref)
        if isinstance(resolved, dict):
            return resolved

    return None


def _resolve_geo_node(item: dict, urn_map: dict[str, dict]) -> Optional[dict]:
    geo_urn = item.get("*location") or item.get("location")
    if isinstance(geo_urn, str):
        resolved = urn_map.get(geo_urn)
        if isinstance(resolved, dict):
            return resolved

    return None


def _resolve_company_name(item: dict, job_card: Optional[dict], urn_map: dict[str, dict]) -> Optional[str]:
    company_node = _resolve_company_node(item, urn_map)
    if isinstance(company_node, dict):
        name = _normalize_scalar_text(
            company_node.get("name")
            or company_node.get("localizedName")
            or company_node.get("defaultLocalizedName")
        )
        if name:
            return name

    company_details = item.get("companyDetails")
    if isinstance(company_details, dict):
        raw_name = _deep_find_first_value_by_keys(company_details, ["rawCompanyName"])
        name = _normalize_scalar_text(raw_name)
        if name:
            return name

    if isinstance(job_card, dict):
        primary = job_card.get("primaryDescription")
        name = _normalize_scalar_text(primary)
        if name:
            return name

    return None


def _resolve_title(item: dict, job_card: Optional[dict]) -> Optional[str]:
    return (
            _normalize_scalar_text(item.get("title"))
            or _normalize_scalar_text(item.get("jobPostingTitle"))
            or (_normalize_scalar_text(job_card.get("jobPostingTitle")) if isinstance(job_card, dict) else None)
    )


def _resolve_description_text(item: dict, job_desc: Optional[dict]) -> Optional[str]:
    embedded = item.get("description")
    text = _normalize_scalar_text(embedded)
    if text:
        return text

    if isinstance(job_desc, dict):
        desc_text = (
                _normalize_scalar_text(job_desc.get("descriptionText"))
                or _normalize_scalar_text(job_desc.get("description"))
                or _normalize_scalar_text(job_desc.get("text"))
        )
        if desc_text:
            return desc_text

    return None


def _resolve_location(item: dict, job_card: Optional[dict], urn_map: dict[str, dict]) -> Optional[str]:
    geo_node = _resolve_geo_node(item, urn_map)
    if isinstance(geo_node, dict):
        text = _normalize_scalar_text(
            geo_node.get("defaultLocalizedName")
            or geo_node.get("abbreviatedLocalizedName")
            or geo_node.get("localizedName")
        )
        if text:
            return text

    if isinstance(job_card, dict):
        for key in ("secondaryDescription", "location", "formattedLocation"):
            text = _normalize_scalar_text(job_card.get(key))
            if text:
                return text

    direct = _normalize_scalar_text(item.get("formattedLocation") or item.get("location"))
    if direct:
        return direct

    return None


def _resolve_company_logo_url(item: dict, job_card: Optional[dict], urn_map: dict[str, dict]) -> Optional[str]:
    company_node = _resolve_company_node(item, urn_map)

    if isinstance(company_node, dict):
        vector_url = _build_best_vector_image_url(company_node)
        if vector_url:
            return vector_url

        logo_resolution = company_node.get("logoResolutionResult")
        if isinstance(logo_resolution, dict):
            direct_url = logo_resolution.get("url")
            if _is_http_url(direct_url):
                return direct_url

    if isinstance(job_card, dict):
        vector_url = _build_best_vector_image_url(job_card)
        if vector_url:
            return vector_url

    return None


def _resolve_workplace_type(
        item: dict,
        title: Optional[str],
        location: Optional[str],
        description: Optional[str],
        urn_map: dict[str, dict],
) -> Optional[str]:
    refs = item.get("*jobWorkplaceTypes")
    if isinstance(refs, list):
        for urn in refs:
            if not isinstance(urn, str):
                continue

            node = urn_map.get(urn)
            if isinstance(node, dict):
                text = _normalize_scalar_text(
                    node.get("defaultLocalizedName")
                    or node.get("localizedName")
                    or node.get("name")
                )
                if text:
                    return text

            match = re.search(r":(\d+)$", urn)
            if match:
                mapped = WORKPLACE_TYPE_ID_MAP.get(match.group(1))
                if mapped:
                    return mapped

    haystack = " ".join(x for x in [title, location, description] if x).lower()

    if "hybrid" in haystack or "híbrido" in haystack:
        return "Hybrid"
    if "remote" in haystack or "remoto" in haystack:
        return "Remote"
    if "on-site" in haystack or "onsite" in haystack or "presencial" in haystack:
        return "On-site"

    return None


def _resolve_employment_type(
        item: dict,
        job_card: Optional[dict],
        job_desc: Optional[dict],
        title: Optional[str],
        description: Optional[str],
) -> Optional[str]:
    direct = _deep_find_first_value_by_keys(
        [item, job_card, job_desc],
        [
            "employmentType",
            "jobType",
            "formattedEmploymentStatus",
            "employmentStatus",
        ],
    )
    direct_text = _normalize_scalar_text(direct)
    if direct_text:
        return direct_text

    candidate_texts = [
        title,
        description,
        _normalize_scalar_text(item.get("description")),
        _normalize_scalar_text(job_card.get("secondaryDescription")) if isinstance(job_card, dict) else None,
        _normalize_scalar_text(job_desc.get("descriptionText")) if isinstance(job_desc, dict) else None,
    ]
    text = " ".join(x for x in candidate_texts if x)
    lower = text.lower()

    patterns = [
        (r"\bfull[- ]?time\b", "Full-time"),
        (r"\bpart[- ]?time\b", "Part-time"),
        (r"\bcontract(or)?\b", "Contract"),
        (r"\bhourly contract\b", "Contract"),
        (r"\btemporary\b", "Temporary"),
        (r"\bintern(ship)?\b", "Internship"),
        (r"\bfreelance\b", "Freelance"),
        (r"\bestágio\b", "Internship"),
        (r"\btemporário\b", "Temporary"),
        (r"\btempo integral\b", "Full-time"),
        (r"\bmeio período\b", "Part-time"),
        (r"\btempo parcial\b", "Part-time"),
        (r"\bpj\b", "Contract"),
        (r"\bclt\b", "Full-time"),
    ]

    for pattern, label in patterns:
        if re.search(pattern, lower):
            return label

    return None


def _resolve_promoted_status(item: dict, job_card: Optional[dict]) -> Optional[str]:
    value = _deep_find_first_value_by_keys(
        [item, job_card],
        ["promoted", "isPromoted", "promotedJob", "promotionType", "sponsored"],
    )

    if isinstance(value, bool):
        return "Promoted" if value else "Not promoted"

    text = _normalize_scalar_text(value)
    if text:
        return text

    return None


def _canonicalize_apply_method(
        cta_text: Optional[str],
        url: Optional[str],
        onsite_apply: Any,
        in_page_offsite_apply: Any,
) -> Optional[str]:
    text = (cta_text or "").strip().lower()
    url_lower = (url or "").lower()

    if onsite_apply is True or "linkedin.com/job-apply/" in url_lower:
        return "Easy Apply"

    if "company website" in text:
        return "Apply on company website"

    if in_page_offsite_apply is True:
        return "Apply on company website"

    if url and "linkedin.com/job-apply/" not in url_lower:
        return "Apply on company website"

    if text in {"easy apply", "easy apply to this job"}:
        return "Easy Apply"

    if text in {"apply", "apply now"}:
        return "Apply"

    if cta_text:
        return cta_text.strip()

    return None


def _resolve_apply_fields(
        job_id: str,
        item: dict,
        job_card: Optional[dict],
        included: list[dict],
) -> tuple[Optional[str], Optional[str]]:
    app_nodes = _find_related_entities(
        included,
        "com.linkedin.voyager.dash.jobs.JobSeekerApplicationDetail",
        job_id,
    )

    candidate_nodes: list[dict] = []
    candidate_nodes.extend([n for n in app_nodes if isinstance(n, dict)])
    if isinstance(item, dict):
        candidate_nodes.append(item)
    if isinstance(job_card, dict):
        candidate_nodes.append(job_card)

    url = None
    method = None

    for node in candidate_nodes:
        if not isinstance(node, dict):
            continue

        if url is None:
            raw_url = _deep_find_first_value_by_keys(
                node,
                [
                    "companyApplyUrl",
                    "applyUrl",
                    "offsiteApplyUrl",
                    "externalApplyUrl",
                    "jobApplyUrl",
                ],
            )
            if _is_http_url(raw_url) and not _is_probable_image_url(raw_url):
                url = raw_url

        cta = node.get("applyCtaText")
        cta_text = _extract_plain_text(cta)

        onsite_apply = node.get("onsiteApply")
        in_page_offsite_apply = node.get("inPageOffsiteApply")

        if method is None:
            method = _canonicalize_apply_method(
                cta_text=cta_text,
                url=url,
                onsite_apply=onsite_apply,
                in_page_offsite_apply=in_page_offsite_apply,
            )

        if method is None:
            raw_method = _deep_find_first_value_by_keys(
                node,
                [
                    "applyMethod",
                    "applyMethodType",
                    "applyType",
                    "applicationType",
                ],
            )
            raw_method_text = _extract_plain_text(raw_method) or _normalize_scalar_text(raw_method)
            method = _canonicalize_apply_method(
                cta_text=raw_method_text,
                url=url,
                onsite_apply=onsite_apply,
                in_page_offsite_apply=in_page_offsite_apply,
            )

    if url and method is None:
        if "linkedin.com/job-apply/" in url.lower():
            method = "Easy Apply"
        else:
            method = "Apply on company website"

    if isinstance(url, str) and _is_probable_image_url(url):
        url = None

    return method, url


def _resolve_posted_time(item: dict, job_desc: Optional[dict]) -> Optional[str]:
    if isinstance(job_desc, dict):
        posted_on = _normalize_scalar_text(job_desc.get("postedOnText"))
        if posted_on:
            return posted_on

    direct = _deep_find_first_value_by_keys(item, ["formattedListedAt", "listedAt", "postedAt", "createdAt"])

    text = _normalize_scalar_text(direct)
    if text and not text.isdigit():
        return text

    epoch_formatted = _format_epoch_millis(direct)
    if epoch_formatted:
        return epoch_formatted

    return None


# ---------------------------------------------------------------------------
# Diagnostics
# ---------------------------------------------------------------------------

def print_dataclass_field_coverage(parsed_jobs: list[LinkedInJob]) -> dict[str, list[str]]:
    rows = [asdict(job) for job in parsed_jobs]
    field_names = [f.name for f in dataclass_fields(LinkedInJob)]
    parser_fields = sorted({k for row in rows for k in row.keys()})

    structure_missing = [f for f in field_names if f not in parser_fields]
    extras = [f for f in parser_fields if f not in field_names]

    total = len(rows)
    never_populated = []
    partially_populated = []
    fully_populated = []

    print("\n" + "=" * 80)
    print("DATACLASS FIELD COVERAGE")
    print("=" * 80)
    print("Dataclass fields:", field_names)
    print("Parser fields:   ", parser_fields)

    if structure_missing:
        print("\nFields missing from parser structure:")
        for field_name in structure_missing:
            print(f"  - {field_name}")
    else:
        print("\nAll dataclass fields are present in parser output.")

    print("\nPopulation by field:")
    for field_name in field_names:
        populated_count = 0

        for row in rows:
            value = row.get(field_name)
            if value is None:
                continue
            if isinstance(value, str) and not value.strip():
                continue
            if value in ("Unknown Company", "Unknown Title"):
                continue
            populated_count += 1

        print(f"  - {field_name}: {populated_count}/{total}")

        if populated_count == 0:
            never_populated.append(field_name)
        elif populated_count < total:
            partially_populated.append(field_name)
        else:
            fully_populated.append(field_name)

    return {
        "structure_missing": structure_missing,
        "never_populated": never_populated,
        "partially_populated": partially_populated,
        "fully_populated": fully_populated,
        "extras": extras,
    }


def print_null_reason_summary(response_json: dict, parsed_jobs: list[LinkedInJob]):
    included = response_json.get("included", [])
    total_jobs = len(parsed_jobs)

    application_detail_count = sum(
        1
        for item in included
        if isinstance(item, dict)
        and item.get("$type") == "com.linkedin.voyager.dash.jobs.JobSeekerApplicationDetail"
    )

    workplace_type_count = sum(
        1
        for item in included
        if isinstance(item, dict)
        and item.get("$type") == "com.linkedin.voyager.dash.jobs.WorkplaceType"
    )

    promoted_found = 0
    for job in parsed_jobs:
        if job.promoted_status:
            promoted_found += 1

    print("\n" + "=" * 80)
    print("WHY SOME FIELDS ARE NULL")
    print("=" * 80)
    print(
        f"- apply_method / company_apply_url: this response contains "
        f"{application_detail_count} JobSeekerApplicationDetail entities for {total_jobs} jobs."
    )
    print(
        "  If a job does not have a JobSeekerApplicationDetail node, "
        "LinkedIn often does not expose apply metadata in this payload."
    )
    print(
        "- employment_type: LinkedIn usually does not send a dedicated employment type "
        "for every job in this prefetch response."
    )
    print(
        "  The parser only fills it when the field exists directly or when the text clearly "
        "contains signals like Full-time / Part-time / Contract / CLT / PJ."
    )
    print(
        f"- promoted_status: populated {promoted_found}/{total_jobs}."
    )
    print(
        "  In this JOB_DETAILS prefetch payload, promoted/sponsored markers are often absent, "
        "so null is expected unless LinkedIn exposes a reliable flag."
    )
    print(
        f"- workplace_type: there are only {workplace_type_count} WorkplaceType entities in the response,"
        " so many workplace values must be inferred from text."
    )


def debug_missing_field_sources(response_json: dict, fields_to_debug: list[str], max_jobs: int = 3):
    included = response_json.get("included", [])
    urn_map = _build_urn_map(included)

    debugged = 0
    for item in included:
        if not isinstance(item, dict):
            continue
        if item.get("$type") != "com.linkedin.voyager.dash.jobs.JobPosting":
            continue

        job_urn = item.get("entityUrn")
        job_id = _extract_job_id_from_urn(job_urn)
        if not job_id:
            continue

        job_card = _resolve_job_card(job_id, urn_map)
        job_desc = _resolve_job_description_node(job_id, urn_map, job_card)
        company_node = _resolve_company_node(item, urn_map)
        geo_node = _resolve_geo_node(item, urn_map)
        app_nodes = _find_related_entities(
            included,
            "com.linkedin.voyager.dash.jobs.JobSeekerApplicationDetail",
            job_id,
        )

        print("\n" + "-" * 80)
        print(f"DEBUG JOB {job_id}")
        print("-" * 80)
        print(f"entityUrn: {job_urn}")

        related_nodes = {
            "job_posting": item,
            "job_posting_card": job_card,
            "job_description": job_desc,
            "company": company_node,
            "geo": geo_node,
            "application_detail": app_nodes[0] if app_nodes else None,
        }

        for field_name in fields_to_debug:
            keywords = FIELD_DEBUG_KEYWORDS.get(field_name, [])
            print(f"\n[field={field_name}] keywords={keywords}")

            hit_any = False
            for label, node in related_nodes.items():
                if not isinstance(node, dict):
                    continue

                matches = _find_key_matches(node, keywords, max_results=5)
                if not matches:
                    continue

                hit_any = True
                print(f"  node={label}")
                for path, hit_keys, matched_node in matches[:3]:
                    print(f"    path={path}")
                    print(f"    matching keys={hit_keys}")
                    print(_json_preview(matched_node, max_chars=1000))

            if not hit_any:
                print("  no candidate keys found in related nodes")

        debugged += 1
        if debugged >= max_jobs:
            break


def inspect_response(resp: dict):
    print("\n" + "=" * 80)
    print("RESPONSE SHAPE")
    print("=" * 80)

    entities = []
    included = resp.get("included")
    if isinstance(included, list):
        for i, item in enumerate(included):
            if isinstance(item, dict):
                entities.append((f"$.included[{i}]", item))

    data_root = resp.get("data")
    if isinstance(data_root, dict):
        for k, v in data_root.items():
            if isinstance(v, dict):
                entities.append((f"$.data.{k}", v))
            elif isinstance(v, list):
                for i, item in enumerate(v):
                    if isinstance(item, dict):
                        entities.append((f"$.data.{k}[{i}]", item))

    type_counts = Counter(_entity_type(node) for _, node in entities)
    for entity_type, count in type_counts.most_common(20):
        print(f"{count:>4}  {entity_type}")


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def parse_linkedin_graphql(response_json: dict) -> list[LinkedInJob]:
    included = response_json.get("included", [])
    urn_map = _build_urn_map(included)

    results: list[LinkedInJob] = []

    for item in included:
        if not isinstance(item, dict):
            continue
        if item.get("$type") != "com.linkedin.voyager.dash.jobs.JobPosting":
            continue

        job_urn = item.get("entityUrn")
        job_id = _extract_job_id_from_urn(job_urn)
        if not job_id:
            continue

        job_card = _resolve_job_card(job_id, urn_map)
        job_desc = _resolve_job_description_node(job_id, urn_map, job_card)

        title = _resolve_title(item, job_card) or "Unknown Title"
        company_name = _resolve_company_name(item, job_card, urn_map) or "Unknown Company"
        description_text = _resolve_description_text(item, job_desc)
        location = _resolve_location(item, job_card, urn_map)
        company_logo_url = _resolve_company_logo_url(item, job_card, urn_map)
        workplace_type = _resolve_workplace_type(item, title, location, description_text, urn_map)
        employment_type = _resolve_employment_type(item, job_card, job_desc, title, description_text)
        promoted_status = _resolve_promoted_status(item, job_card)
        apply_method, company_apply_url = _resolve_apply_fields(job_id, item, job_card, included)
        posted_time = _resolve_posted_time(item, job_desc)

        snippet = None
        if description_text:
            one_line = description_text.replace("\n", " ").strip()
            snippet = one_line[:220] + ("..." if len(one_line) > 220 else "")

        job = LinkedInJob(
            job_id=job_id,
            title=title,
            description_snippet=snippet,
            company_name=company_name,
            location=location,
            company_logo_url=company_logo_url,
            workplace_type=workplace_type,
            employment_type=employment_type,
            promoted_status=promoted_status,
            apply_method=apply_method,
            company_apply_url=company_apply_url,
            posted_time=posted_time,
        )

        results.append(job)

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, "linkedin_graphql_response.json")

    if not os.path.exists(input_path):
        print(f"❌ Could not find {input_path}")
        print("Please make sure linkedin_graphql_response.json exists in the same folder.")
        raise SystemExit(1)

    print(f"Loading data from {input_path}...")
    with open(input_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    parsed_jobs = parse_linkedin_graphql(data)

    print(f"\n✅ Successfully extracted {len(parsed_jobs)} structured jobs:")
    for job in parsed_jobs:
        print(
            f"- {job.title} | {job.location or '-'} | {job.company_name} | job_id={job.job_id}"
        )

    coverage = print_dataclass_field_coverage(parsed_jobs)
    print_null_reason_summary(data, parsed_jobs)

    fields_to_debug = []
    for field_name in coverage["structure_missing"] + coverage["never_populated"]:
        if field_name not in fields_to_debug:
            fields_to_debug.append(field_name)

    for field_name in coverage["partially_populated"]:
        if field_name not in ("job_id", "title", "description_snippet") and field_name not in fields_to_debug:
            fields_to_debug.append(field_name)

    if fields_to_debug:
        debug_missing_field_sources(data, fields_to_debug=fields_to_debug, max_jobs=3)
    else:
        print("\nAll fields are populated for all parsed jobs.")

    inspect_response(data)

    output_path = os.path.join(script_dir, "linkedin_graphql_parsed_jobs.json")
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump([asdict(job) for job in parsed_jobs], fh, indent=2, ensure_ascii=False)

    print(f"\nSaved parsed output to {output_path}")
