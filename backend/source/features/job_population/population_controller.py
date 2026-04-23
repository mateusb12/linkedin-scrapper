from flask import jsonify, Response, stream_with_context, request
from source.features.job_population.population_service import PopulationService
from source.features.job_population.search_spec import (
    PipelineSearchSpec,
    normalize_excluded_keywords,
)


def _get_body():
    if request.method in {"POST", "PUT", "PATCH"}:
        return request.get_json(silent=True) or {}
    return {}


def _get_input(name, *aliases, default=None):
    body = _get_body()

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


def _parse_float(value):
    if value in (None, ""):
        return None
    return float(value)


def _parse_int(value):
    if value in (None, ""):
        return None
    return int(value)


def _build_search_spec() -> PipelineSearchSpec:
    return PipelineSearchSpec(
        keywords=_get_input("keywords"),
        excluded_keywords=normalize_excluded_keywords(
            _get_input("excluded_keywords", "excludedKeywords")
        ),
        geo_id=_get_input("geo_id", "geoId"),
        distance=_parse_float(_get_input("distance")),
        count=_parse_int(_get_input("count")),
    )

def get_total_pages():
    try:
        search_spec = _build_search_spec()
        if search_spec.is_active():
            validation = PopulationService.validate_search_mode(search_spec)
            if not validation.get("success"):
                return jsonify(validation), 409

        pages = PopulationService.get_total_pages(search_spec=search_spec)
        return jsonify({"total_pages": pages}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def fetch_page_endpoint(page_number: int):
    try:
        result = PopulationService.fetch_and_save_page(
            page_number,
            search_spec=_build_search_spec(),
        )
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "page": page_number,
            "step": "controller",
            "error": "Unhandled fetch-page controller error",
            "details": str(e),
        }), 500

def fetch_range_stream():
    start_page = request.args.get('start_page', type=int)
    end_page = request.args.get('end_page', type=int)
    return Response(
        stream_with_context(
            PopulationService.stream_fetch_page_range(
                start_page,
                end_page,
                search_spec=_build_search_spec(),
            )
        ),
        mimetype='text/event-stream'
    )


def validate_search_mode():
    try:
        result = PopulationService.validate_search_mode(_build_search_spec())
        return jsonify(result), 200 if result.get("success") else 409
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Unhandled search validation controller error",
            "details": str(e),
        }), 500

def backfill_descriptions_stream():
    """
    Streams the progress of the enrichment process using SSE.
    Accepts an optional 'time_range' query param.
    """
    time_range = request.args.get('time_range', 'all_time')
    return Response(
        stream_with_context(PopulationService.stream_description_backfill(time_range)),
        mimetype='text/event-stream'
    )
