from source.features.job_scoring.domain import JobPosting
from source.features.job_scoring.scorers.embeddings_scorer import EmbeddingsScorer
from source.features.job_scoring.scorers.hybrid_scorer import HybridScorer
from source.features.job_scoring.scorers.rules_scorer import RulesScorer
from source.features.job_scoring.utils.text_utils import count_phrase_matches


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


def test_matching_uses_token_boundaries_for_short_terms() -> None:
    text = (
        "Curiosidade constante e integração pragmática. "
        "Não deve bater ios ou rag por substring."
    )

    assert count_phrase_matches(text, ("ios",)) == ["ios"]
    assert count_phrase_matches(text, ("rag",)) == ["rag"]
    assert count_phrase_matches("curiosidade pragmatica", ("ios", "rag")) == []


def test_hybrid_prefers_backend_pure_over_fullstack_and_data_platform() -> None:
    scorer = HybridScorer()

    backend_pure = build_job(
        urn="pure",
        title="Senior Backend Developer (Python)",
        description_full=(
            "Design and maintain backend APIs and services in Python with FastAPI, "
            "pytest, PostgreSQL, Docker and AWS. Own service architecture and reliability."
        ),
        qualifications=["Python", "FastAPI", "Pytest", "PostgreSQL", "Docker", "AWS"],
    )
    fullstack = build_job(
        urn="fullstack",
        title="Fullstack Developer (Python, React)",
        description_full=(
            "Build and evolve frontend systems using React, Next.js and TypeScript. "
            "Design and ship Python backends with FastAPI. Deep frontend fundamentals, "
            "UI ownership and state management are required."
        ),
        qualifications=["Python", "FastAPI", "React", "Next.js", "TypeScript"],
        programming_languages=["Python", "TypeScript"],
    )
    data_platform = build_job(
        urn="data",
        title="Junior Data Platform Engineer",
        description_full=(
            "Develop and maintain data ingestion connectors and processing pipelines. "
            "Work with collection, normalization and large volumes of data. "
            "Enhance back-end microservices using Python, SQL, Docker and CI/CD."
        ),
        qualifications=["Python", "SQL", "Docker", "CI/CD"],
    )

    pure_result = scorer.score_job(backend_pure)
    fullstack_result = scorer.score_job(fullstack)
    data_result = scorer.score_job(data_platform)

    assert pure_result.total_score > fullstack_result.total_score
    assert pure_result.total_score > data_result.total_score
    assert fullstack_result.metadata["archetype"] == "fullstack_python"
    assert data_result.metadata["archetype"] == "data_platform_python"
    assert fullstack_result.category_scores["penalties"] > pure_result.category_scores["penalties"]
    assert data_result.category_scores["penalties"] > pure_result.category_scores["penalties"]


def test_hybrid_treats_collaboration_and_differentials_as_adjacent_context() -> None:
    scorer = HybridScorer()
    job = build_job(
        title="Desenvolvedor(a) Python Pleno",
        description_full=(
            "Desenvolver e manter APIs e servicos backend utilizando Python, Django e FastAPI. "
            "Garantir qualidade com pytest, PostgreSQL, Redis, Docker e AWS. "
            "Colaborar com times multidisciplinares de frontend, QA e produto. "
            "Diferenciais: experiencia pratica com machine learning."
        ),
        qualifications=["Python", "Django", "FastAPI", "Pytest", "PostgreSQL", "Docker", "AWS"],
    )

    result = scorer.score_job(job)

    assert result.metadata["archetype"] in {
        "backend_python_pure",
        "backend_python_with_minor_cross_functional_signals",
    }
    assert result.total_score >= 65
    assert result.category_scores["penalties"] < 10
