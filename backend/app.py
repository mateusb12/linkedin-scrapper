import os
import sys
import time
import threading
from werkzeug.exceptions import BadRequest
from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS

# ... (Blueprints imports remain the same) ...
from source.features.get_applied_jobs.services_controller import services_bp
from source.features.gmail_service.gmail_controller import gmail_bp
from source.features.profile.profile_controller import profile_bp
from source.features.job_population.job_controller import job_data_bp
from controllers.resume_data import resume_bp
from source.features.fetch_curl import fetch_curl_bp
from source.features.job_population.population_controller import population_bp

load_dotenv()

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


# --- CRASH-PROOF SILENT MONITOR ---
def start_debugger_monitor():
    def monitor():
        # 1. Wait a bit so Flask has time to print "Running on http://..."
        time.sleep(2)

        print("🔍 Debugger Monitor: Active! Waiting for PyCharm...")

        # Keep this OPEN as long as the app runs. Never close it.
        # This prevents the "I/O operation on closed file" crash.
        devnull = open(os.devnull, 'w')

        while True:
            try:
                # Mute stderr only for the connection attempt
                original_stderr = sys.stderr
                sys.stderr = devnull

                try:
                    import pydevd_pycharm
                    pydevd_pycharm.settrace(
                        'host.docker.internal',
                        port=5678,
                        stdout_to_server=True,
                        stderr_to_server=True,
                        suspend=False
                    )

                    # Connection Successful!
                    # Restore stderr so we can print the success message
                    sys.stderr = original_stderr
                    print("\n✅ SUCCESS: App automatically attached to PyCharm Debugger!\n")
                    break

                except Exception:
                    # Connection failed. Restore stderr silently and retry.
                    sys.stderr = original_stderr
                    pass

            except Exception:
                # Failsafe: Ensure stderr is restored even if code breaks
                sys.stderr = sys.__stderr__

            time.sleep(3)

    thread = threading.Thread(target=monitor, daemon=True)
    thread.start()


# --- EXECUTE MONITOR ---
start_debugger_monitor()

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=5000)