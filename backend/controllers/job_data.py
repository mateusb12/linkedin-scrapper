from flask import Blueprint, jsonify
from sqlalchemy.orm import joinedload

from database.database_connection import get_db_session
from models import Job

job_data_bp = Blueprint("jobs", __name__, url_prefix="/jobs")


@job_data_bp.route("/all", methods=["GET"])
def handle_pagination_curl():
    """
    [DEPRECATED] Handles getting and setting the "Pagination" cURL command.
    This endpoint is preserved for backward compatibility.
    """
    session = get_db_session()
    try:
        jobs = (
            session.query(Job).options(joinedload(Job.company)).all()
        )
        return jsonify([job.to_dict() for job in jobs]), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()
