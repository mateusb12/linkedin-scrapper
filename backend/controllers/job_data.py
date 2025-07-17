import sys
import time
import traceback
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import inspect, or_
from sqlalchemy.orm import joinedload

from database.database_connection import get_db_session
from models import Job
from services.gemini_service import expand_job_data
from services.openrouter_service import expand_job, parse_response
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
        total_jobs = session.query(Job).filter(
            Job.description_full.isnot(None),
            INCOMPLETE_JOB_CONDITION
        ).count()

        print(f"Starting keyword expansion for {total_jobs} jobs…")
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
                .order_by(Job.urn)
                .limit(BATCH_SIZE)
                .all()
            )

            if not batch:
                break

            for job in batch:
                expansion = expand_job_data(job.description_full or "")
                if not isinstance(expansion, dict):
                    raise TypeError(
                        f"expand_job_data returned {type(expansion).__name__}, expected dict"
                    )

                job.responsibilities = expansion.get("responsibilities", [])
                job.qualifications = expansion.get("qualifications", [])
                job.keywords = expansion.get("keywords", [])
                job.job_type = expansion.get("job_type", "Full-stack")
                job.programming_languages = expansion.get("programming_languages", [])
                job.language = expansion.get("language", "PTBR")

                last_urn = job.urn
                processed += 1
                progress(processed)

            session.commit()

            # Optional: log if any jobs are still incomplete after processing
            still_incomplete = (
                session.query(Job.urn)
                .filter(Job.urn.in_([job.urn for job in batch]))
                .filter(INCOMPLETE_JOB_CONDITION)
                .all()
            )
            for urn, in still_incomplete:
                print(f"⚠️ Job URN {urn} still incomplete after processing.")

            for job in batch:
                session.expunge(job)

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
