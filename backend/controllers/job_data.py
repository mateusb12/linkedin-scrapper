import sys
import time
import traceback
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import inspect, or_
from sqlalchemy.orm import joinedload

from database.database_connection import get_db_session
from factory.core_instances import embedding_calculator
from models import Job
from services.model_orchestrator import LLMOrchestrator, AllLLMsFailed
from utils.metric_utils import JobConsoleProgress

job_data_bp = Blueprint("jobs", __name__, url_prefix="/jobs")


@job_data_bp.route("/", methods=["GET"])
@job_data_bp.route("/all", methods=["GET"])
def get_all_jobs():
    """
    Fetches all jobs and their associated company data from the database.
    """
    session = get_db_session()
    try:
        print("Attempting to query the database for all jobs...")
        jobs = (
            session.query(Job)
            .options(joinedload(Job.company))
            .all()
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
    BATCH_SIZE = 3
    last_urn = None  # None to indicate first iteration (no pagination yet)

    try:
        from sqlalchemy import case, desc
        from sqlalchemy.orm import joinedload

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
        progress = JobConsoleProgress(total_jobs)
        orchestrator = LLMOrchestrator(progress=progress)
        processed = 0

        while True:
            query = (
                session.query(Job)
                .options(joinedload(Job.company))
                .filter(
                    Job.description_full.isnot(None),
                    INCOMPLETE_JOB_CONDITION
                )
            )

            if last_urn:
                query = query.filter(Job.urn < last_urn)  # paginate from newest to oldest

            batch = (
                query
                .order_by(desc(Job.urn))  # fetch newest jobs first
                .limit(BATCH_SIZE)
                .all()
            )

            if not batch:
                break

            for job in batch:
                try:
                    expansion = orchestrator.expand_job(job.description_full or "")
                except AllLLMsFailed as exc:
                    session.rollback()
                    print(f"❌ Stopping: {exc}")
                    return jsonify({"error": str(exc)}), 500

                if "error" in expansion or not isinstance(expansion, dict):
                    print(
                        f"⚠️ Could not expand job {job.urn}. Reason: {expansion.get('error', 'Invalid response format')}")
                    last_urn = job.urn
                    processed += 1
                    progress(processed, urn=job.urn)
                    continue

                progress.set_status(f"Expanding job {job.urn}...")

                if not job.responsibilities:
                    job.responsibilities = expansion.get("responsibilities", [])
                if not job.qualifications:
                    job.qualifications = expansion.get("qualifications", [])
                if not job.keywords:
                    job.keywords = expansion.get("keywords", [])
                if not job.job_type:
                    raw_jt = expansion.get("job_type", "Full-stack")
                    if isinstance(raw_jt, dict):
                        lang_key = job.language.lower() if job.language else "en"
                        job.job_type = raw_jt.get(lang_key) or raw_jt.get("en") or "Full-stack"
                    else:
                        job.job_type = raw_jt
                if not job.programming_languages:
                    for key in ("Programming languages", "programming_languages"):
                        if key in expansion:
                            job.programming_languages = expansion[key]
                            break
                if not job.language:
                    job.language = expansion.get("JobDescriptionLanguage", "PTBR")

                last_urn = job.urn
                processed += 1
                progress(processed, urn=job.urn)

            progress.set_status(f"Batch finished, committing changes...")
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


@job_data_bp.route("/<string:urn>/disable", methods=["PATCH"])
def mark_job_as_disabled(urn):
    """
    Marks a job as disabled by setting the 'disabled' field to True.
    """
    session = get_db_session()
    try:
        job = session.query(Job).filter_by(urn=urn).first()
        if not job:
            return jsonify({"error": f"Job with URN '{urn}' not found"}), 404

        job.disabled = True
        session.commit()
        return jsonify({
            "message": f"Job {urn} marked as disabled",
            "job": job.to_dict()
        }), 200

    except Exception as e:
        session.rollback()
        print(f"❌ Failed to disable job {urn}: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@job_data_bp.route('/<string:urn>/mark_applied', methods=['PATCH', 'OPTIONS'])
def mark_job_as_applied(urn):
    session = get_db_session()
    try:
        job = session.query(Job).get(urn)

        if not job:
            return jsonify({"error": f"Job with URN '{urn}' not found"}), 404

        job.has_applied = True
        session.commit()

        return jsonify({
            "message": f"Job '{urn}' marked as applied.",
            "job": job.to_dict()
        }), 200

    except Exception as e:
        session.rollback()
        return jsonify({"error": "Failed to mark job as applied", "details": str(e)}), 500

    finally:
        session.close()


@job_data_bp.route("/match-score", methods=["POST"])
def compute_match_score():
    """
    Computes similarity score between resume and job description using embeddings.
    """
    try:
        request_body = request.get_json()
        resume = request_body.get("resume", "") or request_body.get("resume_text", "")
        job = request_body.get("job_description", "") or request_body.get("job_text", "")

        if not resume.strip():
            raise ValueError("❌ resume field is empty.")
        if not job.strip():
            raise ValueError("❌ job_description field is empty.")

        score = embedding_calculator.compute_similarity(resume_text=resume, job_text=job)
        return jsonify({"match_score": score}), 200

    except Exception as e:
        print("⚠️ Error in match-score route:", str(e))
        return jsonify({"error": str(e)}), 500
