from flask import jsonify, Response, stream_with_context, request
from source.features.job_population.population_service import PopulationService

def get_total_pages():
    try:
        pages = PopulationService.get_total_pages()
        return jsonify({"total_pages": pages}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def fetch_page_endpoint(page_number: int):
    try:
        result = PopulationService.fetch_and_save_page(page_number)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "page": page_number,
            "step": "controller",
            "error": "Unhandled fetch-page controller error",
            "details": str(e),
        }), 500

def fetch_range_stream():
    start_page = request.args.get('start_page', type=int)
    end_page = request.args.get('end_page', type=int)
    return Response(
        stream_with_context(PopulationService.stream_fetch_page_range(start_page, end_page)),
        mimetype='text/event-stream'
    )

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
