from flask import Blueprint, abort, jsonify, request

from backend.database.database_connection import get_db_session
from backend.linkedin.api_fetch.orchestrator import get_total_job_pages
from backend.models.fetch_models import FetchCurls
from backend.utils.fetch_utils import validate_str, ensure_singleton, clean_and_prepare_curl

fetch_jobs_bp = Blueprint("fetch-jobs", __name__, url_prefix="/fetch-jobs")


@fetch_jobs_bp.route('/get-total-pages')
def get_total_pages():
    total_pages: int = get_total_job_pages()
    return {"total_pages": total_pages}


@fetch_jobs_bp.route("/pagination-curl", methods=["GET"])
def get_pagination_curl():
    db = get_db_session()
    fc = db.get(FetchCurls, 1)
    if fc is None or fc.pagination_curl == "":
        abort(404, description="Pagination cURL not yet set.")
    return jsonify(fc.pagination_curl), 200


@fetch_jobs_bp.route("/pagination-curl", methods=["PUT"])
def set_pagination_curl():
    raw_body = request.data.decode("utf-8")
    if not raw_body:
        abort(400, description="Empty cURL content.")

    cleaned_curl = clean_and_prepare_curl(raw_body)

    db = get_db_session()
    fc = ensure_singleton(db)
    fc.pagination_curl = cleaned_curl
    db.commit()
    return jsonify({"pagination_curl": fc.pagination_curl}), 200


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
