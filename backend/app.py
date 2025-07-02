import os
import sys
from flask import Flask
from flask_cors import CORS
from controllers.job_curls import fetch_jobs_bp
from controllers.job_data import job_data_bp
from database.database_connection import create_db_and_tables, engine
from flask_migrate import Migrate
from database.extensions import db
from path.file_content_loader import load_db_path

directory = os.path.dirname(os.path.abspath(__file__))
sys.path.append(directory)

db_path = load_db_path()

app = Flask(__name__)
CORS(app)

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
migrate = Migrate(app, db)

app.register_blueprint(fetch_jobs_bp)
app.register_blueprint(job_data_bp)


@app.route('/')
def home():
    return "Hello, Flask!"


if __name__ == '__main__':
    db_path = load_db_path()
    app.run(debug=True, use_reloader=False)
