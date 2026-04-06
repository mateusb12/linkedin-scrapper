"""
job_tracker_router.py - Routing and Swagger documentation layer.

Uses the same router/controller separation pattern as services_router.py.
"""

from flask import Blueprint

from source.features.get_applied_jobs.applied_jobs_controller import (
    get_applied_jobs,
    get_applied_live,
    get_saved_live,
    debug_job,
    sync_applied_jobs,
    sync_applied_backfill_stream,
    sync_applied_smart,
)

job_tracker_bp = Blueprint("job_tracker", __name__, url_prefix="/job-tracker")


@job_tracker_bp.route("/applied", methods=["GET"])
def get_applied_jobs_route():
    """
    Queries the local database and returns stored applied jobs.
    ---
    tags:
      - Job Tracker
    responses:
      200:
        description: Stored applied jobs.
        schema:
          type: object
          properties:
            status:
              type: string
            data:
              type: object
              properties:
                count:
                  type: integer
                jobs:
                  type: array
                  items:
                    type: object
        examples:
          application/json:
            status: "success"
            data:
              count: 1
              jobs:
                - urn: "4384236851"
                  title: "Python Developer | Remote"
                  application_status: "Waiting"
                  job_url: "https://www.linkedin.com/jobs/view/4384236851/"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
    """
    return get_applied_jobs()


@job_tracker_bp.route("/applied-live", methods=["GET"])
def get_applied_live_route():
    """
    Proxies applied jobs directly from LinkedIn without database writes.
    ---
    tags:
      - Job Tracker
    responses:
      200:
        description: Applied jobs fetched live from LinkedIn.
        schema:
          type: object
          properties:
            status:
              type: string
            data:
              type: object
              properties:
                count:
                  type: integer
                stage:
                  type: string
                jobs:
                  type: array
                  items:
                    type: object
        examples:
          application/json:
            status: "success"
            data:
              count: 1
              stage: "applied"
              jobs:
                - job_id: "4384236851"
                  title: "Python Developer | Remote"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
    """
    return get_applied_live()


@job_tracker_bp.route("/saved-live", methods=["GET"])
def get_saved_live_route():
    """
    Proxies saved jobs directly from LinkedIn without database writes.
    ---
    tags:
      - Job Tracker
    responses:
      200:
        description: Saved jobs fetched live from LinkedIn.
        schema:
          type: object
          properties:
            status:
              type: string
            data:
              type: object
              properties:
                count:
                  type: integer
                stage:
                  type: string
                jobs:
                  type: array
                  items:
                    type: object
        examples:
          application/json:
            status: "success"
            data:
              count: 1
              stage: "saved"
              jobs:
                - job_id: "4384236851"
                  title: "Python Developer | Remote"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
    """
    return get_saved_live()


@job_tracker_bp.route("/debug-job", methods=["GET"])
def debug_job_route():
    """
    Fetches a single fully enriched job by ID, URN, or search query.
    ---
    tags:
      - Job Tracker
    parameters:
      - name: id
        in: query
        type: string
        required: false
      - name: urn
        in: query
        type: string
        required: false
      - name: search
        in: query
        type: string
        required: false
    responses:
      200:
        description: Fully enriched job payload.
        schema:
          type: object
          properties:
            status:
              type: string
            resolved_job_id:
              type: string
            search_used:
              type: string
            data:
              type: object
        examples:
          application/json:
            status: "success"
            resolved_job_id: "4384236851"
            search_used: null
            data:
              enrichment:
                job_id: "4384236851"
              company:
                company_name: "Crossing Hurdles"
              merged_preview:
                job_id: "4384236851"
      400:
        description: Missing lookup parameters.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
      404:
        description: Job not found for the provided search query.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
      500:
        description: Unexpected server error with traceback.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
            traceback:
              type: string
    """
    return debug_job()


@job_tracker_bp.route("/sync-applied", methods=["POST"])
def sync_applied_jobs_route():
    """
    Runs incremental applied-jobs sync.
    ---
    tags:
      - Job Tracker
    responses:
      200:
        description: Sync completed successfully.
        schema:
          type: object
          properties:
            status:
              type: string
            inserted:
              type: integer
            updated:
              type: integer
            updates:
              type: array
              items:
                type: object
        examples:
          application/json:
            status: "success"
            inserted: 0
            updated: 1
            updates: []
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
    """
    return sync_applied_jobs()


@job_tracker_bp.route("/sync-applied-backfill-stream", methods=["GET"])
def sync_applied_backfill_stream_route():
    """
    Streams backfill sync progress from a given YYYY-MM cutoff.
    ---
    tags:
      - Job Tracker
    produces:
      - text/event-stream
    parameters:
      - name: from
        in: query
        type: string
        required: true
        description: Cutoff month in `YYYY-MM` format.
    responses:
      200:
        description: SSE stream for backfill progress.
      400:
        description: Missing or invalid `from` parameter.
        schema:
          type: object
          properties:
            error:
              type: string
    """
    return sync_applied_backfill_stream()


@job_tracker_bp.route("/sync-applied-smart", methods=["POST"])
def sync_applied_smart_route():
    """
    Runs smart sync by diffing LinkedIn jobs against the database.
    ---
    tags:
      - Job Tracker
    responses:
      200:
        description: Smart sync result.
        schema:
          type: object
          additionalProperties: true
        examples:
          application/json:
            status: "success"
      500:
        description: Unexpected server error with traceback.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
            traceback:
              type: string
    """
    return sync_applied_smart()
