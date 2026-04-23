import pytest
import importlib.util
from pathlib import Path


@pytest.fixture
def client():
    app_path = Path(__file__).resolve().parent.parent / "app.py"
    spec = importlib.util.spec_from_file_location("job_scoring_test_app", app_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    flask_app = module.app
    flask_app.config["TESTING"] = True
    with flask_app.test_client() as client:
        yield client


def test_job_scoring_score_endpoint_returns_200(client):
    response = client.post(
        "/job-scoring/score",
        json={
            "id": "job-1",
            "title": "Senior Backend Engineer (Python)",
            "description_full": (
                "Build backend APIs in Python with FastAPI, pytest, PostgreSQL, Docker and AWS."
            ),
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert data["data"]["id"] == "job-1"
    assert data["data"]["total_score"] >= 0
    assert "category_scores" in data["data"]
    assert "score_breakdown" in data["data"]
    assert data["data"]["score_breakdown"]["final_score"] == data["data"]["total_score"]
    assert isinstance(data["data"]["score_breakdown"]["positive"], list)
    assert isinstance(data["data"]["score_breakdown"]["negative"], list)


def test_job_scoring_rank_endpoint_orders_items(client):
    response = client.post(
        "/job-scoring/rank",
        json={
            "items": [
                {
                    "id": "backend",
                    "title": "Senior Backend Engineer (Python)",
                    "description_full": (
                        "Build backend APIs in Python with FastAPI, PostgreSQL, Docker and AWS."
                    ),
                },
                {
                    "id": "frontend",
                    "title": "Frontend Engineer",
                    "description_full": "Own React and TypeScript interfaces.",
                },
            ]
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert [item["id"] for item in data["data"]["items"]] == ["backend", "frontend"]
    assert [item["rank"] for item in data["data"]["items"]] == [1, 2]
    assert all("score_breakdown" in item for item in data["data"]["items"])


def test_job_scoring_score_endpoint_exposes_ai_evaluation_breakdown(client):
    response = client.post(
        "/job-scoring/score",
        json={
            "id": "ai-reviewer",
            "title": "Python Developer - AI Code Reviewer",
            "description_full": (
                "Review AI-generated Python code, grade model responses, answer programming "
                "questions to train AI systems, and provide structured written feedback to improve "
                "model outputs. Flexible contractor role, asynchronous tasks, hourly payment."
            ),
        },
    )

    assert response.status_code == 200
    data = response.get_json()["data"]
    negative_labels = {item["label"] for item in data["score_breakdown"]["negative"]}
    assert "AI evaluation labor penalty" in negative_labels
    assert "Contractor/task-based penalty" in negative_labels


def test_job_scoring_rank_endpoint_exposes_fullstack_breakdown(client):
    response = client.post(
        "/job-scoring/rank",
        json={
            "items": [
                {
                    "id": "fullstack",
                    "title": "Fullstack Developer (Python, React)",
                    "description_full": (
                        "Build frontend systems in React and TypeScript and also ship Python "
                        "APIs with FastAPI."
                    ),
                }
            ]
        },
    )

    assert response.status_code == 200
    data = response.get_json()["data"]["items"][0]
    negative_labels = {item["label"] for item in data["score_breakdown"]["negative"]}
    assert "Fullstack/frontend penalty" in negative_labels


def test_job_scoring_invalid_payload_returns_400(client):
    response = client.post(
        "/job-scoring/score",
        json={
            "title": "",
            "description_full": "Python backend role.",
        },
    )

    assert response.status_code == 400
    data = response.get_json()
    assert data["status"] == "error"
    assert "title" in data["error"]


def test_job_scoring_rank_empty_list_returns_empty_success(client):
    response = client.post("/job-scoring/rank", json={"items": []})

    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert data["data"]["items"] == []
    assert data["data"]["metadata"]["count"] == 0
