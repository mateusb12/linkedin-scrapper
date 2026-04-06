"""
job_router.py - Routing and Swagger documentation layer.
"""

from flask import Blueprint

from source.features.job_population.job_controller import (
    get_all_jobs,
    insert_extra_fields_stream,
    update_job,
    mark_job_as_disabled,
    mark_job_as_applied,
    compute_match_score,
)

job_data_bp = Blueprint("jobs", __name__, url_prefix="/jobs")


@job_data_bp.route("/", methods=["GET"])
@job_data_bp.route("/all", methods=["GET"])
def get_all_jobs_route():
    """
    Returns all stored jobs with calculated status and debug metadata.
    ---
    tags:
      - Jobs
    responses:
      200:
        description: List of jobs from the local database.
        schema:
          type: array
          items:
            type: object
            properties:
              urn:
                type: string
              title:
                type: string
              location:
                type: string
              job_url:
                type: string
              has_applied:
                type: boolean
              application_status:
                type: string
              company:
                type: object
              status:
                type: string
              experience:
                type: object
              _debug:
                type: object
        examples:
          application/json:
            - urn: "4321588464"
              title: "Backend Engineer"
              location: "Brazil"
              job_url: "https://www.linkedin.com/jobs/view/4321588464/"
              has_applied: true
              application_status: "Applied"
              company:
                urn: "urn:li:company:RD Station"
                name: "RD Station"
                logo_url: null
                url: null
              status: "incomplete"
              experience:
                min_years: 0
              _debug:
                urn: "4321588464"
                processed: false
                has_description: true
                has_applied: true
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "database unavailable"
    """
    return get_all_jobs()


@job_data_bp.route("/keywords-stream", methods=["GET"])
def insert_extra_fields_stream_route():
    """
    Streams progress while incomplete jobs are expanded with extra keyword fields.
    ---
    tags:
      - Jobs
    produces:
      - text/event-stream
    responses:
      200:
        description: SSE stream with progress, warning, error, and complete events.
      500:
        description: Runtime errors are emitted as SSE error events.
    """
    return insert_extra_fields_stream()


@job_data_bp.route("/<string:urn>", methods=["PATCH"])
def update_job_route(urn):
    """
    Updates a job by URN.
    ---
    tags:
      - Jobs
    parameters:
      - name: urn
        in: path
        type: string
        required: true
        description: Job URN.
      - in: body
        name: body
        required: false
        schema:
          type: object
          additionalProperties: true
        examples:
          application/json:
            application_status: "Interviewing"
    responses:
      200:
        description: Job updated successfully.
        schema:
          type: object
          properties:
            message:
              type: string
            updated_fields:
              type: array
              items:
                type: string
            job:
              type: object
        examples:
          application/json:
            message: "Job 4321588464 updated"
            updated_fields:
              - "application_status"
            job:
              urn: "4321588464"
              title: "Backend Engineer"
              application_status: "Interviewing"
      400:
        description: Invalid input data.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Invalid field value"
      404:
        description: Job not found.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "'Job not found'"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "database unavailable"
    """
    return update_job(urn)


@job_data_bp.route("/<string:urn>/disable", methods=["PATCH"])
def mark_job_as_disabled_route(urn):
    """
    Marks a job as disabled.
    ---
    tags:
      - Jobs
    parameters:
      - name: urn
        in: path
        type: string
        required: true
        description: Job URN.
    responses:
      200:
        description: Job disabled successfully.
        schema:
          type: object
          properties:
            message:
              type: string
            job:
              type: object
        examples:
          application/json:
            message: "Job 4321588464 disabled"
            job:
              urn: "4321588464"
              title: "Backend Engineer"
      404:
        description: Job not found.
        schema:
          type: object
          properties:
            error:
              type: string
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
    """
    return mark_job_as_disabled(urn)


@job_data_bp.route("/<string:urn>/mark_applied", methods=["PATCH"])
def mark_job_as_applied_route(urn):
    """
    Marks a job as applied.
    ---
    tags:
      - Jobs
    parameters:
      - name: urn
        in: path
        type: string
        required: true
        description: Job URN.
    responses:
      200:
        description: Job marked as applied successfully.
        schema:
          type: object
          properties:
            message:
              type: string
            job:
              type: object
        examples:
          application/json:
            message: "Job 4321588464 applied"
            job:
              urn: "4321588464"
              title: "Backend Engineer"
              has_applied: true
      404:
        description: Job not found.
        schema:
          type: object
          properties:
            error:
              type: string
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
    """
    return mark_job_as_applied(urn)


@job_data_bp.route("/match-score", methods=["POST"])
def compute_match_score_route():
    """
    Computes a resume-to-job similarity score.
    ---
    tags:
      - Jobs
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            resume:
              type: string
            resume_text:
              type: string
            job_description:
              type: string
            job_text:
              type: string
        examples:
          application/json:
            resume_text: "Python developer with Flask experience."
            job_description: "Looking for a Python developer with Flask experience."
    responses:
      200:
        description: Similarity score computed successfully.
        schema:
          type: object
          properties:
            match_score:
              type: number
        examples:
          application/json:
            match_score: 0.98
      500:
        description: Unexpected scoring error.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Connection error."
    """
    return compute_match_score()
