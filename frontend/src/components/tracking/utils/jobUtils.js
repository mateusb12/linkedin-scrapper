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

  if (applicants < 300)
    return "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800";

  if (applicants < 1000)
    return "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800";

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

export const extractJobTypeFromDescription = (description) => {
  if (!description) return null;
  const text = description.toLowerCase();

  if (/\b(full\s?-?stack|fullstack)\b/i.test(text)) {
    return "Full-stack";
  }

  const hasFrontendKeywords = /\b(front\s?-?end|frontend|front)\b/i.test(text);

  const hasBackendKeywords = /\b(back\s?-?end|backend|back)\b/i.test(text);

  if (hasFrontendKeywords && !hasBackendKeywords) return "Frontend";
  if (hasBackendKeywords && !hasFrontendKeywords) return "Backend";

  if (hasFrontendKeywords && hasBackendKeywords) return "Full-stack";

  const backendTechs =
    /\b(java|c#|golang|go|python|ruby|php|node|nodejs|rust|scala|fastapi|django|spring|express|nest|sql|mysql|postgres|aws|azure|docker|kubernetes)\b/i;
  const backendContext =
    /\b(api|apis|microserviços|microservices|banco de dados|database|server|servidor|cloud)\b/i;

  if (backendTechs.test(text) && backendContext.test(text)) {
    return "Backend";
  }

  const frontendTechs =
    /\b(react|reactjs|vue|vuejs|angular|svelte|nextjs|nuxt|tailwind|css|sass|html|javascript|typescript|ux|ui|figma)\b/i;
  const frontendContext =
    /\b(layout|interface|componentes|components|spa|web|mobile|responsiv)\b/i;

  if (frontendTechs.test(text) && frontendContext.test(text)) {
    return "Frontend";
  }

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
  "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20",
  "bg-amber-500/10 text-amber-300 border-amber-500/20 hover:bg-amber-500/20",
  "bg-yellow-400/10 text-yellow-300 border-yellow-400/20 hover:bg-yellow-400/20",
  "bg-lime-500/10 text-lime-400 border-lime-500/20 hover:bg-lime-500/20",
  "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20",
  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
  "bg-teal-500/10 text-teal-300 border-teal-500/20 hover:bg-teal-500/20",
  "bg-cyan-500/10 text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/20",
  "bg-sky-500/10 text-sky-300 border-sky-500/20 hover:bg-sky-500/20",
  "bg-blue-500/10 text-blue-300 border-blue-500/20 hover:bg-blue-500/20",
  "bg-indigo-500/10 text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/20",
  "bg-violet-500/10 text-violet-300 border-violet-500/20 hover:bg-violet-500/20",
  "bg-purple-500/10 text-purple-300 border-purple-500/20 hover:bg-purple-500/20",
  "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20 hover:bg-fuchsia-500/20",
  "bg-pink-500/10 text-pink-300 border-pink-500/20 hover:bg-pink-500/20",
  "bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20",
];

export const getTechBadgeStyle = (index) => {
  // Garante que o índice seja válido (ciclo infinito)
  const safeIndex = (index || 0) % RAINBOW_PALETTE.length;
  return `${RAINBOW_PALETTE[safeIndex]} border transition-colors`;
};
