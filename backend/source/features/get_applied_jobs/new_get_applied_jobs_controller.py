from dataclasses import asdict
from datetime import datetime
from flask import Blueprint, jsonify, request, Response, stream_with_context

from source.features.get_applied_jobs.new_applied_sync_service import (
    AppliedJobsIncrementalSync,
)
from source.features.get_applied_jobs.new_get_applied_jobs_service import (
    JobTrackerFetcher, JobServiceResponse,
)

job_tracker_bp = Blueprint("job_tracker", __name__, url_prefix="/job-tracker")


@job_tracker_bp.route("/applied", methods=["GET"])
def get_applied_jobs():
    try:
        from database.database_connection import get_db_session
        from models.job_models import Job

        db = get_db_session()
        try:
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


@job_tracker_bp.route("/applied-live", methods=["GET"])
def get_applied_live():
    """
    Rota Proxy: Vai no LinkedIn, pega os dados frescos e retorna.
    NÃO SALVA NO BANCO.
    """
    try:
        fetcher = JobTrackerFetcher(debug=False, slim_mode=True)
        result_obj = fetcher.fetch_jobs(stage="applied")

        return jsonify({
            "status": "success",
            "data": result_obj.to_dict()
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


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


@job_tracker_bp.route("/sync-applied-backfill-stream", methods=["GET"])
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
        fetcher = JobTrackerFetcher(debug=True, slim_mode=True)

        result_obj = fetcher.fetch_jobs(stage="saved")

        return jsonify({
            "status": "success",
            "data": asdict(result_obj)
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


@job_tracker_bp.route("/sync-applied-smart", methods=["POST"])
def sync_applied_smart():
    try:
        from database.database_connection import get_db_session
        from models.job_models import Job

        # 1. Busca IDs existentes
        db = get_db_session()
        existing_jobs = (
            db.query(Job.urn)
            .filter(Job.has_applied == True)
            .order_by(Job.applied_on.desc())
            .limit(50)
            .all()
        )
        existing_ids = {str(j.urn).replace("urn:li:jobPosting:", "") for j in existing_jobs}
        db.close()

        # 2. Busca lista leve do LinkedIn
        fetcher = JobTrackerFetcher(debug=True, slim_mode=True)
        latest_candidates = fetcher.fetch_latest_applied_candidates(limit=15)

        # 3. Filtra novos
        new_jobs_to_process = []
        for cand in latest_candidates:
            if str(cand["job_id"]) not in existing_ids:
                new_jobs_to_process.append(cand)

        print(f"🔎 Smart Sync: {len(latest_candidates)} recebidos, {len(new_jobs_to_process)} são novos.")

        if not new_jobs_to_process:
            return jsonify({
                "status": "success",
                "message": "Already up to date",
                "synced_count": 0,
                "details": []
            }), 200

        # 4. Enriquece
        enriched_jobs = []
        for base_job in new_jobs_to_process:
            full_job = fetcher.enrich_single_job(base_job)
            enriched_jobs.append(full_job)

        # 5. Salva e pega detalhes
        saved_info = []
        if enriched_jobs:
            wrapper = JobServiceResponse(count=len(enriched_jobs), stage="applied", jobs=enriched_jobs)
            # Agora o save_results retorna uma lista de dicionários
            saved_info = fetcher.save_results(wrapper)

        return jsonify({
            "status": "success",
            "synced_count": len(saved_info),
            "details": saved_info  # <--- AQUI VAI APARECER ID, EMPRESA E TITULO
        }), 200

    except Exception as e:
        # Agora se der erro no save, vai aparecer aqui
        return jsonify({"status": "error", "error": str(e)}), 500
