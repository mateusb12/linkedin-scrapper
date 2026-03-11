"""
Parse LinkedIn GraphQL search-response JSON into practical dataclasses and run
a consistency audit with debug prints.

What this script does:
1) Loads the raw JSON response.
2) Extracts search metadata, paging, geo, company, verification and job-card data.
3) Merges linked objects into a single ParsedJobCard dataclass.
4) Prints audit/debug information for sparse, missing or inconsistent fields.
5) Optionally saves the parsed jobs to JSON.

Usage:
    python linkedin_graphql_parser_audit.py
    python linkedin_graphql_parser_audit.py /path/to/linkedin_graphql_response.json
    python linkedin_graphql_parser_audit.py /path/to/input.json --save-json /tmp/parsed_jobs.json
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass, fields
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass
class SearchMetadata:
    keywords: Optional[str]
    origin: Optional[str]
    geo_urn: Optional[str]
    pre_dash_geo_urn: Optional[str]
    reference_id: Optional[str]
    title: Optional[str]
    subtitle: Optional[str]


@dataclass
class PagingInfo:
    total: Optional[int]
    start: Optional[int]
    count: Optional[int]


@dataclass
class GeoInfo:
    entity_urn: str
    full_localized_name: Optional[str]
    default_localized_name: Optional[str]
    default_localized_name_without_country: Optional[str]


@dataclass
class CompanyLogoArtifact:
    width: Optional[int]
    height: Optional[int]
    file_identifying_url_path_segment: Optional[str]
    expires_at: Optional[int]


@dataclass
class Company:
    entity_urn: str
    logo_root_url: Optional[str]
    logo_artifacts: List[CompanyLogoArtifact]


@dataclass
class JobPostingVerification:
    entity_urn: str
    control_name: Optional[str]
    badge_system_image: Optional[str]
    action_target: Optional[str]
    lego_tracking_token: Optional[str]


@dataclass
class JobPostingState:
    entity_urn: str
    tracking_urn: Optional[str]
    title: Optional[str]
    reposted_job: Optional[bool]
    content_source: Optional[str]
    poster_id: Optional[str]


@dataclass
class ParsedJobCard:
    # identity
    job_id: str
    card_entity_urn: str
    search_card_urn: str
    job_details_card_urn: Optional[str]
    job_posting_urn: Optional[str]
    normalized_job_posting_urn: Optional[str]

    # visible card data
    title: Optional[str]
    title_accessibility_text: Optional[str]
    title_raw_from_job_posting: Optional[str]
    company_name: Optional[str]
    location_text: Optional[str]

    # linked entities
    company_urn: Optional[str]
    verification_urn: Optional[str]

    # company / verification enrichments
    company_page_url: Optional[str]
    company_logo_root_url: Optional[str]
    company_logo_url: Optional[str]
    verification_control_name: Optional[str]
    verification_badge_system_image: Optional[str]
    verification_action_target: Optional[str]

    # job posting enrichments
    tracking_urn: Optional[str]
    reposted_job: Optional[bool]
    content_source: Optional[str]
    poster_id: Optional[str]

    # diagnostic fields
    blurred: Optional[bool]
    has_job_posting_record: bool
    has_verification_record: bool
    has_company_record: bool
    has_job_details_stub: bool

    # description-related diagnostic
    description_snippet: Optional[str]


@dataclass
class ParseOutput:
    search_metadata: SearchMetadata
    paging: PagingInfo
    geo: Optional[GeoInfo]
    jobs: List[ParsedJobCard]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def text_value(value: Any) -> Optional[str]:
    if isinstance(value, dict):
        return value.get("text")
    if isinstance(value, str):
        return value
    return None


def normalize_whitespace(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.replace("\u00a0", " ")
    value = re.sub(r"\s+", " ", value).strip()
    return value or None


def extract_job_id_from_urn(urn: Optional[str]) -> Optional[str]:
    if not urn:
        return None
    match = re.search(r"\((\d+),", urn)
    if match:
        return match.group(1)
    match = re.search(r":(\d+)$", urn)
    if match:
        return match.group(1)
    return None


def build_entity_index(included: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {
        item["entityUrn"]: item
        for item in included
        if isinstance(item, dict) and item.get("entityUrn")
    }


def extract_company_urn_from_logo(logo: Optional[Dict[str, Any]]) -> Optional[str]:
    if not isinstance(logo, dict):
        return None

    for attr in logo.get("attributes", []):
        if not isinstance(attr, dict):
            continue

        detail_union = attr.get("detailDataUnion") or {}
        if isinstance(detail_union, dict) and detail_union.get("companyLogo"):
            return detail_union["companyLogo"]

        detail_data = attr.get("detailData") or {}
        if isinstance(detail_data, dict) and detail_data.get("*companyLogo"):
            return detail_data["*companyLogo"]

    return None


def extract_badge_system_image(badge: Optional[Dict[str, Any]]) -> Optional[str]:
    if not isinstance(badge, dict):
        return None

    for attr in badge.get("attributes", []):
        if not isinstance(attr, dict):
            continue
        detail_union = attr.get("detailDataUnion") or {}
        if isinstance(detail_union, dict) and detail_union.get("systemImage"):
            return detail_union["systemImage"]

    return None


def company_logo_artifacts(company_obj: Optional[Dict[str, Any]]) -> List[CompanyLogoArtifact]:
    if not isinstance(company_obj, dict):
        return []

    vector = ((company_obj.get("logo") or {}).get("vectorImage") or {})
    artifacts = vector.get("artifacts") or []
    out: List[CompanyLogoArtifact] = []

    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue
        out.append(
            CompanyLogoArtifact(
                width=artifact.get("width"),
                height=artifact.get("height"),
                file_identifying_url_path_segment=artifact.get("fileIdentifyingUrlPathSegment"),
                expires_at=artifact.get("expiresAt"),
            )
        )

    return out


def best_company_logo_url(company_obj: Optional[Dict[str, Any]]) -> Optional[str]:
    if not isinstance(company_obj, dict):
        return None

    vector = ((company_obj.get("logo") or {}).get("vectorImage") or {})
    root_url = vector.get("rootUrl")
    artifacts = vector.get("artifacts") or []

    if not root_url or not artifacts:
        return None

    best = None
    best_score = -1
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue
        width = artifact.get("width") or 0
        height = artifact.get("height") or 0
        score = width * height
        if score > best_score:
            best_score = score
            best = artifact

    if not best:
        return None

    segment = best.get("fileIdentifyingUrlPathSegment")
    if not segment:
        return None

    return f"{root_url}{segment}"


def parse_search_metadata(data_obj: Dict[str, Any]) -> SearchMetadata:
    meta = data_obj.get("metadata") or {}
    return SearchMetadata(
        keywords=meta.get("keywords"),
        origin=meta.get("origin"),
        geo_urn=meta.get("geoUrn"),
        pre_dash_geo_urn=meta.get("preDashGeoUrn"),
        reference_id=meta.get("referenceId"),
        title=text_value(meta.get("title")),
        subtitle=text_value(meta.get("subtitle")),
    )


def parse_paging(data_obj: Dict[str, Any]) -> PagingInfo:
    paging = data_obj.get("paging") or {}
    return PagingInfo(
        total=paging.get("total"),
        start=paging.get("start"),
        count=paging.get("count"),
    )


def parse_geo(geo_obj: Optional[Dict[str, Any]]) -> Optional[GeoInfo]:
    if not isinstance(geo_obj, dict):
        return None

    return GeoInfo(
        entity_urn=geo_obj.get("entityUrn", ""),
        full_localized_name=geo_obj.get("fullLocalizedName"),
        default_localized_name=geo_obj.get("defaultLocalizedName"),
        default_localized_name_without_country=geo_obj.get("defaultLocalizedNameWithoutCountryName"),
    )


def parse_company(company_obj: Dict[str, Any]) -> Company:
    vector = ((company_obj.get("logo") or {}).get("vectorImage") or {})
    return Company(
        entity_urn=company_obj.get("entityUrn", ""),
        logo_root_url=vector.get("rootUrl"),
        logo_artifacts=company_logo_artifacts(company_obj),
    )


def parse_verification(verification_obj: Dict[str, Any]) -> JobPostingVerification:
    return JobPostingVerification(
        entity_urn=verification_obj.get("entityUrn", ""),
        control_name=verification_obj.get("controlName"),
        badge_system_image=extract_badge_system_image(verification_obj.get("badge")),
        action_target=((verification_obj.get("badge") or {}).get("actionTarget")),
        lego_tracking_token=verification_obj.get("legoTrackingToken"),
    )


def parse_job_posting(job_obj: Dict[str, Any]) -> JobPostingState:
    return JobPostingState(
        entity_urn=job_obj.get("entityUrn", ""),
        tracking_urn=job_obj.get("trackingUrn"),
        title=job_obj.get("title"),
        reposted_job=job_obj.get("repostedJob"),
        content_source=job_obj.get("contentSource"),
        poster_id=job_obj.get("posterId"),
    )


def is_stub_job_details_card(card_obj: Dict[str, Any]) -> bool:
    if not isinstance(card_obj, dict):
        return False
    keys = set(card_obj.keys())
    return keys <= {"entityUrn", "$recipeTypes", "$type"} and "JOB_DETAILS" in (card_obj.get("entityUrn") or "")


def related_job_details_urn(search_card_urn: Optional[str]) -> Optional[str]:
    if not search_card_urn:
        return None
    return search_card_urn.replace("JOBS_SEARCH", "JOB_DETAILS")


def parse_job_card(
        card_obj: Dict[str, Any],
        entity_index: Dict[str, Dict[str, Any]],
) -> ParsedJobCard:
    search_card_urn = card_obj.get("entityUrn")
    job_details_urn = related_job_details_urn(search_card_urn)

    job_posting_urn = card_obj.get("*jobPosting") or card_obj.get("jobPostingUrn")
    verification_urn = (
            card_obj.get("*jobPostingVerification")
            or card_obj.get("jobPostingVerificationUrn")
    )
    company_urn = extract_company_urn_from_logo(card_obj.get("logo"))

    job_obj = entity_index.get(job_posting_urn) if job_posting_urn else None
    verification_obj = entity_index.get(verification_urn) if verification_urn else None
    company_obj = entity_index.get(company_urn) if company_urn else None
    job_details_obj = entity_index.get(job_details_urn) if job_details_urn else None

    title_text = text_value(card_obj.get("title"))
    job_posting_title = job_obj.get("title") if isinstance(job_obj, dict) else None

    return ParsedJobCard(
        job_id=extract_job_id_from_urn(search_card_urn) or "UNKNOWN",
        card_entity_urn=search_card_urn or "",
        search_card_urn=search_card_urn or "",
        job_details_card_urn=job_details_urn,
        job_posting_urn=job_posting_urn,
        normalized_job_posting_urn=card_obj.get("preDashNormalizedJobPostingUrn"),
        title=title_text,
        title_accessibility_text=((card_obj.get("title") or {}).get("accessibilityText")),
        title_raw_from_job_posting=job_posting_title,
        company_name=text_value(card_obj.get("primaryDescription")),
        location_text=text_value(card_obj.get("secondaryDescription")),
        company_urn=company_urn,
        verification_urn=verification_urn,
        company_page_url=((card_obj.get("logo") or {}).get("actionTarget")),
        company_logo_root_url=(((company_obj or {}).get("logo") or {}).get("vectorImage") or {}).get("rootUrl"),
        company_logo_url=best_company_logo_url(company_obj),
        verification_control_name=(verification_obj or {}).get("controlName"),
        verification_badge_system_image=extract_badge_system_image((verification_obj or {}).get("badge")),
        verification_action_target=((verification_obj or {}).get("badge") or {}).get("actionTarget"),
        tracking_urn=(job_obj or {}).get("trackingUrn"),
        reposted_job=(job_obj or {}).get("repostedJob"),
        content_source=(job_obj or {}).get("contentSource"),
        poster_id=(job_obj or {}).get("posterId"),
        blurred=card_obj.get("blurred"),
        has_job_posting_record=job_obj is not None,
        has_verification_record=verification_obj is not None,
        has_company_record=company_obj is not None,
        has_job_details_stub=is_stub_job_details_card(job_details_obj) if job_details_obj else False,
        description_snippet=None,  # this payload does not populate a real job description field
    )


def parse_linkedin_graphql_response(payload: Dict[str, Any]) -> ParseOutput:
    data_obj = payload.get("data") or {}
    included = payload.get("included") or []
    entity_index = build_entity_index(included)

    search_metadata = parse_search_metadata(data_obj)
    paging = parse_paging(data_obj)

    geo_urn = (data_obj.get("metadata") or {}).get("*geo") or (data_obj.get("metadata") or {}).get("geoUrn")
    geo_obj = entity_index.get(geo_urn) if geo_urn else None
    geo = parse_geo(geo_obj)

    search_card_urns = []
    for element in data_obj.get("elements", []):
        job_card_union = element.get("jobCardUnion") or {}
        search_card_urn = job_card_union.get("*jobPostingCard")
        if search_card_urn:
            search_card_urns.append(search_card_urn)

    jobs: List[ParsedJobCard] = []
    for urn in search_card_urns:
        card_obj = entity_index.get(urn)
        if not card_obj:
            continue
        jobs.append(parse_job_card(card_obj, entity_index))

    return ParseOutput(
        search_metadata=search_metadata,
        paging=paging,
        geo=geo,
        jobs=jobs,
    )


# ---------------------------------------------------------------------------
# Audit / Debug
# ---------------------------------------------------------------------------

def count_non_null(values: Iterable[Any]) -> int:
    total = 0
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        total += 1
    return total


def print_header(title: str) -> None:
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)


def print_kv(label: str, value: Any) -> None:
    print(f"{label:<36} {value}")


def get_included_type_counter(payload: Dict[str, Any]) -> Counter:
    included = payload.get("included") or []
    return Counter(item.get("$type", "<missing $type>") for item in included if isinstance(item, dict))


def debug_top_level_shape(payload: Dict[str, Any]) -> None:
    print_header("TOP-LEVEL SHAPE")
    print_kv("Top-level keys", list(payload.keys()))

    data_obj = payload.get("data") or {}
    print_kv("data keys", list(data_obj.keys()))

    type_counter = get_included_type_counter(payload)
    print("\nIncluded object counts by $type:")
    for object_type, count in type_counter.most_common():
        print(f"  - {object_type}: {count}")

    all_cards = [
        item for item in (payload.get("included") or [])
        if item.get("$type") == "com.linkedin.voyager.dash.jobs.JobPostingCard"
    ]
    search_cards = [c for c in all_cards if "JOBS_SEARCH" in (c.get("entityUrn") or "")]
    details_cards = [c for c in all_cards if "JOB_DETAILS" in (c.get("entityUrn") or "")]
    details_stubs = [c for c in details_cards if is_stub_job_details_card(c)]

    print("\nCard shape summary:")
    print_kv("All JobPostingCard objects", len(all_cards))
    print_kv("JOBS_SEARCH cards", len(search_cards))
    print_kv("JOB_DETAILS cards", len(details_cards))
    print_kv("JOB_DETAILS stub cards", len(details_stubs))


def debug_search_summary(parsed: ParseOutput) -> None:
    print_header("SEARCH SUMMARY")
    meta = parsed.search_metadata
    paging = parsed.paging

    print_kv("Keywords", meta.keywords)
    print_kv("Origin", meta.origin)
    print_kv("Search title", meta.title)
    print_kv("Search subtitle", meta.subtitle)
    print_kv("Geo URN", meta.geo_urn)
    print_kv("Paging total", paging.total)
    print_kv("Paging start", paging.start)
    print_kv("Paging count", paging.count)

    if parsed.geo:
        print_kv("Geo full name", parsed.geo.full_localized_name)
        print_kv("Geo default name", parsed.geo.default_localized_name)
        print_kv(
            "Geo default name w/o country",
            parsed.geo.default_localized_name_without_country,
        )

    print("\nExtracted jobs:")
    for idx, job in enumerate(parsed.jobs, start=1):
        print(
            f"  {idx}. {job.title!r} | company={job.company_name!r} | "
            f"location={job.location_text!r} | job_id={job.job_id}"
        )


def audit_field_population(parsed: ParseOutput) -> None:
    print_header("FIELD POPULATION AUDIT")

    jobs = parsed.jobs
    if not jobs:
        print("No parsed jobs found.")
        return

    dataclass_field_names = [f.name for f in fields(ParsedJobCard)]
    total = len(jobs)

    for field_name in dataclass_field_names:
        values = [getattr(job, field_name) for job in jobs]
        non_null = count_non_null(values)
        ratio = (non_null / total) * 100 if total else 0.0

        status = "OK"
        if non_null == 0:
            status = "EMPTY"
        elif non_null < total:
            status = "SPARSE"

        print(f"[{status:<5}] {field_name:<32} {non_null}/{total} populated ({ratio:>5.1f}%)")

        if non_null < total:
            missing_examples = []
            for job in jobs:
                value = getattr(job, field_name)
                if value is None or (isinstance(value, str) and not value.strip()):
                    missing_examples.append(job.job_id)
                if len(missing_examples) == 3:
                    break
            if missing_examples:
                print(f"        missing examples: {missing_examples}")


def audit_reference_integrity(payload: Dict[str, Any], parsed: ParseOutput) -> None:
    print_header("REFERENCE INTEGRITY AUDIT")

    included = payload.get("included") or []
    entity_index = build_entity_index(included)
    search_card_urns_in_elements = [
        (element.get("jobCardUnion") or {}).get("*jobPostingCard")
        for element in (payload.get("data") or {}).get("elements", [])
        if (element.get("jobCardUnion") or {}).get("*jobPostingCard")
    ]

    missing_search_cards = [
        urn for urn in search_card_urns_in_elements
        if urn not in entity_index
    ]
    print_kv("Element references to search cards", len(search_card_urns_in_elements))
    print_kv("Missing search cards from included", len(missing_search_cards))
    if missing_search_cards:
        for urn in missing_search_cards[:5]:
            print(f"  - Missing search card: {urn}")

    missing_job_postings = [job.job_id for job in parsed.jobs if not job.has_job_posting_record]
    missing_verifications = [job.job_id for job in parsed.jobs if not job.has_verification_record]
    missing_companies = [job.job_id for job in parsed.jobs if not job.has_company_record]
    missing_details_stub = [job.job_id for job in parsed.jobs if not job.has_job_details_stub]

    print_kv("Missing linked JobPosting", len(missing_job_postings))
    print_kv("Missing linked Verification", len(missing_verifications))
    print_kv("Missing linked Company", len(missing_companies))
    print_kv("Missing JOB_DETAILS stub", len(missing_details_stub))

    if missing_job_postings:
        print(f"  JobPosting missing examples: {missing_job_postings[:5]}")
    if missing_verifications:
        print(f"  Verification missing examples: {missing_verifications[:5]}")
    if missing_companies:
        print(f"  Company missing examples: {missing_companies[:5]}")
    if missing_details_stub:
        print(f"  JOB_DETAILS stub missing examples: {missing_details_stub[:5]}")


def audit_title_consistency(parsed: ParseOutput) -> None:
    print_header("TITLE CONSISTENCY AUDIT")

    raw_mismatches: List[Tuple[str, Optional[str], Optional[str]]] = []
    normalized_mismatches: List[Tuple[str, Optional[str], Optional[str]]] = []

    for job in parsed.jobs:
        card_title = job.title
        posting_title = job.title_raw_from_job_posting

        if card_title != posting_title:
            raw_mismatches.append((job.job_id, card_title, posting_title))

        if normalize_whitespace(card_title) != normalize_whitespace(posting_title):
            normalized_mismatches.append((job.job_id, card_title, posting_title))

    print_kv("Raw title mismatches", len(raw_mismatches))
    print_kv("Normalized title mismatches", len(normalized_mismatches))

    if raw_mismatches:
        print("\nRaw mismatch examples:")
        for job_id, card_title, posting_title in raw_mismatches[:5]:
            print(f"  - job_id={job_id}")
            print(f"    card.title               = {card_title!r}")
            print(f"    jobPosting.title         = {posting_title!r}")
            print(f"    card.title normalized    = {normalize_whitespace(card_title)!r}")
            print(f"    posting.title normalized = {normalize_whitespace(posting_title)!r}")

    if not normalized_mismatches and raw_mismatches:
        print("\nAll raw mismatches disappear after whitespace normalization.")
        print("That usually means the payload has cosmetic noise like trailing spaces or NBSP.")


def audit_duplicates(parsed: ParseOutput) -> None:
    print_header("DUPLICATE AUDIT")

    job_id_counter = Counter(job.job_id for job in parsed.jobs)
    duplicate_job_ids = {job_id: count for job_id, count in job_id_counter.items() if count > 1}

    card_urn_counter = Counter(job.card_entity_urn for job in parsed.jobs)
    duplicate_cards = {urn: count for urn, count in card_urn_counter.items() if count > 1}

    print_kv("Duplicate job_id count", len(duplicate_job_ids))
    print_kv("Duplicate card URN count", len(duplicate_cards))

    if duplicate_job_ids:
        print("Duplicate job_id details:")
        for job_id, count in duplicate_job_ids.items():
            print(f"  - {job_id}: {count}")

    if duplicate_cards:
        print("Duplicate card URN details:")
        for urn, count in duplicate_cards.items():
            print(f"  - {urn}: {count}")


def audit_description_availability(parsed: ParseOutput) -> None:
    print_header("DESCRIPTION AVAILABILITY AUDIT")

    jobs = parsed.jobs
    total = len(jobs)
    available = [job for job in jobs if job.description_snippet]
    missing = [job for job in jobs if not job.description_snippet]

    print_kv("description_snippet present", f"{len(available)}/{total}")
    print_kv("description_snippet missing", f"{len(missing)}/{total}")

    if len(available) == 0:
        print(
            "\n[DEBUG] No real description field was populated in this payload.\n"
            "        This JSON looks like a search-card response with JOB_DETAILS stubs,\n"
            "        not a fully hydrated job-details payload."
        )
    elif len(available) < total:
        print("\n[DEBUG] Description is inconsistent across cards.")
        print("        Present examples:")
        for job in available[:3]:
            print(f"          - {job.job_id}: {job.description_snippet[:120]!r}")
        print("        Missing examples:")
        for job in missing[:3]:
            print(f"          - {job.job_id}: title={job.title!r}")


def audit_company_logo_consistency(parsed: ParseOutput) -> None:
    print_header("COMPANY / LOGO AUDIT")

    missing_page_url = [job.job_id for job in parsed.jobs if not job.company_page_url]
    missing_logo_root = [job.job_id for job in parsed.jobs if not job.company_logo_root_url]
    missing_logo_url = [job.job_id for job in parsed.jobs if not job.company_logo_url]

    print_kv("Missing company page URL", len(missing_page_url))
    print_kv("Missing company logo root", len(missing_logo_root))
    print_kv("Missing resolved logo URL", len(missing_logo_url))

    if missing_page_url:
        print(f"  Missing page URL examples: {missing_page_url[:5]}")
    if missing_logo_root:
        print(f"  Missing logo root examples: {missing_logo_root[:5]}")
    if missing_logo_url:
        print(f"  Missing resolved logo URL examples: {missing_logo_url[:5]}")


def run_full_audit(payload: Dict[str, Any], parsed: ParseOutput) -> None:
    debug_top_level_shape(payload)
    debug_search_summary(parsed)
    audit_reference_integrity(payload, parsed)
    audit_field_population(parsed)
    audit_title_consistency(parsed)
    audit_duplicates(parsed)
    audit_description_availability(parsed)
    audit_company_logo_consistency(parsed)


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def jobs_to_json_serializable(jobs: List[ParsedJobCard]) -> List[Dict[str, Any]]:
    return [asdict(job) for job in jobs]


def save_jobs_json(path: Path, jobs: List[ParsedJobCard]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(jobs_to_json_serializable(jobs), f, ensure_ascii=False, indent=2)
    print(f"\nSaved parsed jobs JSON to: {path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def resolve_default_input_path() -> Path:
    local_default = Path(__file__).with_name("linkedin_graphql_response.json")
    if local_default.exists():
        return local_default

    tmp_default = Path("/mnt/data/linkedin_graphql_response.json")
    if tmp_default.exists():
        return tmp_default

    return local_default


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Parse LinkedIn GraphQL search-response JSON and audit consistency."
    )
    parser.add_argument(
        "input_json",
        nargs="?",
        default=str(resolve_default_input_path()),
        help="Path to linkedin_graphql_response.json",
    )
    parser.add_argument(
        "--save-json",
        dest="save_json",
        default=None,
        help="Optional path to save parsed jobs as JSON.",
    )
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    input_path = Path(args.input_json)
    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    payload = load_json(input_path)
    parsed = parse_linkedin_graphql_response(payload)

    run_full_audit(payload, parsed)

    if args.save_json:
        save_jobs_json(Path(args.save_json), parsed.jobs)

    print_header("DONE")
    print(f"Parsed {len(parsed.jobs)} job cards successfully.")


if __name__ == "__main__":
    main()
