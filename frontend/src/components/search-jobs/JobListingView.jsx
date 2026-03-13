import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  MapPin,
  Building2,
  ShieldCheck,
  Repeat2,
  ExternalLink,
  Briefcase,
  Database,
  Filter,
  ChevronUp,
  ChevronDown,
  XCircle,
  ChevronRight,
  Code2,
  RefreshCw,
  Trash2,
  Clock3,
  Users,
  X,
  Sparkles,
} from "lucide-react";

import { formatShortDateTime } from "../../utils/dateUtils.js";
import {
  getCompetitionStyle,
  getExperienceStyle,
  getSeniorityStyle,
  getTechBadgeStyle,
  getTechIcon,
  getTypeStyle,
} from "../tracking/utils/jobUtils.js";
import {
  badgeTones,
  buildJobInsights,
  formatApplicantsLabel,
  formatDateValue,
  getPostedBadgeClasses,
  getPostedBadgeText,
  placeholderLogo,
} from "./joblistUtils.js";

const Badge = ({ tone = "slate", children }) => (
  <span
    className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeTones[tone]}`}
  >
    {children}
  </span>
);

const InsightBadge = ({ icon: Icon, className = "", title = "", children }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}
  >
    {Icon ? <Icon size={12} className="shrink-0" /> : null}
    <span className="truncate">{children}</span>
  </span>
);

const getScoreStyle = (score = 0) => {
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

const ScoreBadge = ({ score = 0, matchedKeywords = [] }) => {
  const title = matchedKeywords.length
    ? `Matched positive keywords: ${matchedKeywords.join(", ")}`
    : "No positive keyword matched";

  return (
    <InsightBadge
      icon={Sparkles}
      className={getScoreStyle(score)}
      title={title}
    >
      Score {score}
    </InsightBadge>
  );
};

const TechBadge = ({ tech, index }) => {
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

const FilterSelect = ({ value, onChange, children }) => (
  <div className="relative">
    <select
      value={value}
      onChange={onChange}
      className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
    >
      {children}
    </select>

    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
      <svg
        className="h-4 w-4 fill-current"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
      >
        <path d="M5.516 7.548 10 12.032l4.484-4.484 1.032 1.032L10 14.096 4.484 8.58z" />
      </svg>
    </div>
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="flex h-full flex-col items-center justify-center px-8 text-center text-slate-400">
    <Filter size={42} className="mb-4 text-slate-500" />
    <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
    <p className="mt-2 max-w-md text-sm">{description}</p>
  </div>
);

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

const LiveProgressBar = ({ progressData }) => {
  if (!progressData) return null;

  const { step, message, current, total } = progressData;
  let percent = 0;

  if (step === "fetching") {
    percent = 10;
  } else if (step === "parsing") {
    percent = 20;
  } else if (step === "enriching" && total > 0) {
    const enrichPercent = (current / total) * 80;
    percent = 20 + enrichPercent;
  }

  return (
    <div className="mt-4 w-full overflow-hidden rounded-xl border border-sky-900/40 bg-slate-800/40 p-3 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-sky-400">
          <RefreshCw size={12} className="mr-1.5 inline animate-spin" />
          {message}
        </span>
        <span className="text-xs font-bold text-sky-300">
          {Math.round(percent)}%
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900/60">
        <div
          className="h-full rounded-full bg-sky-500 transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

const FetchJobsModal = ({
  isOpen,
  onClose,
  fetchCount,
  setFetchCount,
  onConfirm,
  loading,
  progressData,
}) => {
  if (!isOpen) return null;

  const handleIncrement = (amount) => {
    setFetchCount((prev) => Math.max(1, prev + amount));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100">
            <RefreshCw size={20} className="text-sky-400" />
            Fetch New Jobs
          </h2>

          {!loading && (
            <button
              onClick={onClose}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <p className="mb-6 text-sm text-slate-400">
          How many jobs would you like to fetch from the backend?
        </p>

        <div className="mb-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-3">
            <button
              onClick={() => handleIncrement(-10)}
              disabled={loading || fetchCount <= 10}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700 text-xl font-bold text-slate-200 transition hover:bg-slate-600 disabled:opacity-50"
            >
              -
            </button>

            <div className="flex w-20 flex-col items-center">
              <span className="text-3xl font-bold text-sky-400">
                {fetchCount}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                Jobs
              </span>
            </div>

            <button
              onClick={() => handleIncrement(10)}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700 text-xl font-bold text-slate-200 transition hover:bg-slate-600 disabled:opacity-50"
            >
              +
            </button>
          </div>

          <div className="flex gap-2">
            {[10, 25, 50, 100].map((preset) => (
              <button
                key={preset}
                onClick={() => setFetchCount(preset)}
                disabled={loading}
                className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                  fetchCount === preset
                    ? "border-sky-500 bg-sky-500/20 text-sky-300"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                } disabled:opacity-50`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-4">
            <LiveProgressBar progressData={progressData} />
            <p className="mt-3 text-center text-xs text-slate-500">
              Please wait while we fetch and enrich the data. This might take a
              moment.
            </p>
          </div>
        ) : (
          <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>

            <button
              onClick={() => onConfirm(fetchCount)}
              className="flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-sky-900/20 transition hover:bg-sky-500"
            >
              <Database size={16} />
              Start Fetching
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const JobListItem = ({ job, isSelected, onSelect }) => {
  const [showAllTech, setShowAllTech] = useState(false);
  const insights = buildJobInsights(job);

  const visibleTech = showAllTech
    ? insights.techStack
    : insights.techStack.slice(0, 3);

  const hiddenCount = insights.techStack.length - visibleTech.length;

  const selectedClasses = isSelected
    ? job.isNegativeMatch
      ? "border-red-500/70 bg-red-950/40 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.14)] opacity-100"
      : "border-sky-400/70 bg-sky-950/40 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.14)]"
    : job.isNegativeMatch
      ? "border-red-900/30 bg-red-950/10 hover:border-red-800/40 hover:bg-red-900/20 opacity-60 hover:opacity-100"
      : "border-slate-800 bg-[#0a1728] hover:border-slate-700 hover:bg-slate-800/40";

  return (
    <button
      type="button"
      onClick={() => onSelect(job.id)}
      className={`mx-3 my-2 block w-[calc(100%-1.5rem)] rounded-2xl border p-4 text-left transition-all ${selectedClasses}`}
    >
      <div className="flex gap-3">
        <img
          src={job.company.logo_url}
          alt={`${job.company.name} logo`}
          className={`h-12 w-12 shrink-0 rounded-xl border border-slate-700 bg-slate-900 object-contain ${job.isNegativeMatch ? "grayscale" : ""}`}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = placeholderLogo(job.company.name);
          }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                className={`truncate text-[18px] font-semibold leading-tight ${job.isNegativeMatch ? "text-red-200/70" : "text-slate-100"}`}
              >
                {job.title}
              </h3>

              <p className="mt-1 truncate text-sm text-slate-300">
                {job.company.name}
              </p>

              <p className="mt-1 truncate text-xs text-slate-400">
                {job.location}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {job.isNegativeMatch && (
                <XCircle
                  size={16}
                  className="text-red-500"
                  title="Matches Negative Filter"
                />
              )}

              {job.verified && (
                <ShieldCheck size={16} className="text-emerald-400" />
              )}

              {job.reposted && <Repeat2 size={16} className="text-amber-400" />}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <ScoreBadge
                score={job.positiveScore}
                matchedKeywords={job.matchedPositiveKeywords}
              />

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

              {job.applicants_total != null && (
                <InsightBadge
                  icon={Users}
                  className={getCompetitionStyle(job.applicants_total)}
                >
                  {formatApplicantsLabel(job.applicants_total)}
                </InsightBadge>
              )}

              <InsightBadge
                icon={Clock3}
                className={getPostedBadgeClasses(job.posted_at)}
              >
                {getPostedBadgeText(job.posted_at)}
              </InsightBadge>
            </div>

            {insights.techStack.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-slate-700/50 pt-3">
                {visibleTech.map((tech, index) => (
                  <TechBadge key={tech} tech={tech} index={index} />
                ))}

                {hiddenCount > 0 && !showAllTech && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowAllTech(true);
                    }}
                    className="rounded-full border border-slate-600 bg-slate-800/60 px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-700"
                    title={insights.techStack.slice(3).join(", ")}
                  >
                    +{hiddenCount}
                  </button>
                )}

                {showAllTech && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowAllTech(false);
                    }}
                    className="flex items-center justify-center rounded-full border border-slate-600 bg-slate-800/60 px-2 py-1 text-slate-300 transition hover:bg-slate-700"
                    title="Collapse"
                  >
                    <ChevronUp size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

const JobDetailView = ({ job }) => {
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
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
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
          label="Score"
          value={String(job.positiveScore || 0)}
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

const JobListingView = ({
  jobsState,
  filtersState,
  filterOptions,
  actions,
}) => {
  const {
    filteredJobs,
    negativeMatchCount,
    selectedJobId,
    selectedJob,
    loading,
    progressData,
    errorMessage,
    cacheTimestamp,
    loadedFromCache,
  } = jobsState;

  const {
    searchTerm,
    workplaceType,
    verificationFilter,
    repostedFilter,
    sourceFilter,
    sortBy,
    negativeKeywords,
    newNegativeKeyword,
    positiveKeywords,
    newPositiveKeyword,
    maxApplicantsLimit,
    negativeFiltersCount,
    positiveFiltersCount,
  } = filtersState;

  const { workplaceOptions, sourceOptions, maxPossibleApplicants } =
    filterOptions;

  const {
    onSelectJob,
    onConfirmFetch,
    onClearCache,
    setSearchTerm,
    setWorkplaceType,
    setVerificationFilter,
    setRepostedFilter,
    setSourceFilter,
    setSortBy,
    setNewNegativeKeyword,
    addNegativeKeyword,
    removeNegativeKeyword,
    setNewPositiveKeyword,
    addPositiveKeyword,
    removePositiveKeyword,
    onApplicantsLimitChange,
  } = actions;

  const [isDragging, setIsDragging] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(37);
  const [isFetchModalOpen, setIsFetchModalOpen] = useState(false);
  const [fetchCount, setFetchCount] = useState(10);
  const [isNegativeFilterOpen, setIsNegativeFilterOpen] = useState(false);
  const [isPositiveFilterOpen, setIsPositiveFilterOpen] = useState(false);

  const containerRef = useRef(null);

  const MIN_WIDTH = 28;
  const MAX_WIDTH = 65;

  const cacheStatusTone = !cacheTimestamp
    ? "slate"
    : loadedFromCache
      ? "amber"
      : "green";

  const handleMouseDown = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (event) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidthPx = event.clientX - containerRect.left;
      const newWidthPercent = (newWidthPx / containerRect.width) * 100;
      const clampedWidth = Math.max(
        MIN_WIDTH,
        Math.min(newWidthPercent, MAX_WIDTH),
      );

      setLeftPanelWidth(clampedWidth);
    },
    [isDragging],
  );

  useEffect(() => {
    if (!isDragging) return;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleConfirmFetchAndClose = async (count) => {
    await onConfirmFetch(count);
    setIsFetchModalOpen(false);
  };

  return (
    <div className="h-screen bg-[#081120] font-sans text-slate-100">
      <FetchJobsModal
        isOpen={isFetchModalOpen}
        onClose={() => setIsFetchModalOpen(false)}
        fetchCount={fetchCount}
        setFetchCount={setFetchCount}
        onConfirm={handleConfirmFetchAndClose}
        loading={loading}
        progressData={progressData}
      />

      <div
        ref={containerRef}
        className="flex h-full"
        style={{ userSelect: isDragging ? "none" : "auto" }}
      >
        <aside
          className="flex shrink-0 flex-col border-r border-slate-800 bg-[#0b1526]"
          style={{ width: `${leftPanelWidth}%` }}
        >
          <div className="space-y-4 border-b border-slate-800 p-4">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by title, company, stack or seniority..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2.5">
              <div className="relative grid grid-cols-[40px_1fr_auto] items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80">
                  <Database size={16} className="text-sky-400" />
                </div>

                <div className="flex h-9 flex-1 items-center">
                  <span className="text-sm font-semibold text-slate-100">
                    Cache
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFetchModalOpen(true)}
                    disabled={loading}
                    aria-label="Refresh cache"
                    title="Refresh cache"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-600 bg-slate-700/50 text-slate-200 transition hover:bg-slate-600 hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw
                      size={14}
                      className={loading ? "animate-spin" : ""}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={onClearCache}
                    aria-label="Clear cache"
                    title="Clear cache"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-400 transition hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {cacheTimestamp && (
                  <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center">
                    <Badge tone={cacheStatusTone}>
                      {formatShortDateTime(cacheTimestamp)}
                    </Badge>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="mt-2 border-t border-slate-700/60 pt-2">
                  <p className="text-xs text-red-300">{errorMessage}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FilterSelect
                value={workplaceType}
                onChange={(event) => setWorkplaceType(event.target.value)}
              >
                <option value="All">All Workplaces</option>
                {workplaceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                value={verificationFilter}
                onChange={(event) => setVerificationFilter(event.target.value)}
              >
                <option value="All">All Verification</option>
                <option value="Verified">Verified</option>
                <option value="Unverified">Unverified</option>
              </FilterSelect>

              <FilterSelect
                value={repostedFilter}
                onChange={(event) => setRepostedFilter(event.target.value)}
              >
                <option value="All">All Listings</option>
                <option value="Reposted">Reposted</option>
                <option value="Original">Original</option>
              </FilterSelect>

              <FilterSelect
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option value="All">All Sources</option>
                {sourceOptions.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </FilterSelect>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/30">
              <button
                type="button"
                onClick={() => setIsPositiveFilterOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-emerald-400" />
                  Positive Keywords
                  {positiveFiltersCount > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[10px] text-emerald-300">
                      {positiveKeywords.length}
                    </span>
                  )}
                </div>

                {isPositiveFilterOpen ? (
                  <ChevronUp size={16} className="text-slate-400" />
                ) : (
                  <ChevronDown size={16} className="text-slate-400" />
                )}
              </button>

              {isPositiveFilterOpen && (
                <div className="border-t border-slate-700/50 p-3">
                  <form
                    onSubmit={addPositiveKeyword}
                    className="mb-3 flex gap-2"
                  >
                    <input
                      type="text"
                      value={newPositiveKeyword}
                      onChange={(event) =>
                        setNewPositiveKeyword(event.target.value)
                      }
                      placeholder="e.g., React, Node, AWS..."
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500/50"
                    />

                    <button
                      type="submit"
                      disabled={!newPositiveKeyword.trim()}
                      className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </form>

                  {positiveKeywords.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {positiveKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-900/50 bg-emerald-950/30 px-2 py-1 text-[11px] font-medium text-emerald-200"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => removePositiveKeyword(keyword)}
                            className="rounded-full text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-200"
                          >
                            <XCircle size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400">
                    Each matched positive keyword adds +1 to the job score.
                  </p>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/30">
              <button
                type="button"
                onClick={() => setIsNegativeFilterOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-2">
                  <Filter size={15} className="text-red-400" />
                  Negative Filters
                  {negativeFiltersCount > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500/20 text-[10px] text-red-300">
                      {negativeFiltersCount}
                    </span>
                  )}
                </div>

                {isNegativeFilterOpen ? (
                  <ChevronUp size={16} className="text-slate-400" />
                ) : (
                  <ChevronDown size={16} className="text-slate-400" />
                )}
              </button>

              {isNegativeFilterOpen && (
                <div className="border-t border-slate-700/50 p-3">
                  <form
                    onSubmit={addNegativeKeyword}
                    className="mb-3 flex gap-2"
                  >
                    <input
                      type="text"
                      value={newNegativeKeyword}
                      onChange={(event) =>
                        setNewNegativeKeyword(event.target.value)
                      }
                      placeholder="e.g., Java, PHP..."
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-red-500/50"
                    />

                    <button
                      type="submit"
                      disabled={!newNegativeKeyword.trim()}
                      className="rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </form>

                  {negativeKeywords.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {negativeKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-900/50 bg-red-950/30 px-2 py-1 text-[11px] font-medium text-red-200"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => removeNegativeKeyword(keyword)}
                            className="rounded-full text-red-400 hover:bg-red-900/50 hover:text-red-200"
                          >
                            <XCircle size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div
                    className={`mt-2 ${negativeKeywords.length > 0 ? "border-t border-slate-700/50 pt-3" : ""}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                        <Users size={14} className="text-slate-400" />
                        Max Applicants
                      </label>

                      <span className="text-xs font-medium text-red-300">
                        {maxApplicantsLimit === Number.MAX_SAFE_INTEGER
                          ? "Unlimited"
                          : maxApplicantsLimit}
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max={maxPossibleApplicants}
                      value={
                        maxApplicantsLimit === Number.MAX_SAFE_INTEGER
                          ? maxPossibleApplicants
                          : maxApplicantsLimit
                      }
                      onChange={onApplicantsLimitChange}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-red-500"
                    />

                    <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                      <span>0</span>
                      <span>{maxPossibleApplicants} (Max)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <FilterSelect
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  <option value="relevance">Sort by: Relevance</option>
                  <option value="recent">Sort by: Most Recent</option>
                  <option value="applicants">Sort by: Applicants</option>
                  <option value="title">Sort by: Title</option>
                  <option value="company">Sort by: Company</option>
                </FilterSelect>
              </div>

              <div className="flex shrink-0 items-center gap-2 text-sm text-slate-400">
                <span>{filteredJobs.length} results</span>

                {negativeMatchCount > 0 && (
                  <span className="text-xs text-red-400">
                    ({negativeMatchCount} filtered)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {filteredJobs.length > 0 ? (
              filteredJobs.map((job) => (
                <JobListItem
                  key={job.id}
                  job={job}
                  isSelected={selectedJobId === job.id}
                  onSelect={onSelectJob}
                />
              ))
            ) : (
              <EmptyState
                title="No jobs found"
                description="Try changing the search term or one of the filters."
              />
            )}
          </div>
        </aside>

        <div
          className="w-2 cursor-col-resize bg-slate-800 transition hover:bg-sky-500"
          onMouseDown={handleMouseDown}
        />

        <main className="flex-1 bg-[#0d1728]">
          <JobDetailView job={selectedJob} />
        </main>
      </div>
    </div>
  );
};

export default JobListingView;
