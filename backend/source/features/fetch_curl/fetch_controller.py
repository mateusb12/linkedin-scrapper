from flask import Blueprint, request, jsonify, abort
from source.features.fetch_curl.fetch_service import FetchService

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

@fetch_curl_bp.route("/pagination-curl", methods=["GET", "PUT"])
def handle_pagination_curl():
    if request.method == "GET": return get_config("Pagination")
    return update_config("Pagination")

@fetch_curl_bp.route("/individual-job-curl", methods=["GET", "PUT"])
def handle_individual_curl():
    if request.method == "GET": return get_config("SingleJob")
    return update_config("SingleJob")