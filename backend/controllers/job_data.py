import sys
import time
import traceback
from datetime import datetime, timedelta

from flask import Blueprint, jsonify
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


@job_data_bp.route("/keywords", methods=["PATCH"])
def insert_extra_fields():
    session = get_db_session()
    BATCH_SIZE = 5
    last_urn = ""

    try:
        # count total once
        total_jobs = session.query(Job) \
            .filter(Job.description_full.isnot(None), Job.keywords.is_(None)) \
            .count()
        print(f"Starting keyword expansion for {total_jobs} jobs…")

        progress = JobConsoleProgress(total_jobs)

        processed = 0
        while True:
            batch = (
                session.query(Job)
                .options(joinedload(Job.company))
                .filter(
                    Job.description_full.isnot(None),
                    Job.keywords.is_(None),
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
                        f"expand_job_data returned {type(expansion).__name__}, "
                        "expected dict-like result"
                    )
                job.responsibilities = expansion.get("responsibilities", [])
                job.qualifications = expansion.get("qualifications", [])
                job.keywords = expansion.get("keywords", [])
                job.language = expansion.get("language", "PTBR")

                last_urn = job.urn
                processed += 1
                progress(processed)

            session.commit()
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
