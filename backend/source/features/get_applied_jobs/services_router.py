"""
services_routes.py — Camada de roteamento e documentação Swagger.

Importa a lógica do controller e define as rotas com as especificações
do Flasgger (OpenAPI 2.0/3.0) via docstrings.
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

# Criação do Blueprint aqui
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
        description: Retorna uma lista de vagas aplicadas salvas no banco.
        schema:
          type: object
          properties:
            status:
              type: string
              example: success
            data:
              type: object
              properties:
                count:
                  type: integer
                jobs:
                  type: array
                  items:
                    type: object
      500:
        description: Erro interno no servidor.
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
        description: Retorna vagas aplicadas diretamente do LinkedIn.
      500:
        description: Erro ao buscar dados do LinkedIn.
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
        description: Retorna vagas salvas diretamente do LinkedIn.
      500:
        description: Erro ao buscar dados do LinkedIn.
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
        description: 'ID numérico da vaga (ex: 123456789)'
      - name: urn
        in: query
        type: string
        required: false
        description: 'URN completa da vaga (ex: urn:li:jobPosting:123456789)'
      - name: search
        in: query
        type: string
        required: false
        description: 'Termo de busca (Empresa + Título)'
    responses:
      200:
        description: Retorna dados da vaga 100% enriquecidos.
      400:
        description: Parâmetros obrigatórios ausentes.
      404:
        description: Vaga não encontrada.
      500:
        description: Erro interno no scraping/enriquecimento.
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
        description: Sincronização incremental concluída com sucesso.
        schema:
          type: object
          properties:
            status:
              type: string
              example: success
            inserted:
              type: integer
            updated:
              type: integer
            updates:
              type: array
              items:
                type: object
      500:
        description: Erro durante a sincronização.
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
        description: 'Data de corte no formato YYYY-MM (ex: 2023-08)'
    responses:
      200:
        description: Stream de eventos (text/event-stream) indicando o progresso da sincronização.
      400:
        description: Formato de data inválido ou ausente.
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
        description: Sincronização inteligente concluída.
        schema:
          type: object
          properties:
            status:
              type: string
              example: success
            synced_count:
              type: integer
            details:
              type: array
      500:
        description: Erro durante a sincronização inteligente.
    """
    return sync_applied_smart()
