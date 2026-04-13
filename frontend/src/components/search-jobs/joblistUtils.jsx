import React from "react";
import { Sparkles, Code2 } from "lucide-react";
import {
  cleanJobDescription,
  extractExperienceFromDescription,
  extractFoundations,
  extractJobTypeFromDescription,
  extractSeniorityFromDescription,
  extractSpecifics,
  getPostedStyle,
  getTechIcon,
  getTechBadgeStyle,
} from "../tracking/utils/jobUtils.js";

export const JOBS_CACHE_KEY = "graphql_jobs_cache_v3";
export const NEGATIVE_KEYWORDS_CACHE_KEY = "negative_keywords_v1";
export const NEGATIVE_COMPANIES_CACHE_KEY = "negative_companies_v1";

export const badgeTones = {
  blue: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
  green: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  amber: "bg-amber-400/20 text-amber-300 border border-amber-400/50",
  violet: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  slate: "bg-slate-700/60 text-slate-300 border border-slate-600",
};

const GENERIC_TECH_LABELS = new Set([
  "remote",
  "backend",
  "frontend",
  "full stack",
  "full-stack",
  "senior",
  "junior",
  "pleno",
  "node",
]);

export const normalizeText = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const buildUniqueOptions = (
  items,
  getValue,
  getLabel = (value) => value,
) => {
  const map = new Map();

  items.forEach((item) => {
    const value = getValue(item);

    if (value === undefined || value === null || String(value).trim() === "") {
      return;
    }

    map.set(value, getLabel(value, item));
  });

  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
};

export const placeholderLogo = (companyName = "?") =>
  `https://placehold.co/80x80/0f172a/e2e8f0?text=${encodeURIComponent(
    companyName.charAt(0).toUpperCase() || "?",
  )}`;

export const formatDateValue = (value) => {
  if (!value) return "Not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not specified";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

export const formatApplicantsLabel = (value) => {
  if (value == null) return "Not specified";
  return `${value} applicant${value === 1 ? "" : "s"}`;
};

export const getRelativeTimeMeta = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const diffMs = Date.now() - date.getTime();

  if (diffMs < 0) {
    return { short: "now", long: "just now" };
  }

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (minutes < 1) return { short: "now", long: "just now" };
  if (minutes < 60) return { short: `${minutes}m`, long: `${minutes}m ago` };
  if (hours < 24) return { short: `${hours}h`, long: `${hours}h ago` };
  if (days < 7) return { short: `${days}d`, long: `${days}d ago` };
  if (days < 30) return { short: `${weeks}w`, long: `${weeks}w ago` };
  if (days < 365) return { short: `${months}mo`, long: `${months}mo ago` };

  return { short: `${years}y`, long: `${years}y ago` };
};

export const getPostedBadgeText = (value) => {
  const meta = getRelativeTimeMeta(value);
  if (!meta) return "Posted N/A";
  return `Posted ${meta.long}`;
};

export const getPostedBadgeClasses = (value) => {
  const meta = getRelativeTimeMeta(value);

  if (!meta) {
    return "text-gray-300 bg-gray-700/50 border-gray-600";
  }

  if (meta.short === "now" || /m$|h$/i.test(meta.short)) {
    return "text-emerald-400 bg-emerald-900/30 border-emerald-700/50";
  }

  return getPostedStyle(`Posted ${meta.short}`);
};

export const dedupeLabels = (labels = []) => {
  const map = new Map();

  labels.forEach((label) => {
    if (!label || !String(label).trim()) return;

    const normalized = normalizeText(label);

    if (!normalized) return;

    if (!map.has(normalized)) {
      map.set(normalized, label);
    }
  });

  return Array.from(map.values());
};

export const getMeaningfulTechStack = (job, inferredTechs) => {
  return dedupeLabels([...(inferredTechs || []), ...(job.keywords || [])])
    .filter((tech) => {
      const normalized = normalizeText(tech);

      if (!normalized) return false;
      if (GENERIC_TECH_LABELS.has(normalized)) return false;
      if (normalized === normalizeText(job.workplace_type)) return false;
      if (normalized === normalizeText(job.source_label)) return false;

      return true;
    })
    .slice(0, 8);
};

export const buildJobInsights = (job) => {
  const rawDescription = job.description_full || job.description_snippet || "";
  const combinedText = [job.title, rawDescription].filter(Boolean).join("\n\n");

  const cleanedDescription = rawDescription
    ? cleanJobDescription(rawDescription)
    : null;

  const seniority = extractSeniorityFromDescription(combinedText);
  const jobType = extractJobTypeFromDescription(combinedText);
  const experience = extractExperienceFromDescription(combinedText);

  const foundations = extractFoundations(combinedText);
  const specifics = extractSpecifics(combinedText);

  const techStack = getMeaningfulTechStack(job, [...specifics, ...foundations]);

  return {
    cleanedDescription,
    seniority,
    jobType,
    experience,
    techStack,
  };
};

export const readJobsCache = () => {
  try {
    const raw = localStorage.getItem(JOBS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed || !Array.isArray(parsed.jobs)) return null;

    return {
      jobs: parsed.jobs,
      cachedAt: parsed.cachedAt || null,
    };
  } catch (error) {
    console.warn("Failed to read GraphQL jobs cache:", error);
    return null;
  }
};

export const writeJobsCache = (jobs) => {
  const payload = {
    jobs,
    cachedAt: new Date().toISOString(),
  };

  localStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(payload));

  return payload.cachedAt;
};

export const clearJobsCache = () => {
  localStorage.removeItem(JOBS_CACHE_KEY);
};

export const readNegativeKeywordsCache = () => {
  try {
    const raw = localStorage.getItem(NEGATIVE_KEYWORDS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to read negative keywords cache:", error);
    return [];
  }
};

export const writeNegativeKeywordsCache = (keywords) => {
  localStorage.setItem(NEGATIVE_KEYWORDS_CACHE_KEY, JSON.stringify(keywords));
};

export const readNegativeCompaniesCache = () => {
  try {
    const raw = localStorage.getItem(NEGATIVE_COMPANIES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to read negative companies cache:", error);
    return [];
  }
};

export const writeNegativeCompaniesCache = (companies) => {
  localStorage.setItem(NEGATIVE_COMPANIES_CACHE_KEY, JSON.stringify(companies));
};

export const Badge = ({ tone = "slate", children }) => (
  <span
    className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeTones[tone]}`}
  >
    {children}
  </span>
);

export const InsightBadge = ({
  icon: Icon,
  className = "",
  title = "",
  children,
}) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}
  >
    {Icon ? <Icon size={12} className="shrink-0" /> : null}
    <span className="truncate">{children}</span>
  </span>
);

export const getScoreStyle = (score = 0) => {
  if (score >= 3) {
    return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
  }

  if (score === 2) {
    return "border-sky-500/30 bg-sky-500/15 text-sky-300";
  }

  if (score === 1) {
    return "border-violet-500/30 bg-violet-500/15 text-violet-300";
  }

  return "border-slate-600 bg-slate-800/70 text-slate-300";
};

export const ScoreBadge = ({ score = 0, matchedKeywords = [] }) => {
  const title = matchedKeywords.length
    ? `Matched positive keywords: ${matchedKeywords.join(", ")}`
    : "No positive keyword matched";

  return (
    <InsightBadge
      icon={Sparkles}
      className={getScoreStyle(score)}
      title={title}
    >
      Keyword Score {score}
    </InsightBadge>
  );
};

export const TechBadge = ({ tech, index }) => {
  const icon = getTechIcon(tech);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${getTechBadgeStyle(index, tech)}`}
    >
      {icon ? (
        <img
          src={icon}
          alt=""
          className="h-3.5 w-3.5 shrink-0 object-contain"
          loading="lazy"
        />
      ) : (
        <Code2 size={12} className="shrink-0" />
      )}
      <span>{tech}</span>
    </span>
  );
};
