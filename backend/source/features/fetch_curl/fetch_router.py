"""
fetch_router.py - Routing and Swagger documentation layer.
"""

from flask import Blueprint

from source.features.fetch_curl.fetch_controller import (
    get_config,
    update_config,
    handle_pagination_curl,
    handle_individual_curl,
    handle_config,
    handle_experience_config,
    fetch_profile_section,
)

fetch_curl_bp = Blueprint("fetch_curl", __name__, url_prefix="/config")


@fetch_curl_bp.route("/curl/<string:name>", methods=["GET"])
def get_config_route(name: str):
    """
    Returns one stored curl configuration by name.
    ---
    tags:
      - Config
    parameters:
      - name: name
        in: path
        type: string
        required: true
    responses:
      200:
        description: Stored curl configuration.
        schema:
          type: object
          additionalProperties: true
      404:
        description: Configuration not found.
    """
    return get_config(name)


@fetch_curl_bp.route("/curl/<string:name>", methods=["PUT"])
def update_config_route(name: str):
    """
    Updates one stored curl configuration from the raw request body.
    ---
    tags:
      - Config
    parameters:
      - name: name
        in: path
        type: string
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: string
    responses:
      200:
        description: Configuration updated successfully.
        schema:
          type: object
          properties:
            message:
              type: string
      400:
        description: Missing body or invalid curl input.
      404:
        description: Configuration not found.
    """
    return update_config(name)


@fetch_curl_bp.route("/pagination-curl", methods=["GET", "PUT", "DELETE"])
def handle_pagination_curl_route():
    """
    Gets, updates, or deletes the `Pagination` curl configuration.
    ---
    tags:
      - Config
    responses:
      200:
        description: Operation completed successfully.
      400:
        description: Invalid request body.
      404:
        description: Configuration not found.
    """
    return handle_pagination_curl()


@fetch_curl_bp.route("/individual-job-curl", methods=["GET", "PUT", "DELETE"])
def handle_individual_curl_route():
    """
    Gets, updates, or deletes the `SingleJob` curl configuration.
    ---
    tags:
      - Config
    responses:
      200:
        description: Operation completed successfully.
      400:
        description: Invalid request body.
      404:
        description: Configuration not found.
    """
    return handle_individual_curl()


@fetch_curl_bp.route("/curl/<string:name>", methods=["GET", "PUT", "DELETE"])
def handle_config_route(name: str):
    """
    Generic config handler for get, update, or delete operations by name.
    ---
    tags:
      - Config
    parameters:
      - name: name
        in: path
        type: string
        required: true
    responses:
      200:
        description: Operation completed successfully.
      400:
        description: Invalid request body.
      404:
        description: Configuration not found.
    """
    return handle_config(name)


@fetch_curl_bp.route("/experience", methods=["GET", "PUT", "DELETE"])
def handle_experience_config_route():
    """
    Gets, updates, or deletes the `Experience` configuration.
    ---
    tags:
      - Config
    parameters:
      - name: body
        in: body
        required: false
        schema:
          type: object
          properties:
            curl:
              type: string
    responses:
      200:
        description: Operation completed successfully.
      400:
        description: Missing curl input or invalid request body.
      404:
        description: Configuration not found.
    """
    return handle_experience_config()


@fetch_curl_bp.route("/profile/<string:vanity_name>/<string:config_name>", methods=["GET"])
def fetch_profile_section_route(vanity_name: str, config_name: str):
    """
    Fetches one dynamic profile section using the stored config.
    ---
    tags:
      - Config
    parameters:
      - name: vanity_name
        in: path
        type: string
        required: true
      - name: config_name
        in: path
        type: string
        required: true
    responses:
      200:
        description: Extracted profile section as JSON or plain text.
      500:
        description: Extraction failed.
    """
    return fetch_profile_section(vanity_name, config_name)
