import json

from flask import Blueprint, jsonify, request, stream_with_context, Response

from factory.core_instances import embedding_calculator
from models import Job
from services.model_orchestrator import LLMOrchestrator, AllLLMsFailed
from utils.metric_utils import JobConsoleProgress
from repository.job_repository import JobRepository, incomplete_job_condition

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

            # --- FIX: JobConsoleProgress RESTORED ---
            # Initialize the console progress bar for server-side monitoring.
            progress = JobConsoleProgress(total_to_process)

            # This initial message sets up the progress bar on the frontend.
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

                        # Aggressively update fields to ensure the job is marked as "complete".
                        if isinstance(expansion, dict):
                            if hasattr(job, 'keywords'): job.keywords = expansion.get('keywords', [])
                            if hasattr(job, 'programming_languages'): job.programming_languages = expansion.get('technologies', [])
                            if hasattr(job, 'responsibilities'): job.responsibilities = expansion.get('responsibilities', [])
                            if hasattr(job, 'qualifications'): job.qualifications = expansion.get('qualifications', [])
                            if hasattr(job, 'job_type'): job.job_type = expansion.get('job_type', job.job_type or 'N/A')
                            if hasattr(job, 'language'): job.language = expansion.get('language', job.language or 'en')
                        else:
                            # If expansion fails, still fill fields to mark as complete
                            if hasattr(job, 'keywords') and job.keywords is None: job.keywords = []
                            if hasattr(job, 'programming_languages') and job.programming_languages is None: job.programming_languages = []
                            if hasattr(job, 'responsibilities') and job.responsibilities is None: job.responsibilities = []
                            if hasattr(job, 'qualifications') and job.qualifications is None: job.qualifications = []
                            if hasattr(job, 'job_type') and job.job_type is None: job.job_type = 'N/A'
                            if hasattr(job, 'language') and job.language is None: job.language = 'en'

                        job.processed = True
                        repo.commit()

                    except AllLLMsFailed as exc:
                        repo.rollback()
                        yield f"event: error\ndata: {json.dumps({'error': f'Failed on URN {job.urn}: {exc}'})}\n\n"
                        continue

                    processed_this_run += 1
                    last_urn = job.urn

                    # --- FIX: JobConsoleProgress CALL RESTORED ---
                    # This call updates the progress bar in your backend terminal.
                    progress(processed_this_run, urn=job.urn)

                    # This yield sends progress data to the frontend client.
                    progress_data = {
                        "processed": processed_this_run,
                        "total": total_to_process,
                        "urn": job.urn,
                        "message": f"Processed URN: {job.urn}"
                    }
                    yield f"data: {json.dumps(progress_data)}\n\n"

            yield f"event: complete\ndata: {json.dumps({'message': 'All jobs processed successfully.'})}\n\n"

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