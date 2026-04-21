import React from "react";
import {
  MapPin,
  Building2,
  ShieldCheck,
  ExternalLink,
  Briefcase,
  Clock3,
  Users,
  Sparkles,
  Code2,
  ChevronRight,
  XCircle,
  BookmarkCheck,
} from "lucide-react";

import {
  getCompetitionStyle,
  getExperienceStyle,
  getSeniorityStyle,
  getTypeStyle,
} from "../tracking/utils/jobUtils.js";
import {
  getPostedBadgeClasses,
  getPostedBadgeText,
  InsightBadge,
  placeholderLogo,
  ScoreBadge,
  Badge,
  formatApplicantsLabel,
  formatDateValue,
  TechBadge,
  buildJobInsights,
} from "./joblistUtils.jsx";

const formatScoreLabel = (label) =>
  label
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatSignedPoints = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return null;

  const rounded =
    Math.abs(numericValue % 1) < Number.EPSILON
      ? Math.round(numericValue)
      : numericValue.toFixed(2);

  return `${numericValue >= 0 ? "+" : ""}${rounded}`;
};

const getShortSource = (value) => {
  if (!value) return null;

  const trimmed = String(value).trim().replace(/\s+/g, " ");

  if (trimmed.length <= 120) return trimmed;

  return `${trimmed.slice(0, 117)}...`;
};

const BreakdownList = ({ items = [], tone }) => {
  if (!items.length) {
    return <Placeholder text="None." />;
  }

  const toneClasses =
    tone === "positive"
      ? "border-emerald-500/20 bg-emerald-500/5"
      : "border-amber-500/20 bg-amber-500/5";
  const pointsClasses =
    tone === "positive" ? "text-emerald-300" : "text-amber-300";

  return (
    <ul className="mt-2 space-y-2">
      {items.map((item, index) => {
        const label = item?.label || "Unnamed signal";
        const points = formatSignedPoints(item?.points);
        const source = getShortSource(item?.source);

        return (
          <li
            key={`${label}-${item?.source || "no-source"}-${index}`}
            className={`rounded-xl border px-3 py-2 ${toneClasses}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-slate-100">{label}</p>
              {points && (
                <span className={`shrink-0 font-semibold ${pointsClasses}`}>
                  {points}
                </span>
              )}
            </div>
            {source && <p className="mt-1 text-xs text-slate-400">{source}</p>}
          </li>
        );
      })}
    </ul>
  );
};

const InfoCard = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/70 px-4 py-3">
    <Icon size={18} className="shrink-0 text-slate-400" />
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="truncate text-sm text-slate-200">
        {value || "Not specified"}
      </p>
    </div>
  </div>
);

const Placeholder = ({ text = "None specified." }) => (
  <div className="flex items-center text-sm italic text-slate-400">
    <XCircle size={16} className="mr-2 shrink-0" />
    <span>{text}</span>
  </div>
);

const JobListingJobDetails = ({
  job,
  maxPythonScore = 0,
  isSaved = false,
  onToggleSaved,
}) => {
  if (!job) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Select a job to see the details
      </div>
    );
  }

  const insights = buildJobInsights(job);
  const description =
    insights.cleanedDescription ||
    job.description_full ||
    job.description_snippet ||
    null;
  const pythonScore =
    typeof job.pythonScore === "number" && Number.isFinite(job.pythonScore)
      ? job.pythonScore
      : null;
  const normalizedPythonScore =
    pythonScore != null && maxPythonScore > 0
      ? Math.max(0, Math.min((pythonScore / maxPythonScore) * 100, 100))
      : 0;
  const scoreBreakdown = job.aiScoreBreakdown || null;
  const breakdownPositive = Array.isArray(scoreBreakdown?.positive)
    ? scoreBreakdown.positive
    : [];
  const breakdownNegative = Array.isArray(scoreBreakdown?.negative)
    ? scoreBreakdown.negative
    : [];
  const categoryScores = Object.entries(
    scoreBreakdown?.category_totals || job.aiCategoryScores || {},
  ).filter(([, value]) => typeof value === "number" && Number.isFinite(value));
  const finalScore =
    typeof scoreBreakdown?.final_score === "number" &&
    Number.isFinite(scoreBreakdown.final_score)
      ? scoreBreakdown.final_score
      : typeof job.aiScore === "number" && Number.isFinite(job.aiScore)
        ? job.aiScore
        : pythonScore;
  const matchedKeywordGroups = Object.entries(job.aiMatchedKeywords || {}).filter(
    ([, keywords]) => Array.isArray(keywords) && keywords.length > 0,
  );
  const hasScoreReasoning =
    Boolean(scoreBreakdown) ||
    Boolean(job.aiArchetype) ||
    typeof job.aiSuspicious === "boolean" ||
    Boolean(job.aiSignals?.length) ||
    Boolean(job.aiSuspiciousReasons?.length) ||
    Boolean(job.aiBonusReasons?.length) ||
    Boolean(job.aiPenaltyReasons?.length) ||
    Boolean(job.aiEvidence?.length) ||
    categoryScores.length > 0 ||
    matchedKeywordGroups.length > 0;

  return (
    <div className="h-full overflow-y-auto px-6 py-7 md:px-8">
      <div className="mb-8 flex items-start gap-5">
        <img
          src={job.company.logo_url}
          alt={`${job.company.name} logo`}
          className="h-16 w-16 rounded-xl border border-slate-700 bg-slate-900 object-contain"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = placeholderLogo(job.company.name);
          }}
        />

        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-bold leading-tight text-white">
            {job.title}
            {job.isNegativeMatch && (
              <span className="ml-3 inline-flex items-center gap-1 align-middle rounded-md border border-red-900 bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
                <XCircle size={12} /> Negative Match
              </span>
            )}
          </h2>

          <p className="mt-1 text-xl text-slate-300">{job.company.name}</p>
          <p className="mt-1 text-sm text-slate-400">{job.location}</p>
          <p className="mt-1 text-xs text-slate-500">Job ID: {job.job_id}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <ScoreBadge
              score={job.positiveScore}
              matchedKeywords={job.matchedPositiveKeywords}
            />

            {job.pythonScore != null && (
              <InsightBadge
                icon={Code2}
                className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                title="Calibrated Python match score from AI scorer"
              >
                Python Score: {Math.round(job.pythonScore)}
              </InsightBadge>
            )}

            {job.verified && <Badge tone="green">Verified</Badge>}
            {job.reposted && <Badge tone="amber">Reposted</Badge>}

            {job.workplace_type && job.workplace_type !== "Not specified" && (
              <Badge tone="blue">{job.workplace_type}</Badge>
            )}

            <InsightBadge
              icon={Clock3}
              className={getPostedBadgeClasses(job.posted_at)}
            >
              {getPostedBadgeText(job.posted_at)}
            </InsightBadge>

            {job.applicants_total != null && (
              <InsightBadge
                icon={Users}
                className={getCompetitionStyle(job.applicants_total)}
              >
                {formatApplicantsLabel(job.applicants_total)}
              </InsightBadge>
            )}

            {insights.seniority && (
              <InsightBadge
                icon={Briefcase}
                className={getSeniorityStyle(insights.seniority)}
              >
                {insights.seniority}
              </InsightBadge>
            )}

            {insights.jobType && (
              <InsightBadge
                icon={Code2}
                className={getTypeStyle(insights.jobType)}
              >
                {insights.jobType}
              </InsightBadge>
            )}

            {insights.experience?.text && (
              <InsightBadge
                icon={Clock3}
                className={getExperienceStyle(insights.experience)}
              >
                {insights.experience.text} exp
              </InsightBadge>
            )}
          </div>

          {job.matchedPositiveKeywords?.length > 0 && (
            <p className="mt-3 text-sm text-slate-400">
              Positive matches:{" "}
              <span className="text-slate-200">
                {job.matchedPositiveKeywords.join(", ")}
              </span>
            </p>
          )}

          {job.missingMustHaveKeywords?.length > 0 && (
            <p className="mt-1 text-sm text-red-400">
              Missing required keywords:{" "}
              <span className="font-semibold">
                {job.missingMustHaveKeywords.join(", ")}
              </span>
            </p>
          )}

          <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Python Score
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Relative to the strongest Python match in the current filtered
                  list
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-indigo-300">
                  {pythonScore != null ? Math.round(pythonScore) : "Not scored"}
                </p>
                <p className="text-xs text-slate-500">
                  {maxPythonScore > 0
                    ? `${Math.round(normalizedPythonScore)}% of current max`
                    : "No scored jobs in current filter"}
                </p>
              </div>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-300"
                style={{ width: `${normalizedPythonScore}%` }}
              />
            </div>

            {hasScoreReasoning && (
              <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-200 marker:content-none">
                  <span>Why this score?</span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-slate-500"
                  />
                </summary>

                <div className="space-y-4 border-t border-slate-800 px-4 py-4 text-sm text-slate-300">
                  {job.aiArchetype && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Archetype
                      </p>
                      <p className="mt-1 text-slate-200">{job.aiArchetype}</p>
                    </div>
                  )}

                  {finalScore != null && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Final Score
                      </p>
                      <p className="mt-1 text-slate-200">
                        {Math.round(finalScore * 100) / 100}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                      Positive Signals
                    </p>
                    <BreakdownList items={breakdownPositive} tone="positive" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                      Negative Signals
                    </p>
                    <BreakdownList items={breakdownNegative} tone="negative" />
                  </div>

                  {categoryScores.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Category Totals
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {categoryScores.map(([label, value]) => (
                          <span
                            key={label}
                            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200"
                          >
                            {formatScoreLabel(label)}: {Math.round(value * 100) / 100}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Suspicious
                    </p>
                    <p
                      className={`mt-1 ${
                        job.aiSuspicious ? "text-red-300" : "text-slate-200"
                      }`}
                    >
                      {job.aiSuspicious ? "Yes" : "No"}
                    </p>
                  </div>

                  {job.aiSuspiciousReasons?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-400">
                        Suspicious Reasons
                      </p>
                      <ul className="mt-2 space-y-1 text-slate-200">
                        {job.aiSuspiciousReasons.map((reason, index) => (
                          <li key={`${reason}-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {matchedKeywordGroups.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Matched Keywords
                      </p>
                      <div className="mt-2 space-y-2">
                        {matchedKeywordGroups.map(([group, keywords]) => (
                          <div key={group}>
                            <p className="text-xs text-slate-500">
                              {formatScoreLabel(group)}
                            </p>
                            <p className="mt-1 text-slate-200">
                              {keywords.join(", ")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {job.aiBonusReasons?.length > 0 && breakdownPositive.length === 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                        Positive Signals
                      </p>
                      <ul className="mt-2 space-y-1 text-slate-200">
                        {job.aiBonusReasons.map((reason, index) => (
                          <li key={`${reason}-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {job.aiPenaltyReasons?.length > 0 &&
                    breakdownNegative.length === 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                        Penalties
                      </p>
                      <ul className="mt-2 space-y-1 text-slate-200">
                        {job.aiPenaltyReasons.map((reason, index) => (
                          <li key={`${reason}-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {job.aiSignals?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">
                        Archetype Signals
                      </p>
                      <ul className="mt-2 space-y-1 text-slate-200">
                        {job.aiSignals.map((signal, index) => (
                          <li key={`${signal}-${index}`}>{signal}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {job.aiEvidence?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Evidence
                      </p>
                      <ul className="mt-2 space-y-1 text-slate-200">
                        {job.aiEvidence.map((evidenceItem, index) => (
                          <li key={`${evidenceItem}-${index}`}>{evidenceItem}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            )}
          </section>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 font-semibold transition ${
            isSaved
              ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.12)] hover:bg-emerald-500/20"
              : "border-slate-700 bg-slate-800 text-slate-200 hover:border-emerald-500/40 hover:bg-slate-700"
          }`}
          title={isSaved ? "Saved job" : "Mark job as saved"}
        >
          <input
            type="checkbox"
            checked={isSaved}
            onChange={() => onToggleSaved?.(job)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-emerald-500 focus:ring-emerald-500/40 focus:ring-offset-slate-900"
          />
          <BookmarkCheck
            size={16}
            className={isSaved ? "text-emerald-300" : "text-slate-400"}
          />
          <span>{isSaved ? "Saved" : "Save"}</span>
        </label>

        <a
          href={job.job_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
        >
          <ExternalLink size={16} />
          Open Job
        </a>

        {job.company.page_url && (
          <a
            href={job.company.page_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 font-semibold text-slate-100 transition hover:bg-slate-700"
          >
            <Building2 size={16} />
            Company Page
          </a>
        )}

        {job.company.url && job.company.url !== job.company.page_url && (
          <a
            href={job.company.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 font-semibold text-slate-100 transition hover:bg-slate-700"
          >
            <Building2 size={16} />
            Company Website
          </a>
        )}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoCard icon={MapPin} label="Location" value={job.location} />
        <InfoCard
          icon={Briefcase}
          label="Workplace Type"
          value={job.workplace_type}
        />
        <InfoCard
          icon={Clock3}
          label="Posted At"
          value={formatDateValue(job.posted_at)}
        />
        <InfoCard
          icon={Users}
          label="Applicants"
          value={formatApplicantsLabel(job.applicants_total)}
        />
        <InfoCard
          icon={ShieldCheck}
          label="Verification"
          value={job.verified ? "Verified" : "Not verified"}
        />
        <InfoCard
          icon={Sparkles}
          label="Keyword Score"
          value={String(job.positiveScore || 0)}
        />
        <InfoCard
          icon={Code2}
          label="Python Score"
          value={
            job.pythonScore != null
              ? String(Math.round(job.pythonScore))
              : "Not scored"
          }
        />
      </div>

      <div className="space-y-8">
        <section>
          <h3 className="mb-4 flex items-center border-b border-slate-800 pb-2 text-xl font-semibold text-slate-100">
            <Code2 size={18} className="mr-2" />
            Extracted Signals
          </h3>

          <div className="flex flex-wrap gap-2">
            <ScoreBadge
              score={job.positiveScore}
              matchedKeywords={job.matchedPositiveKeywords}
            />

            {job.pythonScore != null && (
              <InsightBadge
                icon={Code2}
                className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                title="Calibrated Python match score from AI scorer"
              >
                Python Score: {Math.round(job.pythonScore)}
              </InsightBadge>
            )}

            {insights.seniority && (
              <InsightBadge
                icon={Briefcase}
                className={getSeniorityStyle(insights.seniority)}
              >
                Seniority: {insights.seniority}
              </InsightBadge>
            )}

            {insights.jobType && (
              <InsightBadge
                icon={Code2}
                className={getTypeStyle(insights.jobType)}
              >
                Type: {insights.jobType}
              </InsightBadge>
            )}

            {insights.experience?.text && (
              <InsightBadge
                icon={Clock3}
                className={getExperienceStyle(insights.experience)}
              >
                Experience: {insights.experience.text} exp
              </InsightBadge>
            )}

            {job.applicants_total != null && (
              <InsightBadge
                icon={Users}
                className={getCompetitionStyle(job.applicants_total)}
              >
                Competition: {formatApplicantsLabel(job.applicants_total)}
              </InsightBadge>
            )}

            <InsightBadge
              icon={Clock3}
              className={getPostedBadgeClasses(job.posted_at)}
            >
              {getPostedBadgeText(job.posted_at)}
            </InsightBadge>
          </div>
        </section>

        <section>
          <h3 className="mb-4 flex items-center border-b border-slate-800 pb-2 text-xl font-semibold text-slate-100">
            <Code2 size={18} className="mr-2" />
            Detected Stack
          </h3>

          {insights.techStack.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {insights.techStack.map((tech, index) => (
                <TechBadge
                  key={`${job.id}-detail-${tech}`}
                  tech={tech}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <Placeholder text="No useful stack hints were extracted from this listing." />
          )}
        </section>

        <section>
          <h3 className="mb-4 flex items-center border-b border-slate-800 pb-2 text-xl font-semibold text-slate-100">
            <ChevronRight size={18} className="mr-2" />
            About This Listing
          </h3>

          {description ? (
            <div className="whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-800/60 p-4 text-sm leading-7 text-slate-300">
              {description}
            </div>
          ) : (
            <Placeholder text="No description is available for this listing." />
          )}
        </section>
      </div>
    </div>
  );
};

export default JobListingJobDetails;
