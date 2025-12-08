from flask import Blueprint, jsonify, Response, stream_with_context, request
from source.features.job_population.population_service import PopulationService

population_bp = Blueprint("job_population", __name__, url_prefix="/pipeline")

@population_bp.route('/get-total-pages', methods=['GET'])
def get_total_pages():
    try:
        pages = PopulationService.get_total_pages()
        return jsonify({"total_pages": pages}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@population_bp.route('/fetch-page/<int:page_number>', methods=['GET'])
def fetch_page_endpoint(page_number: int):
    try:
        result = PopulationService.fetch_and_save_page(page_number)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@population_bp.route('/backfill-descriptions-stream', methods=['GET'])
def backfill_descriptions_stream():
    """
    Streams the progress of the enrichment process using SSE.
    Accepts an optional 'time_range' query param.
    """
    time_range = request.args.get('time_range', 'all_time')
    return Response(
        stream_with_context(PopulationService.stream_description_backfill(time_range)),
        mimetype='text/event-stream'
    )