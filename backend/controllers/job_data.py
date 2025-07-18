import sys
import time
import traceback
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import inspect, or_
from sqlalchemy.orm import joinedload

from database.database_connection import get_db_session
from models import Job
from services.model_orchestrator import LLMOrchestrator
from utils.metric_utils import JobConsoleProgress

job_data_bp = Blueprint("jobs", __name__, url_prefix="/jobs")


@job_data_bp.route("/all", methods=["GET"])
def get_all_jobs():
    """
    Fetches all jobs and their associated company data from the database.
    """
    session = get_db_session()
    try:
        print("Attempting to query the database for all jobs...")
        jobs = (
            session.query(Job).options(joinedload(Job.company)).all()
        )
        print(f"Fetched {len(jobs)} jobs from the database.")
        return jsonify([job.to_dict() for job in jobs]), 200
    except Exception as e:
        print(f"An error occurred: {e}")
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


INCOMPLETE_JOB_CONDITION = or_(
    Job.description_full.is_(None),
    Job.description_full == '',
    Job.responsibilities.is_(None),
    Job.responsibilities == [],
    Job.qualifications.is_(None),
    Job.qualifications == [],
    Job.keywords.is_(None),
    Job.keywords == [],
    Job.job_type.is_(None),
    Job.job_type == '',
    Job.programming_languages.is_(None),
    Job.programming_languages == [],
    Job.language.is_(None),
    Job.language == ''
)


@job_data_bp.route("/keywords", methods=["PATCH"])
def insert_extra_fields():
    session = get_db_session()
    BATCH_SIZE = 5
    last_urn = ""

    try:
        from sqlalchemy import case, desc

        incompleteness_score = (
                case((Job.responsibilities.is_(None), 1), else_=0) +
                case((Job.qualifications.is_(None), 1), else_=0) +
                case((Job.keywords.is_(None), 1), else_=0) +
                case((Job.job_type.is_(None), 1), else_=0) +
                case((Job.programming_languages.is_(None), 1), else_=0) +
                case((Job.language.is_(None), 1), else_=0)
        )

        total_jobs = session.query(Job).filter(
            Job.description_full.isnot(None),
            INCOMPLETE_JOB_CONDITION
        ).count()

        print(f"🔄 Starting keyword expansion for {total_jobs} incomplete jobs...")
        orchestrator = LLMOrchestrator()
        progress = JobConsoleProgress(total_jobs)
        processed = 0

        while True:
            batch = (
                session.query(Job)
                .options(joinedload(Job.company))
                .filter(
                    Job.description_full.isnot(None),
                    INCOMPLETE_JOB_CONDITION,
                    Job.urn > last_urn
                )
                .order_by(desc(incompleteness_score), Job.urn)
                .limit(BATCH_SIZE)
                .all()
            )

            if not batch:
                break

            for job in batch:
                expansion = orchestrator.generate_response(job.description_full or "")

                if "error" in expansion or not isinstance(expansion, dict):
                    print(f"⚠️ Could not expand job {job.urn}. Reason: {expansion.get('error', 'Invalid response format')}")
                    last_urn = job.urn
                    processed += 1
                    progress(processed)
                    continue

                # Patch only missing fields (preserve existing ones)
                if not job.responsibilities:
                    job.responsibilities = expansion.get("Responsibilities", [])
                if not job.qualifications:
                    job.qualifications = expansion.get("Qualifications", [])
                if not job.keywords:
                    job.keywords = expansion.get("Keywords", [])
                if not job.job_type:
                    job.job_type = expansion.get("JobType", "Full-stack")
                if not job.programming_languages:
                    job.programming_languages = expansion.get("JobLanguages", [])
                if not job.language:
                    job.language = expansion.get("JobDescriptionLanguage", "PTBR")

                last_urn = job.urn
                processed += 1
                progress(processed)

            session.commit()

        print("\n✅ Extra fields inserted successfully.")
        return jsonify({"message": "Done"}), 200

    except Exception as exc:
        session.rollback()
        print("\n❌ An error occurred:")
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 500

    finally:
        session.close()


@job_data_bp.route("/<string:urn>", methods=["PATCH"])
def update_job(urn):
    """
    Dynamically updates any column of a Job using SQLAlchemy introspection.
    Excludes primary key and relationship fields like 'company'.
    """
    session = get_db_session()
    try:
        job = session.query(Job).filter_by(urn=urn).first()
        if not job:
            return jsonify({"error": f"Job with URN '{urn}' not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"error": "Empty JSON payload"}), 400

        mapper = inspect(Job)
        updatable_fields = {
            col.key for col in mapper.attrs
            if hasattr(col, 'columns') and not col.columns[0].primary_key
        }

        updated_fields = []

        for key, value in data.items():
            if key in updatable_fields:
                setattr(job, key, value)
                updated_fields.append(key)

        if not updated_fields:
            return jsonify({"error": "No valid fields provided"}), 400

        session.commit()
        return jsonify({
            "message": f"Job {urn} updated successfully",
            "updated_fields": updated_fields,
            "job": job.to_dict()
        }), 200

    except Exception as e:
        session.rollback()
        print(f"❌ Failed to update job {urn}: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()