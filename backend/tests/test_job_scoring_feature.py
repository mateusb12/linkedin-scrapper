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


def test_hybrid_strongly_penalizes_data_engineering_python_cluster() -> None:
    scorer = HybridScorer()
    job = build_job(
        urn="data-engineering-cluster",
        title="Engenheiro de Dados - Pleno",
        description_full=(
            "Atuar com pipelines de dados, ETL e ELT usando Python, Spark e PySpark. "
            "Construir Data Lake e Data Warehouse com Airflow, dbt, BigQuery, Glue "
            "e Cloud Composer. Garantir qualidade de dados, monitoria de pipelines, "
            "processamento distribuido, grandes volumes de dados e queries complexas. "
            "Usamos Docker, PostgreSQL, Git e CI/CD."
        ),
        qualifications=[
            "Python",
            "Spark",
            "PySpark",
            "Airflow",
            "dbt",
            "BigQuery",
            "Docker",
            "PostgreSQL",
            "Git",
            "CI/CD",
        ],
        keywords=["data engineering", "etl", "data lake", "data warehouse"],
        programming_languages=["Python"],
    )

    result = scorer.score_job(job)

    assert result.metadata["archetype"] == "data_platform_python"
    assert result.metadata["raw_python_match_score"] > result.total_score
    assert result.metadata["domain_penalty"] >= 35
    assert result.metadata["final_python_dev_score"] == result.total_score
    assert result.total_score <= 30
    negative_labels = {item.label for item in result.score_breakdown.negative}
    assert "Data engineering title penalty" in negative_labels
    assert "Data engineering cluster penalty" in negative_labels
    assert result.category_scores["penalties"] >= 40


def test_hybrid_penalizes_data_platform_title_with_backend_side_signals() -> None:
    scorer = HybridScorer()
    job = build_job(
        urn="data-platform-side-backend",
        title="Junior Data Platform Engineer",
        description_full=(
            "Develop and maintain data ingestion connectors and data pipelines for "
            "collection, normalization and processing at global scale. Work with "
            "large volumes of data, monitor pipelines and troubleshoot incidents. "
            "Enhance back-end microservices using Python, FastAPI, PostgreSQL, Docker "
            "and CI/CD."
        ),
        qualifications=["Python", "FastAPI", "PostgreSQL", "Docker", "CI/CD"],
        keywords=["data platform", "data pipelines", "large volumes of data"],
        programming_languages=["Python"],
    )

    result = scorer.score_job(job)

    assert result.metadata["archetype"] == "data_platform_python"
    assert result.total_score <= 15
    negative_labels = {item.label for item in result.score_breakdown.negative}
    assert "Data engineering title penalty" in negative_labels
    assert "Data engineering cluster penalty" in negative_labels


def test_hybrid_preserves_backend_python_with_single_airflow_side_signal() -> None:
    scorer = HybridScorer()
    job = build_job(
        urn="backend-airflow-side-signal",
        title="Senior Backend Python Engineer",
        description_full=(
            "Build and maintain backend APIs and services in Python with FastAPI, "
            "pytest, PostgreSQL, Redis, Docker and AWS. Own production reliability, "
            "database design, CI/CD and observability. Occasionally integrate with "
            "Airflow jobs owned by the data team."
        ),
        qualifications=["Python", "FastAPI", "Pytest", "PostgreSQL", "Docker", "AWS"],
        responsibilities=[
            "Design and implement APIs and microservices.",
            "Operate production systems and support feature delivery.",
        ],
        keywords=["backend", "api", "microservices", "airflow"],
    )

    result = scorer.score_job(job)

    assert result.metadata["archetype"] in {
        "backend_python_pure",
        "backend_python_with_minor_cross_functional_signals",
    }
    assert result.total_score >= 65
    assert "Data engineering cluster penalty" not in {
        item.label for item in result.score_breakdown.negative
    }


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


def test_hybrid_penalizes_ai_training_evaluation_contractor_pattern() -> None:
    scorer = HybridScorer()
    ai_eval_job = build_job(
        urn="ai-eval",
        title="Back-End Python Developer - Remote",
        description_full=(
            "Create and answer computer science and programming-related questions to train AI models. "
            "Review, analyze, and evaluate AI-generated code for accuracy, efficiency, and best practices. "
            "Provide clear, constructive, and structured feedback to improve AI responses in Spanish and English. "
            "This is an asynchronous, project-based independent contractor role with flexible hours, "
            "5 to 40 hours per week, hourly compensation and weekly payout."
        ),
        qualifications=["Python", "Code review", "English", "Spanish"],
        responsibilities=[
            "Train AI models with human feedback on code and programming questions.",
            "Review model responses and explain technical concepts clearly.",
        ],
        keywords=["python", "ai", "feedback"],
    )

    result = scorer.score_job(ai_eval_job)

    assert result.metadata["archetype"] == "ai_training_or_evaluation_python"
    assert result.total_score <= 45
    assert result.suspicious is True
    negative_labels = {item.label for item in result.score_breakdown.negative}
    assert "AI evaluation labor penalty" in negative_labels
    assert "Contractor/task-based penalty" in negative_labels
    assert any(
        "avaliar/treinar respostas de IA" in reason
        or "avaliação/treino de IA" in reason
        for reason in result.explanation.penalty_reasons
    )
    assert "vaga usa Python mais para avaliação/treino de IA do que para engenharia backend" in result.suspicious_reasons


def test_hybrid_classifies_agent_evaluation_python_engineer_as_ai_training() -> None:
    scorer = HybridScorer()
    job = build_job(
        urn="agent-eval-python-engineer",
        title="Python Engineer (Remote)",
        description_full=(
            "Help design and evaluate autonomous AI agents across multiple LLMs, spanning health, "
            "education, daily life, and other real-world domains (all coding work). Shape the future "
            "of agentic AI systems by providing expert human feedback to leading AI organisations. "
            "Help train Large Language Models (LLMs) for complex, multi-step architectural workflows.\n\n"
            "Key Responsibilities:\n"
            "AI Agent Evaluation\n"
            "Write evaluation rubrics with objective pass/fail criteria\n"
            "Debug agent traces to identify failure patterns\n"
            "Stress test agents against edge cases, prompt injection, and tool misuse\n"
            "Technical Assessment\n"
            "Assess production-grade modular software architecture\n"
            "Analyse multi-turn system interactions and behaviours\n"
            "Provide high-density technical feedback for LLM training\n"
            "Project Workflow\n"
            "Create an account and upload a resume/ID\n"
            "Complete the onboarding assessment\n"
            "Start earning through flexible task assignments\n\n"
            "Qualifications:\n"
            "Experience in backend engineering, AI automation, or complex systems integration\n"
            "Proven ability to build and maintain production-grade software with modular separation\n"
            "Strong command of at least two major languages such as Python, JavaScript, Go, or Java "
            "and experience working with SQL databases\n"
            "Practical experience building for live, non-mocked environments and handling multi-turn "
            "system interactions\n\n"
            "Preferred:\n"
            "Experience integrating agents with live tools such as Supabase, Gmail, and other APIs\n"
            "Familiarity with persistent state and session-tracking patterns\n"
            "Experience identifying privacy leaks, authority escalation, or indirect prompt injection "
            "vulnerabilities\n\n"
            "Compensation:\n"
            "Hourly compensation ranges from USD $30-$50\n"
            "Payments are issued weekly via PayPal or AirTM\n"
            "Full compensation details are provided prior to task acceptance"
        ),
        programming_languages=["Python", "JavaScript", "SQL"],
    )

    result = scorer.score_job(job)
    signals = result.metadata["archetype_signals"]

    assert result.metadata["archetype"] == "ai_training_or_evaluation_python"
    assert signals["backend_core"] > 0
    assert signals["ai_evaluation_core"] > signals["backend_core"] * 3
    assert signals["contractor_style"] > 0
    assert result.metadata["structural_penalty"] >= 15
    assert result.suspicious is True
    assert result.total_score <= 45
    assert "vaga usa Python mais para avaliação/treino de IA do que para engenharia backend" in result.suspicious_reasons


def test_hybrid_preserves_legit_ai_backend_engineering_role() -> None:
    scorer = HybridScorer()
    job = build_job(
        urn="ai-backend",
        title="Senior AI Platform Backend Engineer",
        description_full=(
            "Build backend services and APIs for model-serving and inference workloads. "
            "Design and maintain Python microservices, deployment pipelines, observability, "
            "production support, database design and cloud infrastructure for AI products. "
            "Own reliability, scalability, CI/CD, monitoring and incident response."
        ),
        qualifications=[
            "Python",
            "FastAPI",
            "Docker",
            "Kubernetes",
            "AWS",
            "PostgreSQL",
        ],
        responsibilities=[
            "Build and operate production systems for inference APIs and evaluation tooling.",
            "Maintain service ownership, on-call support and roadmap execution for backend services.",
        ],
        keywords=["backend", "apis", "microservices", "ai products"],
    )

    result = scorer.score_job(job)

    assert result.metadata["archetype"] in {
        "backend_python_pure",
        "backend_python_with_minor_cross_functional_signals",
    }
    assert result.total_score >= 65
    assert result.category_scores["penalties"] < 10
    positive_labels = {item.label for item in result.score_breakdown.positive}
    assert "Backend ownership boost" in positive_labels or "Backend core preserved" in positive_labels


def test_hybrid_preserves_ai_agent_backend_product_role_with_eval_terms() -> None:
    scorer = HybridScorer()
    job = build_job(
        urn="agent-backend-product",
        title="Senior Backend Python Engineer - AI Agents",
        description_full=(
            "Build backend services for autonomous AI agent products in Python with FastAPI. "
            "Design APIs, implement backend features, maintain production systems, deploy services, "
            "own services, database schemas, reliability, observability and scaling. "
            "Support evaluation rubrics, prompt injection defenses and agent trace debugging as "
            "product features for production agent workflows."
        ),
        qualifications=["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
        responsibilities=[
            "Build and operate production systems for agent APIs.",
            "Maintain service ownership and deploy backend services.",
        ],
        keywords=["backend", "services", "apis", "ai agents"],
    )

    result = scorer.score_job(job)

    assert result.metadata["archetype"] in {
        "backend_python_pure",
        "backend_python_with_minor_cross_functional_signals",
        "ai_or_llm_python",
    }
    assert result.metadata["archetype"] != "ai_training_or_evaluation_python"
    assert result.suspicious is False
    assert result.total_score >= 65


def test_pure_backend_python_stays_above_ai_evaluation_job() -> None:
    scorer = HybridScorer()
    backend_job = build_job(
        urn="backend-core",
        title="Senior Backend Python Engineer",
        description_full=(
            "Build and maintain backend APIs and services in Python with FastAPI, pytest, PostgreSQL, "
            "Redis, Docker and AWS. Own production systems, service reliability, observability, "
            "database design, deployments and incident response."
        ),
        qualifications=["Python", "FastAPI", "Pytest", "PostgreSQL", "Docker", "AWS"],
        responsibilities=[
            "Design and implement APIs and microservices.",
            "Operate production systems and support feature delivery.",
        ],
        keywords=["backend", "api", "microservices", "reliability"],
    )
    ai_eval_job = build_job(
        urn="ai-eval-2",
        title="Back-End Python Developer - Remote",
        description_full=(
            "Answer programming-related questions to train AI models and review AI-generated code. "
            "Provide structured feedback to improve AI responses in a project-based contractor setup "
            "with flexible hours and weekly payout."
        ),
        qualifications=["Python"],
        responsibilities=["Evaluate model responses and grade coding answers."],
        keywords=["python", "ai"],
    )

    backend_result = scorer.score_job(backend_job)
    ai_eval_result = scorer.score_job(ai_eval_job)

    assert backend_result.total_score > ai_eval_result.total_score
    assert backend_result.metadata["archetype"] in {
        "backend_python_pure",
        "backend_python_with_minor_cross_functional_signals",
    }
    assert ai_eval_result.metadata["archetype"] == "ai_training_or_evaluation_python"


def test_hybrid_preserves_llm_backend_engineering_with_strong_ownership() -> None:
    scorer = HybridScorer()
    job = build_job(
        urn="llm-platform",
        title="Backend Engineer - LLM Platform",
        description_full=(
            "Build APIs and microservices in Python to serve LLM inference workloads. "
            "Design scalable systems for model serving, evaluation pipelines, logging, and observability."
        ),
        qualifications=["Python"],
    )

    result = scorer.score_job(job)

    assert result.metadata["archetype"] == "ai_or_llm_python"
    assert 55 <= result.total_score <= 75
    assert result.suspicious is False
    assert result.metadata["structural_penalty"] <= 4.0
    positive_labels = {item.label for item in result.score_breakdown.positive}
    negative_labels = {item.label for item in result.score_breakdown.negative}
    assert "LLM backend ownership boost" in positive_labels
    assert "AI/LLM context penalty" in negative_labels


def test_hybrid_score_breakdown_is_structured_for_pure_backend_job() -> None:
    scorer = HybridScorer()
    job = build_job(
        urn="backend-breakdown",
        title="Senior Backend Python Engineer",
        description_full=(
            "Build backend APIs and services in Python with FastAPI, pytest, PostgreSQL, "
            "Redis, Docker and AWS. Own production systems, observability and reliability."
        ),
        qualifications=["Python", "FastAPI", "Pytest", "PostgreSQL", "Docker", "AWS"],
    )

    result = scorer.score_job(job)

    positive_labels = {item.label for item in result.score_breakdown.positive}
    assert "Python core match" in positive_labels
    assert "Backend title signal" in positive_labels
    assert "Database stack boost" in positive_labels
    assert "Cloud/DevOps stack boost" in positive_labels
    assert result.score_breakdown.final_score == result.total_score


def test_hybrid_score_breakdown_marks_fullstack_penalty() -> None:
    scorer = HybridScorer()
    job = build_job(
        urn="fullstack-breakdown",
        title="Fullstack Developer (Python, React)",
        description_full=(
            "Build and evolve frontend systems using React, Next.js and TypeScript. "
            "Design and ship Python backends with FastAPI."
        ),
        qualifications=["Python", "FastAPI", "React", "Next.js", "TypeScript"],
        programming_languages=["Python", "TypeScript"],
    )

    result = scorer.score_job(job)

    negative_labels = {item.label for item in result.score_breakdown.negative}
    assert "Fullstack/frontend penalty" in negative_labels
    assert "Frontend dominance penalty" in negative_labels
