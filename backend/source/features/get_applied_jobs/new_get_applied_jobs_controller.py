from flask import Blueprint, jsonify

from source.features.get_applied_jobs.new_get_applied_jobs_service import JobTrackerFetcher

job_tracker_bp = Blueprint("job_tracker", __name__, url_prefix="/job-tracker")


@job_tracker_bp.route("/saved", methods=["GET"])
def get_saved_jobs():
    """Retorna o payload bruto das vagas salvas."""
    try:
        fetcher = JobTrackerFetcher(debug=True)
        raw_data = fetcher.fetch_jobs(stage="saved")
        return jsonify({
            "status": "success",
            "stage": "saved",
            "data": raw_data
        }), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@job_tracker_bp.route("/applied", methods=["GET"])
def get_applied_jobs():
    """Retorna o payload bruto das vagas aplicadas."""
    try:
        fetcher = JobTrackerFetcher(debug=True)
        raw_data = fetcher.fetch_jobs(stage="applied")
        return jsonify({
            "status": "success",
            "stage": "applied",
            "data": raw_data
        }), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
