from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class ScoreWeights:
    python_primary: float = 55.0
    databases: float = 18.0
    cloud_devops: float = 16.0
    benefits: float = 6.0
    penalties: float = 20.0

    @property
    def positive_total(self) -> float:
        return (
            self.python_primary
            + self.databases
            + self.cloud_devops
            + self.benefits
        )


@dataclass(frozen=True, slots=True)
class TextProfile:
    strong_python_signals: tuple[str, ...] = (
        "python backend",
        "backend python",
        "engenheira backend python",
        "engenheiro backend python",
        "software engineer python",
        "backend engineer python",
        "python developer",
        "desenvolvedor python",
        "api em python",
        "apis em python",
        "microservices python",
        "servicos em python",
        "flask",
        "fastapi",
        "django",
        "pytest",
    )
    backend_context_terms: tuple[str, ...] = (
        "backend",
        "api",
        "apis",
        "rest",
        "microservice",
        "microservices",
        "service",
        "services",
        "arquitetura",
        "architecture",
        "web services",
    )
    python_terms: tuple[str, ...] = (
        "python",
        "python 3",
        "python3",
    )
    pure_backend_terms: tuple[str, ...] = (
        "backend engineer",
        "backend developer",
        "software engineer backend",
        "desenvolvedor backend",
        "engenheiro backend",
        "back end",
        "back-end",
    )
    mixed_stack_terms: tuple[str, ...] = (
        "fullstack",
        "full stack",
        "react",
        "javascript",
        "typescript",
        "frontend",
        "front end",
        "front-end",
    )
    platform_terms: tuple[str, ...] = (
        "odoo",
        "erp",
        "sap",
    )
    database_terms: tuple[str, ...] = (
        "sql",
        "postgresql",
        "postgres",
        "mysql",
        "sqlite",
        "nosql",
        "mongodb",
        "redis",
        "query",
        "queries",
        "index",
        "indexes",
        "indices",
        "performance",
        "tuning",
        "optimization",
        "data modeling",
        "modelagem de dados",
    )
    cloud_devops_terms: tuple[str, ...] = (
        "docker",
        "container",
        "containers",
        "kubernetes",
        "deploy",
        "deployment",
        "ci/cd",
        "pipeline",
        "pipelines",
        "cloud",
        "aws",
        "gcp",
        "azure",
        "terraform",
        "troubleshooting",
        "observability",
    )
    benefit_terms: tuple[str, ...] = (
        "vale refeicao",
        "vale refeição",
        "vale alimentacao",
        "vale alimentação",
        "vr",
        "va",
        "beneficio flexivel",
        "benefício flexível",
        "cartao caju",
        "cartão caju",
        "caju",
    )
    generic_benefit_terms: tuple[str, ...] = (
        "plano de saude",
        "plano de saúde",
        "seguro de vida",
        "gympass",
        "wellhub",
        "day off",
        "psicologia",
        "terapia",
    )
    ai_secondary_terms: tuple[str, ...] = (
        "llm",
        "prompt engineering",
        "generative ai",
        "genai",
        "artificial intelligence",
        "machine learning",
        "data science",
        "data engineer",
        "data engineering",
        "data platform",
        "analytics engineer",
        "platform engineer",
        "scientist",
        "analytics",
        "automacao",
        "automação",
        "nlp",
        "rag",
    )
    non_target_terms: tuple[str, ...] = (
        "frontend",
        "react",
        "angular",
        "ios",
        "android",
        "mobile",
        "php",
        "ruby on rails",
        "java",
        "spring",
        ".net",
        "dotnet",
        "c#",
        "golang",
        "go developer",
        "node.js",
        "nodejs",
        "typescript",
    )


@dataclass(frozen=True, slots=True)
class EmbeddingAnchors:
    python_primary_positive: tuple[str, ...] = (
        (
            "Backend Python puro, APIs, Flask, FastAPI, Django, Pytest, "
            "servicos em Python, arquitetura backend e manutencao de APIs."
        ),
        (
            "Vaga de software engineer backend com Python como linguagem principal, "
            "modelagem de servicos, testes com pytest e ownership de APIs."
        ),
    )
    python_primary_negative: tuple[str, ...] = (
        (
            "Python usado apenas para LLM, IA generativa, automacoes isoladas, "
            "notebooks, analytics e apoio secundario fora do backend principal."
        ),
        (
            "Vaga focada em frontend, mobile, Java, Node ou stack principal sem "
            "Python central no backend."
        ),
    )
    databases_positive: tuple[str, ...] = (
        (
            "Projetos com SQL, PostgreSQL, NoSQL, modelagem de dados, query tuning, "
            "indexes, performance e troubleshooting de banco."
        ),
    )
    cloud_devops_positive: tuple[str, ...] = (
        (
            "Times com Docker, containers, deploy, CI/CD, cloud, pipelines, "
            "observabilidade e troubleshooting em AWS, GCP ou Azure."
        ),
    )
    benefits_positive: tuple[str, ...] = (
        (
            "Beneficios valorizados: vale refeicao, vale alimentacao, beneficio "
            "flexivel e cartao Caju."
        ),
    )


@dataclass(frozen=True, slots=True)
class JobScoringConfig:
    weights: ScoreWeights = field(default_factory=ScoreWeights)
    text_profile: TextProfile = field(default_factory=TextProfile)
    embedding_anchors: EmbeddingAnchors = field(default_factory=EmbeddingAnchors)
    suspicious_score_threshold: float = 72.0
    suspicious_python_floor: float = 18.0
    suspicious_penalty_threshold: float = 8.0


DEFAULT_JOB_SCORING_CONFIG = JobScoringConfig()
