"""
population_router.py - Routing and Swagger documentation layer.
"""

from flask import Blueprint

from source.features.job_population.population_controller import (
    get_total_pages,
    fetch_page_endpoint,
    fetch_range_stream,
    backfill_descriptions_stream,
)

population_bp = Blueprint("job_population", __name__, url_prefix="/pipeline")


@population_bp.route('/get-total-pages', methods=['GET'])
def get_total_pages_route():
    """
    Returns the total number of available pagination pages.
    ---
    tags:
      - Pipeline
    responses:
      200:
        description: Total number of pages available.
        schema:
          type: object
          properties:
            total_pages:
              type: integer
        examples:
          application/json:
            total_pages: 0
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
    """
    return get_total_pages()


@population_bp.route('/fetch-page/<int:page_number>', methods=['GET'])
def fetch_page_endpoint_route(page_number: int):
    """
    Fetches one LinkedIn jobs page, enriches new jobs, and saves them to the database.
    ---
    tags:
      - Pipeline
    parameters:
      - name: page_number
        in: path
        type: integer
        required: true
        description: Page number to fetch.
    responses:
      200:
        description: Page processed successfully.
        schema:
          type: object
          properties:
            success:
              type: boolean
            count:
              type: integer
            total_found:
              type: integer
            message:
              type: string
        examples:
          application/json:
            success: true
            count: 0
            total_found: 0
            message: "No jobs found"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            success:
              type: boolean
            error:
              type: string
        examples:
          application/json:
            success: false
            error: "Network request failed"
    """
    return fetch_page_endpoint(page_number)


@population_bp.route('/fetch-range-stream', methods=['GET'])
def fetch_range_stream_route():
    """
    Streams page-range fetching progress and results through SSE.
    ---
    tags:
      - Pipeline
    produces:
      - text/event-stream
    parameters:
      - name: start_page
        in: query
        type: integer
        required: true
        description: First page to fetch.
      - name: end_page
        in: query
        type: integer
        required: true
        description: Last page to fetch.
    responses:
      200:
        description: SSE stream with page progress, retries, errors, and completion.
      500:
        description: Runtime errors are emitted as SSE events.
    """
    return fetch_range_stream()


@population_bp.route('/backfill-descriptions-stream', methods=['GET'])
def backfill_descriptions_stream_route():
    """
    Streams job description backfill progress with optional time filtering.
    ---
    tags:
      - Pipeline
    produces:
      - text/event-stream
    parameters:
      - name: time_range
        in: query
        type: string
        required: false
        description: Optional range such as `all_time`, `past_24h`, `past_week`, or `past_month`.
    responses:
      200:
        description: SSE stream with progress, error, and complete events.
      500:
        description: Runtime errors are emitted as SSE events.
    """
    return backfill_descriptions_stream()
