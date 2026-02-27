from datetime import datetime
from flask import Blueprint, jsonify, request, Response, stream_with_context

from source.features.get_applied_jobs.new_applied_sync_service import AppliedJobsIncrementalSync
from source.features.get_applied_jobs.new_get_applied_jobs_service import JobTrackerFetcher

job_tracker_bp = Blueprint("job_tracker", __name__, url_prefix="/job-tracker")


# ============================================================
# NORMAL FETCH
# ============================================================

@job_tracker_bp.route("/applied", methods=["GET"])
def get_applied_jobs():
    try:
        fetcher = JobTrackerFetcher(debug=True)
        raw_data = fetcher.fetch_jobs(stage="applied")
        return jsonify({
            "status": "success",
            "stage": "applied",
            "data": raw_data
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# INCREMENTAL SIMPLE
# ============================================================

@job_tracker_bp.route("/sync-applied", methods=["POST"])
def sync_applied_jobs():
    try:
        result = AppliedJobsIncrementalSync.sync()

        return jsonify({
            "status": "success",
            "inserted": result["inserted"],
            "stopped_early": result["stopped_early"]
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


# ============================================================
# 🔥 BACKFILL STREAM (SSE)
# ============================================================

@job_tracker_bp.route("/sync-applied-backfill-stream", methods=["POST"])
def sync_applied_backfill_stream():
    from_param = request.args.get("from")

    if not from_param:
        return jsonify({"error": "Missing 'from' parameter (format: YYYY-MM)"}), 400

    try:
        cutoff_date = datetime.strptime(from_param, "%Y-%m")
        cutoff_date = cutoff_date.replace(day=1)
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM"}), 400

    return Response(
        stream_with_context(
            AppliedJobsIncrementalSync.sync_backfill_stream(cutoff_date)
        ),
        content_type="text/event-stream",
    )
