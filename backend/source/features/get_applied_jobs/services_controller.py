# backend/controllers/services_controller.py
import json
from datetime import timezone
from flask import Blueprint, jsonify, request
from dateutil.parser import parse as parse_datetime
import traceback

from exceptions.service_exceptions import LinkedInScrapingException
from models import Job, FetchCurl
from source.features.job_population.job_repository import JobRepository
from services.job_tracking.huntr_service import get_huntr_jobs_data
from database.database_connection import get_db_session
from source.features.get_applied_jobs.fetch_linkedin_applied_jobs import fetch_all_linkedin_jobs

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
def normalize_linkedin_job(job_data) -> dict:
    """Normalizes a single LinkedIn job (can be dict or Job object)."""
    # Handle if fetch_all_linkedin_jobs returns ORM objects
    if isinstance(job_data, Job):
        return normalize_sql_job(job_data)

    # Handle if it returns dicts
    try:
        # Check if 'applied_on' is already a datetime object or string
        applied_at = job_data.get("applied_on")

        return {
            "company": job_data.get("company"),
            "title": job_data.get("title", "").strip(),
            "appliedAt": applied_at,
            "source": "LinkedIn",
            "url": job_data.get("job_url"),
            "urn": job_data.get("urn")  # Ensure URN is passed for deduplication
        }
    except KeyError as e:
        print("Key error on LinkedIn job normalization:", job_data)
        raise e


def normalize_sql_job(job: Job) -> dict:
    """Normalizes a single SQL Job object for the frontend."""
    return {
        "company": job.company.name if job.company else "Unknown",
        "title": job.title.strip() if job.title else "Unknown Title",
        "appliedAt": job.applied_on,
        "source": "LinkedIn" if "linkedin" in (job.job_url or "") else "SQL",
        "url": job.job_url or None,
        "urn": job.urn,
        "location": job.location,
        "description_full": job.description_full
    }


# --- THIS ENDPOINT IS MADE MORE ROBUST ---
@services_bp.route("/applied-jobs", methods=["GET"])
def get_all_applied_jobs():
    """
    Fetches and unifies job applications, de-duplicating to ensure correct source labeling.
    """
    repo = JobRepository()
    try:
        # 1. Trigger the sync (Updates DB with fresh timestamps)
        print("Syncing LinkedIn jobs...")
        fetch_all_linkedin_jobs()
        print("Sync complete.")

        # 2. Fetch ALL applied jobs from DB (Now includes those without descriptions)
        all_jobs = repo.fetch_internal_sql_jobs()

        normalized_jobs = [normalize_sql_job(job) for job in all_jobs]

        # 3. Clean and Sort
        final_list = []
        for job in normalized_jobs:
            applied_at = job.get("appliedAt")

            # Skip if no date
            if not applied_at:
                continue

            try:
                # Ensure we have a datetime object
                if isinstance(applied_at, str):
                    applied_at = parse_datetime(applied_at)

                # Ensure Timezone Awareness (UTC) for consistent sorting
                if applied_at.tzinfo is None:
                    applied_at = applied_at.replace(tzinfo=timezone.utc)

                job["appliedAt"] = applied_at

                # Format for Frontend Display
                # Example: 02-dec-2025
                job["formattedDate"] = applied_at.strftime("%d-%b-%Y").lower()

                # ISO format for charts/sorting
                job["appliedAt"] = applied_at.isoformat()

                final_list.append(job)
            except Exception as parse_err:
                print(f"Skipping job {job.get('title')} - invalid date: {applied_at} ({parse_err})")
                continue

        # 4. Sort Descending (Newest First)
        all_jobs_sorted = sorted(
            final_list,
            key=lambda x: x["appliedAt"],
            reverse=True
        )

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


def _get_record_by_identifier(identifier: str) -> FetchCurl | None:
    """
    Finds a FetchCurl record by its ID or name.
    - If the identifier is a digit, it searches by primary key (id).
    - Otherwise, it searches by the 'name' field.

    Args:
        identifier: The ID or name of the record.

    Returns:
        The FetchCurl ORM instance or None if not found.
    """
    session = get_db_session()
    try:
        if isinstance(identifier, int) or identifier.isdigit():
            return session.query(FetchCurl).filter_by(id=int(identifier)).one_or_none()
        return session.query(FetchCurl).filter_by(name=identifier).one_or_none()
    finally:
        session.close()


@services_bp.route("/cookies", methods=["GET", "PUT"])
def manage_cookies():
    session = get_db_session()

    # GET logic remains the same
    if request.method == "GET":
        identifier = request.args.get("identifier")
        if not identifier:
            return jsonify({"error": "Missing 'identifier'"}), 400
        record = session.query(FetchCurl).filter_by(name=identifier).one_or_none()
        if not record:
            return jsonify({"error": "Record not found"}), 404
        return jsonify({"identifier": identifier, "cookies": record.cookies}), 200

    # PUT Logic - UPDATED for CSRF handling
    if request.method == "PUT":
        data = request.get_json()
        if not data or "identifier" not in data or "cookies" not in data:
            return jsonify({"error": "Missing required fields"}), 400

        identifier = data["identifier"]
        new_cookies = data["cookies"]
        csrf_token = data.get("csrfToken")  # Optional new field

        record = session.query(FetchCurl).filter_by(name=identifier).one_or_none()

        if not record:
            record = FetchCurl(name=identifier, cookies=new_cookies)
            session.add(record)
        else:
            record.cookies = new_cookies

            # Update CSRF token in headers if provided
            if csrf_token and record.headers:
                try:
                    headers = json.loads(record.headers)
                    headers["csrf-token"] = csrf_token
                    record.headers = json.dumps(headers)
                    print(f"✅ Updated CSRF token in headers to: {csrf_token}")
                except json.JSONDecodeError:
                    print("❌ Failed to parse headers JSON for CSRF update")

        try:
            session.commit()
            return jsonify({
                "message": "Credentials updated successfully",
                "identifier": identifier,
                "cookies": new_cookies
            }), 200
        except Exception as e:
            session.rollback()
            return jsonify({"error": "Database error", "details": str(e)}), 500

    return jsonify({"error": "Method not allowed"}), 405
