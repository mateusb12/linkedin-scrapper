from flask import Blueprint, abort, jsonify, request

from database.database_connection import get_db_session
from database.populator import populate_from_json
from linkedin.api_fetch.orchestrator import get_total_job_pages, run_fetch_for_page
from models import FetchCurl

# Notice: Parsing imports (asdict, looks_like_node_fetch, etc.) are removed from here.

fetch_jobs_bp = Blueprint("fetch-jobs", __name__, url_prefix="/fetch-jobs")


# --- Helper Functions for DB Logic ---

def _get_curl_by_name(name: str):
    """
    Helper function to retrieve a FetchCurl object by its name.
    """
    db = get_db_session()
    try:
        curl_record = db.query(FetchCurl).filter(FetchCurl.name == name).first()

        if not curl_record:
            abort(404, description=f"'{name}' cURL configuration has not been set yet.")

        if not curl_record.base_url:
            abort(404, description=f"'{name}' cURL is configured but has no base URL.")

        return jsonify(curl_record.to_dict()), 200
    except Exception as e:
        print(f"Error retrieving cURL by name '{name}': {str(e)}")
        abort(500, description=f"An unexpected error occurred: {str(e)}")
    finally:
        db.close()


def _upsert_curl_by_name(name: str):
    """
    Helper function to create or update a FetchCurl object using the ORM's
    internal parsing logic.
    """
    raw_body = request.data.decode("utf-8")

    # Simple validation remains at controller level
    if not raw_body:
        abort(400, description="Request body cannot be empty.")

    db = get_db_session()

    try:
        # 1. Retrieve or Instantiate
        record = db.query(FetchCurl).filter(FetchCurl.name == name).first()
        status_code = 200

        if not record:
            # Create new instance if it doesn't exist
            record = FetchCurl(name=name)
            db.add(record)
            status_code = 201

        # 2. Delegate Parsing and Updating to the Model
        # The model raises ValueError if parsing fails, which we catch below.
        try:
            record.update_from_raw(raw_body)
        except ValueError as ve:
            abort(400, description=str(ve))

        # 3. Persist
        db.commit()
        db.refresh(record)

        message = f"'{name}' cURL was successfully {'stored' if status_code == 201 else 'updated'}."

    except Exception as e:
        db.rollback()
        # If it's an abort exception (from the inner try), re-raise it
        if hasattr(e, 'code') and e.code == 400:
            raise e
        abort(500, description=f"A database error occurred: {e}")
    finally:
        db.close()

    return jsonify({"message": message, "id": record.id}), status_code


# --- Generic API Endpoint ---

@fetch_jobs_bp.route("/curl/<string:name>", methods=["GET", "PUT"])
def handle_generic_curl(name: str):
    """
    Handles getting and setting a FetchCurl object by its unique name.
    - GET: Retrieves the cURL configuration for the given name.
    - PUT: Creates or updates (upserts) the cURL for the given name.
    """
    if request.method == "GET":
        return _get_curl_by_name(name)
    elif request.method == "PUT":
        return _upsert_curl_by_name(name)
    abort(405)


# --- Backward-Compatible Endpoints ---

@fetch_jobs_bp.route("/pagination-curl", methods=["GET", "PUT"])
def handle_pagination_curl():
    """
    [DEPRECATED] Handles getting and setting the "Pagination" cURL command.
    This endpoint is preserved for backward compatibility.
    """
    if request.method == "GET":
        return _get_curl_by_name("Pagination")
    elif request.method == "PUT":
        return _upsert_curl_by_name("Pagination")
    abort(405)


@fetch_jobs_bp.route("/individual-job-curl", methods=["GET", "PUT"])
def handle_individual_job_curl():
    if request.method == "GET":
        return _get_curl_by_name("SingleJob")
    elif request.method == "PUT":
        return _upsert_curl_by_name("SingleJob")
    abort(405)


# --- Other Endpoints ---

@fetch_jobs_bp.route('/get-total-pages')
def get_total_pages():
    """Returns the total number of job pages available."""
    total_pages: int = get_total_job_pages()
    return jsonify({"total_pages": total_pages})


@fetch_jobs_bp.route('/fetch-page/<int:page_number>', methods=['GET'])
def fetch_page(page_number: int):
    """
    Fetches a specific page of job data using the pagination cURL command.

    Args:
        page_number: The page number to fetch (e.g., 1, 2, 3...).

    Returns:
        A JSON response containing the parsed data for the requested page.
    """
    if page_number < 1:
        abort(400, description="Page number must be greater than 0.")

    page_data = run_fetch_for_page(page_number=page_number)
    if not page_data:
        abort(404, description=f"No data found for page {page_number}.")

    populate_from_json(page_data)

    return jsonify(page_data)