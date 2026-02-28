import pythonIcon from "../../../assets/skills_icons/_python.png";
import javaIcon from "../../../assets/skills_icons/java.png";
import sqlIcon from "../../../assets/skills_icons/sql.png";
import javascriptIcon from "../../../assets/skills_icons/javascript.png";
import typescriptIcon from "../../../assets/skills_icons/typescript.png";
import phpIcon from "../../../assets/skills_icons/php.png";
import djangoIcon from "../../../assets/skills_icons/django.png";
import azureIcon from "../../../assets/skills_icons/azure.png";
import kubernetesIcon from "../../../assets/skills_icons/kubernetes.png";
import linuxIcon from "../../../assets/skills_icons/linux.png";
import dockerIcon from "../../../assets/skills_icons/docker.png";
import reactIcon from "../../../assets/skills_icons/react.png";
import nodejsIcon from "../../../assets/skills_icons/nodejs.png";
import nextjsIcon from "../../../assets/skills_icons/nextjs.png";
import awsIcon from "../../../assets/skills_icons/aws.png";
import gitIcon from "../../../assets/skills_icons/git.png";
import mysqlIcon from "../../../assets/skills_icons/mysql.png";
import reactnativeIcon from "../../../assets/skills_icons/react-native.png";
import llmIcon from "../../../assets/skills_icons/llm.png";
import flaskIcon from "../../../assets/skills_icons/flask.png";
import pandasIcon from "../../../assets/skills_icons/pandas.png";
import postgresIcon from "../../../assets/skills_icons/postgres.png";
import rabbitIcon from "../../../assets/skills_icons/rabbit.svg";
import kafkaIcon from "../../../assets/skills_icons/kafka.svg";
import terraformIcon from "../../../assets/skills_icons/terraform.svg";

const NEGATIVE_KEYWORDS = [
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

export const extractExperienceFromDescription = (description) => {
  if (!description) {
    console.warn(
      "⚠️ extractExperience: Description is MISSING/NULL. Skipping regex.",
    );
    return null;
  }

  const snippet = description.slice(0, 40).replace(/\n/g, " ") + "...";

  const hasKeywords = /years?|anos?/i.test(description);

  const regex =
    /(\d+)(?:\s*[-–to]\s*(\d+))?\s*(?:\+|plus|\s*mais)?\s*(?:years?|yrs?|anos?)\b/gi;

  const matches = [...description.matchAll(regex)];

  if (matches.length === 0) {
    if (hasKeywords) {
      console.groupEnd();
    }
    return null;
  }

  const candidates = matches
    .map((m) => {
      const min = parseInt(m[1], 10);
      const max = m[2] ? parseInt(m[2], 10) : null;

      return { min, max, fullMatch: m[0] };
    })
    .filter((item) => {
      return item.min > 0 && item.min <= 20;
    });

  if (candidates.length === 0) {
    if (hasKeywords) {
      console.log("❌ Matches found, but all were filtered out.");
      console.groupEnd();
    }
    return null;
  }

  const bestMatch = candidates.reduce((prev, current) => {
    return prev.min > current.min ? prev : current;
  });

  if (hasKeywords) {
    console.groupEnd();
  }

  return {
    min: bestMatch.min,
    max: bestMatch.max,
    text: bestMatch.fullMatch,
  };
};

const formatCustomDate = (dateStr) => {
  if (!dateStr) return "N/A";

  const [year, month, day] = dateStr.split("-");

  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];

  return `${day}/${months[parseInt(month) - 1]}/${year}`;
};

export const getExperienceStyle = (experience) => {
  if (!experience)
    return "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700";

  const minYears = experience.min ?? 0;

  if (minYears <= 4)
    return "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800";

  if (minYears <= 6)
    return "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800";

  return "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30 border-red-200 dark:border-red-800";
};

export const getCompetitionStyle = (applicants) => {
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

export const cleanJobDescription = (rawText) => {
  if (!rawText) return "No description available.";

  const lines = rawText.replace(/\r\n/g, "\n").split("\n");

  const cleanedLines = [];

  let pendingBullet = false;
  let pendingBold = false;

  const garbageRegex = new RegExp(
    "^(div|ul|br|text-attr-\\d+|\\d+|about the job|start|end|open|collapsed|expanded|horizontal|vertical|small|normal|sans|h2|stringValue|bindableBoolean)$",
    "i",
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;

    if (line === "li") {
      pendingBullet = true;
      continue;
    }

    if (line === "strong") {
      pendingBold = true;
      continue;
    }

    if (garbageRegex.test(line)) {
      continue;
    }

    let currentText = line;

    if (pendingBold) {
      if (!currentText.startsWith("**")) {
        currentText = `**${currentText}**`;
      }
      pendingBold = false;
    }

    if (pendingBullet) {
      currentText = `- ${currentText}`;
      pendingBullet = false;
    } else if (/^[•·\-\*]\s/.test(currentText)) {
      currentText = currentText.replace(/^[•·\-\*]\s*/, "- ");
    }

    if (cleanedLines.length > 0) {
      const lastIndex = cleanedLines.length - 1;
      const lastLine = cleanedLines[lastIndex];

      const isCurrentBullet = currentText.startsWith("- ");
      const isCurrentHeader = currentText.startsWith("**");

      const lastLineEndsSentence = /[.!?:;]$/.test(lastLine);
      const lastLineIsHeader =
        lastLine.startsWith("**") && lastLine.endsWith("**");
      const lastLineIsBullet = lastLine.startsWith("- ");

      if (
        !lastLineEndsSentence &&
        !lastLineIsHeader &&
        !lastLineIsBullet &&
        !isCurrentBullet &&
        !isCurrentHeader
      ) {
        cleanedLines[lastIndex] = lastLine + " " + currentText;
      } else {
        if (isCurrentBullet && !lastLineIsBullet && lastLine !== "") {
          cleanedLines.push("");
        }

        if (isCurrentHeader && lastLine !== "") {
          cleanedLines.push("");
        }

        cleanedLines.push(currentText);
      }
    } else {
      cleanedLines.push(currentText);
    }
  }

  return cleanedLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ \./g, ".")
    .trim();
};

export const extractSeniorityFromDescription = (description) => {
  if (!description) return null;
  const text = description.toLowerCase();

  if (
    /\b(sênior|senior|sr\.?|spec|specialist|especialista|principal|lead|staff|architect|arquiteto)\b/i.test(
      text,
    )
  ) {
    return "Sênior";
  }

  if (/\b(pleno|mid|middle|mid-level|pl\.)\b/i.test(text)) {
    return "Pleno";
  }

  if (/\b(júnior|junior|jr\.?|entry-level|entry|iniciante)\b/i.test(text)) {
    return "Júnior";
  }

  if (/\b(estágio|estagiário|intern|internship|trainee)\b/i.test(text)) {
    return "Estágio";
  }

  return null;
};

export const extractJobTypeFromDescription = (fullText) => {
  if (!fullText) return null;

  let text = fullText.toLowerCase();

  text = text.replace(/phyton/g, "python");
  text = text.replace(/javascrpt|java script/g, "javascript");

  text = text.replace(
    /(collaborate|work|interface|integrate|support|liaise)\s+(with|closely\s+with)\s+(the\s+)?(front|back)-?end/g,
    " ",
  );

  if (/\b(full\s?-?stack|fullstack)\b/i.test(text)) {
    return "Full-stack";
  }

  if (
    /(backend\s*(,|ou|or|\/)\s*frontend)|(frontend\s*(,|ou|or|\/)\s*backend)/i.test(
      text,
    )
  ) {
    return "Full-stack";
  }

  let backendScore = 0;
  let frontendScore = 0;

  const titleChunk = text.slice(0, 150);
  const bodyChunk = text.slice(150);

  const scoreText = (txt, weight) => {
    const backendRegex =
      /\b(backend|back-end|python|java|go|golang|ruby|php|c#|rust|scala|elixir|nodejs|node\.js|\.net|api|apis|sql|mysql|postgres|docker|aws|cloud|microservices|data engineer|etl|spark|airflow)\b/g;
    const backendMatches = txt.match(backendRegex) || [];
    backendScore += backendMatches.length * weight;

    const frontendRegex =
      /\b(frontend|front-end|javascript|js|typescript|ts|react|vue|angular|svelte|next\.?js|html|css|ui\/ux|ui|ux|figma|styled|tailwind)\b/g;
    const frontendMatches = txt.match(frontendRegex) || [];
    frontendScore += frontendMatches.length * weight;
  };

  scoreText(titleChunk, 5);
  scoreText(bodyChunk, 1);

  if (backendScore > 5 && frontendScore > 5) {
    const ratio =
      Math.max(backendScore, frontendScore) /
      Math.min(backendScore, frontendScore);
    if (ratio < 1.3) {
      return "Full-stack";
    }
  }

  if (backendScore > frontendScore) return "Backend";
  if (frontendScore > backendScore) return "Frontend";

  if (/\b(python|java|go|ruby)\s+developer\b/.test(text)) return "Backend";
  if (/\b(react|vue|angular)\s+developer\b/.test(text)) return "Frontend";

  return null;
};

export const getSeniorityStyle = (seniority) => {
  switch (seniority) {
    case "Sênior":
      return "text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800";
    case "Pleno":
      return "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800";
    case "Júnior":
      return "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800";
    case "Estágio":
      return "text-teal-700 bg-teal-100 dark:text-teal-400 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800";
    default:
      return "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700";
  }
};

export const getTypeStyle = (type) => {
  switch (type) {
    case "Full-stack":
      return "text-indigo-700 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800";
    case "Backend":
      return "text-slate-700 bg-slate-200 dark:text-slate-300 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600";
    case "Frontend":
      return "text-pink-700 bg-pink-100 dark:text-pink-400 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800";
    default:
      return "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700";
  }
};

const foundationKeywords = {
  Python: /\bpython\b/i,
  JavaScript: /\b(javascript|js)\b/i,
  TypeScript: /\b(typescript|ts)\b/i,
  Java: /\bjava\b(?!script)/i,
  "C#": /\bc#\b|\b\.net\b/i,
  "C++": /\bc\+\+\b/i,
  Go: /\b(go|golang)\b/i,
  Ruby: /\bruby\b/i,
  PHP: /\bphp\b/i,
  Rust: /\brust\b/i,
  Swift: /\bswift\b/i,
  Kotlin: /\bkotlin\b/i,
  SQL: /\bsql\b/i,
};

const specificKeywords = {
  Django: /\bdjango\b/i,
  FastAPI: /\bfastapi\b/i,
  Flask: /\bflask\b/i,
  Pandas: /\bpandas\b/i,
  RPA: /\brpa\b/i,
  LLM: /\b(llm|llms|large language model|large language models|ia generativa)\b/i,
  RAG: /\b(rag|retrieval[-\s]?augmented generation)\b/i,
  MCP: /\b(mcp|model context protocol)\b/i,
  GenAI: /\b(genai|generative ai|generative artificial intelligence)\b/i,
  Kubernetes: /\bkubernetes|kubernets|k8s\b/i,
  Linux: /\blinux\b/i,
  N8N: /\bn8n\b/i,
  Lovable: /\blovable\b/i,
  Gemini: /\bgemini\b/i,
  Apache: /\bapache\b/i,
  Oracle: /\boracle\b/i,
  LangGraph: /\blanggraph\b/i,
  LangChain: /\blangchain\b/i,
  NumPy: /\bnumpy\b/i,
  Kafka: /\bkafka\b/i,
  RabbitMQ: /\brabbitmq\b/i,

  React: /\breact(?:\.js)?\b/i,
  "React Native": /\breact\s?native\b/i,
  Vue: /\bvue(?:\.js)?\b/i,
  Angular: /\bangular\b/i,
  "Node.js": /\bnode(?:\.?js)?\b/i,
  NextJS: /\bnext(?:\.?js)?\b/i,
  "Nest.js": /\bnest(?:\.?js)?\b/i,
  Express: /\bexpress(?:\.?js)?\b/i,
  Svelte: /\bsvelte\b/i,

  Spring: /\bspring\b/i,
  "Spring Boot": /\bspring\s?boot\b/i,
  Hibernate: /\bhibernate\b/i,

  PostgreSQL: /\bpostgre(?:sql|s)?\b/i,
  MySQL: /\bmysql\b/i,
  MongoDB: /\bmongo(?:db)?\b/i,
  Redis: /\bredis\b/i,

  AWS: /\baws\b|amazon web services/i,
  Azure: /\bazure\b/i,
  Docker: /\bdocker\b/i,
  Git: /\bgit\b/i,
  Terraform: /\bterraform\b/i,
};

export const extractFoundations = (description) => {
  if (!description) return [];

  const found = [];

  Object.entries(foundationKeywords).forEach(([techName, regex]) => {
    if (regex.test(description)) {
      found.push(techName);
    }
  });

  return found;
};

export const extractSpecifics = (description) => {
  if (!description) return [];

  const found = [];

  Object.entries(specificKeywords).forEach(([techName, regex]) => {
    if (regex.test(description)) {
      found.push(techName);
    }
  });

  return found.sort((a, b) => {
    const isANegative = NEGATIVE_KEYWORDS.includes(a.toLowerCase());
    const isBNegative = NEGATIVE_KEYWORDS.includes(b.toLowerCase());

    if (isANegative && !isBNegative) return -1;
    if (!isANegative && isBNegative) return 1;
    return 0;
  });
};

const RAINBOW_PALETTE = [
  "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20",
  "bg-pink-500/10 text-pink-400 border-pink-500/20 hover:bg-pink-500/20",
  "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20",
  "bg-yellow-400/10 text-yellow-300 border-yellow-400/20 hover:bg-yellow-400/20",
  "bg-cyan-500/10 text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/20",
];

export const getTechBadgeStyle = (index, techName = "") => {
  const name = techName ? techName.toLowerCase().trim() : "";

  if (NEGATIVE_KEYWORDS.includes(name)) {
    return "bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30 border transition-colors font-bold";
  }

  const categoryStyles = {
    backend:
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
    database:
      "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20",
    devops:
      "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20",
    tools:
      "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20",
  };

  const techMap = {
    django: "backend",
    fastapi: "backend",
    flask: "backend",
    spring: "backend",
    "spring boot": "backend",
    express: "backend",
    nest: "backend",
    "nest.js": "backend",
    laravel: "backend",
    dotnet: "backend",
    ".net": "backend",

    postgresql: "database",
    postgres: "database",
    mysql: "database",
    sql: "database",
    mongodb: "database",
    mongo: "database",
    redis: "database",
    sqlite: "database",
    supabase: "database",
    oracle: "database",

    docker: "devops",
    kubernetes: "devops",
    k8s: "devops",
    aws: "devops",
    azure: "devops",
    gcp: "devops",
    terraform: "devops",
    linux: "devops",
    bash: "devops",
    ci: "devops",
    cd: "devops",
    "ci/cd": "devops",

    git: "tools",
    github: "tools",
    gitlab: "tools",
    scrum: "tools",
    kanban: "tools",
    jira: "tools",
    agile: "tools",
    tdd: "tools",
    solid: "tools",
  };

  if (techMap[name]) {
    return `${categoryStyles[techMap[name]]} border transition-colors`;
  }

  const safeIndex = (index || 0) % RAINBOW_PALETTE.length;
  return `${RAINBOW_PALETTE[safeIndex]} border transition-colors`;
};

export const getPostedStyle = (postedText) => {
  if (!postedText) {
    return "text-gray-300 bg-gray-700/50 border-gray-600";
  }

  const t = postedText.toLowerCase().trim();

  const match = t.match(/posted\s+(\d+)\s*(d|w|mo)/i);
  if (!match) return "text-gray-300 bg-gray-700/50 border-gray-600";

  const num = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === "d" && num < 7) {
    return "text-emerald-400 bg-emerald-900/30 border border-emerald-700/50";
  }

  if ((unit === "d" && num >= 7 && num < 30) || (unit === "w" && num < 4)) {
    return "text-yellow-400 bg-yellow-900/30 border border-yellow-700/50";
  }

  if (
    unit === "mo" ||
    (unit === "w" && num >= 4) ||
    (unit === "d" && num >= 30)
  ) {
    return "text-red-400 bg-red-900/30 border border-red-700/50";
  }

  return "text-gray-300 bg-gray-700/50 border-gray-600";
};

const techIconsMap = {
  Python: pythonIcon,
  Java: javaIcon,
  SQL: sqlIcon,
  JavaScript: javascriptIcon,
  TypeScript: typescriptIcon,
  PHP: phpIcon,

  Django: djangoIcon,
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
};

export const getTechIcon = (techName) => {
  return techIconsMap[techName] || null;
};
