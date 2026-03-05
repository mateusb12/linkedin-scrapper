"""
job_tracker_controller.py — Thin Flask routes.

Each endpoint is a thin wire to the correct layer:
    - DB-only   → JobRepository
    - HTTP-only → LinkedInProxy
    - Both      → JobSyncService

No business logic lives here.
"""

import traceback
from dataclasses import asdict
from datetime import datetime

from flask import Blueprint, jsonify, request, Response, stream_with_context

from source.features.get_applied_jobs.applied_job_sync_service import JobSyncService
from source.features.get_applied_jobs.linkedin_proxy import LinkedInProxy

# Keep old import alive for backfill streaming (not yet refactored)
from source.features.get_applied_jobs.applied_jobs_livestream_sync_service import (
    AppliedJobsIncrementalSync,
)
from source.features.jobs.job_repository import JobRepository

job_tracker_bp = Blueprint("job_tracker", __name__, url_prefix="/job-tracker")


# ══════════════════════════════════════════════════════════════
# DB-ONLY endpoints (JobRepository)
# ══════════════════════════════════════════════════════════════

@job_tracker_bp.route("/applied", methods=["GET"])
def get_applied_jobs():
    """List applied jobs from the local database."""
    try:
        jobs = JobRepository.get_applied_jobs()
        return jsonify({
            "status": "success",
            "data": {"count": len(jobs), "jobs": jobs},
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


# ══════════════════════════════════════════════════════════════
# LINKEDIN-ONLY endpoints (LinkedInProxy) — zero DB writes
# ══════════════════════════════════════════════════════════════

@job_tracker_bp.route("/applied-live", methods=["GET"])
def get_applied_live():
    """Proxy: fetch applied jobs from LinkedIn, return directly. No DB."""
    try:
        proxy = LinkedInProxy(debug=False, slim_mode=True)
        result = proxy.fetch_jobs_listing(stage="applied")
        return jsonify({
            "status": "success",
            "data": result.to_dict(),
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@job_tracker_bp.route("/saved-live", methods=["GET"])
def get_saved_live():
    """Proxy: fetch saved jobs from LinkedIn, return directly. No DB."""
    try:
        proxy = LinkedInProxy(debug=True, slim_mode=True)
        result = proxy.fetch_jobs_listing(stage="saved")
        return jsonify({
            "status": "success",
            "data": result.to_dict(),
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@job_tracker_bp.route("/debug-job", methods=["GET"])
def debug_job():
    """
    Debug proxy: hit LinkedIn for a SINGLE job, return raw parsed data.
    Zero DB writes. Accepts multiple identifier types.

    Usage:
        /job-tracker/debug-job?id=4012345678
        /job-tracker/debug-job?urn=urn:li:jobPosting:4012345678
        /job-tracker/debug-job?search=nubank+software+engineer
    """
    try:
        job_id = request.args.get("id")
        urn = request.args.get("urn")
        search_query = request.args.get("search")

        # Resolve URN → numeric ID
        if not job_id and urn:
            job_id = urn.replace("urn:li:jobPosting:", "").replace("urn:li:fs_jobPosting:", "")

        if not job_id and not search_query:
            return jsonify({
                "status": "error",
                "error": "Pass ?id=<job_id>, ?urn=<full_urn>, or ?search=<company+title>",
            }), 400

        proxy = LinkedInProxy(debug=True, slim_mode=True)

        # If no direct ID, resolve from listing
        if not job_id and search_query:
            job_id = proxy.resolve_job_id(search_query)
            if not job_id:
                return jsonify({
                    "status": "error",
                    "error": f"Could not resolve '{search_query}' to a job ID.",
                    "hint": "Use /job-tracker/applied-live to browse IDs, then use ?id=",
                }), 404

        # Fetch all three layers independently
        merged = proxy.enrichment_pipeline(job_id)
        # Resolve company if we got a URN
        company = None
        company_urn = merged.get("company_urn")
        if company_urn:
            company = proxy.fetch_company_details(company_urn)

        # Build merged preview (details + premium + resolved company)

        if company and company.get("company_name"):
            merged["company"] = company["company_name"]
            merged["company_url"] = company.get("company_url")
            merged["company_logo"] = company.get("company_logo")
            print(f"[debug_job] company_urn={company_urn!r}")  # ADD
            print(f"[debug_job] company result={company!r}")  # ADD

        return jsonify({
            "status": "success",
            "resolved_job_id": job_id,
            "search_used": search_query,
            "data": {
                "enrichment": merged,
                "company": company,
                "merged_preview": merged,
            },
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }), 500


# ══════════════════════════════════════════════════════════════
# SYNC endpoints (JobSyncService — LinkedIn + DB)
# ══════════════════════════════════════════════════════════════

@job_tracker_bp.route("/sync-applied", methods=["POST"])
def sync_applied_jobs():
    """Incremental sync (page 1, ~10 jobs)."""
    try:
        result = AppliedJobsIncrementalSync.sync()
        return jsonify({
            "status": "success",
            "inserted": result["inserted"],
            "updated": result["updated"],
            "updates": result["updates"],
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@job_tracker_bp.route("/sync-applied-backfill-stream", methods=["GET"])
def sync_applied_backfill_stream():
    from_param = request.args.get("from")

    if not from_param:
        return jsonify({"error": "Missing 'from' parameter (YYYY-MM)"}), 400

    try:
        cutoff_date = datetime.strptime(from_param, "%Y-%m").replace(day=1)
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    def generate():
        yield from AppliedJobsIncrementalSync.sync_backfill_stream(cutoff_date)

    response = Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
    )
    response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"  # kills nginx buffering
    response.headers["Transfer-Encoding"] = "chunked"  # forces chunk-by-chunk
    return response


@job_tracker_bp.route("/sync-applied-smart", methods=["POST"])
def sync_applied_smart():
    """Smart sync: diff LinkedIn vs DB, enrich + save only new jobs."""
    try:
        service = JobSyncService(debug=True, slim_mode=True)
        result = service.sync_smart()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500
