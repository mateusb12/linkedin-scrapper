"""
job_search_router.py - Routing and Swagger documentation layer.

Imports controller logic and defines routes with Flasgger (Swagger 2.0)
specifications via docstrings.
"""

from flask import Blueprint

from source.features.search_jobs.job_search_controller import (
    search_jobs_live,
    search_jobs_live_stream,
    search_jobs_debug_live,
    search_jobs_options,
)

search_jobs_bp = Blueprint("search_jobs", __name__, url_prefix="/search-jobs")


@search_jobs_bp.route("/live", methods=["GET", "POST"])
def search_jobs_live_route():
    """
    Searches LinkedIn jobs live and returns structured results without writing to the database.
    ---
    tags:
      - Search Jobs
    parameters:
      - name: page
        in: query
        type: integer
        required: false
        description: Page number. Defaults to 1.
      - name: count
        in: query
        type: integer
        required: false
        description: Number of jobs to fetch.
      - name: keywords
        in: query
        type: string
        required: false
        description: Search keywords.
      - name: geo_id
        in: query
        type: string
        required: false
        description: LinkedIn geo ID.
      - name: work_types
        in: query
        type: array
        required: false
        collectionFormat: multi
        items:
          type: string
        description: Repeated or comma-separated work type values.
      - name: date_posted
        in: query
        type: string
        required: false
        description: Date filter enum value.
      - name: experience_levels
        in: query
        type: array
        required: false
        collectionFormat: multi
        items:
          type: string
        description: Repeated or comma-separated experience level values.
      - name: job_types
        in: query
        type: array
        required: false
        collectionFormat: multi
        items:
          type: string
        description: Repeated or comma-separated job type values.
      - name: blacklist
        in: query
        type: array
        required: false
        collectionFormat: multi
        items:
          type: string
        description: Company names to blacklist from enrichment output.
      - in: body
        name: body
        required: false
        schema:
          type: object
          properties:
            page:
              type: integer
            count:
              type: integer
            keywords:
              type: string
            geo_id:
              type: string
            sort_by:
              type: string
            work_types:
              type: array
              items:
                type: string
            date_posted:
              type: string
            experience_levels:
              type: array
              items:
                type: string
            job_types:
              type: array
              items:
                type: string
            origin:
              type: string
            debug:
              type: boolean
            save_raw_json:
              type: boolean
            save_parsed_json:
              type: boolean
            blacklist:
              type: array
              items:
                type: string
        examples:
          application/json:
            page: 1
            count: 1
            keywords: "Python Developer"
            geo_id: "106057199"
            sort_by: "R"
            work_types:
              - "2"
            date_posted: "r604800"
            experience_levels:
              - "2"
            job_types:
              - "F"
            origin: "JOB_SEARCH_PAGE_JOB_FILTER"
            debug: false
            save_raw_json: true
            save_parsed_json: true
            blacklist:
              - "Acme Corp"
    responses:
      200:
        description: Structured search results from LinkedIn.
        schema:
          type: object
          properties:
            status:
              type: string
            data:
              type: object
              properties:
                meta:
                  type: object
                audit:
                  type: object
                jobs:
                  type: array
                  items:
                    type: object
        examples:
          application/json:
            status: "success"
            data:
              meta:
                page: 1
                count: 1
                duplicates_removed: 0
                raw_json_path: "/app/source/features/search_jobs/linkedin_graphql_response.json"
                parsed_json_path: "/app/source/features/search_jobs/linkedin_graphql_parsed_jobs.json"
                keywords: "Python Developer"
                origin: "JOB_SEARCH_PAGE_JOB_FILTER"
                paging:
                  count: 1
                  start: 0
                  total: 100
                geo:
                  geo_urn: "urn:li:geo:106057199"
                  geo_id: "106057199"
                  geo_name: "Brazil"
                jobs_enriched: true
              audit:
                total_jobs: 1
                jobs_with_title: 1
                jobs_with_company_name: 1
                jobs_with_location_text: 1
                jobs_with_company_logo_url: 1
                jobs_with_verification: 1
                jobs_with_company_record: 1
                jobs_with_job_posting_record: 1
                jobs_with_description_snippet: 1
                jobs_with_meaningful_card_data: 1
                can_extract_meaningful_data: true
                can_extract_full_descriptions: true
                notes: []
              jobs:
                - job_id: "4385054128"
                  title: "Python Developer"
                  company_name: "Jusfy"
                  location_text: "Brazil (Remote)"
                  company_logo_url: "https://media.licdn.com/dms/image/v2/company-logo_400_400/example"
                  job_url: "https://www.linkedin.com/jobs/view/4385054128/"
                  applied: false
                  posted_at: "2026-03-30T13:05:36+00:00"
                  description_snippet: "A Jusfy esta em busca de um Python Developer para compor o time."
                  blacklisted: false
                  enrichment_skipped: false
      400:
        description: Invalid request parameter.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
        examples:
          application/json:
            status: "error"
            error: "Invalid integer for 'page': abc"
      500:
        description: Unexpected search failure.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
        examples:
          application/json:
            status: "error"
            error: "HTTP 403 - cookies / csrf provavelmente expirados."
    """
    return search_jobs_live()


@search_jobs_bp.route("/live/stream", methods=["GET", "POST"])
def search_jobs_live_stream_route():
    """
    Streams job search progress and results through Server-Sent Events.
    ---
    tags:
      - Search Jobs
    produces:
      - text/event-stream
    parameters:
      - name: page
        in: query
        type: integer
        required: false
      - name: count
        in: query
        type: integer
        required: false
      - name: keywords
        in: query
        type: string
        required: false
      - in: body
        name: body
        required: false
        schema:
          type: object
          properties:
            page:
              type: integer
            count:
              type: integer
            keywords:
              type: string
    responses:
      200:
        description: SSE stream with `progress`, `result`, or `error` events.
      400:
        description: Invalid request parameter before the stream starts.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
      500:
        description: Runtime stream errors are emitted as SSE error events.
    """
    return search_jobs_live_stream()


@search_jobs_bp.route("/debug-live", methods=["GET", "POST"])
def search_jobs_debug_live_route():
    """
    Runs the same live job search flow as `/live`, but includes traceback details on failure.
    ---
    tags:
      - Search Jobs
    parameters:
      - name: page
        in: query
        type: integer
        required: false
      - name: count
        in: query
        type: integer
        required: false
      - name: keywords
        in: query
        type: string
        required: false
      - in: body
        name: body
        required: false
        schema:
          type: object
          properties:
            page:
              type: integer
            count:
              type: integer
            keywords:
              type: string
            debug:
              type: boolean
        examples:
          application/json:
            page: 1
            count: 1
            keywords: "Python Developer"
            debug: true
    responses:
      200:
        description: Structured search results from LinkedIn.
        schema:
          type: object
          properties:
            status:
              type: string
            data:
              type: object
        examples:
          application/json:
            status: "success"
            data:
              meta:
                page: 1
                count: 1
              audit:
                total_jobs: 1
              jobs:
                - job_id: "4385054128"
                  title: "Python Developer"
      400:
        description: Invalid request parameter.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
            traceback:
              type: string
        examples:
          application/json:
            status: "error"
            error: "Invalid value for 'sort_by': newest. Allowed: ['RELEVANCE (R)', 'DATE_POSTED (DD)']"
            traceback: "Traceback (most recent call last): ..."
      500:
        description: Unexpected search failure with traceback.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
            traceback:
              type: string
        examples:
          application/json:
            status: "error"
            error: "HTTP 400 - malformed Voyager query."
            traceback: "Traceback (most recent call last): ..."
    """
    return search_jobs_debug_live()


@search_jobs_bp.route("/options", methods=["GET"])
def search_jobs_options_route():
    """
    Returns allowed enum values for the frontend search filters.
    ---
    tags:
      - Search Jobs
    responses:
      200:
        description: Available enum options for search filters.
        schema:
          type: object
          properties:
            status:
              type: string
            data:
              type: object
        examples:
          application/json:
            status: "success"
            data:
              sort_by:
                - name: "RELEVANCE"
                  value: "R"
              work_types:
                - name: "REMOTE"
                  value: "2"
              date_posted:
                - name: "PAST_WEEK"
                  value: "r604800"
              experience_levels:
                - name: "ENTRY_LEVEL"
                  value: "2"
              job_types:
                - name: "FULL_TIME"
                  value: "F"
              origins:
                - name: "JOB_SEARCH_PAGE_JOB_FILTER"
                  value: "JOB_SEARCH_PAGE_JOB_FILTER"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            status:
              type: string
            error:
              type: string
        examples:
          application/json:
            status: "error"
            error: "unexpected error"
    """
    return search_jobs_options()
