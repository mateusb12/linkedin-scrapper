import re

from flask import Blueprint, jsonify, Response, stream_with_context, request
import json

from database.database_connection import get_db_session
from models.connection_models import LinkedInConnection
from source.features.friends_connections.fetch_connections import LinkedInConnectionsFetcher
from source.features.friends_connections.fetch_single_profile import ProfileEnrichmentService

connections_bp = Blueprint("connections", __name__, url_prefix="/connections")


@connections_bp.route("/", methods=["GET"])
def get_connections():
    """Retorna os dados do banco para preencher a tela inicialmente."""
    db = get_db_session()
    try:
        conns = db.query(LinkedInConnection).order_by(LinkedInConnection.name.asc()).all()
        return jsonify([c.to_dict() for c in conns]), 200
    finally:
        db.close()


@connections_bp.route("/sync", methods=["GET"])
def sync_connections_stream():
    """Endpoint Server-Sent Events (SSE) orquestrador inteligente."""

    def generate():
        db = get_db_session()
        try:
            pending_count = db.query(LinkedInConnection).filter_by(is_fully_scraped=False).count()

            if pending_count > 0:
                # MODO ENRICHMENT
                enricher = ProfileEnrichmentService(debug=True)
                for event in enricher.enrich_pending_profiles_stream(limit=pending_count):
                    yield f"data: {json.dumps(event)}\n\n"
            else:
                # MODO FETCH (Procura amigos novos)
                fetcher = LinkedInConnectionsFetcher(debug=True)
                for event in fetcher.fetch_all_stream(batch_size=10, max_pages=100):
                    yield f"data: {json.dumps(event)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
        finally:
            db.close()

    return Response(stream_with_context(generate()), mimetype='text/event-stream')


@connections_bp.route("/reset-one", methods=["POST"])
def reset_one():
    from flask import request
    db = get_db_session()
    try:
        data = request.get_json()
        conn_id = data.get("id")

        if not conn_id:
            return jsonify({"error": "id obrigatório"}), 400

        conn = db.query(LinkedInConnection).filter_by(id=conn_id).first()

        if not conn:
            return jsonify({"error": "perfil não encontrado"}), 404

        # apaga dados enriquecidos
        conn.about = None
        conn.experiences = None
        conn.education = None
        conn.certifications = None
        conn.skills = None
        conn.image_url = None
        conn.headline = None
        conn.connected_time = ""
        conn.is_fully_scraped = False

        db.commit()

        return jsonify({"status": "ok", "reset_id": conn_id}), 200

    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        db.close()


@connections_bp.route("/reset-bugged", methods=["POST"])
def reset_bugged_profiles():
    """
    RESET ALL:
    Reseta todos os perfis, limpando dados enriquecidos (about, experiências, etc)
    e marcando is_fully_scraped = False, igual ao UPDATE que você roda no sqlite3.
    """
    db = get_db_session()
    try:
        # Faz o UPDATE em todas as linhas da tabela linkedin_connections
        affected = db.query(LinkedInConnection).update(
            {
                LinkedInConnection.about: None,
                LinkedInConnection.experiences: None,
                LinkedInConnection.education: None,
                LinkedInConnection.certifications: None,
                LinkedInConnection.skills: None,
                LinkedInConnection.image_url: None,
                LinkedInConnection.headline: None,
                LinkedInConnection.connected_time: "",
                LinkedInConnection.is_fully_scraped: False,
            },
            synchronize_session=False,  # não precisa sincronizar objetos em memória
        )

        db.commit()

        return jsonify(
            {
                "status": "ok",
                "message": f"{affected} perfis foram resetados (reset all).",
            }
        ), 200

    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        db.close()


@connections_bp.route("/refresh-profile", methods=["POST"])
def refresh_profile():
    """Força o scrape síncrono de APENAS UM perfil por ID ou Nome"""
    data = request.get_json()
    search_id = data.get("id")
    search_name = data.get("name")

    db = get_db_session()
    try:
        if search_id:
            conn = db.query(LinkedInConnection).filter_by(id=search_id).first()
        elif search_name:
            # ilike permite buscar por "diana", "Diana Honcharova", etc.
            conn = db.query(LinkedInConnection).filter(LinkedInConnection.name.ilike(f"%{search_name}%")).first()
        else:
            return jsonify({"error": "Forneça 'id' ou 'name'"}), 400

        if not conn:
            return jsonify({"error": "Perfil não encontrado no banco."}), 404

        print(f"\n\n=======================================================")
        print(f"🔄 INICIANDO REFRESH FORÇADO PARA: {conn.name}")
        print(f"=======================================================")

        enricher = ProfileEnrichmentService(debug=True)

        try:
            # 1. Puxa os dados crus novamente do LinkedIn
            raw_data = enricher._fetch_raw_profile_data(conn.vanity_name)

            # 2. Roda a nossa engine de análise
            ficha = enricher._analyze_raw_data(conn.vanity_name, raw_data)

            if ficha:
                # 3. Atualiza o banco direto
                enricher._update_connection_in_db(db, conn, ficha)
                db.commit()
                return jsonify({
                    "status": "ok",
                    "message": f"Perfil de {conn.name} atualizado com sucesso!",
                    "data": conn.to_dict()
                }), 200
            else:
                return jsonify({"error": "Não foi possível gerar a ficha deste perfil."}), 500

        except Exception as e:
            db.rollback()
            return jsonify({"error": f"Erro durante o scrape: {str(e)}"}), 500

    finally:
        db.close()
