from dataclasses import asdict

from flask import Blueprint, abort, jsonify, request
from sqlalchemy.orm.exc import NoResultFound

from database.database_connection import get_db_session
from linkedin.api_fetch.orchestrator import get_total_job_pages, run_fetch_for_page
from models import FetchCurl
from models.fetch_models import parse_fetch_string_flat

fetch_jobs_bp = Blueprint("fetch-jobs", __name__, url_prefix="/fetch-jobs")


# --- Helper Functions for DB Logic ---
# These functions contain the core database interaction logic, allowing the
# routes to remain clean and focused on request handling.

def _get_curl_by_name(name: str):
    """
    Helper function to retrieve a FetchCurl object by its name from the database.

    Args:
        name: The unique name of the cURL configuration to retrieve.

    Returns:
        A Flask JSON response tuple (dict, status_code).
    """
    db = get_db_session()
    try:
        # Use .one() to get a single record. It raises NoResultFound if no
        # record is found, which is caught below.
        curl_record = db.query(FetchCurl).filter(FetchCurl.name == name).one()

        if not curl_record.base_url:
            abort(404, description=f"'{name}' cURL is configured but has no base URL.")

        return jsonify(curl_record.to_dict()), 200
    except NoResultFound:
        abort(404, description=f"'{name}' cURL configuration has not been set yet.")
    finally:
        db.close()


def _upsert_curl_by_name(name: str):
    """
    Helper function to create or update a FetchCurl object by its unique name.

    This function implements "upsert" logic:
    1. It first queries the database to see if an entry with the given 'name'
       already exists.
    2. If it exists, the existing record is updated with the new data.
    3. If it does not exist, a new record is created.
    This ensures that the 'name' field remains a unique identifier.

    Args:
        name: The unique name of the cURL configuration to create or update.

    Returns:
        A Flask JSON response tuple (dict, status_code).
    """
    raw_body = request.data.decode("utf-8")
    if not raw_body:
        abort(400, description="Request body cannot be empty.")

    # Parse the raw cURL string from the request body into a structured object.
    cleaned_string = " ".join(raw_body.split())
    structured_data = parse_fetch_string_flat(cleaned_string)
    if not structured_data:
        abort(400, description="Failed to parse the provided fetch string.")

    data_dict = asdict(structured_data)
    db = get_db_session()

    try:
        # First, try to retrieve an existing record with the same name.
        record = db.query(FetchCurl).filter(FetchCurl.name == name).first()

        if record:
            # UPDATE: If the record exists, update its fields with the new data.
            for key, value in data_dict.items():
                setattr(record, key, value)
            message = f"'{name}' cURL was successfully updated."
            status_code = 200  # OK
        else:
            # CREATE: If the record does not exist, create a new one.
            # The name is assigned from the URL parameter.
            record = FetchCurl(**data_dict, name=name)
            db.add(record)
            message = f"'{name}' cURL was successfully stored."
            status_code = 201  # Created

        db.commit()
        db.refresh(record)

    except Exception as e:
        db.rollback()
        abort(500, description=f"A database error occurred: {e}")
    finally:
        db.close()

    return jsonify({"message": message, "id": record.id}), status_code


# --- Generic API Endpoint ---
# This is the new, primary endpoint for managing cURL configurations.

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
    abort(405)  # Method Not Allowed for other HTTP verbs


# --- Backward-Compatible Endpoints ---
# The original API endpoints are preserved to ensure older clients continue
# to function without modification. They now call the same core logic.

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
    """
    [DEPRECATED] Handles getting and setting the "SingleJob" cURL command.
    This endpoint is preserved for backward compatibility.
    """
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

    return jsonify(page_data)
