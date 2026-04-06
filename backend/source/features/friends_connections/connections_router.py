"""
connections_router.py - Routing and Swagger documentation layer.
"""

from flask import Blueprint

from source.features.friends_connections.connections_controller import (
    get_connections,
    sync_connections_stream,
    reset_one,
    reset_bugged_profiles,
    refresh_profile,
)

connections_bp = Blueprint("connections", __name__, url_prefix="/connections")


@connections_bp.route("/", methods=["GET"])
def get_connections_route():
    """
    Returns stored LinkedIn connections.
    ---
    tags:
      - Connections
    responses:
      200:
        description: List of stored connections.
        schema:
          type: array
          items:
            type: object
        examples:
          application/json:
            - id: 1
              name: "Joao Silva"
              vanity_name: "joao-silva"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
    """
    return get_connections()


@connections_bp.route("/sync", methods=["GET"])
def sync_connections_stream_route():
    """
    Streams connections sync or profile enrichment progress.
    ---
    tags:
      - Connections
    produces:
      - text/event-stream
    responses:
      200:
        description: SSE stream with sync progress events.
      500:
        description: Runtime errors are emitted as SSE payloads.
    """
    return sync_connections_stream()


@connections_bp.route("/reset-one", methods=["POST"])
def reset_one_route():
    """
    Resets enriched fields for one stored connection.
    ---
    tags:
      - Connections
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            id:
              type: integer
        examples:
          application/json:
            id: 1
    responses:
      200:
        description: Connection reset successfully.
        schema:
          type: object
          properties:
            status:
              type: string
            reset_id:
              type: integer
        examples:
          application/json:
            status: "ok"
            reset_id: 1
      400:
        description: Missing ID.
        schema:
          type: object
          properties:
            error:
              type: string
      404:
        description: Connection not found.
        schema:
          type: object
          properties:
            error:
              type: string
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
    """
    return reset_one()


@connections_bp.route("/reset-bugged", methods=["POST"])
def reset_bugged_profiles_route():
    """
    Resets all stored connections to the non-enriched state.
    ---
    tags:
      - Connections
    responses:
      200:
        description: Bulk reset completed.
        schema:
          type: object
          properties:
            status:
              type: string
            message:
              type: string
        examples:
          application/json:
            status: "ok"
            message: "10 perfis foram resetados (reset all)."
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
    """
    return reset_bugged_profiles()


@connections_bp.route("/refresh-profile", methods=["POST"])
def refresh_profile_route():
    """
    Forces synchronous refresh for one stored profile by ID or name.
    ---
    tags:
      - Connections
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            id:
              type: integer
            name:
              type: string
        examples:
          application/json:
            id: 1
    responses:
      200:
        description: Profile refreshed successfully.
        schema:
          type: object
          properties:
            status:
              type: string
            message:
              type: string
            data:
              type: object
        examples:
          application/json:
            status: "ok"
            message: "Perfil de Joao Silva atualizado com sucesso!"
            data:
              id: 1
              name: "Joao Silva"
      400:
        description: Missing search criteria.
        schema:
          type: object
          properties:
            error:
              type: string
      404:
        description: Profile not found.
        schema:
          type: object
          properties:
            error:
              type: string
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
    """
    return refresh_profile()
