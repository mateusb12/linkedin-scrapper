# backend/controllers/services_controller.py
from flask import Blueprint

from services.job_tracking.huntr_service import get_huntr_jobs_data
from services.job_tracking.python_linkedin_jobs import get_linkedin_applied_jobs
from utils.date_parser import parse_relative_date

services_bp = Blueprint("services", __name__, url_prefix="/services")


def normalize_huntr_job(job: dict) -> dict:
    """Normalizes a single Huntr job entry."""
    return {
        "company": job.get("company"),
        "title": job.get("title", "").strip(),
        "appliedAt": job.get("appliedAt"),  # Already in ISO format
        "source": "Huntr",
        "url": job.get("url"),  # Add URL if available
    }


def normalize_linkedin_job(job: dict) -> dict:
    """Normalizes a single LinkedIn job entry."""
    return {
        "company": job.get("company"),
        "title": job.get("title", "").strip(),
        "appliedAt": parse_relative_date(job.get("status", "")),  # Use the parser
        "source": "LinkedIn",
        "url": job.get("url"),
    }


@services_bp.route("/applied-jobs", methods=["GET"])
def get_all_applied_jobs():
    """
    Fetches and unifies job applications from Huntr and LinkedIn.
    """
    try:
        # Fetch data from both services
        huntr_jobs_raw = get_huntr_jobs_data()
        linkedin_jobs_raw = get_linkedin_applied_jobs()

        # Normalize data
        normalized_huntr = [normalize_huntr_job(job) for job in huntr_jobs_raw]
        normalized_linkedin = [normalize_linkedin_job(job) for job in linkedin_jobs_raw]

        # Combine and sort by date (most recent first)
        all_jobs = sorted(
            normalized_huntr + normalized_linkedin,
            key=lambda x: x["appliedAt"],
            reverse=True
        )

        return all_jobs, 200
    except Exception as e:
        # Basic error handling
        return {"error": "Failed to fetch job data", "details": str(e)}, 500


# You can keep the old endpoints for debugging or remove them
@services_bp.route("/huntr", methods=["GET"])
def get_huntr_jobs():
    jobs: list[dict] = get_huntr_jobs_data()
    return jobs, 200


@services_bp.route("/linkedin", methods=["GET"])
def get_linkedin_jobs():
    jobs: list[dict] = get_linkedin_applied_jobs()
    return jobs, 200
