from flask import Blueprint, abort, jsonify

from backend.database.database_connection import get_db_session
from backend.linkedin.api_fetch.orchestrator import get_total_job_pages
from backend.models.fetch_models import FetchCurls

fetch_curls_bp = Blueprint("fetch-jobs", __name__, url_prefix="/api")


@fetch_curls_bp.route('/get-total-pages')
def get_total_pages():
    total_pages: int = get_total_job_pages()
    return {"total_pages": total_pages}


@fetch_curls_bp.route("/pagination-curl", methods=["GET"])
def get_pagination_curl():
    db = get_db_session()
    fc = db.get(FetchCurls, 1)
    if fc is None or fc.pagination_curl == "":
        abort(404, description="Pagination cURL not yet set.")
    return jsonify({"pagination_curl": fc.pagination_curl}), 200
