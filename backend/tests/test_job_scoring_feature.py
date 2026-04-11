from source.features.job_scoring.domain import JobPosting
from source.features.job_scoring.scorers.embeddings_scorer import EmbeddingsScorer
from source.features.job_scoring.scorers.hybrid_scorer import HybridScorer
from source.features.job_scoring.scorers.rules_scorer import RulesScorer


def build_job(**overrides) -> JobPosting:
    base = {
        "urn": "1",
        "title": "Backend Engineer Python",
        "description_full": (
            "We build backend APIs in Python with FastAPI, pytest, SQL, "
            "Docker and AWS."
        ),
        "description_snippet": "",
        "qualifications": ["Python", "FastAPI", "SQL", "Docker"],
        "responsibilities": [],
        "keywords": ["backend", "api", "cloud"],
        "programming_languages": ["Python"],
    }
    base.update(overrides)
    return JobPosting(**base)


def test_rules_scorer_prefers_python_backend_job() -> None:
    aligned = build_job()
    misaligned = build_job(
        urn="2",
        title="Frontend Engineer React",
        description_full="React, TypeScript, design systems and frontend ownership.",
        qualifications=["React", "TypeScript"],
        keywords=["frontend"],
        programming_languages=["TypeScript"],
    )

    scorer = RulesScorer()
    assert scorer.score_job(aligned).total_score > scorer.score_job(misaligned).total_score


def test_hybrid_and_embeddings_keep_score_in_bounds() -> None:
    job = build_job()
    for scorer in (HybridScorer(), EmbeddingsScorer()):
        result = scorer.score_job(job)
        assert 0 <= result.total_score <= 100
        assert set(result.category_scores) == {
            "python_primary",
            "databases",
            "cloud_devops",
            "benefits",
            "penalties",
        }
