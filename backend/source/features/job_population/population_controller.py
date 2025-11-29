from flask import Blueprint, jsonify
from source.features.job_population.population_service import PopulationService

# ✅ NEW PREFIX: Distinct namespace for pipeline execution
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

        # If success=False, we can still return 200 with the error message
        # or return 500. Returning 200 allows the frontend to handle "soft" failures gracefully.
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500