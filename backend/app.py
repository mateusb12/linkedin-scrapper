from werkzeug.exceptions import BadRequest

from source.features.get_applied_jobs.services_controller import services_bp
from source.features.profile.profile_controller import profile_bp
from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS

from source.features.job_population.job_controller import job_data_bp
from controllers.resume_data import resume_bp
from database.database_connection import create_db_and_tables
from source.features.fetch_curl import fetch_curl_bp
from source.features.job_population.population_controller import population_bp

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)



# Register blueprints
app.register_blueprint(fetch_curl_bp)
# app.register_blueprint(fetch_jobs_bp)
app.register_blueprint(job_data_bp)
app.register_blueprint(population_bp)
app.register_blueprint(resume_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(services_bp)


# --- Routes ---
@app.route('/')
def home():
    """A simple route to confirm the server is running."""
    return "Hello, Flask!"

@app.errorhandler(BadRequest)
def handle_bad_request(e):
    print("🔥 BAD REQUEST CAUGHT:")
    print(" ->", e)
    print("BODY:", request.data)
    print("HEADERS:", dict(request.headers))
    return {"error": "Bad Request", "details": str(e)}, 400


# --- Main Execution ---
if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)