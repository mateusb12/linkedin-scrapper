# backend/source/features/friends_connections/connections_controller.py

from flask import Blueprint, jsonify
from database.database_connection import get_db_session
from models.connection_models import LinkedInConnection
from source.features.friends_connections.fetch_connections import LinkedInConnectionsFetcher
from source.features.friends_connections.fetch_single_profile import ProfileEnrichmentService

connections_bp = Blueprint("connections", __name__, url_prefix="/connections")


@connections_bp.route("/sync", methods=["GET"])
def sync_connections():
    db = get_db_session()
    try:
        # 1. Verifica se há conexões pendentes de Enrichment
        pending_count = db.query(LinkedInConnection).filter_by(is_fully_scraped=False).count()

        if pending_count > 0:
            # MODO ENRICHMENT: Popula as conexões incompletas (limite por batch para não tomar block)
            enricher = ProfileEnrichmentService(debug=True)
            enriched_total = enricher.enrich_pending_profiles(limit=5)
            message = f"Enrichment ativado: {enriched_total} perfis atualizados."
        else:
            # MODO FETCH: Procura conexões novas na rede
            fetcher = LinkedInConnectionsFetcher(debug=True)
            # Retorna a lista atualizada
            fetcher.fetch_all(batch_size=10, max_pages=100)
            message = "Varredura de novas conexões concluída."

        # 2. Retorna a base de dados atualizada
        all_db_connections = db.query(LinkedInConnection).order_by(LinkedInConnection.id.desc()).all()

        return jsonify({
            "message": message,
            "total": len(all_db_connections),
            "data": [conn.to_dict() for conn in all_db_connections]
        }), 200

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": f"Erro interno no servidor: {str(e)}"}), 500
    finally:
        db.close()
