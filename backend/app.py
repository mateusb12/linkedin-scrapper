from werkzeug.exceptions import BadRequest
from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from debugger import start_debugger_monitor

from source.features.get_applied_jobs.services_controller import services_bp
from source.features.gmail_service.gmail_controller import gmail_bp
from source.features.profile.profile_controller import profile_bp
from source.features.job_population.job_controller import job_data_bp
from source.features.resume.resume_data import resume_bp
from source.features.fetch_curl import fetch_curl_bp
from source.features.job_population.population_controller import population_bp

load_dotenv()

start_debugger_monitor()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Register blueprints
app.register_blueprint(fetch_curl_bp)
app.register_blueprint(job_data_bp)
app.register_blueprint(population_bp)
app.register_blueprint(resume_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(services_bp)
app.register_blueprint(gmail_bp)

@app.route('/')
def home():
    return "Hello, Flask!"

@app.errorhandler(BadRequest)
def handle_bad_request(e):
    print("🔥 BAD REQUEST CAUGHT:", e)
    return {"error": "Bad Request", "details": str(e)}, 400

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=5000)