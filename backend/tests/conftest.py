import importlib.util
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture
def flask_app():
    app_path = BACKEND_ROOT / "app.py"
    spec = importlib.util.spec_from_file_location("backend_flask_app", app_path)
    app_module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = app_module
    spec.loader.exec_module(app_module)
    flask_app = app_module.app
    flask_app.config["TESTING"] = True
    return flask_app


@pytest.fixture
def client(flask_app):
    with flask_app.test_client() as client:
        yield client
