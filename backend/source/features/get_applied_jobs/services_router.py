"""
services_routes.py — Routing and Swagger documentation layer.

Imports controller logic and defines routes with Flasgger (Swagger 2.0)
specifications via docstrings.
"""

from flask import Blueprint
from source.features.get_applied_jobs.applied_jobs_controller import (
    get_applied_jobs,
    get_applied_live,
    get_saved_live,
    debug_job,
    sync_applied_jobs,
    sync_applied_backfill_stream,
    sync_applied_smart
)

# Blueprint creation
services_bp = Blueprint("services", __name__, url_prefix="/services")


# ══════════════════════════════════════════════════════════════
# DB-ONLY endpoints
# ══════════════════════════════════════════════════════════════

@services_bp.route("/applied", methods=["GET"])
def get_applied_jobs_route():
    """
    List applied jobs from the local database.
    ---
    tags:
      - Job Tracker (Database)
    responses:
      200:
        description: Returns a list of applied jobs saved in the database.
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
            status: success
            data:
              count: 31
              jobs:
                - urn: "4384236851"
                  title: "Python Developer | Remote"
                  job_url: "https://www.linkedin.com/jobs/view/4384236851/"
                  location: "Brazil"
                  application_status: "Waiting"
                  applicants: 216
                  applied_on: "2026-03-16T20:20:56"
                  applied_at_brt: "2026-03-16T17:20:56-03:00"
                  company:
                    name: "Crossing Hurdles"
                    urn: "urn:li:company:c875d7c8-5634-4916-b484-4c0352bcf909"
                    logo_url: null
                    url: null
      500:
        description: Internal server error.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
        examples:
          application/json:
            status: error
            error: database unavailable
    """
    return get_applied_jobs()


# ══════════════════════════════════════════════════════════════
# LINKEDIN-ONLY endpoints — zero DB writes
# ══════════════════════════════════════════════════════════════

@services_bp.route("/applied-live", methods=["GET"])
def get_applied_live_route():
    """
    Proxy: fetch applied jobs from LinkedIn, return directly. No DB.
    ---
    tags:
      - Job Tracker (Live Proxy)
    responses:
      200:
        description: Returns applied jobs directly from LinkedIn.
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
            status: success
            data:
              count: 1
              stage: applied
              jobs:
                - job_id: "4384236851"
                  title: "Python Developer | Remote"
                  company: "Crossing Hurdles"
                  location: "Brazil"
                  job_url: "https://www.linkedin.com/jobs/view/4384236851/"
                  applied: true
                  applied_at: "2026-03-16T20:20:56"
      500:
        description: Error fetching data from LinkedIn.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
        examples:
          application/json:
            status: error
            error: "HTTPSConnectionPool(host='www.linkedin.com', port=443): Max retries exceeded..."
    """
    return get_applied_live()


@services_bp.route("/saved-live", methods=["GET"])
def get_saved_live_route():
    """
    Proxy: fetch saved jobs from LinkedIn, return directly. No DB.
    ---
    tags:
      - Job Tracker (Live Proxy)
    responses:
      200:
        description: Returns saved jobs directly from LinkedIn.
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
            status: success
            data:
              count: 1
              stage: saved
              jobs:
                - job_id: "4384236851"
                  title: "Python Developer | Remote"
                  company: "Crossing Hurdles"
                  location: "Brazil"
                  job_url: "https://www.linkedin.com/jobs/view/4384236851/"
      500:
        description: Error fetching data from LinkedIn.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
        examples:
          application/json:
            status: error
            error: "HTTPSConnectionPool(host='www.linkedin.com', port=443): Max retries exceeded..."
    """
    return get_saved_live()


@services_bp.route("/debug-job", methods=["GET"])
def debug_job_route():
    """
    Debug proxy: hit LinkedIn for a SINGLE job, return fully enriched job.
    ---
    tags:
      - Job Tracker (Live Proxy)
    parameters:
      - name: id
        in: query
        type: string
        required: false
        description: "Numeric job ID (e.g., 123456789)"
      - name: urn
        in: query
        type: string
        required: false
        description: "Complete job URN (e.g., urn:li:jobPosting:123456789)"
      - name: search
        in: query
        type: string
        required: false
        description: "Search term (Company + Title)"
    responses:
      200:
        description: Returns 100% enriched job data.
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
              properties:
                enrichment:
                  type: object
                company:
                  type: object
                merged_preview:
                  type: object
        examples:
          application/json:
            status: success
            resolved_job_id: "4320563941"
            search_used: null
            data:
              enrichment:
                job_id: "4320563941"
                title: "Fullstack Engineer (Python & React.js)"
                company: "Avenue Code"
                location: "Latin America"
                job_url: "https://www.linkedin.com/jobs/view/4320563941/"
                applicants: 95
              company:
                company_name: "Avenue Code"
              merged_preview:
                job_id: "4320563941"
                title: "Fullstack Engineer (Python & React.js)"
                company: "Avenue Code"
                location: "Latin America"
                job_url: "https://www.linkedin.com/jobs/view/4320563941/"
                applicants: 95
      400:
        description: Missing required parameters.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
        examples:
          application/json:
            status: error
            error: "Pass ?id=<job_id>, ?urn=<full_urn>, or ?search=<company+title>"
      404:
        description: Job not found.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
        examples:
          application/json:
            status: error
            error: Not found
      500:
        description: Internal error during scraping/enrichment.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
        examples:
          application/json:
            status: error
            error: "fetch_job_details(4320563941) HTTPSConnectionPool(host='www.linkedin.com', port=443): Max retries exceeded..."
    """
    return debug_job()


# ══════════════════════════════════════════════════════════════
# SYNC endpoints (LinkedIn + DB)
# ══════════════════════════════════════════════════════════════

@services_bp.route("/sync-applied", methods=["POST"])
def sync_applied_jobs_route():
    """
    Incremental sync (page 1, ~10 jobs).
    ---
    tags:
      - Job Tracker (Synchronization)
    responses:
      200:
        description: Incremental synchronization completed successfully.
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
      500:
        description: Error during synchronization.
    """
    return sync_applied_jobs()


@services_bp.route("/sync-applied-backfill-stream", methods=["GET"])
def sync_applied_backfill_stream_route():
    """
    Stream backfill sync via SSE (Server-Sent Events).
    ---
    tags:
      - Job Tracker (Synchronization)
    parameters:
      - name: from
        in: query
        type: string
        required: true
        description: "Cutoff date in YYYY-MM format (e.g., 2023-08)"
    responses:
      200:
        description: Event stream (text/event-stream) indicating synchronization progress.
      400:
        description: Invalid or missing date format.
    """
    return sync_applied_backfill_stream()


@services_bp.route("/sync-applied-smart", methods=["POST"])
def sync_applied_smart_route():
    """
    Smart sync: diff LinkedIn vs DB, enrich + save only new jobs.
    ---
    tags:
      - Job Tracker (Synchronization)
    responses:
      200:
        description: Smart synchronization completed.
        schema:
          type: object
          properties:
            status:
              type: string
            synced_count:
              type: integer
            details:
              type: array
      500:
        description: Error during smart synchronization.
    """
    return sync_applied_smart()
