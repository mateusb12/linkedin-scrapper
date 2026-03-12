"""
search_jobs_controller.py — Thin Flask routes.

Each endpoint is a thin wire to the correct layer:
    - LinkedIn-only → LinkedInJobsSearchService

No business logic lives here.
"""

import traceback
from enum import Enum
from typing import Any

from flask import Blueprint, jsonify, request

from source.features.search_jobs.curl_voyager_jobs_fetch import JobSearchTuning, WorkType, JobType, ExperienceLevel, \
    DatePosted, SearchOrigin, SortBy
from source.features.search_jobs.job_search_service import LinkedInJobsSearchService

search_jobs_bp = Blueprint("search_jobs", __name__, url_prefix="/search-jobs")


# ══════════════════════════════════════════════════════════════
# Helpers — request parsing only
# ══════════════════════════════════════════════════════════════

def _json_body() -> dict[str, Any]:
    if request.method == "POST":
        return request.get_json(silent=True) or {}
    return {}


def _get_input(name: str, *aliases: str, default: Any = None) -> Any:
    """
    Reads from JSON body first (POST), then query params.
    Supports:
      - single query param
      - repeated query param (?x=a&x=b)
      - aliases / camelCase names
    """
    body = _json_body()

    for key in (name, *aliases):
        if key in body:
            return body[key]

    for key in (name, *aliases):
        if key in request.args:
            values = request.args.getlist(key)
            if len(values) > 1:
                return values
            return request.args.get(key)

    return default


def _parse_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False

    raise ValueError(f"Invalid boolean value: {value}")


def _parse_int(value: Any, field_name: str) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValueError(f"Invalid integer for '{field_name}': {value}")


def _parse_float(value: Any, field_name: str) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError(f"Invalid number for '{field_name}': {value}")


def _normalize_list_input(value: Any) -> list[Any]:
    if value is None or value == "":
        return []

    if isinstance(value, list):
        return value

    if isinstance(value, tuple):
        return list(value)

    if isinstance(value, set):
        return list(value)

    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]

    return [value]


def _parse_enum(value: Any, enum_cls: type[Enum], field_name: str):
    if value is None or value == "":
        return None

    if isinstance(value, enum_cls):
        return value

    raw = str(value).strip()

    for member in enum_cls:
        if raw == member.value:
            return member
        if raw.upper() == member.name:
            return member

    allowed = [f"{member.name} ({member.value})" for member in enum_cls]
    raise ValueError(f"Invalid value for '{field_name}': {value}. Allowed: {allowed}")


def _parse_enum_list(value: Any, enum_cls: type[Enum], field_name: str) -> list[Enum]:
    items = _normalize_list_input(value)
    return [_parse_enum(item, enum_cls, field_name) for item in items]


def _build_tuning_from_request() -> JobSearchTuning:
    return JobSearchTuning(
        current_job_id=_get_input("current_job_id", "currentJobId"),
        keywords=_get_input("keywords"),
        geo_id=_get_input("geo_id", "geoId"),
        distance=_parse_float(_get_input("distance"), "distance"),

        sort_by=_parse_enum(_get_input("sort_by", "sortBy"), SortBy, "sort_by"),
        work_types=_parse_enum_list(
            _get_input("work_types", "workTypes"),
            WorkType,
            "work_types",
        ),
        date_posted=_parse_enum(
            _get_input("date_posted", "datePosted"),
            DatePosted,
            "date_posted",
        ),
        experience_levels=_parse_enum_list(
            _get_input("experience_levels", "experienceLevels"),
            ExperienceLevel,
            "experience_levels",
        ),
        job_types=_parse_enum_list(
            _get_input("job_types", "jobTypes"),
            JobType,
            "job_types",
        ),

        origin=_parse_enum(
            _get_input("origin"),
            SearchOrigin,
            "origin",
        ) or _get_input("origin"),

        spell_correction_enabled=_parse_bool(
            _get_input("spell_correction_enabled", "spellCorrectionEnabled"),
            default=False,
        ),

        custom_selected_filters=_get_input(
            "custom_selected_filters",
            "customSelectedFilters",
            default={},
        ) or {},

        custom_query_fields=_get_input(
            "custom_query_fields",
            "customQueryFields",
            default={},
        ) or {},
    )


def _enum_options(enum_cls: type[Enum]) -> list[dict[str, str]]:
    return [{"name": member.name, "value": member.value} for member in enum_cls]


# ══════════════════════════════════════════════════════════════
# LINKEDIN-ONLY endpoints (LinkedInJobsSearchService) — zero DB writes
# ══════════════════════════════════════════════════════════════

@search_jobs_bp.route("/live", methods=["GET", "POST"])
def search_jobs_live():
    """
    Proxy/orchestrator:
    - hits LinkedIn through the existing fetch module
    - parses through the existing parse module
    - returns structured result
    - zero DB writes
    """
    try:
        page = _parse_int(_get_input("page", default=1), "page") or 1
        count = _parse_int(_get_input("count"), "count")
        debug = _parse_bool(_get_input("debug", default=False), default=False)
        save_raw_json = _parse_bool(
            _get_input("save_raw_json", "saveRawJson", default=True),
            default=True,
        )
        save_parsed_json = _parse_bool(
            _get_input("save_parsed_json", "saveParsedJson", default=True),
            default=True,
        )

        tuning = _build_tuning_from_request()

        service = LinkedInJobsSearchService()
        result = service.search_jobs(
            page=page,
            count=count,
            tuning=tuning,
            debug=debug,
            save_raw_json=save_raw_json,
            save_parsed_json=save_parsed_json,
        )

        return jsonify({
            "status": "success",
            "data": result,
        }), 200

    except ValueError as e:
        return jsonify({
            "status": "error",
            "error": str(e),
        }), 400

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e),
        }), 500


@search_jobs_bp.route("/debug-live", methods=["GET", "POST"])
def search_jobs_debug_live():
    """
    Same orchestration flow as /live, but includes traceback on failure.
    Useful while stabilizing filters / Voyager query shape.
    """
    try:
        page = _parse_int(_get_input("page", default=1), "page") or 1
        count = _parse_int(_get_input("count"), "count")
        debug = _parse_bool(_get_input("debug", default=True), default=True)
        save_raw_json = _parse_bool(
            _get_input("save_raw_json", "saveRawJson", default=True),
            default=True,
        )
        save_parsed_json = _parse_bool(
            _get_input("save_parsed_json", "saveParsedJson", default=True),
            default=True,
        )

        tuning = _build_tuning_from_request()

        service = LinkedInJobsSearchService()
        result = service.search_jobs(
            page=page,
            count=count,
            tuning=tuning,
            debug=debug,
            save_raw_json=save_raw_json,
            save_parsed_json=save_parsed_json,
        )

        return jsonify({
            "status": "success",
            "data": result,
        }), 200

    except ValueError as e:
        return jsonify({
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }), 400

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }), 500


@search_jobs_bp.route("/options", methods=["GET"])
def search_jobs_options():
    """Expose allowed enum values for frontend filters."""
    try:
        return jsonify({
            "status": "success",
            "data": {
                "sort_by": _enum_options(SortBy),
                "work_types": _enum_options(WorkType),
                "date_posted": _enum_options(DatePosted),
                "experience_levels": _enum_options(ExperienceLevel),
                "job_types": _enum_options(JobType),
                "origins": _enum_options(SearchOrigin),
            },
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e),
        }), 500
