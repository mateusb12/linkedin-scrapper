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

from flask import jsonify, request, Response, stream_with_context

from source.features.enrich_jobs.linkedin_http_batch_enricher import BatchEnrichmentService
from source.features.enrich_jobs.linkedin_http_job_enricher import LinkedInJobEnricher
from source.features.get_applied_jobs.applied_job_sync_service import JobSyncService

# Keep old import alive for backfill streaming (not yet refactored)
from source.features.get_applied_jobs.applied_jobs_livestream_sync_service import (
    AppliedJobsIncrementalSync,
)
from source.features.get_applied_jobs.linkedin_http_proxy import LinkedInProxy
from source.features.get_applied_jobs.utils_proxy import LinkedInAppliedJobsEmptyError
from source.features.jobs.job_repository import JobRepository


def _build_linkedin_upstream_error_response(exc: LinkedInAppliedJobsEmptyError):
    return jsonify({
        "status": "error",
        "error": str(exc),
    }), exc.status_code

def get_applied_jobs():
    try:
        jobs = JobRepository.get_applied_jobs()
        return jsonify({
            "status": "success",
            "data": {"count": len(jobs), "jobs": jobs},
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

def get_applied_live():
    try:
        proxy = LinkedInProxy(debug=False, slim_mode=True)
        result = proxy.fetch_jobs_listing(stage="applied")
        return jsonify({
            "status": "success",
            "data": result.to_dict(),
        }), 200
    except LinkedInAppliedJobsEmptyError as exc:
        return _build_linkedin_upstream_error_response(exc)
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

def get_saved_live():
    try:
        proxy = LinkedInProxy(debug=True, slim_mode=True)
        result = proxy.fetch_jobs_listing(stage="saved")
        return jsonify({
            "status": "success",
            "data": result.to_dict(),
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

def debug_job():
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

        # We still need the proxy just to resolve a search string to an ID
        if not job_id and search_query:
            proxy = LinkedInProxy(debug=True, slim_mode=True)
            job_id = proxy.resolve_job_id(search_query)
            if not job_id:
                return jsonify({"status": "error", "error": "Not found"}), 404

        # 🚀 Use the new Enricher to fetch everything!

        enricher = BatchEnrichmentService(
            debug=True,
            slim_mode=True,
            return_seed_on_failure=False,
        )
        enriched_job = enricher.enrich_job(job_id)

        merged_dict = asdict(enriched_job)

        return jsonify({
            "status": "success",
            "resolved_job_id": job_id,
            "search_used": search_query,
            "data": {
                "enrichment": merged_dict,
                "company": {"company_name": merged_dict.get("company")},
                # Mocked to keep your previous response structure
                "merged_preview": merged_dict,
            },
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }), 500

def sync_applied_jobs():
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


def sync_applied_smart():
    try:
        service = JobSyncService(debug=True, slim_mode=True)
        result = service.sync_smart()
        return jsonify(result), 200

    except LinkedInAppliedJobsEmptyError as exc:
        return _build_linkedin_upstream_error_response(exc)
    except Exception as e:
        print("\n❌ SYNC ERROR")
        traceback.print_exc()

        return jsonify({
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500
