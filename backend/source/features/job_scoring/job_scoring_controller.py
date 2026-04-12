from __future__ import annotations

from flask import jsonify, request

from source.features.job_scoring.job_scoring_service import JobScoringService
from source.features.job_scoring.schemas import (
    JobScoringBatchRequest,
    JobScoringDBRankRequest,
    JobScoringItemInput,
    JobScoringSimpleBatchRequest,
    JobScoringValidationError,
)


def _json_body() -> dict:
    return request.get_json(silent=True) or {}


def _service() -> JobScoringService:
    return JobScoringService()


def score_single_job():
    try:
        payload = JobScoringItemInput.from_dict(_json_body())
        result = _service().score_job(payload)
        return jsonify({"status": "success", "data": result}), 200
    except JobScoringValidationError as exc:
        return jsonify({"status": "error", "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"status": "error", "error": str(exc)}), 500


def rank_jobs():
    try:
        payload = JobScoringBatchRequest.from_dict(_json_body())
        result = _service().rank_jobs(payload)
        return jsonify({"status": "success", "data": result}), 200
    except JobScoringValidationError as exc:
        return jsonify({"status": "error", "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"status": "error", "error": str(exc)}), 500


def rank_simple_jobs():
    try:
        payload = JobScoringSimpleBatchRequest.from_dict(_json_body())
        result = _service().rank_simple_jobs(payload)
        return jsonify({"status": "success", "data": result}), 200
    except JobScoringValidationError as exc:
        return jsonify({"status": "error", "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"status": "error", "error": str(exc)}), 500


def rank_jobs_from_db():
    try:
        payload = JobScoringDBRankRequest.from_dict(_json_body())
        result = _service().rank_db_jobs(payload)
        return jsonify({"status": "success", "data": result}), 200
    except JobScoringValidationError as exc:
        return jsonify({"status": "error", "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"status": "error", "error": str(exc)}), 500
