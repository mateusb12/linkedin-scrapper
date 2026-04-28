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
    SQL: sqlIcon,
    JavaScript: javascriptIcon,
    TypeScript: typescriptIcon,
    PHP: phpIcon,

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
    "Node.js": nodejsIcon,
    NextJS: nextjsIcon,
    AWS: awsIcon,
    Git: gitIcon,
    MySQL: mysqlIcon,
    "React Native": reactnativeIcon,
    LLM: llmIcon,
    Flask: flaskIcon,
    Pandas: pandasIcon,
    PostgreSQL: postgresIcon,
    RabbitMQ: rabbitIcon,
    Kafka: kafkaIcon,
    Terraform: terraformIcon,
    LangChain: langchainIcon,
    Gemini: geminiIcon,
};

const TECH_LABEL_ALIASES: Record<string, string> = {
    api: "API",
    gcp: "GCP",
    "google cloud": "GCP",
    "google cloud platform": "GCP",
    aws: "AWS",
    "amazon web services": "AWS",
    azure: "Azure",
    postgres: "PostgreSQL",
    postgresql: "PostgreSQL",
    mysql: "MySQL",
    node: "Node.js",
    nodejs: "Node.js",
    "node.js": "Node.js",
    nextjs: "NextJS",
    "next.js": "NextJS",
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
    terraform: "Terraform",
    typescript: "TypeScript",
    vue: "Vue",
    "full stack": "Full Stack",
    fullstack: "Full Stack",
    "full-stack": "Full Stack",
    "data pipeline": "Data pipeline",
    "data pipelines": "Data pipeline",
}

export const normalizeTechText = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[-_.]/g, " ")
        .replace(/\s+/g, " ")

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
    {label: "AWS", pattern: /\b(aws|amazon web services)\b/i},
    {label: "GCP", pattern: /\b(gcp|google cloud|google cloud platform)\b/i},
    {label: "Azure", pattern: /\bazure\b/i},
    {label: "Python", pattern: /\bpython\b/i},
    {label: "Django", pattern: /\bdjango\b/i},
    {label: "FastAPI", pattern: /\bfastapi\b/i},
    {label: "Flask", pattern: /\bflask\b/i},
    {label: "React", pattern: /\breact\b/i},
    {label: "TypeScript", pattern: /\btypescript\b/i},
    {label: "JavaScript", pattern: /\bjavascript\b/i},
    {label: "Node.js", pattern: /\b(node\.js|nodejs|node)\b/i},
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
    "nosql",
    "etl",
    "task queue",
    "task queues",
    "async",
    "async processing",
    "machine learning",
    "ml",
    "cloud",
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
