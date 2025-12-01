import json

from flask import Blueprint, jsonify, request, stream_with_context, Response

from factory.core_instances import embedding_calculator
from models import Job
from services.model_orchestrator import LLMOrchestrator, AllLLMsFailed
from utils.metric_utils import JobConsoleProgress
from source.features.job_population.job_repository import JobRepository

job_data_bp = Blueprint("jobs", __name__, url_prefix="/jobs")


# --- SHARED HELPER FUNCTIONS ---

def get_job_status(job: Job) -> str:
    """
    Determines if a job is 'complete' or 'incomplete'.

    The criterion is based on the 'processed' flag, which is the same logic
    used by the `keywords-stream` endpoint to identify jobs that need
    LLM-based field expansion. A job is incomplete if `processed` is not `True`.
    """
    return "complete" if job.processed else "incomplete"


def _job_to_dict_with_status(job: Job) -> dict:
    """Converts a Job object to a dictionary and adds the calculated 'status' field."""
    job_dict = job.to_dict()
    job_dict["status"] = get_job_status(job)
    return job_dict


# --- END SHARED HELPER FUNCTIONS ---


@job_data_bp.route("/", methods=["GET"])
@job_data_bp.route("/all", methods=["GET"])
def get_all_jobs():
    """Retrieves all jobs and adds a 'status' field to each."""
    repo = JobRepository()
    try:
        jobs = repo.get_all()
        # Use the helper to add the 'status' field to each job's dictionary
        return jsonify([_job_to_dict_with_status(j) for j in jobs]), 200
    except Exception as e:
        repo.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        repo.close()


@job_data_bp.route("/keywords-stream", methods=["GET"])
def insert_extra_fields_stream():
    """
    Processes incomplete jobs and streams progress updates. This version ensures
    that processed jobs are correctly marked as complete, progress counting is
    accurate, and server-side console progress is displayed.
    """
    def generate():
        print("Starting resilient job expansion stream...")
        repo = JobRepository()
        BATCH_SIZE = 3
        last_urn = None

        try:
            total_to_process = repo.count_incomplete()
            processed_this_run = 0

            # Progress bar for backend console
            progress = JobConsoleProgress(total_to_process)

            # Initial payload for frontend
            initial_data = {"total": total_to_process, "processed": 0}
            yield f"data: {json.dumps(initial_data)}\n\n"

            orchestrator = LLMOrchestrator(progress=progress)

            while processed_this_run < total_to_process:
                batch = repo.fetch_incomplete_batch(BATCH_SIZE, last_urn)
                if not batch:
                    break

                for job in batch:
                    try:
                        expansion = orchestrator.expand_job(job.description_full or "")

                        # --- VALIDATION LAYER ---
                        valid = (
                                isinstance(expansion, dict)
                                and isinstance(expansion.get("keywords"), list)
                                and len(expansion["keywords"]) > 0
                                and isinstance(expansion.get("responsibilities"), list)
                                and len(expansion["responsibilities"]) > 0
                                and isinstance(expansion.get("qualifications"), list)
                                and len(expansion["qualifications"]) > 0
                        )

                        if not valid:
                            # ❌ DO NOT mark as processed
                            job.processed = False
                            repo.commit()

                            warning_msg = {
                                "message": f"LLM returned incomplete data for {job.urn}",
                                "urn": job.urn
                            }
                            yield f"event: warning\ndata: {json.dumps(warning_msg)}\n\n"
                            continue

                        # --- APPLY VALID FIELDS ---
                        job.keywords = expansion["keywords"]
                        job.responsibilities = expansion["responsibilities"]
                        job.qualifications = expansion["qualifications"]

                        job.job_type = expansion.get("job_type", job.job_type)
                        job.language = expansion.get("language", job.language)

                        # Now AND ONLY NOW mark as processed
                        job.processed = True
                        repo.commit()

                    except AllLLMsFailed as exc:
                        repo.rollback()
                        yield f"event: error\ndata: {json.dumps({'error': f'Failed on URN {job.urn}: {exc}'})}\n\n"
                        continue

                    processed_this_run += 1
                    last_urn = job.urn

                    # Update console progress bar
                    progress(processed_this_run, urn=job.urn)

                    # Stream progress message
                    progress_data = {
                        "processed": processed_this_run,
                        "total": total_to_process,
                        "urn": job.urn,
                        "message": f"Processed URN: {job.urn}"
                    }
                    yield f"data: {json.dumps(progress_data)}\n\n"

            # FINAL SUMMARY
            remaining = repo.count_incomplete()
            message = (
                "All jobs processed successfully."
                if remaining == 0
                else f"Processing finished, but {remaining} jobs still incomplete."
            )

            yield f"event: complete\ndata: {json.dumps({'message': message, 'remaining': remaining})}\n\n"

        except Exception as e:
            repo.rollback()
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

        finally:
            repo.close()

    return Response(stream_with_context(generate()), mimetype='text/event-stream')


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