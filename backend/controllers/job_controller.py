from flask import Blueprint, jsonify, request

from factory.core_instances import embedding_calculator
from services.model_orchestrator import LLMOrchestrator, AllLLMsFailed
from utils.metric_utils import JobConsoleProgress
from repository.job_repository import JobRepository

job_data_bp = Blueprint("jobs", __name__, url_prefix="/jobs")


@job_data_bp.route("/", methods=["GET"])
@job_data_bp.route("/all", methods=["GET"])
def get_all_jobs():
    repo = JobRepository()
    try:
        jobs = repo.get_all()
        return jsonify([j.to_dict() for j in jobs]), 200
    except Exception as e:
        repo.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        repo.close()


@job_data_bp.route("/keywords", methods=["PATCH"])
def insert_extra_fields():
    repo = JobRepository()
    BATCH_SIZE = 3
    last_urn = None
    try:
        total = repo.count_incomplete()
        progress = JobConsoleProgress(total)
        orchestrator = LLMOrchestrator(progress=progress)
        processed = 0

        while True:
            batch = repo.fetch_incomplete_batch(BATCH_SIZE, last_urn)
            if not batch:
                break
            for job in batch:
                try:
                    expansion = orchestrator.expand_job(job.description_full or "")
                except AllLLMsFailed as exc:
                    repo.rollback()
                    return jsonify({"error": str(exc)}), 500

                if not isinstance(expansion, dict):
                    last_urn = job.urn
                    processed += 1
                    progress(processed, urn=job.urn)
                    continue

                # apply expansions on job fields if missing...
                # (same logic as before)

                last_urn = job.urn
                processed += 1
                progress(processed, urn=job.urn)

            repo.commit()
        return jsonify({"message": "Done"}), 200
    except Exception as e:
        repo.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        repo.close()


@job_data_bp.route("/<string:urn>", methods=["PATCH"])
def update_job(urn):
    repo = JobRepository()
    try:
        data = request.get_json() or {}
        updated = repo.update(urn, data)
        repo.commit()
        job = repo.get_by_urn(urn)
        return jsonify({"message": f"Job {urn} updated", "updated_fields": updated, "job": job.to_dict()}), 200
    except KeyError as ke:
        repo.rollback()
        return jsonify({"error": str(ke)}), 404
    except ValueError as ve:
        repo.rollback()
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        repo.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        repo.close()


@job_data_bp.route("/<string:urn>/disable", methods=["PATCH"])
def mark_job_as_disabled(urn):
    repo = JobRepository()
    try:
        repo.disable(urn)
        repo.commit()
        job = repo.get_by_urn(urn)
        return jsonify({"message": f"Job {urn} disabled", "job": job.to_dict()}), 200
    except KeyError as ke:
        repo.rollback()
        return jsonify({"error": str(ke)}), 404
    except Exception as e:
        repo.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        repo.close()


@job_data_bp.route("/<string:urn>/mark_applied", methods=["PATCH"])
def mark_job_as_applied(urn):
    repo = JobRepository()
    try:
        repo.mark_applied(urn)
        repo.commit()
        job = repo.get_by_urn(urn)
        return jsonify({"message": f"Job {urn} applied", "job": job.to_dict()}), 200
    except KeyError as ke:
        repo.rollback()
        return jsonify({"error": str(ke)}), 404
    except Exception as e:
        repo.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        repo.close()


@job_data_bp.route("/match-score", methods=["POST"])
def compute_match_score():
    try:
        data = request.get_json() or {}
        resume = data.get("resume", data.get("resume_text", ""))
        job_text = data.get("job_description", data.get("job_text", ""))
        if not resume.strip() or not job_text.strip():
            raise ValueError("Empty resume or job text")
        score = embedding_calculator.compute_similarity(resume_text=resume, job_text=job_text)
        return jsonify({"match_score": score}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
