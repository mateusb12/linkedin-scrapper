# backend/controllers/services_controller.py
from datetime import datetime, timezone

from flask import Blueprint, jsonify

from database.database_connection import get_db_session
from models import Job
from repository.job_repository import JobRepository
from services.job_tracking.huntr_service import get_huntr_jobs_data
from services.job_tracking.python_linkedin_jobs import fetch_all_linkedin_jobs
from utils.date_parser import parse_relative_date
from dateutil.parser import parse as parse_datetime

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


def normalize_sql_job(job: Job) -> dict:
    return {
        "company": job.company.name if job.company else "Unknown",
        "title": job.title.strip() if job.title else "",
        "appliedAt": job.applied_on or job.updated_at or job.created_at,
        "source": "SQL",
        "url": job.job_url or None,
    }


@services_bp.route("/applied-jobs", methods=["GET"])
def get_all_applied_jobs():
    """
    Fetches and unifies job applications from Huntr, LinkedIn, and SQL.
    """
    try:
        # Fetch raw data
        huntr_jobs_raw = get_huntr_jobs_data()
        linkedin_jobs_raw = fetch_all_linkedin_jobs()
        repo = JobRepository()
        sql_jobs = repo.fetch_applied_jobs()

        # Normalize each source
        normalized_huntr = [normalize_huntr_job(job) for job in huntr_jobs_raw]
        normalized_linkedin = [normalize_linkedin_job(job) for job in linkedin_jobs_raw]
        normalized_sql = [normalize_sql_job(job) for job in sql_jobs]

        # Convert all appliedAt to timezone-aware datetime
        for job in normalized_huntr + normalized_linkedin + normalized_sql:
            if isinstance(job["appliedAt"], str):
                job["appliedAt"] = parse_datetime(job["appliedAt"])
            if job["appliedAt"].tzinfo is None:
                job["appliedAt"] = job["appliedAt"].replace(tzinfo=timezone.utc)

        # Merge and sort by date
        all_jobs = sorted(
            normalized_huntr + normalized_linkedin + normalized_sql,
            key=lambda x: x["appliedAt"],
            reverse=True
        )

        # Add formattedDate field
        for job in all_jobs:
            job["formattedDate"] = job["appliedAt"].strftime("%d-%b-%Y").lower()

        return all_jobs, 200

    except Exception as e:
        return {"error": "Failed to fetch job data", "details": str(e)}, 500


# You can keep the old endpoints for debugging or remove them
@services_bp.route("/huntr", methods=["GET"])
def get_huntr_jobs():
    jobs: list[dict] = get_huntr_jobs_data()
    return jobs, 200


@services_bp.route("/linkedin", methods=["GET"])
def get_linkedin_jobs():
    jobs: list[dict] = fetch_all_linkedin_jobs()
    return jobs, 200


@services_bp.route("/sql", methods=["GET"])
def get_sql_jobs():
    """
    Fetches all jobs where has_applied is True.
    """
    repo = JobRepository()
    jobs = repo.fetch_applied_jobs()
    return jsonify([job.to_dict() for job in jobs]), 200
