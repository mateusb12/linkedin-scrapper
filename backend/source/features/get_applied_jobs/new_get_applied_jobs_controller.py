# backend/source/features/get_applied_jobs/new_get_applied_jobs_controller.py
from dataclasses import asdict
from datetime import datetime
from flask import Blueprint, jsonify, request, Response, stream_with_context

from source.features.get_applied_jobs.new_applied_sync_service import (
    AppliedJobsIncrementalSync,
)
from source.features.get_applied_jobs.new_get_applied_jobs_service import (
    JobTrackerFetcher,
)

job_tracker_bp = Blueprint("job_tracker", __name__, url_prefix="/job-tracker")


# ============================================================
# FETCH FROM SQL (READ-ONLY)
# ============================================================

@job_tracker_bp.route("/applied", methods=["GET"])
def get_applied_jobs():
    try:
        from database.database_connection import get_db_session
        from models.job_models import Job

        db = get_db_session()
        try:
            # Traz todos os jobs aplicados, ordenados por data
            jobs = (
                db.query(Job)
                .filter(Job.has_applied == True)
                .order_by(Job.applied_on.desc())
                .all()
            )

            return jsonify({
                "status": "success",
                "data": {
                    "count": len(jobs),
                    "jobs": [job.to_dict() for job in jobs]
                }
            }), 200
        finally:
            db.close()

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


# ============================================================
# LIVE FETCH (NO PERSISTENCE)
# ============================================================

@job_tracker_bp.route("/applied-live", methods=["GET"])
def get_applied_live():
    """
    Rota Proxy: Vai no LinkedIn, pega os dados frescos e retorna.
    NÃO SALVA NO BANCO.
    """
    try:
        fetcher = JobTrackerFetcher(debug=False)
        # fetch_jobs agora retorna um objeto JobServiceResponse
        result_obj = fetcher.fetch_jobs(stage="applied")

        # Convertemos para dict para o Flask conseguir serializar em JSON
        return jsonify({
            "status": "success",
            "data": result_obj.to_dict()
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


# ============================================================
# SYNC ENDPOINTS (WRITE TO SQL)
# ============================================================

@job_tracker_bp.route("/sync-applied", methods=["POST"])
def sync_applied_jobs():
    """Sync incremental (página 1, ~10 jobs)"""
    try:
        result = AppliedJobsIncrementalSync.sync()
        return jsonify({
            "status": "success",
            "inserted": result["inserted"],
            "updated": result["updated"],
            "updates": result["updates"]
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@job_tracker_bp.route("/sync-applied-backfill-stream", methods=["POST"])
def sync_applied_backfill_stream():
    """Sync profundo com stream (Server-Sent Events)"""
    from_param = request.args.get("from")

    if not from_param:
        return jsonify({"error": "Missing 'from' parameter (YYYY-MM)"}), 400

    try:
        cutoff_date = datetime.strptime(from_param, "%Y-%m").replace(day=1)
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    return Response(
        stream_with_context(
            AppliedJobsIncrementalSync.sync_backfill_stream(cutoff_date)
        ),
        content_type="text/event-stream",
    )


@job_tracker_bp.route("/saved-live", methods=["GET"])
def get_saved_live():
    """
    Rota Proxy: Busca vagas SALVAS (Saved Jobs) no LinkedIn e retorna.
    LGPD (Privacy by Design):
    - Dados transitórios: Esta rota apenas 'espelha' o LinkedIn.
    - Zero Persistência: Nada é salvo no banco de dados local.
    """
    try:
        # Instancia o fetcher (debug=True se quiser ver logs no terminal)
        fetcher = JobTrackerFetcher(debug=True)

        # O fetch_jobs já tem default stage="saved", mas explicitamos para clareza.
        # Isso vai usar o registro 'SavedJobs' (ID 8) da sua tabela fetch_curl.
        result_obj = fetcher.fetch_jobs(stage="saved")

        # Serialização segura com asdict, pois Dataclasses nativas não têm .to_dict()
        return jsonify({
            "status": "success",
            "data": asdict(result_obj)
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500
