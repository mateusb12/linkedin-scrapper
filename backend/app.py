import os
from flask import Flask
from flask_cors import CORS
from controllers.job_curls import fetch_jobs_bp
from database.database_connection import create_db_and_tables

app = Flask(__name__)
CORS(app)

app.register_blueprint(fetch_jobs_bp)


@app.route('/')
def home():
    return "Hello, Flask!"


if __name__ == '__main__':
    create_db_and_tables()
    app.run(debug=True, use_reloader=False)
