# backend/source/features/get_applied_jobs/new_get_applied_jobs_controller.py

from datetime import datetime
from flask import Blueprint, jsonify, request, Response, stream_with_context

from source.features.get_applied_jobs.new_applied_sync_service import (
    AppliedJobsIncrementalSync,
)
from source.features.get_applied_jobs.new_get_applied_jobs_service import (
    JobTrackerFetcher,
)

job_tracker_bp = Blueprint("job_tracker", __name__, url_prefix="/job-tracker")


# ============================================================
# FETCH FROM SQL
# ============================================================

@job_tracker_bp.route("/applied", methods=["GET"])
def get_applied_jobs():
    try:
        from database.database_connection import get_db_session
        from models.job_models import Job

        db = get_db_session()

        try:
            jobs = (
                db.query(Job)
                .filter(Job.has_applied == True)
                .order_by(Job.applied_on.desc())
                .all()
            )

            return jsonify({
                "status": "success",
                "data": {
                    "count": len(jobs),
                    "jobs": [job.to_dict() for job in jobs]
                }
            }), 200

        finally:
            db.close()

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


# ============================================================
# INCREMENTAL SYNC (PAGE 1 ONLY)
# ============================================================

@job_tracker_bp.route("/sync-applied", methods=["POST"])
def sync_applied_jobs():
    try:
        result = AppliedJobsIncrementalSync.sync()

        return jsonify({
            "status": "success",
            "inserted": result["inserted"],
            "updated": result["updated"],
            "updates": result["updates"],
            "stopped_early": result["stopped_early"]
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


# ============================================================
# BACKFILL WITH CUTOFF (STREAM)
# ============================================================

@job_tracker_bp.route("/sync-applied-backfill-stream", methods=["POST"])
def sync_applied_backfill_stream():
    from_param = request.args.get("from")

    if not from_param:
        return jsonify({
            "status": "error",
            "error": "Missing 'from' parameter (format: YYYY-MM)"
        }), 400

    try:
        cutoff_date = datetime.strptime(from_param, "%Y-%m")
        cutoff_date = cutoff_date.replace(day=1)
    except ValueError:
        return jsonify({
            "status": "error",
            "error": "Invalid date format. Use YYYY-MM"
        }), 400

    return Response(
        stream_with_context(
            AppliedJobsIncrementalSync.sync_backfill_stream(cutoff_date)
        ),
        content_type="text/event-stream",
    )


# ============================================================
# LIVE FETCH (DEBUG / NO PERSIST)
# ============================================================

@job_tracker_bp.route("/applied-live", methods=["GET"])
def get_applied_live():
    try:
        fetcher = JobTrackerFetcher(debug=False)
        result = fetcher.fetch_jobs(stage="applied")

        return jsonify({
            "status": "success",
            "data": result
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500
