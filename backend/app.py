from flask import Flask

from backend.controllers.job_curls import fetch_jobs_bp
from backend.database.database_connection import create_db_and_tables

app = Flask(__name__)

app.register_blueprint(fetch_jobs_bp)


@app.route('/')
def home():
    return "Hello, Flask!"


if __name__ == '__main__':
    create_db_and_tables()
    app.run(debug=True)
