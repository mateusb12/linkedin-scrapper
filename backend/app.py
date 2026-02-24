import logging
import sys
import traceback

from werkzeug.exceptions import BadRequest
from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from debugger import start_debugger_monitor
from source.features.friends_connections.connections_controller import connections_bp

from source.features.get_applied_jobs.services_controller import services_bp
from source.features.gmail_service.gmail_controller import gmail_bp
from source.features.profile.profile_controller import profile_bp
from source.features.job_population.job_controller import job_data_bp
from source.features.resume.resume_data import resume_bp
from source.features.fetch_curl import fetch_curl_bp
from source.features.job_population.population_controller import population_bp
from database.database_connection import create_db_and_tables

load_dotenv()

start_debugger_monitor()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

app.config["PROPAGATE_EXCEPTIONS"] = True
app.config["TRAP_HTTP_EXCEPTIONS"] = True
app.config["TRAP_BAD_REQUEST_ERRORS"] = True

app.logger.setLevel(logging.DEBUG)

logging.basicConfig(
    level=logging.DEBUG,
    stream=sys.stdout,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

with app.app_context():
    create_db_and_tables()

# Register blueprints
app.register_blueprint(fetch_curl_bp)
app.register_blueprint(job_data_bp)
app.register_blueprint(population_bp)
app.register_blueprint(resume_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(services_bp)
app.register_blueprint(gmail_bp)
app.register_blueprint(connections_bp)


@app.route('/')
def home():
    return "Hello, Flask!"


@app.errorhandler(BadRequest)
def handle_bad_request(e):
    print("🔥 BAD REQUEST CAUGHT:", e)
    return {"error": "Bad Request", "details": str(e)}, 400


@app.errorhandler(Exception)
def handle_all_exceptions(e):
    print("\n🔥🔥🔥 UNCAUGHT EXCEPTION 🔥🔥🔥")
    traceback.print_exc()
    return {"error": str(e)}, 500


if __name__ == '__main__':
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=5000)
