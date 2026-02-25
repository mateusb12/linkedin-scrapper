from flask import Blueprint, jsonify, Response, stream_with_context
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
        conns = db.query(LinkedInConnection).order_by(LinkedInConnection.id.desc()).all()
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
