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
