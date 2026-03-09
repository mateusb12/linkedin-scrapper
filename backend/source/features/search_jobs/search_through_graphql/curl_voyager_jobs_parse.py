import json
import re
import os
from collections import Counter
from dataclasses import dataclass, asdict, fields as dataclass_fields
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
    "company_logo_url": ["logo", "image", "vector", "artwork", "picture"],
    "workplace_type": ["workplace", "remote", "hybrid", "onsite"],
    "employment_type": ["employment", "jobtype", "job_type"],
    "promoted_status": ["promot", "fitlevel", "match", "skill"],
    "apply_method": ["apply", "easy", "offsite"],
    "company_apply_url": ["apply", "offsite", "url"],
    "posted_time": ["listed", "posted", "created", "time", "date"],
}


# ---------------------------------------------------------------------------
# Diagnostic helpers
# ---------------------------------------------------------------------------

def _json_preview(obj: Any, max_chars: int = 1200) -> str:
    try:
        text = json.dumps(obj, indent=2, ensure_ascii=False)
    except Exception:
        text = repr(obj)

    if len(text) > max_chars:
        return text[:max_chars] + "\n... [truncated]"
    return text


def _type_summary(obj: Any, depth: int = 0, max_depth: int = 3) -> str:
    indent = "  " * depth

    if isinstance(obj, dict):
        if depth >= max_depth:
            return f"{{dict, {len(obj)} keys: {list(obj.keys())[:8]}}}"

        lines = [f"dict ({len(obj)} keys):"]
        for k, v in list(obj.items())[:15]:
            lines.append(
                f"{indent}  {k!r}: {_type_summary(v, depth + 1, max_depth)}"
            )

        if len(obj) > 15:
            lines.append(f"{indent}  ... ({len(obj) - 15} more keys)")

        return "\n".join(lines)

    if isinstance(obj, list):
        if not obj:
            return "[] (empty list)"

        if depth >= max_depth:
            return (
                f"[list, {len(obj)} items, "
                f"first type={type(obj[0]).__name__}]"
            )

        sample = _type_summary(obj[0], depth + 1, max_depth)
        return (
            f"list ({len(obj)} items), first item:\n"
            f"{indent}  {sample}"
        )

    if isinstance(obj, str):
        preview = obj[:120].replace("\n", "\\n")
        return f"str({len(obj)}): {preview!r}"

    return f"{type(obj).__name__}: {str(obj)[:80]}"


def _walk(obj: Any, path: str = "$"):
    yield path, obj

    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from _walk(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj[:100]):
            yield from _walk(v, f"{path}[{i}]")


def _extract_text(value: Any, max_parts: int = 8) -> Optional[str]:
    parts: list[str] = []

    def rec(v: Any):
        if len(parts) >= max_parts:
            return

        if isinstance(v, str):
            text = " ".join(v.split())
            if text and text not in parts:
                parts.append(text)
            return

        if isinstance(v, dict):
            for key in (
                    "text", "rawText", "formattedText", "accessibilityText",
                    "title", "name", "companyName", "subtitle", "description",
                    "defaultLocalizedName", "localizedName", "abbreviatedLocalizedName",
            ):
                if key in v:
                    rec(v[key])
                    if len(parts) >= max_parts:
                        return

            for _, sub in list(v.items())[:10]:
                rec(sub)
                if len(parts) >= max_parts:
                    return
            return

        if isinstance(v, list):
            for sub in v[:8]:
                rec(sub)
                if len(parts) >= max_parts:
                    return

    rec(value)

    if not parts:
        return None

    joined = " | ".join(parts)
    if len(joined) > 1000:
        joined = joined[:1000] + "..."
    return joined


def _find_first_text_for_keys(obj: Any, target_keys: list[str]) -> Optional[str]:
    wanted = {k.lower() for k in target_keys}

    for _, node in _walk(obj):
        if not isinstance(node, dict):
            continue

        for k, v in node.items():
            if str(k).lower() in wanted:
                text = _extract_text(v)
                if text:
                    return text

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


def _entity_type(node: dict) -> str:
    return (
            node.get("$type")
            or node.get("entityType")
            or node.get("type")
            or "__unknown__"
    )


def _collect_entities(resp: dict) -> list[tuple[str, dict]]:
    entities: list[tuple[str, dict]] = []

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

    return entities


def _extract_job_candidates(entities: list[tuple[str, dict]], max_results: int = 10):
    results = []
    seen = set()

    for path, node in entities:
        blob = _json_preview(node, max_chars=4000).lower()

        if not any(
                term in blob
                for term in (
                        "description", "jobposting", "jobtitle", "companyname",
                        "formatteddescription", "jobpostingcard",
                )
        ):
            continue

        urn = (
                _extract_text(node.get("entityUrn"))
                or _extract_text(node.get("trackingUrn"))
                or _find_first_text_for_keys(node, ["entityUrn", "trackingUrn"])
        )

        title = (
                _extract_text(node.get("title"))
                or _extract_text(node.get("jobTitle"))
                or _find_first_text_for_keys(node, ["title", "jobTitle", "listedAt"])
        )

        company = (
                _extract_text(node.get("companyName"))
                or _extract_text(node.get("company"))
                or _extract_text(node.get("subtitle"))
                or _find_first_text_for_keys(node, ["companyName", "company", "subtitle"])
        )

        description = (
                _extract_text(node.get("description"))
                or _extract_text(node.get("formattedDescription"))
                or _extract_text(node.get("jobPostingDescription"))
                or _find_first_text_for_keys(
            node,
            [
                "description", "formattedDescription",
                "jobPostingDescription", "descriptionText",
            ],
        )
        )

        entity_type = _entity_type(node)

        signature = (urn, title, company, description[:120] if description else None)
        if signature in seen:
            continue
        seen.add(signature)

        if title or company or description:
            results.append(
                {
                    "path": path,
                    "type": entity_type,
                    "urn": urn,
                    "title": title,
                    "company": company,
                    "description": description,
                }
            )

        if len(results) >= max_results:
            break

    return results


def _extract_job_id_from_urn(urn: Optional[str]) -> Optional[str]:
    if not isinstance(urn, str):
        return None
    match = re.search(r"[:(](\d+)(?:,|\)|$)", urn)
    return match.group(1) if match else None


def _normalize_scalar_text(value: Any) -> Optional[str]:
    text = _extract_text(value)
    if not text:
        return None
    stripped = text.strip()
    return stripped or None


def _first_string_ref(node: Any, urn_map: dict[str, dict], type_hint: Optional[str] = None) -> Optional[dict]:
    if not isinstance(node, dict):
        return None

    for _, val in node.items():
        if isinstance(val, str) and val in urn_map:
            resolved = urn_map[val]
            if type_hint is None or resolved.get("$type") == type_hint:
                return resolved
    return None


def _resolve_company_name(item: dict, urn_map: dict[str, dict]) -> Optional[str]:
    direct = _normalize_scalar_text(item.get("companyName"))
    if direct:
        return direct

    company_details = item.get("companyDetails")
    if not isinstance(company_details, dict):
        return None

    company_obj = company_details.get("company")
    if isinstance(company_obj, dict):
        nested_name = _normalize_scalar_text(
            company_obj.get("name")
            or company_obj.get("companyName")
            or company_obj
        )
        if nested_name:
            return nested_name

    company_node = _first_string_ref(
        company_details,
        urn_map,
        type_hint="com.linkedin.voyager.dash.organization.Company",
    )
    if isinstance(company_node, dict):
        company_name = _normalize_scalar_text(
            company_node.get("name")
            or company_node.get("localizedName")
            or company_node
        )
        if company_name:
            return company_name

    return _find_first_text_for_keys(company_details, ["companyName", "name"])


def _resolve_description(item: dict, urn_map: dict[str, dict]) -> str:
    desc_urn = item.get("*description")
    desc_obj = None

    if isinstance(desc_urn, str):
        desc_obj = urn_map.get(desc_urn)

    if not isinstance(desc_obj, dict):
        return ""

    desc_val = desc_obj.get("description") or desc_obj.get("text") or desc_obj
    text = _normalize_scalar_text(desc_val)
    return text or ""


def _resolve_job_card(job_id: Optional[str], urn_map: dict[str, dict]) -> Optional[dict]:
    if not job_id:
        return None
    job_card_urn = f"urn:li:fsd_jobPostingCard:({job_id},JOB_DETAILS)"
    return urn_map.get(job_card_urn)


def _resolve_company_node(item: dict, urn_map: dict[str, dict]) -> Optional[dict]:
    company_details = item.get("companyDetails")
    if not isinstance(company_details, dict):
        return None

    company_obj = company_details.get("company")
    if isinstance(company_obj, dict):
        return company_obj

    return _first_string_ref(
        company_details,
        urn_map,
        type_hint="com.linkedin.voyager.dash.organization.Company",
    )


def _best_effort_extract_field(
        field_name: str,
        item: dict,
        job_card: Optional[dict],
        company_node: Optional[dict],
) -> Optional[str]:
    candidates: list[Any] = []

    if field_name == "location":
        candidates = [
            item.get("formattedLocation"), item.get("location"),
            item.get("formattedJobLocation"), item.get("jobLocation"),
            job_card.get("location") if isinstance(job_card, dict) else None,
            job_card.get("formattedLocation") if isinstance(job_card, dict) else None,
            item.get("primaryDescription"), item.get("secondaryDescription"),
        ]
    elif field_name == "company_logo_url":
        candidates = [
            company_node.get("logo") if isinstance(company_node, dict) else None,
            company_node.get("image") if isinstance(company_node, dict) else None,
            company_node.get("logoImage") if isinstance(company_node, dict) else None,
            job_card.get("companyLogo") if isinstance(job_card, dict) else None,
            job_card.get("logo") if isinstance(job_card, dict) else None,
        ]
    elif field_name == "workplace_type":
        candidates = [
            item.get("workplaceType"),
            job_card.get("workplaceType") if isinstance(job_card, dict) else None,
        ]
    elif field_name == "employment_type":
        candidates = [
            item.get("employmentType"), item.get("jobType"),
            job_card.get("employmentType") if isinstance(job_card, dict) else None,
            job_card.get("jobType") if isinstance(job_card, dict) else None,
        ]
    elif field_name == "promoted_status":
        candidates = [
            item.get("promoted"), item.get("promotionType"),
            job_card.get("promoted") if isinstance(job_card, dict) else None,
            job_card.get("promotionalCard") if isinstance(job_card, dict) else None,
            job_card.get("jobFitLevelCard") if isinstance(job_card, dict) else None,
        ]
    elif field_name == "apply_method":
        candidates = [
            item.get("applyMethod"), item.get("applyMethodType"),
            job_card.get("applyMethod") if isinstance(job_card, dict) else None,
        ]
    elif field_name == "company_apply_url":
        candidates = [
            item.get("companyApplyUrl"), item.get("applyUrl"), item.get("offsiteApplyUrl"),
            job_card.get("companyApplyUrl") if isinstance(job_card, dict) else None,
            job_card.get("applyUrl") if isinstance(job_card, dict) else None,
            job_card.get("offsiteApplyUrl") if isinstance(job_card, dict) else None,
        ]
    elif field_name == "posted_time":
        candidates = [
            item.get("listedAt"), item.get("postedAt"), item.get("formattedListedAt"),
            job_card.get("listedAt") if isinstance(job_card, dict) else None,
            job_card.get("postedAt") if isinstance(job_card, dict) else None,
            job_card.get("formattedListedAt") if isinstance(job_card, dict) else None,
        ]

    for candidate in candidates:
        text = _normalize_scalar_text(candidate)
        if text:
            return text
    return None


def _print_resolved_refs(label: str, node: Optional[dict], urn_map: dict[str, dict]):
    if not isinstance(node, dict):
        return

    refs = {
        k: v for k, v in node.items()
        if k.startswith("*") and isinstance(v, str)
    }

    if not refs:
        return

    print(f"\n{label} URN refs:")
    for key, urn in refs.items():
        resolved = urn_map.get(urn)
        if resolved:
            print(
                f"  {key}: {urn} -> "
                f"{resolved.get('$type', '__unknown__')} "
                f"keys={list(resolved.keys())[:12]}"
            )
        else:
            print(f"  {key}: {urn} -> [UNRESOLVED]")


def print_dataclass_field_coverage(parsed_jobs: list[dict]) -> dict[str, list[str]]:
    field_names = [f.name for f in dataclass_fields(LinkedInJob)]
    parser_fields = sorted({k for job in parsed_jobs for k in job.keys()})

    structure_missing = [f for f in field_names if f not in parser_fields]
    extras = [f for f in parser_fields if f not in field_names]

    total = len(parsed_jobs)
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
        for job in parsed_jobs:
            value = job.get(field_name)
            if value is None: continue
            if isinstance(value, str) and not value.strip(): continue
            if value in ("Unknown Company", "Unknown Title"): continue
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


def debug_missing_field_sources(
        response_json: dict,
        fields_to_debug: list[str],
        max_jobs: int = 3,
):
    included = response_json.get("included", [])

    urn_map: dict[str, dict] = {}
    for item in included:
        if not isinstance(item, dict): continue
        urn = item.get("entityUrn") or item.get("urn")
        if isinstance(urn, str): urn_map[urn] = item

    debugged = 0

    for item in included:
        if not isinstance(item, dict): continue
        if item.get("$type") != "com.linkedin.voyager.dash.jobs.JobPosting": continue

        job_urn = item.get("entityUrn")
        job_id = _extract_job_id_from_urn(job_urn)
        if not job_id: continue

        job_card = _resolve_job_card(job_id, urn_map)
        job_desc = urn_map.get(f"urn:li:fsd_jobDescription:{job_id}")
        company_details = item.get("companyDetails")
        company_node = _resolve_company_node(item, urn_map)

        print("\n" + "-" * 80)
        print(f"DEBUG JOB {job_id}")
        print("-" * 80)
        print(f"entityUrn: {job_urn}")

        _print_resolved_refs("JobPosting", item, urn_map)

        related_nodes = {
            "job_posting": item,
            "job_posting_card": job_card,
            "job_description": job_desc,
            "company": company_node,
            "company_details": company_details,
        }

        for field_name in fields_to_debug:
            keywords = FIELD_DEBUG_KEYWORDS.get(field_name, [])
            print(f"\n[field={field_name}] keywords={keywords}")

            hit_any = False
            for label, node in related_nodes.items():
                if not isinstance(node, dict): continue

                matches = _find_key_matches(node, keywords, max_results=5)
                if not matches: continue

                hit_any = True
                print(f"  node={label}")
                for path, hit_keys, matched_node in matches[:3]:
                    print(f"    path={path}")
                    print(f"    matching keys={hit_keys}")
                    print(_json_preview(matched_node, max_chars=1200))

            if not hit_any:
                print("  no candidate keys found in related nodes")

        debugged += 1
        if debugged >= max_jobs: break


def inspect_response(resp: dict):
    print("\n" + "=" * 80)
    print("RESPONSE SHAPE")
    print("=" * 80)

    entities = _collect_entities(resp)
    type_counts = Counter(_entity_type(node) for _, node in entities)

    if type_counts:
        for entity_type, count in type_counts.most_common(20):
            print(f"{count:>4}  {entity_type}")

    candidates = _extract_job_candidates(entities, max_results=10)
    if candidates:
        print("\n" + "=" * 80)
        print("BEST-EFFORT PARSED JOB CANDIDATES")
        print("=" * 80)
        for idx, item in enumerate(candidates, start=1):
            print(f"\n[{idx}] {item['path']}")
            print(f"Title:       {item['title'] or '-'}")
            print(f"Company:     {item['company'] or '-'}")


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def parse_linkedin_graphql(response_json: dict) -> list[dict]:
    included = response_json.get("included", [])

    urn_map: dict[str, dict] = {}
    for item in included:
        if not isinstance(item, dict): continue
        urn = item.get("entityUrn") or item.get("urn")
        if isinstance(urn, str):
            urn_map[urn] = item

    results: list[dict] = []

    for item in included:
        if not isinstance(item, dict): continue
        if item.get("$type", "") != "com.linkedin.voyager.dash.jobs.JobPosting": continue

        job_urn = item.get("entityUrn")
        job_id = _extract_job_id_from_urn(job_urn)
        if not job_id: continue

        title = _normalize_scalar_text(item.get("title")) or "Unknown Title"
        company_name = _resolve_company_name(item, urn_map) or "Unknown Company"
        description_text = _resolve_description(item, urn_map)

        job_card = _resolve_job_card(job_id, urn_map)
        company_node = _resolve_company_node(item, urn_map)

        job = LinkedInJob(
            job_id=job_id,
            title=title,
            description_snippet=(
                description_text[:100].replace("\n", " ").strip() + "..."
                if description_text else None
            ),
            company_name=company_name,
            location=_best_effort_extract_field("location", item, job_card, company_node),
            company_logo_url=_best_effort_extract_field("company_logo_url", item, job_card, company_node),
            workplace_type=_best_effort_extract_field("workplace_type", item, job_card, company_node),
            employment_type=_best_effort_extract_field("employment_type", item, job_card, company_node),
            promoted_status=_best_effort_extract_field("promoted_status", item, job_card, company_node),
            apply_method=_best_effort_extract_field("apply_method", item, job_card, company_node),
            company_apply_url=_best_effort_extract_field("company_apply_url", item, job_card, company_node),
            posted_time=_best_effort_extract_field("posted_time", item, job_card, company_node),
        )

        results.append(asdict(job))

    return results


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, "linkedin_graphql_response.json")

    if not os.path.exists(input_path):
        print(f"❌ Could not find {input_path}")
        print("Please run fetch_jobs.py first.")
        raise SystemExit(1)

    print(f"Loading data from {input_path}...")
    with open(input_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    clean_jobs = parse_linkedin_graphql(data)
    print(f"\n✅ Successfully extracted {len(clean_jobs)} structured jobs:")

    for job in clean_jobs:
        print(f"- {job['title']} | {job['company_name']} | job_id={job['job_id']}")

    coverage = print_dataclass_field_coverage(clean_jobs)

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
