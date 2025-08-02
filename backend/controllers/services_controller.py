from flask import Blueprint

from services.job_tracking.huntr_service import get_huntr_jobs_data
from services.job_tracking.python_linkedin_jobs import get_linkedin_applied_jobs

services_bp = Blueprint("services", __name__, url_prefix="/services")


@services_bp.route("/huntr", methods=["GET"])
def get_huntr_jobs():
    jobs: list[dict] = get_huntr_jobs_data()
    return jobs, 200


@services_bp.route("/linkedin", methods=["GET"])
def get_linkedin_jobs():
    """
    Placeholder for LinkedIn jobs service.
    """
    jobs: list[dict] = get_linkedin_applied_jobs()
    return jobs, 200
