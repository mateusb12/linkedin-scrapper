from flask import Flask

from backend.linkedin.api_fetch.orchestrator import get_total_job_pages

app = Flask(__name__)


@app.route('/')
def home():
    return "Hello, Flask!"


@app.route('/fetch-jobs/get-total-pages')
def get_total_pages():
    total_pages: int = get_total_job_pages()
    return {"total_pages": total_pages}


if __name__ == '__main__':
    app.run(debug=True)
