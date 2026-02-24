# backend/source/features/friends_connections/connections_controller.py

from flask import Blueprint, jsonify
from source.features.friends_connections.fetch_connections import LinkedInConnectionsFetcher

connections_bp = Blueprint("connections", __name__, url_prefix="/connections")


@connections_bp.route("/sync", methods=["GET", "POST"])
def sync_connections():
    try:
        fetcher = LinkedInConnectionsFetcher()
        connections_list = fetcher.fetch_all()

        return jsonify({
            "message": "Sincronização concluída com sucesso",
            "total": len(connections_list),
            "data": connections_list
        }), 200

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": f"Erro interno no servidor: {str(e)}"}), 500
