# backend/source/features/get_applied_jobs/services_controller.py

import json
import math
import re
import traceback
from datetime import timezone
from flask import Blueprint, jsonify, request
from dateutil.parser import parse as parse_datetime
from sqlalchemy import or_, func

from exceptions.service_exceptions import LinkedInScrapingException
from models import Job, FetchCurl, Email, Company
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


def normalize_linkedin_job(job_data) -> dict:
    """Normalizes a single LinkedIn job (can be dict or Job object)."""
    if isinstance(job_data, Job):
        return normalize_sql_job(job_data)

    try:
        applied_at = job_data.get("applied_on")
        return {
            "company": job_data.get("company"),
            "title": job_data.get("title", "").strip(),
            "appliedAt": applied_at,
            "source": "LinkedIn",
            "url": job_data.get("job_url"),
            "urn": job_data.get("urn")
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
        "description_full": job.description_full,
        "applicants": job.applicants,
        "application_status": job.application_status or "Waiting"  # Default for frontend
    }


def apply_timezone_fix(job_dict):
    """Helper to ensure dates are UTC aware for frontend conversion."""
    applied_at = job_dict.get("appliedAt")
    if applied_at:
        if isinstance(applied_at, str):
            try:
                applied_at = parse_datetime(applied_at)
            except:
                pass

        if hasattr(applied_at, 'tzinfo'):
            if applied_at.tzinfo is None:
                applied_at = applied_at.replace(tzinfo=timezone.utc)

            job_dict["formattedDate"] = applied_at.strftime("%d-%b-%Y").lower()
            job_dict["appliedAt"] = applied_at.isoformat()
    return job_dict


@services_bp.route("/applied-jobs", methods=["GET"])
def get_all_applied_jobs():
    """
    Fetches job applications.
    """
    repo = JobRepository()
    try:
        page = request.args.get('page', type=int)
        limit = request.args.get('limit', default=10, type=int)

        if page:
            result = repo.fetch_paginated_applied_jobs(page, limit)

            normalized_jobs = []
            for job in result['jobs']:
                norm = normalize_sql_job(job)
                norm = apply_timezone_fix(norm)
                normalized_jobs.append(norm)

            return jsonify({
                "data": normalized_jobs,
                "total": result['total'],
                "page": result['page'],
                "limit": result['limit'],
                "total_pages": math.ceil(result['total'] / limit)
            }), 200

        else:
            print("Syncing LinkedIn jobs...")
            fetch_all_linkedin_jobs()
            print("Sync complete.")

            all_jobs = repo.fetch_internal_sql_jobs()
            normalized_jobs = [normalize_sql_job(job) for job in all_jobs]

            final_list = []
            for job in normalized_jobs:
                if not job.get("appliedAt"):
                    continue
                try:
                    job = apply_timezone_fix(job)
                    final_list.append(job)
                except Exception as parse_err:
                    print(f"Skipping job {job.get('title')} - invalid date ({parse_err})")
                    continue

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


@services_bp.route("/sync-status", methods=["POST"])
def sync_application_status():
    """
    Cross-references 'Job fails' emails with Jobs table to update status to 'Refused'.
    """
    session = get_db_session()
    try:
        rejection_emails = session.query(Email).filter(Email.folder == "Job fails").all()
        updated_count = 0

        for email in rejection_emails:
            target_company_name = None

            # 1. Parse Subject (Ascendion case)
            subject_match = re.search(r"application to .*? at (.*)", email.subject, re.IGNORECASE)

            if subject_match:
                target_company_name = subject_match.group(1).strip().rstrip('.')

            # 2. Fallback to Sender
            if not target_company_name:
                sender_clean = email.sender.split(' via ')[0].split('<')[0].strip().replace('"', '')
                if "linkedin" not in sender_clean.lower():
                    target_company_name = sender_clean

            if not target_company_name:
                continue

            print(f"   [Status Sync] Email: '{email.subject}' -> Detected Company: '{target_company_name}'")

            # 3. Find matching jobs
            # CRITICAL FIX: Allow application_status to be NULL or "Waiting"
            candidate_jobs = session.query(Job).join(Company).filter(
                or_(
                    Job.application_status == "Waiting",
                    Job.application_status.is_(None)
                ),
                or_(
                    func.lower(Company.name).contains(func.lower(target_company_name)),
                    func.lower(target_company_name).contains(func.lower(Company.name))
                )
            ).all()

            if not candidate_jobs:
                print(f"      -> ⚠️ NO MATCH found for '{target_company_name}' in DB (or already refused).")

            for job in candidate_jobs:
                job.application_status = "Refused"
                updated_count += 1
                print(f"      -> ✅ UPDATING: Marked '{job.title}' at '{job.company.name}' as Refused.")

        session.commit()
        return jsonify({"message": f"Sync complete. Updated {updated_count} jobs to 'Refused'."}), 200

    except Exception as e:
        session.rollback()
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


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


@services_bp.route("/cookies", methods=["GET", "PUT"])
def manage_cookies():
    session = get_db_session()

    if request.method == "GET":
        identifier = request.args.get("identifier")
        if not identifier:
            return jsonify({"error": "Missing 'identifier'"}), 400
        record = session.query(FetchCurl).filter_by(name=identifier).one_or_none()
        if not record:
            return jsonify({"error": "Record not found"}), 404
        return jsonify({"identifier": identifier, "cookies": record.cookies}), 200

    if request.method == "PUT":
        data = request.get_json()
        if not data or "identifier" not in data or "cookies" not in data:
            return jsonify({"error": "Missing required fields"}), 400

        identifier = data["identifier"]
        new_cookies = data["cookies"]
        csrf_token = data.get("csrfToken")

        record = session.query(FetchCurl).filter_by(name=identifier).one_or_none()

        if not record:
            record = FetchCurl(name=identifier, cookies=new_cookies)
            session.add(record)
        else:
            record.cookies = new_cookies
            if csrf_token and record.headers:
                try:
                    headers = json.loads(record.headers)
                    headers["csrf-token"] = csrf_token
                    record.headers = json.dumps(headers)
                except json.JSONDecodeError:
                    pass

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