# backend/controllers/services_controller.py
from datetime import timezone
from flask import Blueprint, jsonify, request
from dateutil.parser import parse as parse_datetime
import traceback

from exceptions.service_exceptions import LinkedInScrapingException
from models import Job, FetchCurl
from source.features.job_population.job_repository import JobRepository
from services.job_tracking.huntr_service import get_huntr_jobs_data
from database.database_connection import get_db_session
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
    except LinkedInScrapingException as e:
        print(f"ERROR during LinkedIn sync: {e}")
        # Return a 502 Bad Gateway, which is appropriate for a failed upstream request
        return jsonify({"error": "Failed to fetch data from LinkedIn.", "details": str(e)}), 502
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
    """
    A unified endpoint to get or set cookies for a FetchCurl record.

    GET /fetch-curl/cookies?identifier=<id_or_name>
      - Retrieves the cookies for the specified record.

    PUT /fetch-curl/cookies
      - Updates the cookies for the record specified in the JSON body.
      - Body: {"identifier": "<id_or_name>", "cookies": "new_cookie_string"}
    """
    # --- Setter (Update) Logic ---
    if request.method == "PUT":
        data = request.get_json()
        if not data or "identifier" not in data or "cookies" not in data:
            return jsonify({"error": "Missing 'identifier' or 'cookies' in request body"}), 400

        identifier = data.get("identifier")
        new_cookies = data.get("cookies")

        print(f"\n[DEBUG] Frontend is asking to UPDATE record with IDENTIFIER: '{identifier}'")

        record = _get_record_by_identifier(str(identifier))

        if not record:
            return jsonify({"error": f"Record with identifier '{identifier}' not found"}), 404

        print(f"[DEBUG] Found record in DB to UPDATE -> ID: {record.id}, Name: {record.name}\n")

        try:
            record.cookies = new_cookies
            db.session.commit()
            return jsonify({
                "message": "Cookies updated successfully",
                "identifier": identifier,
                "record": record.to_dict()
            }), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "Failed to update cookies", "details": str(e)}), 500

    # --- Getter (Retrieve) Logic ---
    if request.method == "GET":
        identifier = request.args.get("identifier")
        if not identifier:
            return jsonify({"error": "Missing 'identifier' query parameter"}), 400

        record = _get_record_by_identifier(identifier)

        if not record:
            return jsonify({"error": f"Record with identifier '{identifier}' not found"}), 404

        return jsonify({
            "identifier": identifier,
            "cookies": record.cookies
        }), 200

    # Fallback for unsupported methods
    return jsonify({"error": "Method not allowed"}), 405