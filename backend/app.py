from flask import Flask

from backend.controllers.job_curls import fetch_jobs_bp

app = Flask(__name__)

app.register_blueprint(fetch_jobs_bp)


@app.route('/')
def home():
    return "Hello, Flask!"


if __name__ == '__main__':
    app.run(debug=True)
