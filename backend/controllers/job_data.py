from flask import Blueprint, jsonify
from sqlalchemy.orm import joinedload

from database.database_connection import get_db_session
from models import Job

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
    """
    Inserts extra fields into all job records in the database.
    This is a placeholder function that can be expanded to include specific logic.
    """
    session = get_db_session()
    try:
        print("Inserting extra fields into all job records...")
        jobs = (
            session.query(Job).options(joinedload(Job.company)).all()
        )
        session.commit()
        print("Extra fields inserted successfully.")
        jobs = [job.to_dict() for job in jobs]
        return jsonify({"message": "Extra fields inserted successfully.", "jobs": jobs}), 200
    except Exception as e:
        print(f"An error occurred: {e}")
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()
