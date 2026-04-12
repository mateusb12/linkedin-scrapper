from source.features.job_scoring.job_scoring_service import JobScoringService
from source.features.job_scoring.schemas import (
    JobScoringBatchRequest,
    JobScoringItemInput,
    JobScoringSimpleBatchRequest,
)


def test_score_job_returns_public_structure() -> None:
    service = JobScoringService()
    payload = JobScoringItemInput.from_dict(
        {
            "id": "backend-1",
            "title": "Senior Backend Engineer (Python)",
            "description_full": (
                "Build backend APIs and services in Python with FastAPI, pytest, "
                "PostgreSQL, Docker and AWS."
            ),
            "qualifications": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
        }
    )

    result = service.score_job(payload)

    assert result["id"] == "backend-1"
    assert result["total_score"] >= 0
    assert result["archetype"] in {
        "backend_python_pure",
        "backend_python_with_minor_cross_functional_signals",
    }
    assert result["matched_keywords"]["python_primary"]
    assert isinstance(result["suspicious"], bool)
    assert isinstance(result["suspicious_reasons"], list)
    assert "metadata" in result


def test_rank_jobs_orders_by_total_score_and_preserves_ids() -> None:
    service = JobScoringService()
    request = JobScoringBatchRequest.from_dict(
        {
            "items": [
                {
                    "id": "good-fit",
                    "title": "Senior Backend Engineer (Python)",
                    "description_full": (
                        "Build backend APIs in Python with FastAPI, pytest, PostgreSQL, "
                        "Docker and AWS."
                    ),
                },
                {
                    "id": "bad-fit",
                    "title": "Frontend Engineer",
                    "description_full": "Own React, TypeScript, CSS and design systems.",
                },
            ]
        }
    )

    result = service.rank_jobs(request)

    assert result["metadata"]["scorer"] == "hybrid_scorer"
    assert [item["id"] for item in result["items"]] == ["good-fit", "bad-fit"]
    assert [item["rank"] for item in result["items"]] == [1, 2]
    assert result["items"][0]["total_score"] >= result["items"][1]["total_score"]


def test_rank_jobs_propagates_archetype_and_suspicious_fields() -> None:
    service = JobScoringService()
    request = JobScoringBatchRequest.from_dict(
        {
            "items": [
                {
                    "id": "data-role",
                    "title": "Data Platform Engineer",
                    "description_full": (
                        "Develop data ingestion connectors and large scale pipelines. "
                        "Use Python, SQL, Docker and CI/CD for data platform reliability."
                    ),
                }
            ]
        }
    )

    result = service.rank_jobs(request)
    item = result["items"][0]

    assert item["archetype"] == "data_platform_python"
    assert "suspicious" in item
    assert "suspicious_reasons" in item


def test_rank_simple_jobs_preserves_sparse_llm_backend_role() -> None:
    service = JobScoringService()
    request = JobScoringSimpleBatchRequest.from_dict(
        {
            "items": [
                {
                    "id": "llm-backend",
                    "title": "Backend Engineer - LLM Platform",
                    "description": (
                        "Build APIs and microservices in Python to serve LLM inference workloads. "
                        "Design scalable systems for model serving, evaluation pipelines, logging, and observability."
                    ),
                },
                {
                    "id": "ai-eval",
                    "title": "Back-End Python Developer - Remote",
                    "description": (
                        "Create and answer programming questions to train AI models. "
                        "Review AI-generated code and provide structured feedback to improve AI responses. "
                        "Project-based contractor role with flexible hours and weekly payout."
                    ),
                },
                {
                    "id": "fullstack",
                    "title": "Fullstack Developer (Python, React)",
                    "description": (
                        "Build and evolve frontend systems using React, Next.js and TypeScript. "
                        "Design and ship Python backends with FastAPI."
                    ),
                },
                {
                    "id": "backend-core",
                    "title": "Senior Backend Python Engineer",
                    "description": (
                        "Build and maintain backend APIs and services in Python with FastAPI, pytest, PostgreSQL, "
                        "Docker and AWS. Own production systems, reliability, deployments and observability."
                    ),
                },
            ]
        }
    )

    result = service.rank_simple_jobs(request)
    items = {item["id"]: item for item in result["items"]}

    assert result["metadata"]["input_shape"] == "title_description_only"
    assert items["backend-core"]["total_score"] >= items["llm-backend"]["total_score"]
    assert 50 <= items["llm-backend"]["total_score"] <= 65
    assert items["llm-backend"]["archetype"] == "ai_or_llm_python"
    assert items["llm-backend"]["suspicious"] is False
    assert items["llm-backend"]["total_score"] > items["fullstack"]["total_score"]
    assert items["llm-backend"]["total_score"] > items["ai-eval"]["total_score"]
    assert items["ai-eval"]["archetype"] == "ai_training_or_evaluation_python"
    assert items["ai-eval"]["suspicious"] is True
