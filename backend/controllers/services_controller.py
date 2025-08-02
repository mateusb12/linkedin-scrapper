from flask import Blueprint

from services.job_tracking.huntr_service import get_huntr_jobs_data

services_bp = Blueprint("services", __name__, url_prefix="/services")


@services_bp.route("/huntr", methods=["GET"])
def get_huntr_jobs():
    jobs: list[dict] = get_huntr_jobs_data()
    return jobs, 200
