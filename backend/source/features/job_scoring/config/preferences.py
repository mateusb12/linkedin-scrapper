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
        "python backend engineer",
        "python backend developer",
        "python backend",
        "backend python",
        "back end",
        "back-end",
    )
    backend_title_terms: tuple[str, ...] = (
        "backend",
        "back end",
        "back-end",
        "api",
        "apis",
        "python engineer",
        "python developer",
        "desenvolvedor python",
        "software engineer python",
    )
    mixed_stack_terms: tuple[str, ...] = (
        "fullstack",
        "full stack",
        "full-stack",
        "react",
        "reactjs",
        "next js",
        "next.js",
        "javascript",
        "typescript",
        "frontend",
        "front end",
        "front-end",
        "html",
        "css",
        "ui",
        "design system",
        "tailwind",
        "nodejs",
        "node.js",
    )
    platform_terms: tuple[str, ...] = (
        "odoo",
        "erp",
        "sap",
        "sistemas internos",
        "internal systems",
        "plataforma interna",
        "internal platform",
    )
    frontend_core_terms: tuple[str, ...] = (
        "frontend",
        "front end",
        "front-end",
        "react",
        "reactjs",
        "next js",
        "next.js",
        "typescript",
        "javascript",
        "html",
        "css",
        "ui",
        "design system",
        "tailwind",
        "ssr",
        "ssg",
        "redux",
        "zustand",
        "react query",
    )
    data_platform_terms: tuple[str, ...] = (
        "data engineer",
        "data engineering",
        "data platform",
        "analytics engineer",
        "platform engineer",
        "data ingestion",
        "ingestion",
        "connectors",
        "connector",
        "normalization",
        "processing",
        "processing pipelines",
        "data pipelines",
        "pipeline",
        "pipelines",
        "collection",
        "media ingestion",
        "external integrations",
        "integrations",
        "large volumes of data",
    )
    ai_core_terms: tuple[str, ...] = (
        "llm",
        "prompt engineering",
        "generative ai",
        "genai",
        "artificial intelligence",
        "machine learning",
        "rag",
        "nlp",
        "ai workflows",
        "agentic systems",
    )
    ai_evaluation_terms: tuple[str, ...] = (
        "train ai models",
        "training ai models",
        "train ai systems",
        "ai generated code",
        "ai-generated code",
        "ai code reviewer",
        "code reviewer",
        "improve ai responses",
        "evaluate ai outputs",
        "review model responses",
        "review ai generated code",
        "review ai generated python code",
        "evaluate ai generated code",
        "provide structured feedback",
        "structured feedback",
        "answer programming related questions",
        "answer computer science questions",
        "grade model responses",
        "explain technical concepts",
        "explain programming concepts",
        "annotation",
        "annotator",
        "labeling",
        "labeler",
        "rater",
        "grader",
        "evaluator",
        "human feedback",
        "rlhf",
        "model evaluation",
        "response evaluation",
    )
    ai_evaluation_support_terms: tuple[str, ...] = (
        "review",
        "evaluate",
        "evaluation",
        "feedback",
        "grading",
        "rate",
        "rating",
        "questions",
        "responses",
        "explain",
        "accuracy",
        "best practices",
    )
    contractor_style_terms: tuple[str, ...] = (
        "project based",
        "project-based",
        "task based",
        "task-based",
        "asynchronous",
        "flexible hours",
        "flexible schedule",
        "independent contractor",
        "contractor",
        "hourly compensation",
        "hourly payment",
        "hourly rate",
        "weekly payout",
        "paid weekly",
        "hours per week",
    )
    engineering_ownership_terms: tuple[str, ...] = (
        "build backend services",
        "backend services",
        "design apis",
        "implement apis",
        "maintain apis",
        "build apis",
        "own production systems",
        "production systems",
        "production support",
        "service ownership",
        "feature delivery",
        "roadmap execution",
        "system architecture",
        "scalability",
        "reliability",
        "observability",
        "deploy services",
        "operate services",
        "monitor services",
        "microservices",
        "distributed systems",
        "database design",
        "cloud infrastructure",
        "ci cd",
        "ci/cd",
        "incident response",
        "on call",
        "on-call",
    )
    responsibility_verbs: tuple[str, ...] = (
        "build",
        "develop",
        "design",
        "ship",
        "own",
        "maintain",
        "evolve",
        "operate",
        "implement",
        "trabalhar",
        "desenvolver",
        "projetar",
        "atuar",
        "manter",
        "construir",
    )
    adjacent_context_terms: tuple[str, ...] = (
        "nice to have",
        "nice-to-have",
        "diferencial",
        "diferenciais",
        "desejavel",
        "desejaveis",
        "plus",
        "bonus",
        "exposure",
        "familiarity",
        "knowledge of",
        "conhecimento em",
        "conhecimento de",
        "colaborar",
        "collaborate",
        "collaboration",
        "times",
        "team",
        "teams",
        "multidisciplinares",
        "cross functional",
        "cross-functional",
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
        "vale alimentacao refeicao",
        "vale refeicao alimentacao",
        "alimentacao refeicao",
        "beneficio flexivel",
        "benefício flexível",
        "cartao flexivel",
        "cartão flexível",
        "va vr",
        "vr va",
        "vr",
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
