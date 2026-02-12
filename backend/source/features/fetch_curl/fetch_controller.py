from flask import Blueprint, request, jsonify, abort
from source.features.fetch_curl.fetch_service import FetchService

from source.features.api_fetch.potential_urls.potential_curl.analyzer import parse_curl

from source.features.fetch_curl.sdui_curl_parser import parse_sdui_curl

fetch_curl_bp = Blueprint("fetch_curl", __name__, url_prefix="/config")


@fetch_curl_bp.route("/curl/<string:name>", methods=["GET"])
def get_config(name: str):
    data = FetchService.get_curl_config(name)
    if not data:
        return abort(404, description="Configuration not found")
    return jsonify(data)


@fetch_curl_bp.route("/curl/<string:name>", methods=["PUT"])
def update_config(name: str):
    raw_body = request.data.decode("utf-8")
    if not raw_body:
        return abort(400, description="Body required")

    try:
        FetchService.upsert_curl_config(name, raw_body)
        return jsonify({"message": f"'{name}' updated successfully."}), 200
    except ValueError as e:
        return abort(400, description=str(e))


# --- Legacy/Specific Aliases ---
# These are still "Config" actions, so they belong here under /config

@fetch_curl_bp.route("/pagination-curl", methods=["GET", "PUT", "DELETE"])
def handle_pagination_curl():
    if request.method == "GET": return handle_config("Pagination")
    if request.method == "DELETE": return handle_config("Pagination")
    return handle_config("Pagination")


@fetch_curl_bp.route("/individual-job-curl", methods=["GET", "PUT", "DELETE"])
def handle_individual_curl():
    if request.method == "GET": return handle_config("SingleJob")
    if request.method == "DELETE": return handle_config("SingleJob")
    return handle_config("SingleJob")


@fetch_curl_bp.route("/experience", methods=["PUT"])
def update_experience_config():
    data = request.get_json()
    curl = data.get("curl")

    if not curl:
        return {"error": "Missing curl input"}, 400

    parsed = parse_sdui_curl(curl)

    FetchService.update_config_from_parsed(
        "Experience",
        parsed
    )

    return {"message": "Experience config updated"}, 200


@fetch_curl_bp.route("/curl/<string:name>", methods=["GET", "PUT", "DELETE"])
def handle_config(name: str):
    if request.method == "GET":
        data = FetchService.get_curl_config(name)
        if not data:
            return abort(404, description="Configuration not found")
        return jsonify(data)

    if request.method == "DELETE":
        deleted = FetchService.delete_curl_config(name)
        if not deleted:
            return abort(404, description="Configuration not found")
        return jsonify({"message": f"'{name}' deleted successfully."}), 200

    # PUT
    raw_body = request.data.decode("utf-8")
    if not raw_body:
        return abort(400, description="Body required")

    try:
        FetchService.upsert_curl_config(name, raw_body)
        return jsonify({"message": f"'{name}' updated successfully."}), 200
    except ValueError as e:
        return abort(400, description=str(e))


@fetch_curl_bp.route("/experience", methods=["GET", "PUT", "DELETE"])
def handle_experience_config():
    if request.method == "GET":
        return handle_config("Experience")

    if request.method == "DELETE":
        return handle_config("Experience")

    # PUT (seu código atual)
    data = request.get_json()
    curl = data.get("curl")

    if not curl:
        return {"error": "Missing curl input"}, 400

    parsed = parse_sdui_curl(curl)

    FetchService.update_config_from_parsed(
        "Experience",
        parsed
    )

    return {"message": "Experience config updated"}, 200
