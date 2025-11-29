from flask import Blueprint, request, jsonify, abort
from database.populator import populate_from_json
from source.features.fetch_curl.fetch_service import FetchService

# Define Blueprint
fetch_curl_bp = Blueprint("fetch_curl", __name__, url_prefix="/fetch-jobs")

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

# --- Legacy/Specific Aliases (Frontend uses these) ---

@fetch_curl_bp.route("/pagination-curl", methods=["GET", "PUT"])
def handle_pagination_curl():
    if request.method == "GET": return get_config("Pagination")
    return update_config("Pagination")

@fetch_curl_bp.route("/individual-job-curl", methods=["GET", "PUT"])
def handle_individual_curl():
    if request.method == "GET": return get_config("SingleJob")
    return update_config("SingleJob")

# --- Execution Endpoints ---

@fetch_curl_bp.route('/get-total-pages')
def get_total_pages():
    pages = FetchService.get_total_pages()
    return jsonify({"total_pages": pages})

@fetch_curl_bp.route('/fetch-page/<int:page_number>', methods=['GET'])
def fetch_page(page_number: int):
    data = FetchService.execute_fetch_page(page_number)
    if not data:
        return abort(500, description="Failed to fetch data from LinkedIn")

    # Optional: If you want to save to the main DB immediately
    # This is an external dependency we might want to decouple later
    populate_from_json(data)

    return jsonify(data)