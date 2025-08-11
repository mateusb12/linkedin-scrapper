# backend/controllers/services_controller.py
from datetime import timezone
from flask import Blueprint, jsonify
from dateutil.parser import parse as parse_datetime
import traceback

from models import Job
from repository.job_repository import JobRepository
from services.job_tracking.huntr_service import get_huntr_jobs_data
from services.linkedin_calls.fetch_linkedin_applied_jobs import fetch_all_linkedin_jobs

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
    try:
        return {
            "company": job_dict.get("company"),
            "title": job_dict.get("title", "").strip(),
            "appliedAt": job_dict["applied_on"],  # Key from Job.to_dict()
            "source": "LinkedIn",
            "url": job_dict.get("job_url"),  # Key from Job.to_dict()
        }
    except KeyError as e:
        print("Key error on LinkedIn job normalization:", job_dict)
        raise e


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
        # 1. Fetch from Huntr
        # huntr_jobs_raw = get_huntr_jobs_data()
        # normalized_huntr = [normalize_huntr_job(job) for job in huntr_jobs_raw]

        # 2. Fetch from LinkedIn
        print("Syncing LinkedIn jobs...")
        linkedin_jobs_raw = [item.to_dict() for item in fetch_all_linkedin_jobs()]
        normalized_linkedin = [normalize_linkedin_job(job) for job in linkedin_jobs_raw]
        print("Sync complete.")

        # 3. Deduplication via LinkedIn URNs
        linkedin_urns = {job['urn'] for job in normalized_linkedin if job.get('urn')}

        # 4. Fetch from SQL (excluding jobs already in LinkedIn)
        all_sql_jobs = repo.fetch_internal_sql_jobs()
        non_linkedin_sql_jobs = [job for job in all_sql_jobs if job.urn not in linkedin_urns]
        normalized_sql = [normalize_sql_job(job) for job in non_linkedin_sql_jobs]

        # 5. Combine sources
        all_jobs_unfiltered = normalized_linkedin + normalized_sql

        # 6. Print source counts
        source_counts = {
            "linkedin": len(normalized_linkedin),
            "sql": len(normalized_sql),
        }
        print("Job source counts:", source_counts)

        # 7. Filter + clean appliedAt
        all_jobs_filtered = []
        for job in all_jobs_unfiltered:
            applied_at = job.get("appliedAt")
            if not applied_at:
                continue

            try:
                if isinstance(applied_at, str):
                    applied_at = parse_datetime(applied_at)

                if applied_at is None:
                    continue

                if applied_at.tzinfo is None:
                    applied_at = applied_at.replace(tzinfo=timezone.utc)

                job["appliedAt"] = applied_at
                all_jobs_filtered.append(job)
            except Exception as parse_err:
                print(f"Skipping job with invalid appliedAt: {applied_at} (error: {parse_err})")
                continue

        # 8. Sort by date
        all_jobs_sorted = sorted(
            all_jobs_filtered,
            key=lambda x: x["appliedAt"],
            reverse=True
        )

        # 9. Format output
        for job in all_jobs_sorted:
            job["formattedDate"] = job["appliedAt"].strftime("%d-%b-%Y").lower()
            job["appliedAt"] = job["appliedAt"].isoformat()

        return jsonify(all_jobs_sorted), 200

    except Exception as e:
        if isinstance(e, KeyError):
            print("KeyError detected – missing required key:")
            print(traceback.format_exc())
            raise
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