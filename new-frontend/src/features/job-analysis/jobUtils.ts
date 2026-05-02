// Tipos auxiliares
export type Experience = {
    min: number;
    max: number | null;
    text: string;
};

export type Seniority = "Sênior" | "Pleno" | "Júnior" | "Estágio";
export type JobType = "Full-stack" | "Backend" | "Frontend";

// IMPORT DE ASSETS (funciona com Vite/webpack se tiver declaration para imagens)
import pythonIcon from "../../assets/skills/_python.png";
import javaIcon from "../../assets/skills/java.png";
import sqlIcon from "../../assets/skills/sql.png";
import javascriptIcon from "../../assets/skills/javascript.png";
import typescriptIcon from "../../assets/skills/typescript.png";
import phpIcon from "../../assets/skills/php.png";
import goIcon from "../../assets/skills/go.svg";
import cplusIcon from "../../assets/skills/c-plus.svg";

import djangoIcon from "../../assets/skills/django.png";
import azureIcon from "../../assets/skills/azure.png";
import googleCloudIcon from "../../assets/skills/google-cloud.png";
import kubernetesIcon from "../../assets/skills/kubernetes.png";
import linuxIcon from "../../assets/skills/linux.png";
import dockerIcon from "../../assets/skills/docker.png";

import reactIcon from "../../assets/skills/react.png";
import nodejsIcon from "../../assets/skills/nodejs.png";
import nextjsIcon from "../../assets/skills/nextjs.png";
import reactnativeIcon from "../../assets/skills/react-native.png";
import vueIcon from "../../assets/skills/vue.svg";

import awsIcon from "../../assets/skills/aws.png";
import gitIcon from "../../assets/skills/git.png";
import mysqlIcon from "../../assets/skills/mysql.png";
import postgresIcon from "../../assets/skills/postgres.png";
import redisIcon from "../../assets/skills/redis.svg";
import oracleIcon from "../../assets/skills/oracle.svg";

import flaskIcon from "../../assets/skills/flask.png";
import fastapiIcon from "../../assets/skills/fastapi.svg";
import pandasIcon from "../../assets/skills/pandas.png";

import kafkaIcon from "../../assets/skills/kafka.svg";
import rabbitIcon from "../../assets/skills/rabbit.svg";
import terraformIcon from "../../assets/skills/terraform.svg";

import llmIcon from "../../assets/skills/llm.png";
import langchainIcon from "../../assets/skills/langchain.svg";
import geminiIcon from "../../assets/skills/gemini.svg";
import langflowIcon from "../../assets/skills/langflow.svg";
import langgraphIcon from "../../assets/skills/langgraph.svg";
import csharpIcon from "../../assets/skills/csharp.svg";
import dotnetIcon from "../../assets/skills/dotnet.svg";
import apiIcon from "../../assets/skills/api.png";
import backendIcon from "../../assets/skills/backend.png";
import frontendIcon from "../../assets/skills/frontend.png";
import fullstackIcon from "../../assets/skills/frontend_dev.png";
import cloudIcon from "../../assets/skills/cloud.png";
import serverIcon from "../../assets/skills/server.png";
import databaseIcon from "../../assets/skills/database.png";
import dataAnalysisIcon from "../../assets/skills/data-analysis.png";
import machineLearningIcon from "../../assets/skills/machine-learning.png";
import mongoIcon from "../../assets/skills/mongo.svg";
import sqliteIcon from "../../assets/skills/sqlite.svg";
import supabaseIcon from "../../assets/skills/supabase.png";
import firebaseIcon from "../../assets/skills/firebase.png";
import s3Icon from "../../assets/skills/s3.svg";
import celeryIcon from "../../assets/skills/celery.png";
import clickhouseIcon from "../../assets/skills/clickhouse.svg";
import elasticsearchIcon from "../../assets/skills/elastic-search.svg";
import grafanaIcon from "../../assets/skills/grafana.svg";
import grafanaLokiIcon from "../../assets/skills/grafana-loki.png";
import pytestIcon from "../../assets/skills/pytest.svg";
import cypressIcon from "../../assets/skills/cypress.svg";
import playwrightIcon from "../../assets/skills/playwright.svg";
import graphqlIcon from "../../assets/skills/graphql.svg";
import figmaIcon from "../../assets/skills/figma.svg";
import openapiIcon from "../../assets/skills/open-api.svg";
import swaggerIcon from "../../assets/skills/swagger.svg";
import lighthouseIcon from "../../assets/skills/lighthouse.svg";
import jwtIcon from "../../assets/skills/jwt.png";
import oauth2Icon from "../../assets/skills/oauth2.png";
import securityIcon from "../../assets/skills/security.png";
import seleniumIcon from "../../assets/skills/selenium.svg";
import htmlIcon from "../../assets/skills/html.svg";
import cssIcon from "../../assets/skills/css.svg";
import expressIcon from "../../assets/skills/express.svg";
import tailwindIcon from "../../assets/skills/tailwind.svg";
import viteIcon from "../../assets/skills/vite.svg";
import eslintIcon from "../../assets/skills/eslint.svg";
import ejsIcon from "../../assets/skills/ejs.png";
import numpyIcon from "../../assets/skills/numpy.png";
import scipyIcon from "../../assets/skills/scipy.svg";
import scikitLearnIcon from "../../assets/skills/scikit-learn.svg";
import matplotlibIcon from "../../assets/skills/matplotlib.png";
import seabornIcon from "../../assets/skills/seaborn.png";
import networkxIcon from "../../assets/skills/networkx.png";
import spacyIcon from "../../assets/skills/spacy.png";
import nlpIcon from "../../assets/skills/nlp.png";
import httpIcon from "../../assets/skills/http.png";
import websocketIcon from "../../assets/skills/websocket.svg";
import githubActionsIcon from "../../assets/skills/github-actions.svg";
import pm2Icon from "../../assets/skills/pm2.svg";
import alembicIcon from "../../assets/skills/alembic.png";
import poetryIcon from "../../assets/skills/poetry.png";

export const extractExperienceFromDescription = (
    description?: string | null,
): Experience | null => {
    if (!description) return null;

    const regex =
        /(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s*(?:\+|plus|\s*mais)?\s*(?:years?|yrs?|anos?)\b/gi;

    const matches = [...description.matchAll(regex)];
    if (matches.length === 0) return null;

    const candidates = matches
        .map((m) => {
            const min = parseInt(m[1], 10);
            const max = m[2] ? parseInt(m[2], 10) : null;
            return {min, max, fullMatch: m[0]};
        })
        .filter((item) => item.min > 0 && item.min <= 20);

    if (candidates.length === 0) return null;

    const bestMatch = candidates.reduce((prev, current) =>
        prev.min > current.min ? prev : current,
    );

    return {
        min: bestMatch.min,
        max: bestMatch.max,
        text: bestMatch.fullMatch,
    };
};

export type JobAgeMeta = {
    label: string;
    totalDays: number | null;
    tone: "green" | "amber" | "red" | "slate";
};

export const getJobAgeMeta = (postedAt?: string | null): JobAgeMeta => {
    if (!postedAt) {
        return {
            label: "N/A",
            totalDays: null,
            tone: "slate",
        };
    }

    const date = new Date(postedAt);

    if (Number.isNaN(date.getTime())) {
        return {
            label: "N/A",
            totalDays: null,
            tone: "slate",
        };
    }

    const diffMs = Math.max(0, Date.now() - date.getTime());
    const totalMinutes = Math.floor(diffMs / 60_000);
    const totalHours = Math.floor(diffMs / 3_600_000);
    const totalDays = Math.floor(diffMs / 86_400_000);

    const months = Math.floor(totalDays / 30);
    const days = totalDays % 30;

    const label =
        totalDays === 0
            ? totalHours > 0
                ? `${totalHours}h`
                : `${Math.max(1, totalMinutes)}m`
            : months > 0 && days > 0
                ? `${months}m${days}d`
                : months > 0
                    ? `${months}m`
                    : `${days}d`;

    const tone =
        totalDays <= 3
            ? "green"
            : totalDays <= 14
                ? "amber"
                : "red";

    return {
        label,
        totalDays,
        tone,
    };
};

// Tipagem forte do map de ícones
const techIconsMap: Record<string, string> = {
    Python: pythonIcon,
    Java: javaIcon,
    "C++": cplusIcon,
    SQL: sqlIcon,
    JavaScript: javascriptIcon,
    TypeScript: typescriptIcon,
    PHP: phpIcon,
    Go: goIcon,

    Django: djangoIcon,
    FastAPI: fastapiIcon,
    Redis: redisIcon,
    Vue: vueIcon,
    Oracle: oracleIcon,
    Azure: azureIcon,
    GCP: googleCloudIcon,
    "Google Cloud": googleCloudIcon,
    "Google Cloud Platform": googleCloudIcon,
    Kubernetes: kubernetesIcon,
    Linux: linuxIcon,
    Docker: dockerIcon,
    React: reactIcon,
    "Next.js": nextjsIcon,
    "Node.js": nodejsIcon,
    NextJS: nextjsIcon,
    AWS: awsIcon,
    "AWS Lambda": awsIcon,
    "API Gateway": awsIcon,
    DynamoDB: awsIcon,
    "S3": s3Icon,
    SQS: awsIcon,
    SNS: awsIcon,
    ECS: awsIcon,
    CloudFormation: awsIcon,
    Git: gitIcon,
    MySQL: mysqlIcon,
    "React Native": reactnativeIcon,
    LLM: llmIcon,
    Flask: flaskIcon,
    Pandas: pandasIcon,
    "Celery": celeryIcon,
    PostgreSQL: postgresIcon,
    RabbitMQ: rabbitIcon,
    Kafka: kafkaIcon,
    Terraform: terraformIcon,
    LangChain: langchainIcon,
    Gemini: geminiIcon,
    LangFlow: langflowIcon,
    LangGraph: langgraphIcon,
    "Django REST Framework": djangoIcon,
    "ClickHouse": clickhouseIcon,
    "Elasticsearch": elasticsearchIcon,
    "Sentry": securityIcon,
    "Grafana": grafanaIcon,
    "Loki": grafanaLokiIcon,
    "Tempo": grafanaIcon,
    "Mimir": grafanaIcon,
    PEP8: pythonIcon,
    Flake8: pythonIcon,
    "Pytest": pytestIcon,
    "Claude Code": llmIcon,
    Cursor: llmIcon,
    "Cypress": cypressIcon,
    "Playwright": playwrightIcon,
    "GraphQL": graphqlIcon,
    "Figma": figmaIcon,
    "OpenAPI": openapiIcon,
    "DRF Spectacular": openapiIcon,
    "Django Debug Toolbar": djangoIcon,
    "Lighthouse": lighthouseIcon,
    "Web Vitals": lighthouseIcon,
    "C#": csharpIcon,
    ".NET": dotnetIcon,
    "ASP.NET": dotnetIcon,
    "ASP.NET Core": dotnetIcon,
    "Entity Framework": dotnetIcon,
    "API": apiIcon,
    "REST": apiIcon,
    "REST API": apiIcon,
    "HTTP": httpIcon,
    "WebSocket": websocketIcon,
    "WebSockets": websocketIcon,
    "JWT": jwtIcon,
    "OAuth": oauth2Icon,
    "OAuth2": oauth2Icon,
    "Swagger": swaggerIcon,
    "Backend": backendIcon,
    "Frontend": frontendIcon,
    "Full Stack": fullstackIcon,
    "Serverless": cloudIcon,
    "SOAP": apiIcon,
    "Microservices": serverIcon,
    "Data pipeline": dataAnalysisIcon,
    "Data Pipeline": dataAnalysisIcon,
    "Data Analysis": dataAnalysisIcon,
    "Machine Learning": machineLearningIcon,
    "ML": machineLearningIcon,
    "NoSQL": databaseIcon,
    "MongoDB": mongoIcon,
    "Mongo": mongoIcon,
    "SQLite": sqliteIcon,
    "Supabase": supabaseIcon,
    "Firebase": firebaseIcon,
    "Selenium": seleniumIcon,
    "HTML": htmlIcon,
    "CSS": cssIcon,
    "Express": expressIcon,
    "Express.js": expressIcon,
    "Tailwind": tailwindIcon,
    "Tailwind CSS": tailwindIcon,
    "Vite": viteIcon,
    "ESLint": eslintIcon,
    "EJS": ejsIcon,
    "NumPy": numpyIcon,
    "SciPy": scipyIcon,
    "Scikit-learn": scikitLearnIcon,
    "Scikit Learn": scikitLearnIcon,
    "Matplotlib": matplotlibIcon,
    "Seaborn": seabornIcon,
    "NetworkX": networkxIcon,
    "spaCy": spacyIcon,
    "NLP": nlpIcon,
    "GitHub Actions": githubActionsIcon,
    "CI/CD": githubActionsIcon,
    "PM2": pm2Icon,
    "Alembic": alembicIcon,
    "Poetry": poetryIcon,
    "Agentic AI": llmIcon,

};

const TECH_LABEL_ALIASES: Record<string, string> = {
    api: "API",
    gcp: "GCP",
    "google cloud": "GCP",
    "google cloud platform": "GCP",
    aws: "AWS",
    "amazon web services": "AWS",
    "aws lambda": "AWS Lambda",
    "api gateway": "API Gateway",
    "aws api gateway": "API Gateway",
    dynamodb: "DynamoDB",
    "dynamo db": "DynamoDB",
    s3: "S3",
    "aws s3": "S3",
    sqs: "SQS",
    "aws sqs": "SQS",
    sns: "SNS",
    "aws sns": "SNS",
    ecs: "ECS",
    "aws ecs": "ECS",
    cloudformation: "CloudFormation",
    "cloud formation": "CloudFormation",
    serverless: "Serverless",
    soap: "SOAP",
    "soap service": "SOAP",
    "soap services": "SOAP",
    microservice: "Microservices",
    microservices: "Microservices",
    terraform: "Terraform",
    tdd: "TDD",
    "test driven development": "TDD",
    ddd: "DDD",
    "domain driven design": "DDD",
    lambda: "AWS Lambda",
    azure: "Azure",
    "c#": "C#",
    csharp: "C#",
    "c sharp": "C#",
    "c plus plus": "C++",
    cplusplus: "C++",
    cpp: "C++",
    "c++": "C++",
    net: ".NET",
    dotnet: ".NET",
    "dot net": ".NET",
    "net core": ".NET",
    "net framework": ".NET",
    "asp net": "ASP.NET",
    aspnet: "ASP.NET",
    "asp net core": "ASP.NET Core",
    aspnetcore: "ASP.NET Core",
    "entity framework": "Entity Framework",
    entityframework: "Entity Framework",
    "entity framework core": "Entity Framework",
    "ef core": "Entity Framework",
    postgres: "PostgreSQL",
    postgresql: "PostgreSQL",
    mysql: "MySQL",
    node: "Node.js",
    nodejs: "Node.js",
    "node.js": "Node.js",
    golang: "Go",
    go: "Go",
    rails: "Ruby",
    "ruby on rails": "Ruby",
    ruby: "Ruby",
    "node js": "Node.js",
    nextjs: "Next.js",
    "next.js": "Next.js",
    "next js": "Next.js",
    backend: "Backend",
    django: "Django",
    docker: "Docker",
    fastapi: "FastAPI",
    flask: "Flask",
    frontend: "Frontend",
    gemini: "Gemini",
    git: "Git",
    java: "Java",
    javascript: "JavaScript",
    kafka: "Kafka",
    kubernetes: "Kubernetes",
    langchain: "LangChain",
    linux: "Linux",
    llm: "LLM",
    "no sql": "NoSQL",
    nosql: "NoSQL",
    "lang graph": "LangGraph",
    langgraph: "LangGraph",
    "lang flow": "LangFlow",
    langflow: "LangFlow",
    "large language models": "LLM",
    "large language model": "LLM",
    llms: "LLM",
    oracle: "Oracle",
    pandas: "Pandas",
    php: "PHP",
    python: "Python",
    rabbitmq: "RabbitMQ",
    react: "React",
    "react native": "React Native",
    reactnative: "React Native",
    redis: "Redis",
    remote: "Remote",
    sql: "SQL",
    typescript: "TypeScript",
    vue: "Vue",
    "full stack": "Full Stack",
    fullstack: "Full Stack",
    "full-stack": "Full Stack",
    "data pipeline": "Data pipeline",
    "data pipelines": "Data pipeline",
    celery: "Celery",
    drf: "Django REST Framework",
    "django rest framework": "Django REST Framework",
    sentry: "Sentry",
    grafana: "Grafana",
    "grafana stack": "Grafana",
    lgtm: "Grafana",
    "lgtm stack": "Grafana",
    loki: "Loki",
    tempo: "Tempo",
    mimir: "Mimir",
    clickhouse: "ClickHouse",
    "click house": "ClickHouse",
    elasticsearch: "Elasticsearch",
    "elastic search": "Elasticsearch",
    pep8: "PEP8",
    "pep 8": "PEP8",
    flake8: "Flake8",
    "flake 8": "Flake8",
    pytest: "Pytest",
    "claude code": "Claude Code",
    cursor: "Cursor",
    cypress: "Cypress",
    playwright: "Playwright",
    graphql: "GraphQL",
    "graph ql": "GraphQL",
    figma: "Figma",
    "openapi": "OpenAPI",
    "open api": "OpenAPI",
    "drf spectacular": "DRF Spectacular",
    "django debug toolbar": "Django Debug Toolbar",
    lighthouse: "Lighthouse",
    "web vitals": "Web Vitals",
    "agentic ai": "Agentic AI",
    "rest": "REST",
    "rest api": "REST API",
    "api rest": "REST API",
    "restful api": "REST API",
    "restful apis": "REST API",
    "http": "HTTP",
    "https": "HTTP",
    "websocket": "WebSocket",
    "websockets": "WebSocket",
    "web socket": "WebSocket",
    "web sockets": "WebSocket",
    "jwt": "JWT",
    "json web token": "JWT",
    "json web tokens": "JWT",
    "oauth": "OAuth",
    "oauth2": "OAuth2",
    "oauth 2": "OAuth2",
    "swagger": "Swagger",
    "mongodb": "MongoDB",
    "mongo": "MongoDB",
    "sqlite": "SQLite",
    "sqlite3": "SQLite",
    "supabase": "Supabase",
    "firebase": "Firebase",
    "machine learning": "Machine Learning",
    "ml": "Machine Learning",
    "data analysis": "Data Analysis",
    "data analytics": "Data Analysis",
    "selenium": "Selenium",
    "html": "HTML",
    "html5": "HTML",
    "css": "CSS",
    "css3": "CSS",
    "express": "Express",
    "expressjs": "Express.js",
    "express js": "Express.js",
    "express.js": "Express.js",
    "tailwind": "Tailwind CSS",
    "tailwind css": "Tailwind CSS",
    "vite": "Vite",
    "eslint": "ESLint",
    "ejs": "EJS",
    "numpy": "NumPy",
    "scipy": "SciPy",
    "scikit learn": "Scikit-learn",
    "scikit-learn": "Scikit-learn",
    "sklearn": "Scikit-learn",
    "matplotlib": "Matplotlib",
    "seaborn": "Seaborn",
    "networkx": "NetworkX",
    "network x": "NetworkX",
    "spacy": "spaCy",
    "nlp": "NLP",
    "natural language processing": "NLP",
    "github actions": "GitHub Actions",
    "github action": "GitHub Actions",
    "ci cd": "CI/CD",
    "ci/cd": "CI/CD",
    "cicd": "CI/CD",
    "pm2": "PM2",
    "alembic": "Alembic",
    "poetry": "Poetry",
    "swagger ui": "Swagger",

}

export const normalizeTechText = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[-_.]/g, " ")
        .replace(/\s+/g, " ")
        .trim()

export const formatTechLabel = (tech: string) => {
    const normalized = normalizeTechText(tech)

    return (
        TECH_LABEL_ALIASES[normalized] ??
        tech
            .trim()
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase())
    )
}

export const getTechIcon = (techName?: string | null): string | null => {
    if (!techName) return null

    const label = formatTechLabel(techName)
    const directIcon = techIconsMap[label]
    if (directIcon) return directIcon

    const alias = TECH_LABEL_ALIASES[normalizeTechText(techName)]

    return alias ? techIconsMap[alias] ?? null : null
};

const RUNTIME_KEYWORD_HINTS = [
    {label: "PostgreSQL", pattern: /\b(postgresql|postgres)\b/i},
    {label: "MySQL", pattern: /\bmysql\b/i},
    {label: "SQL", pattern: /\bsql\b/i},
    {label: "ClickHouse", pattern: /\bclick\s*house\b|\bclickhouse\b/i},
    {label: "Elasticsearch", pattern: /\belastic\s*search\b|\belasticsearch\b/i},
    {label: "C#", pattern: /(^|[^a-z0-9])(?:c\s*#|csharp|c\s+sharp)([^a-z0-9]|$)/i},
    {label: "ASP.NET Core", pattern: /(^|[^a-z0-9])(?:asp\s*\.?\s*net\s*core|aspnetcore)([^a-z0-9]|$)/i},
    {label: "ASP.NET", pattern: /(^|[^a-z0-9])(?:asp\s*\.?\s*net|aspnet)(?!\s*core)([^a-z0-9]|$)/i},
    {
        label: ".NET",
        pattern: /(^|[^a-z0-9])(?:asp\s*\.?\s*net|\.net|dot\s*net|dotnet|net\s+(?:core|framework|[0-9]))([^a-z0-9]|$)/i
    },
    {label: "Entity Framework", pattern: /\b(entity\s*framework(?:\s*core)?|entityframework|ef\s*core)\b/i},
    {label: "AWS Lambda", pattern: /\baws\s+lambda\b/i},
    {label: "API Gateway", pattern: /\b(?:aws\s+)?api\s+gateway\b/i},
    {label: "DynamoDB", pattern: /\b(?:dynamodb|dynamo\s*db)\b/i},
    {label: "S3", pattern: /\b(?:aws\s+)?s3\b/i},
    {label: "SQS", pattern: /\b(?:aws\s+)?sqs\b/i},
    {label: "SNS", pattern: /\b(?:aws\s+)?sns\b/i},
    {label: "ECS", pattern: /\b(?:aws\s+)?ecs\b/i},
    {label: "CloudFormation", pattern: /\b(?:cloudformation|cloud\s+formation)\b/i},
    {label: "Serverless", pattern: /\bserverless\b/i},
    {label: "SOAP", pattern: /\bsoap(?:\s+services?)?\b/i},
    {label: "Microservices", pattern: /\bmicroservices?\b/i},
    {label: "Terraform", pattern: /\bterraform\b/i},
    {label: "TDD", pattern: /\b(?:tdd|test[-\s]*driven\s+development)\b/i},
    {label: "DDD", pattern: /\b(?:ddd|domain[-\s]*driven\s+design)\b/i},
    {label: "AWS", pattern: /\b(aws|amazon web services)\b/i},
    {label: "GCP", pattern: /\b(gcp|google cloud|google cloud platform)\b/i},
    {label: "Azure", pattern: /\bazure\b/i},
    {label: "Python", pattern: /\bpython\b/i},
    {label: "LLM", pattern: /\b(?:llms?|large\s+language\s+models?)\b/i},
    {label: "Claude Code", pattern: /\bclaude\s+code\b/i},
    {label: "Cursor", pattern: /\bcursor\b/i},
    {label: "Agentic AI", pattern: /\bagentic\s+ai\b/i},
    {label: "LangFlow", pattern: /\blangflow\b/i},
    {label: "LangGraph", pattern: /\blanggraph\b/i},
    {label: "NoSQL", pattern: /\b(?:nosql|no\s*sql)\b/i},
    {label: "Java", pattern: /\bjava\b/i},
    {label: "C++", pattern: /(^|[^a-z0-9])(?:c\s*\+\s*\+|cpp|cplusplus|c\s+plus\s+plus)([^a-z0-9]|$)/i},
    {label: "Go", pattern: /\b(go|golang)\b/i},
    {label: "Ruby", pattern: /\b(ruby|ruby\s+on\s+rails|rails)\b/i},
    {label: "Django", pattern: /\bdjango\b/i},
    {label: "FastAPI", pattern: /\bfastapi\b/i},
    {label: "Flask", pattern: /\bflask\b/i},
    {label: "Django REST Framework", pattern: /\b(?:django\s+rest\s+framework|drf)\b/i},
    {label: "Celery", pattern: /\bcelery\b/i},
    {label: "React", pattern: /\breact\b/i},
    {label: "Vue", pattern: /\bvue(?:\.js)?\b/i},
    {label: "TypeScript", pattern: /\btypescript\b/i},
    {label: "JavaScript", pattern: /\bjavascript\b/i},
    {label: "Node.js", pattern: /\b(node\.js|nodejs|node)\b/i},
    {label: "Next.js", pattern: /\bnext(?:\.|\s)?js\b/i},
    {label: "Docker", pattern: /\bdocker\b/i},
    {label: "Kubernetes", pattern: /\b(kubernetes|k8s)\b/i},
    {label: "Kafka", pattern: /\bkafka\b/i},
    {label: "RabbitMQ", pattern: /\brabbitmq\b/i},
    {label: "Redis", pattern: /\bredis\b/i},
    {label: "Data pipeline", pattern: /\bdata pipelines?\b/i},
    {label: "Backend", pattern: /\b(back-end|backend)\b/i},
    {label: "Frontend", pattern: /\b(front-end|frontend)\b/i},
    {label: "Full Stack", pattern: /\b(full stack|fullstack|full-stack)\b/i},
    {label: "Remote", pattern: /\bremote\b/i},
    {label: "Hybrid", pattern: /\bhybrid\b/i},
    {label: "On-site", pattern: /\b(on-site|onsite|presential|presencial)\b/i},
    {label: "Senior", pattern: /\b(senior|sênior)\b/i},
    {label: "Pleno", pattern: /\b(pleno|mid level)\b/i},
    {label: "Junior", pattern: /\b(junior|júnior|entry)\b/i},
    {label: "Internship", pattern: /\b(intern|internship|estagio|estágio)\b/i},
    {label: "Sentry", pattern: /\bsentry\b/i},
    {label: "Grafana", pattern: /\b(?:grafana|grafana\s+stack|lgtm|lgtm\s+stack)\b/i},
    {label: "Loki", pattern: /\bloki\b/i},
    {label: "Tempo", pattern: /\btempo\b/i},
    {label: "Mimir", pattern: /\bmimir\b/i},
    {label: "PEP8", pattern: /\bpep\s*8\b/i},
    {label: "Flake8", pattern: /\bflake\s*8\b/i},
    {label: "Pytest", pattern: /\bpytest\b/i},
    {label: "Cypress", pattern: /\bcypress\b/i},
    {label: "Playwright", pattern: /\bplaywright\b/i},
    {label: "GraphQL", pattern: /\bgraph\s*ql\b|\bgraphql\b/i},
    {label: "Figma", pattern: /\bfigma\b/i},
    {label: "OpenAPI", pattern: /\bopen\s*api\b|\bopenapi\b/i},
    {label: "DRF Spectacular", pattern: /\bdrf\s+spectacular\b/i},
    {label: "Django Debug Toolbar", pattern: /\bdjango\s+debug\s+toolbar\b/i},
    {label: "Lighthouse", pattern: /\blighthouse\b/i},
    {label: "Web Vitals", pattern: /\bweb\s+vitals\b/i},
    {label: "MongoDB", pattern: /\b(?:mongodb|mongo\s*db|mongo)\b/i},
    {label: "SQLite", pattern: /\bsqlite(?:3)?\b/i},
    {label: "Supabase", pattern: /\bsupabase\b/i},
    {label: "Firebase", pattern: /\bfirebase\b/i},
    {label: "REST API", pattern: /\brest(?:ful)?\s+apis?\b|\bapis?\s+rest\b/i},
    {label: "HTTP", pattern: /\bhttps?\b/i},
    {label: "WebSocket", pattern: /\bweb\s*sockets?\b|\bwebsockets?\b/i},
    {label: "JWT", pattern: /\b(?:jwt|json\s+web\s+tokens?)\b/i},
    {label: "OAuth2", pattern: /\boauth\s*2\b|\boauth2\b|\boauth\b/i},
    {label: "Swagger", pattern: /\bswagger(?:\s+ui)?\b/i},
    {label: "Selenium", pattern: /\bselenium\b/i},
    {label: "HTML", pattern: /\bhtml5?\b/i},
    {label: "CSS", pattern: /\bcss3?\b/i},
    {label: "Express.js", pattern: /\bexpress(?:\.js|\s+js|js)?\b/i},
    {label: "Tailwind CSS", pattern: /\btailwind(?:\s+css)?\b/i},
    {label: "Vite", pattern: /\bvite\b/i},
    {label: "ESLint", pattern: /\beslint\b/i},
    {label: "EJS", pattern: /\bejs\b/i},
    {label: "NumPy", pattern: /\bnumpy\b/i},
    {label: "SciPy", pattern: /\bscipy\b/i},
    {label: "Scikit-learn", pattern: /\b(?:scikit[-\s]?learn|sklearn)\b/i},
    {label: "Matplotlib", pattern: /\bmatplotlib\b/i},
    {label: "Seaborn", pattern: /\bseaborn\b/i},
    {label: "NetworkX", pattern: /\bnetwork\s*x\b|\bnetworkx\b/i},
    {label: "spaCy", pattern: /\bspacy\b/i},
    {label: "NLP", pattern: /\b(?:nlp|natural\s+language\s+processing)\b/i},
    {label: "GitHub Actions", pattern: /\bgithub\s+actions?\b/i},
    {label: "CI/CD", pattern: /\b(?:ci\s*\/\s*cd|ci\s+cd|cicd)\b/i},
    {label: "PM2", pattern: /\bpm2\b/i},
    {label: "Alembic", pattern: /\balembic\b/i},
    {label: "Poetry", pattern: /\bpoetry\b/i},

]

type RuntimeJobKeywordsSource = {
    title?: string | null
    description?: string | null
    description_full?: string | null
    description_snippet?: string | null
    premium_title?: string | null
    premium_description?: string | null
    jobType?: string | null
    seniority?: string | null
    location?: string | null
    keywords?: string[] | null
}

const dedupeKeywordLabels = (keywords: string[]) => {
    const keywordMap = new Map<string, string>()

    keywords.forEach((item) => {
        const label = formatTechLabel(item)
        const key = normalizeTechText(label)

        if (key && key !== "not specified" && !keywordMap.has(key)) {
            keywordMap.set(key, label)
        }
    })

    return [...keywordMap.values()]
}

export const extractRuntimeJobKeywordsFromText = (text: string): string[] =>
    dedupeKeywordLabels(
        RUNTIME_KEYWORD_HINTS
            .filter((hint) => hint.pattern.test(text))
            .map((hint) => hint.label),
    )

export const getRuntimeJobKeywords = (jobLike: RuntimeJobKeywordsSource) => {
    const searchableText = [
        jobLike.title,
        jobLike.description,
        jobLike.description_full,
        jobLike.description_snippet,
        jobLike.premium_title,
        jobLike.premium_description,
        jobLike.jobType,
        jobLike.seniority,
        jobLike.location,
    ]
        .filter(Boolean)
        .join(" ")

    return dedupeKeywordLabels([
        ...(jobLike.keywords ?? []),
        ...extractRuntimeJobKeywordsFromText(searchableText),
    ])
}

const ROLE_SIGNAL_KEYWORDS = new Set([
    "backend",
    "frontend",
    "remote",
    "hybrid",
    "on site",
    "on-site",
    "onsite",
    "presential",
    "presencial",
    "full stack",
    "fullstack",
    "full-stack",
    "platform",
    "data pipeline",
    "data pipelines",
    "data engineering",
    "data engineer",
    "serverless",
    "microservice",
    "microservices",
    "tdd",
    "test driven development",
    "test-driven development",
    "ddd",
    "domain driven design",
    "domain-driven design",
    "qa",
    "qa automation",
    "automation",
    "mobile",
    "junior",
    "júnior",
    "pleno",
    "mid level",
    "senior",
    "sênior",
    "intern",
    "internship",
    "estagio",
    "estágio",
])

const HIDDEN_JOB_KEYWORDS = new Set([
    "api",
    "apis",
    "etl",
    "task queue",
    "task queues",
    "async",
    "async processing",
    "machine learning",
    "ml",
    "cloud",
    "agentes conversacionais",
    "conversational agents",
    "multiagentes",
    "multiagente",
    "multiagent",
    "multi-agent",
    "multi agent",
    "agentic ai",
    "ia generativa",
    "gen ai",
    "generative ai",
])

export const isRoleSignalKeyword = (keyword: string) => {
    const normalizedKeyword = normalizeTechText(keyword)
    const normalizedLabel = normalizeTechText(formatTechLabel(keyword))

    return (
        ROLE_SIGNAL_KEYWORDS.has(normalizedKeyword) ||
        ROLE_SIGNAL_KEYWORDS.has(normalizedLabel)
    )
}

export const splitStackAndRoleSignals = (
    keywords: string[],
    seniority?: string | null,
): { stackKeywords: string[]; roleSignals: string[] } => {
    const cleanKeywords = dedupeKeywordLabels(keywords).filter(
        (item) => !HIDDEN_JOB_KEYWORDS.has(normalizeTechText(item)),
    )

    const stackKeywords = cleanKeywords.filter(
        (item) => !isRoleSignalKeyword(item),
    )

    const roleSignals = dedupeKeywordLabels([
        ...cleanKeywords.filter(isRoleSignalKeyword),
        seniority ?? "",
    ]).filter((item) => {
        const normalized = normalizeTechText(item)

        return normalized !== "not specified" && !HIDDEN_JOB_KEYWORDS.has(normalized)
    })

    return {stackKeywords, roleSignals}
}

export const isPositiveKeywordMatch = (
    value: string,
    positiveKeywords: string[],
) => {
    const normalizedValue = normalizeTechText(value)
    const normalizedLabel = normalizeTechText(formatTechLabel(value))

    return positiveKeywords.some((keyword) => {
        const normalizedKeyword = normalizeTechText(keyword)

        return (
            normalizedKeyword === normalizedValue ||
            normalizedKeyword === normalizedLabel
        )
    })
}
