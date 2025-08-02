import os
import sys

# Move this block to the top
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from controllers.services_controller import services_bp
from controllers.profile_controller import profile_bp
from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate

from controllers.job_curls import fetch_jobs_bp
from controllers.job_data import job_data_bp
from controllers.resume_data import resume_bp
from database.database_connection import create_db_and_tables
from database.extensions import db
from path.file_content_loader import load_db_path

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Database configuration
db_path = load_db_path()
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize extensions
db.init_app(app)
migrate = Migrate(app, db)

# Register blueprints
app.register_blueprint(fetch_jobs_bp)
app.register_blueprint(job_data_bp)
app.register_blueprint(resume_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(services_bp)


# --- Routes ---
@app.route('/')
def home():
    """A simple route to confirm the server is running."""
    return "Hello, Flask!"


# --- Main Execution ---
if __name__ == '__main__':
    with app.app_context():
        create_db_and_tables()
    app.run(debug=True, use_reloader=False)