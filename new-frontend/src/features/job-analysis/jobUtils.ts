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

const NEGATIVE_KEYWORDS: string[] = [
    "rpa",
    "llm",
    "mcp",
    "rag",
    "n8n",
    "langchain",
    "lovable",
    "gemini",
    "oracle",
    "langgraph",
];

export const extractExperienceFromDescription = (
    description?: string | null,
): Experience | null => {
    if (!description) return null;

    const regex =
        /(\d+)(?:\s*[-–to]\s*(\d+))?\s*(?:\+|plus|\s*mais)?\s*(?:years?|yrs?|anos?)\b/gi;

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

export const getExperienceStyle = (experience: Experience | null): string => {
    if (!experience)
        return "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700";

    const minYears = experience.min ?? 0;

    if (minYears <= 4)
        return "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800";

    if (minYears <= 6)
        return "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800";

    return "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30 border-red-200 dark:border-red-800";
};

export const getCompetitionStyle = (applicants?: number | null): string => {
    if (applicants == null)
        return "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700";

    if (applicants < 117)
        return "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800";

    if (applicants < 468)
        return "text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800";

    if (applicants < 1820)
        return "text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800";

    return "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30 border-red-200 dark:border-red-800";
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

export const getTechIcon = (techName?: string | null): string | null => {
    if (!techName) return null;
    return techIconsMap[techName] ?? null;
};
