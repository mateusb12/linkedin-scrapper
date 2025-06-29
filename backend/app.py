from flask import Flask

from backend.controllers.curls import fetch_curls_bp

app = Flask(__name__)

app.register_blueprint(fetch_curls_bp)


@app.route('/')
def home():
    return "Hello, Flask!"


if __name__ == '__main__':
    app.run(debug=True)
