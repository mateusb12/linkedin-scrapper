"""
job_scoring_router.py - Routing and Swagger documentation layer.
"""

from flask import Blueprint

from source.features.job_scoring.job_scoring_controller import (
    rank_jobs,
    rank_jobs_from_db,
    rank_simple_jobs,
    score_single_job,
)

job_scoring_bp = Blueprint("job_scoring", __name__, url_prefix="/job-scoring")


@job_scoring_bp.route("/score", methods=["POST"])
def score_single_job_route():
    """
    Scores a single job using the official hybrid scorer.
    ---
    tags:
      - Job Scoring
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - title
          properties:
            id:
              type: string
            external_id:
              type: string
            title:
              type: string
            description_full:
              type: string
            description_snippet:
              type: string
            qualifications:
              type: array
              items:
                type: string
            responsibilities:
              type: array
              items:
                type: string
            keywords:
              type: array
              items:
                type: string
            programming_languages:
              type: array
              items:
                type: string
            premium_title:
              type: string
            premium_description:
              type: string
            location:
              type: string
            experience_level:
              type: string
            work_remote_allowed:
              type: boolean
            has_applied:
              type: boolean
            application_status:
              type: string
            company_urn:
              type: string
            metadata:
              type: object
        examples:
          application/json:
            id: "job-1"
            title: "Senior Backend Engineer (Python)"
            description_full: "Build backend APIs in Python with FastAPI, PostgreSQL, Docker and AWS."
            qualifications:
              - "Python"
              - "FastAPI"
              - "PostgreSQL"
              - "Docker"
    responses:
      200:
        description: Scored job with explanation fields.
      400:
        description: Invalid payload.
      500:
        description: Unexpected server error.
    """
    return score_single_job()


@job_scoring_bp.route("/rank", methods=["POST"])
def rank_jobs_route():
    """
    Scores and ranks a batch of jobs using the official hybrid scorer.
    ---
    tags:
      - Job Scoring
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - items
          properties:
            items:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: string
                  external_id:
                    type: string
                  title:
                    type: string
                  description_full:
                    type: string
        examples:
          application/json:
            items:
              - id: "job-1"
                title: "Senior Backend Engineer (Python)"
                description_full: "Build backend APIs in Python with FastAPI, PostgreSQL, Docker and AWS."
              - id: "job-2"
                title: "Frontend Engineer"
                description_full: "Own React and TypeScript interfaces."
    responses:
      200:
        description: Ranked items ordered by descending total score.
      400:
        description: Invalid payload.
      500:
        description: Unexpected server error.
    """
    return rank_jobs()


@job_scoring_bp.route("/rank-descriptions", methods=["POST"])
def rank_simple_jobs_route():
    """
    Scores and ranks jobs from title + description only.
    ---
    tags:
      - Job Scoring
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - items
          properties:
            items:
              type: array
              items:
                type: object
                required:
                  - title
                  - description
                properties:
                  id:
                    type: string
                  external_id:
                    type: string
                  title:
                    type: string
                  description:
                    type: string
    responses:
      200:
        description: Ranked items adapted from simple text input.
      400:
        description: Invalid payload.
      500:
        description: Unexpected server error.
    """
    return rank_simple_jobs()


@job_scoring_bp.route("/rank-db", methods=["POST"])
def rank_jobs_from_db_route():
    """
    Scores and ranks local jobs from the SQLite database using optional filters.
    ---
    tags:
      - Job Scoring
    parameters:
      - in: body
        name: body
        required: false
        schema:
          type: object
          properties:
            has_applied:
              type: boolean
            work_remote_allowed:
              type: boolean
            company_urn:
              type: string
            application_status:
              type: string
            limit:
              type: integer
    responses:
      200:
        description: Ranked database jobs.
      400:
        description: Invalid payload.
      500:
        description: Unexpected server error.
    """
    return rank_jobs_from_db()
