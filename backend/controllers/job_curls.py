from dataclasses import asdict

from flask import Blueprint, abort, jsonify, request

from backend.database.database_connection import get_db_session
from backend.linkedin.api_fetch.orchestrator import get_total_job_pages
from backend.models import FetchCurl
from backend.models.fetch_models import parse_fetch_string_flat
from backend.utils.fetch_utils import validate_str, ensure_singleton, clean_and_prepare_curl

fetch_jobs_bp = Blueprint("fetch-jobs", __name__, url_prefix="/fetch-jobs")


@fetch_jobs_bp.route('/get-total-pages')
def get_total_pages():
    total_pages: int = get_total_job_pages()
    return {"total_pages": total_pages}


@fetch_jobs_bp.route("/pagination-curl", methods=["GET"])
def get_pagination_curl():
    db = get_db_session()
    pagination_curl = db.query(FetchCurl).filter(FetchCurl.name == "Pagination").first()
    if pagination_curl is None or pagination_curl.base_url == "":
        abort(404, description="Pagination cURL not yet set.")
    dict_curl = pagination_curl.to_dict()
    return jsonify(dict_curl), 200


@fetch_jobs_bp.route("/pagination-curl", methods=["PUT"])
def set_pagination_curl():
    """
    Flask endpoint to receive, parse, and store a fetch command string.
    """
    # Get the raw string from the request body
    raw_body = request.data.decode("utf-8")
    if not raw_body:
        abort(400, description="Request body cannot be empty.")

    # Clean up whitespace for more reliable regex matching
    cleaned_string = " ".join(raw_body.split())

    # Parse the string using our function
    structured_data = parse_fetch_string_flat(cleaned_string)

    if not structured_data:
        abort(400, description="Failed to parse the provided fetch string.")

    # Convert the dataclass to a dictionary to instantiate the ORM model
    data_dict = asdict(structured_data)
    new_record = FetchCurl(**data_dict)
    new_record.name = "Pagination"

    # Create a new database session and save the record
    db = get_db_session()
    try:
        db.add(new_record)
        db.commit()
        db.refresh(new_record)  # Refresh to get the auto-generated ID
        record_id = new_record.id
    except Exception as e:
        db.rollback()
        abort(500, description=f"Database error: {e}")
    finally:
        db.close()

    # Return a success response
    return jsonify({
        "message": "Fetch call successfully parsed and stored.",
        "id": record_id
    }), 201  # 201 Created


@fetch_jobs_bp.route("/individual-job-curl", methods=["GET"])
def get_individual_job_curl():
    db = get_db_session()
    fc = db.get(FetchCurls, 1)
    if fc is None or fc.individual_job_curl == "":
        abort(404, description="Individual-job cURL not yet set.")
    return jsonify({"individual_job_curl": fc.individual_job_curl}), 200


@fetch_jobs_bp.route("/individual-job-curl", methods=["PUT"])
def set_individual_job_curl():
    raw_body = request.data.decode("utf-8").strip()
    new_val = validate_str(raw_body, "individual_job_curl")

    db = get_db_session()
    fc = ensure_singleton(db)
    fc.individual_job_curl = new_val
    db.commit()
    return jsonify({"individual_job_curl": fc.individual_job_curl}), 200
