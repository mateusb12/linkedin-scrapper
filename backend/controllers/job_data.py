import sys
import time
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
    """Augments every Job with responsibilities / qualifications / keywords."""
    session = get_db_session()
    BATCH_SIZE = 5

    try:
        # 1. Build query and compute workload size --------------------------
        base_q = (
            session.query(Job)
            .filter(Job.description_full.isnot(None),
                    Job.keywords.is_(None))
        )
        total_jobs = base_q.count()
        jobs_iter = base_q.options(joinedload(Job.company)).yield_per(BATCH_SIZE)

        # 2. Initialise progress tracker ------------------------------------
        progress = JobConsoleProgress(total_jobs)
        print(f"Starting keyword expansion for {total_jobs} jobs…")

        # 3. Main loop -------------------------------------------------------
        for idx, job in enumerate(jobs_iter, 1):
            job_description = job.description_full or ""
            expansion = expand_job_data(job_description)

            job.responsibilities = expansion.get("responsibilities", [])
            job.qualifications = expansion.get("qualifications", [])
            job.keywords = expansion.get("keywords", [])

            if idx % BATCH_SIZE == 0:
                session.flush()
                session.commit()
                session.expunge_all()

            progress(idx)

        # 4. Finalise --------------------------------------------------------
        session.commit()
        progress(total_jobs)  # final print
        print("\n✅ Extra fields inserted successfully.")
        return jsonify({"message": "Done"}), 200

    except Exception as exc:
        session.rollback()
        print(f"\n❌ error: {exc}")
        return jsonify({"error": str(exc)}), 500

    finally:
        session.close()
