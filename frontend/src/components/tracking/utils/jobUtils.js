export const extractExperienceFromDescription = (description) => {
  if (!description) return null;

  const regex =
    /\b(\d+)(?:\s*[-–to]\s*(\d+))?\s*(?:\+|plus|\s*mais)?\s*(?:years?|yrs?|anos?)\b/i;

  const match = description.match(regex);

  if (match) {
    const min = parseInt(match[1], 10);
    const max = match[2] ? parseInt(match[2], 10) : null;

    if (min > 20) return null;

    return {
      min,
      max,
      text: match[0],
    };
  }

  return null;
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

  const lines = rawText.split("\n");
  const garbagePatterns = [
    /^div$/,
    /^com\.linkedin\..*/,
    /^stringValue$/,
    /^Collapsed$/,
    /^bindableBoolean$/,
    /^booleanBinding$/,
    /^Expanded$/,
    /^onComponentDisappear$/,
    /^horizontal$/,
    /^h2$/,
    /^sans$/,
    /^small$/,
    /^normal$/,
    /^open$/,
    /^start$/,
    /^strong$/,
    /^text-attr-\d+$/,
    /^more$/,
    /^expandable_text_block.*/,
  ];

  const cleanedLines = lines
    .map((line) => line.trim())
    .filter((line) => {
      if (line.length === 0) return false;
      return !garbagePatterns.some((pattern) => pattern.test(line));
    })
    .map((line) => {
      if (line === "li" || line === "ul") return "• ";
      if (line === "br") return "";
      return line;
    });

  let text = cleanedLines.join("\n");
  text = text.replace(/([a-z])\*\*([A-Z])/g, "$1\n\n**$2");
  text = text.replace(/\n\*\*/g, "\n\n**");
  const unicodeBullets = /[✔✨✅•➡🔹🔸▪]/g;
  text = text.replace(new RegExp(`\\n([✔✨✅•➡🔹🔸▪])`, "g"), "\n\n$1");

  return text;
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

  // --- STEP 1: PRE-PROCESSING & CLEANING ---

  // 1. Fix common recruiter typos
  text = text.replace(/phyton/g, "python"); // The "Foursys" fix
  text = text.replace(/javascrpt|java script/g, "javascript");

  // 2. Remove "Collaboration" noise (The "Makai" fix)
  // We remove phrases where the role simply talks to other teams
  text = text.replace(/(collaborate|work|interface|integrate|support|liaise)\s+(with|closely\s+with)\s+(the\s+)?(front|back)-?end/g, " ");

  // --- STEP 2: IMMEDIATE "FULL-STACK" TRIGGERS ---

  // Explicit "Full Stack" mention is usually the strongest signal
  if (/\b(full\s?-?stack|fullstack)\b/i.test(text)) {
    return "Full-stack";
  }

  // The "ProFUSION" Fix: Polyglot/Generalist detection
  // If they say "Backend, Frontend or Mobile" or "Backend / Frontend", it's a generalist role.
  // We treat this as Full-stack for classification purposes.
  if (/(backend\s*(,|ou|or|\/)\s*frontend)|(frontend\s*(,|ou|or|\/)\s*backend)/i.test(text)) {
    return "Full-stack";
  }

  // --- STEP 3: SCORING SYSTEM ---

  let backendScore = 0;
  let frontendScore = 0;

  // We weight the TITLE (first ~150 chars) much heavier than the body
  const titleChunk = text.slice(0, 150);
  const bodyChunk = text.slice(150);

  const scoreText = (txt, weight) => {
    // BACKEND KEYWORDS
    const backendRegex = /\b(backend|back-end|python|java|go|golang|ruby|php|c#|rust|scala|elixir|nodejs|node\.js|\.net|api|apis|sql|mysql|postgres|docker|aws|cloud|microservices|data engineer|etl|spark|airflow)\b/g;
    const backendMatches = txt.match(backendRegex) || [];
    backendScore += backendMatches.length * weight;

    // FRONTEND KEYWORDS
    const frontendRegex = /\b(frontend|front-end|javascript|js|typescript|ts|react|vue|angular|svelte|next\.?js|html|css|ui\/ux|ui|ux|figma|styled|tailwind)\b/g;
    const frontendMatches = txt.match(frontendRegex) || [];
    frontendScore += frontendMatches.length * weight;
  };

  // Apply Scoring: Title words are worth 5x more than Body words
  scoreText(titleChunk, 5);
  scoreText(bodyChunk, 1);

  // --- STEP 4: ANALYZE SCORES ---

  // If the scores are very close (within 20% of each other) and both are high, it's likely Full-stack
  // (e.g., a job asking for React AND Node equally)
  if (backendScore > 5 && frontendScore > 5) {
    const ratio = Math.max(backendScore, frontendScore) / Math.min(backendScore, frontendScore);
    if (ratio < 1.3) {
      return "Full-stack";
    }
  }

  // The "Nortal" Fix:
  // Even if the title says "UI/UX" (Frontend points), if the body lists
  // Python, API, MySQL repeatedly, the Backend Score will overtake the Frontend Score.

  if (backendScore > frontendScore) return "Backend";
  if (frontendScore > backendScore) return "Frontend";

  // --- STEP 5: TIE-BREAKER / FALLBACK ---

  // If scores are equal or zero (rare), look for specific "Developer" context
  if (/\b(python|java|go|ruby)\s+developer\b/.test(text)) return "Backend";
  if (/\b(react|vue|angular)\s+developer\b/.test(text)) return "Frontend";

  return null; // Truly uncategorized
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
  NumPy: /\bnumpy\b/i,

  React: /\breact(?:\.js)?\b/i,
  "React Native": /\breact\s?native\b/i,
  Vue: /\bvue(?:\.js)?\b/i,
  Angular: /\bangular\b/i,
  "Node.js": /\bnode(?:\.?js)?\b/i,
  "Next.js": /\bnext(?:\.?js)?\b/i,
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
  Kubernetes: /\bkubernetes|k8s\b/i,
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

  return found;
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
