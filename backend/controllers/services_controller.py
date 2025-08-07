# backend/controllers/services_controller.py
from datetime import timezone
from flask import Blueprint, jsonify
from dateutil.parser import parse as parse_datetime
import traceback

from models import Job
from repository.job_repository import JobRepository
from services.job_tracking.huntr_service import get_huntr_jobs_data
from services.job_tracking.python_linkedin_jobs import fetch_all_linkedin_jobs

services_bp = Blueprint("services", __name__, url_prefix="/services")


def normalize_huntr_job(job: dict) -> dict:
    """Normalizes a single Huntr job entry."""
    return {
        "company": job.get("company"),
        "title": job.get("title", "").strip(),
        "appliedAt": job.get("appliedAt"),
        "source": "Huntr",
        "url": job.get("url"),
    }


# --- THIS FUNCTION IS CORRECTED ---
def normalize_linkedin_job(job_dict: dict) -> dict:
    """Normalizes a single LinkedIn job dictionary."""
    return {
        "company": job_dict.get("company"),
        "title": job_dict.get("title", "").strip(),
        "appliedAt": job_dict.get("appliedOn"),  # Key from Job.to_dict()
        "source": "LinkedIn",
        "url": job_dict.get("job_url"),  # Key from Job.to_dict()
    }


def normalize_sql_job(job: Job) -> dict:
    """Normalizes a single SQL Job object."""
    return {
        "company": job.company.name if job.company else "Unknown",
        "title": job.title.strip() if job.title else "",
        "appliedAt": job.applied_on,
        "source": "SQL",
        "url": job.job_url or None,
    }


# --- THIS ENDPOINT IS MADE MORE ROBUST ---
@services_bp.route("/applied-jobs", methods=["GET"])
def get_all_applied_jobs():
    """
    Fetches and unifies job applications, de-duplicating to ensure correct source labeling.
    """
    repo = JobRepository()
    try:
        # --- NEW LOGIC ---

        # 1. Fetch from independent sources first.
        huntr_jobs_raw = get_huntr_jobs_data()
        normalized_huntr = [normalize_huntr_job(job) for job in huntr_jobs_raw]

        # 2. Sync and fetch from LinkedIn. This is our primary source of truth for LinkedIn jobs.
        print("Syncing LinkedIn jobs...")
        linkedin_jobs_raw = [item.to_dict() for item in fetch_all_linkedin_jobs()]
        normalized_linkedin = [normalize_linkedin_job(job) for job in linkedin_jobs_raw]
        print("Sync complete.")

        # 3. Create a set of all URNs from the LinkedIn sync for efficient de-duplication.
        linkedin_urns = {job['urn'] for job in normalized_linkedin if job.get('urn')}

        # 4. Fetch all jobs from the SQL database.
        all_sql_jobs = repo.fetch_applied_jobs()

        # 5. Filter out any SQL job that we already have from the LinkedIn sync.
        # This prevents the same job from appearing twice with two different sources.
        non_linkedin_sql_jobs = [job for job in all_sql_jobs if job.urn not in linkedin_urns]
        normalized_sql = [normalize_sql_job(job) for job in non_linkedin_sql_jobs]

        # 6. Combine the clean, de-duplicated lists.
        all_jobs_unfiltered = normalized_huntr + normalized_linkedin + normalized_sql

        # --- The rest of your processing logic remains the same ---
        all_jobs_filtered = []
        for job in all_jobs_unfiltered:
            applied_at = job.get("appliedAt")
            if not applied_at:
                continue

            if isinstance(applied_at, str):
                job["appliedAt"] = parse_datetime(applied_at)

            if job["appliedAt"].tzinfo is None:
                job["appliedAt"] = job["appliedAt"].replace(tzinfo=timezone.utc)

            all_jobs_filtered.append(job)

        all_jobs_sorted = sorted(
            all_jobs_filtered,
            key=lambda x: x["appliedAt"],
            reverse=True
        )

        for job in all_jobs_sorted:
            job["formattedDate"] = job["appliedAt"].strftime("%d-%b-%Y").lower()
            job["appliedAt"] = job["appliedAt"].isoformat()

        return jsonify(all_jobs_sorted), 200

    except Exception as e:
        print("An error occurred in /applied-jobs endpoint:")
        print(traceback.format_exc())
        return jsonify({"error": "Failed to fetch job data", "details": str(e)}), 500
    finally:
        repo.close()


# You can keep the old endpoints for debugging or remove them
@services_bp.route("/huntr", methods=["GET"])
def get_huntr_jobs():
    jobs: list[dict] = get_huntr_jobs_data()
    return jsonify(jobs), 200


@services_bp.route("/linkedin", methods=["GET"])
def get_linkedin_jobs():
    jobs: list[dict] = fetch_all_linkedin_jobs()
    return jsonify(jobs), 200


@services_bp.route("/sql", methods=["GET"])
def get_sql_jobs():
    repo = JobRepository()
    try:
        jobs = repo.fetch_applied_jobs()
        return jsonify([job.to_dict() for job in jobs]), 200
    finally:
        repo.close()