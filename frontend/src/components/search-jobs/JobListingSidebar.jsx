import React, { useState, useEffect } from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Database,
  RefreshCw,
  Trash2,
  Target,
  XCircle,
  Sparkles,
  Filter,
  Users,
  Briefcase,
  Clock3,
  Code2,
  ShieldCheck,
  Repeat2,
  X,
  Building2,
  MapPin,
  BookmarkCheck,
} from "lucide-react";

import { formatShortDateTime } from "../../utils/dateUtils.js";
import {
  getCompetitionStyle,
  getExperienceStyle,
  getSeniorityStyle,
  getTypeStyle,
} from "../tracking/utils/jobUtils.js";
import {
  buildJobInsights,
  InsightBadge,
  placeholderLogo,
  ScoreBadge,
  TechBadge,
  Badge,
  formatApplicantsLabel,
  getPostedBadgeClasses,
  getPostedBadgeText,
} from "./joblistUtils.jsx";

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

const formatRemainingTime = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return "—";

  const totalSeconds = Math.ceil(ms / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const totalMinutes = Math.ceil(totalSeconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes}min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}min`;
};

const formatEta = (date) => {
  if (!date) return "—";

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const LiveProgressBar = ({ progressData }) => {
  const [enrichStartedAt, setEnrichStartedAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!progressData) {
      setEnrichStartedAt(null);
      setNow(Date.now());
      return;
    }

    if (progressData.step === "fetching") {
      setEnrichStartedAt(null);
      setNow(Date.now());
      return;
    }

    if (
      progressData.step === "enriching" &&
      progressData.total > 0 &&
      enrichStartedAt === null
    ) {
      setEnrichStartedAt(Date.now());
      setNow(Date.now());
    }
  }, [progressData, enrichStartedAt]);

  useEffect(() => {
    if (
      !progressData ||
      progressData.step !== "enriching" ||
      !enrichStartedAt
    ) {
      return;
    }

    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [progressData, enrichStartedAt]);

  if (!progressData) return null;

  const { step, message, current = 0, total = 0 } = progressData;

  let percent = 0;

  if (step === "fetching") {
    percent = 10;
  } else if (step === "parsing") {
    percent = 20;
  } else if (step === "enriching" && total > 0) {
    const enrichPercent = (current / total) * 80;
    percent = 20 + enrichPercent;
  }

  const elapsedMs =
    step === "enriching" && enrichStartedAt
      ? Math.max(now - enrichStartedAt, 0)
      : 0;

  const elapsedMinutes = elapsedMs / 60000;

  const jobsPerMinute =
    step === "enriching" && current > 0 && elapsedMinutes > 0
      ? current / elapsedMinutes
      : null;

  const remainingJobs =
    step === "enriching" && total > 0 ? Math.max(total - current, 0) : null;

  const remainingMs =
    jobsPerMinute && remainingJobs != null
      ? (remainingJobs / jobsPerMinute) * 60000
      : null;

  const eta =
    remainingMs && Number.isFinite(remainingMs)
      ? new Date(now + remainingMs)
      : null;

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

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            jobs/min
          </p>
          <p className="text-sm font-semibold text-slate-100">
            {jobsPerMinute ? jobsPerMinute.toFixed(2) : "—"}
          </p>
        </div>

        <div className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            jobs faltando
          </p>
          <p className="text-sm font-semibold text-slate-100">
            {remainingJobs != null ? `${remainingJobs} jobs` : "—"}
          </p>
        </div>

        <div className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            tempo restante
          </p>
          <p className="text-sm font-semibold text-slate-100">
            {formatRemainingTime(remainingMs)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            ETA
          </p>
          <p className="text-sm font-semibold text-slate-100">
            {formatEta(eta)}
          </p>
        </div>
      </div>
    </div>
  );
};

const FetchJobsModal = ({
  isOpen,
  onClose,
  fetchCount,
  setFetchCount,
  fetchQuery,
  setFetchQuery,
  onConfirm,
  loading,
  progressData,
}) => {
  if (!isOpen) return null;

  const handleIncrement = (amount) => {
    setFetchCount((prev) => Math.max(10, prev + amount));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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

        <p className="mb-4 text-sm text-slate-400">
          How many jobs would you like to fetch from the backend?
        </p>

        <div className="mb-5">
          <label
            htmlFor="fetch-jobs-query"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Search query
          </label>
          <input
            id="fetch-jobs-query"
            type="text"
            value={fetchQuery}
            onChange={(event) => setFetchQuery(event.target.value)}
            disabled={loading}
            placeholder="e.g. React, Python backend, Node.js"
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500 disabled:opacity-60"
          />
        </div>

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
              onClick={() => onConfirm(fetchCount, fetchQuery)}
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

const CompanyFilterModal = ({
  isOpen,
  onClose,
  companyOptions,
  selectedCompanies,
  onToggle,
}) => {
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const filtered = companyOptions.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-md max-h-[80vh] flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100">
            <Building2 size={20} className="text-red-400" />
            Exclude Companies
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-slate-800 p-4">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search companies to filter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none transition focus:border-red-500/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length > 0 ? (
            filtered.map((company) => {
              const isSelected = selectedCompanies.includes(company.value);
              return (
                <label
                  key={company.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg p-3 transition hover:bg-slate-800/50"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(company.value)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500/50 focus:ring-offset-slate-900"
                  />
                  <span className="text-sm font-medium text-slate-200">
                    {company.label}
                  </span>
                </label>
              );
            })
          ) : (
            <p className="p-4 text-center text-sm text-slate-500">
              No companies found.
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-800 p-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-red-600/20 px-6 py-2 text-sm font-bold text-red-400 transition hover:bg-red-600/30"
          >
            Done
          </button>
        </div>
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
      : job.isSaved
        ? "border-emerald-400/70 bg-emerald-950/30 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.16)]"
        : "border-sky-400/70 bg-sky-950/40 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.14)]"
    : job.isNegativeMatch
      ? "border-red-900/30 bg-red-950/10 hover:border-red-800/40 hover:bg-red-900/20 opacity-60 hover:opacity-100"
      : job.isSaved
        ? "border-emerald-500/40 bg-emerald-950/15 hover:border-emerald-400/60 hover:bg-emerald-950/25"
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
              {job.isSaved && (
                <BookmarkCheck
                  size={16}
                  className="text-emerald-300"
                  title="Saved job"
                />
              )}

              {job.isNegativeMatch && (
                <XCircle
                  size={16}
                  className="text-red-500"
                  title="Matches Negative Filter or Missing Must-Have"
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

const JobListingSidebar = ({
  leftPanelWidth,
  jobsState,
  filtersState,
  filterOptions,
  actions,
  fetchModalState,
  fetchModalActions,
}) => {
  const {
    filteredJobs,
    negativeMatchCount,
    savedJobsCount,
    selectedJobId,
    loading,
    progressData,
    errorMessage,
    cacheTimestamp,
    loadedFromCache,
    showHiddenJobs,
  } = jobsState;

  const {
    searchTerm,
    excludedWorkplaceTypes,
    verificationFilter,
    repostedFilter,
    sourceFilter,
    sortBy,
    negativeKeywords,
    newNegativeKeyword,
    negativeCompanies,
    positiveKeywords,
    newPositiveKeyword,
    mustHaveKeywords,
    newMustHaveKeyword,
    maxApplicantsLimit,
    negativeFiltersCount,
    positiveFiltersCount,
    mustHaveFiltersCount,
  } = filtersState;

  const {
    workplaceExclusionOptions,
    sourceOptions,
    companyOptions,
    maxPossibleApplicants,
  } = filterOptions;

  const {
    onSelectJob,
    onConfirmFetch,
    onClearCache,
    setSearchTerm,
    toggleExcludedWorkplaceType,
    setVerificationFilter,
    setRepostedFilter,
    setSourceFilter,
    setSortBy,
    setShowHiddenJobs,
    setNewNegativeKeyword,
    addNegativeKeyword,
    removeNegativeKeyword,
    toggleNegativeCompany,
    setNewPositiveKeyword,
    addPositiveKeyword,
    removePositiveKeyword,
    setNewMustHaveKeyword,
    addMustHaveKeyword,
    removeMustHaveKeyword,
    onApplicantsLimitChange,
  } = actions;

  const { isFetchModalOpen, fetchCount, fetchQuery } = fetchModalState;
  const { setIsFetchModalOpen, setFetchCount, setFetchQuery } =
    fetchModalActions;

  const [isGeneralFiltersOpen, setIsGeneralFiltersOpen] = useState(false);
  const [isMustHaveFilterOpen, setIsMustHaveFilterOpen] = useState(false);
  const [isPositiveFilterOpen, setIsPositiveFilterOpen] = useState(false);
  const [isNegativeFilterOpen, setIsNegativeFilterOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);

  const cacheStatusTone = !cacheTimestamp
    ? "slate"
    : loadedFromCache
      ? "amber"
      : "green";

  const handleConfirmFetchAndClose = async (count, query) => {
    await onConfirmFetch(count, query);
    setIsFetchModalOpen(false);
  };

  const activeGeneralFiltersCount = [
    verificationFilter !== "All",
    repostedFilter !== "All",
    sourceFilter !== "All",
  ].filter(Boolean).length;

  return (
    <>
      <FetchJobsModal
        isOpen={isFetchModalOpen}
        onClose={() => setIsFetchModalOpen(false)}
        fetchCount={fetchCount}
        setFetchCount={setFetchCount}
        fetchQuery={fetchQuery}
        setFetchQuery={setFetchQuery}
        onConfirm={handleConfirmFetchAndClose}
        loading={loading}
        progressData={progressData}
      />

      <CompanyFilterModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        companyOptions={companyOptions}
        selectedCompanies={negativeCompanies}
        onToggle={toggleNegativeCompany}
      />

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

          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/30">
            <button
              type="button"
              onClick={() => setIsGeneralFiltersOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/50"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-sky-400" />
                General Filters
                {activeGeneralFiltersCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500/20 px-1 text-[10px] text-sky-300">
                    {activeGeneralFiltersCount}
                  </span>
                )}
              </div>

              {isGeneralFiltersOpen ? (
                <ChevronUp size={16} className="text-slate-400" />
              ) : (
                <ChevronDown size={16} className="text-slate-400" />
              )}
            </button>

            {isGeneralFiltersOpen && (
              <div className="border-t border-slate-700/50 p-3 space-y-3">
                <div className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex flex-wrap items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-800/80">
                        <Database size={14} className="text-sky-400" />
                      </div>

                      <span className="text-sm font-medium text-slate-100">
                        Cache
                      </span>

                      {cacheTimestamp && (
                        <Badge tone={cacheStatusTone}>
                          {formatShortDateTime(cacheTimestamp)}
                        </Badge>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
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

                      {cacheTimestamp && (
                        <button
                          type="button"
                          onClick={onClearCache}
                          aria-label="Clear cache"
                          title="Clear cache"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-400 transition hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-300"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {errorMessage && (
                    <p className="mt-2 text-xs text-red-300">{errorMessage}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FilterSelect
                    value={verificationFilter}
                    onChange={(event) =>
                      setVerificationFilter(event.target.value)
                    }
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
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/30">
            <button
              type="button"
              onClick={() => setIsMustHaveFilterOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/50"
            >
              <div className="flex items-center gap-2">
                <Target size={15} className="text-amber-400" />
                Must-Have Keywords
                {mustHaveFiltersCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] text-amber-300">
                    {mustHaveKeywords.length}
                  </span>
                )}
              </div>

              {isMustHaveFilterOpen ? (
                <ChevronUp size={16} className="text-slate-400" />
              ) : (
                <ChevronDown size={16} className="text-slate-400" />
              )}
            </button>

            {isMustHaveFilterOpen && (
              <div className="border-t border-slate-700/50 p-3">
                <form onSubmit={addMustHaveKeyword} className="mb-3 flex gap-2">
                  <input
                    type="text"
                    value={newMustHaveKeyword}
                    onChange={(event) =>
                      setNewMustHaveKeyword(event.target.value)
                    }
                    placeholder="e.g., Python, SQL..."
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-500/50"
                  />

                  <button
                    type="submit"
                    disabled={!newMustHaveKeyword.trim()}
                    className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    Add
                  </button>
                </form>

                {mustHaveKeywords.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {mustHaveKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center gap-1.5 rounded-md border border-amber-900/50 bg-amber-950/30 px-2 py-1 text-[11px] font-medium text-amber-200"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeMustHaveKeyword(keyword)}
                          className="rounded-full text-amber-400 hover:bg-amber-900/50 hover:text-amber-200"
                        >
                          <XCircle size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-slate-400">
                  Jobs missing any of these will be marked negative.
                </p>
              </div>
            )}
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
                <form onSubmit={addPositiveKeyword} className="mb-3 flex gap-2">
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
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500/20 px-1 text-[10px] text-red-300">
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
                <form onSubmit={addNegativeKeyword} className="mb-3 flex gap-2">
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
                  className={`mt-2 ${
                    negativeKeywords.length > 0
                      ? "border-t border-slate-700/50 pt-3"
                      : ""
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                      <Building2 size={14} className="text-slate-400" />
                      Excluded Companies
                    </label>

                    <button
                      type="button"
                      onClick={() => setIsCompanyModalOpen(true)}
                      className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
                    >
                      Manage
                    </button>
                  </div>

                  {negativeCompanies.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {negativeCompanies.map((company) => (
                        <span
                          key={company}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-900/50 bg-red-950/30 px-2 py-1 text-[11px] font-medium text-red-200"
                        >
                          {company}
                          <button
                            type="button"
                            onClick={() => toggleNegativeCompany(company)}
                            className="rounded-full text-red-400 hover:bg-red-900/50 hover:text-red-200"
                          >
                            <XCircle size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className={`mt-2 ${
                    negativeKeywords.length > 0 || negativeCompanies.length > 0
                      ? "border-t border-slate-700/50 pt-3"
                      : ""
                  }`}
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

                <div
                  className={`mt-2 ${
                    negativeKeywords.length > 0 ||
                    negativeCompanies.length > 0 ||
                    maxApplicantsLimit !== Number.MAX_SAFE_INTEGER
                      ? "border-t border-slate-700/50 pt-3"
                      : ""
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                      <MapPin size={14} className="text-slate-400" />
                      Workplace Type Exclusion
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {workplaceExclusionOptions.map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-700 bg-slate-900/50 px-2 py-2 text-xs font-medium text-slate-200 transition hover:border-red-500/50 hover:bg-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={excludedWorkplaceTypes.includes(
                            option.value,
                          )}
                          onChange={() =>
                            toggleExcludedWorkplaceType(option.value)
                          }
                          className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-red-500"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
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
                <option value="keywordScore">Sort by: Keyword Score</option>
                <option value="pythonScore">Sort by: Python Score</option>
                <option value="aiScore">Sort by: AI Match</option>
                <option value="recent">Sort by: Most Recent</option>
                <option value="applicants">Sort by: Applicants</option>
                <option value="title">Sort by: Title</option>
                <option value="company">Sort by: Company</option>
              </FilterSelect>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-sm text-slate-400">
              <span>{filteredJobs.length} results</span>

              {negativeMatchCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHiddenJobs((prev) => !prev)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                    showHiddenJobs
                      ? "border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                      : "border-slate-700 bg-slate-800/60 text-red-400 hover:border-red-500/40 hover:bg-red-500/10"
                  }`}
                  title={
                    showHiddenJobs
                      ? "Hide jobs matching negative filters"
                      : "Show jobs matching negative filters"
                  }
                >
                  {showHiddenJobs
                    ? "Hide filtered"
                    : `Show filtered (${negativeMatchCount})`}
                </button>
              )}

              <span className="text-xs font-semibold text-emerald-300">
                ({savedJobsCount} saved)
              </span>
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
    </>
  );
};

export default JobListingSidebar;
