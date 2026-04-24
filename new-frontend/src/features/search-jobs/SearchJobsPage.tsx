import {useEffect, useMemo, useState, type FormEvent} from "react"
import {
    BookmarkCheck,
    Briefcase,
    Building2,
    Clock3,
    Code2,
    ExternalLink, Filter,
    MapPin,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Users,
    XCircle,
} from "lucide-react"
import {
    clearJobsCacheMock,
    fetchJobsMock,
    type FetchJobsProgress,
    getInitialSearchJobsMockData,
    placeholderLogo,
    readSavedJobIdsMock,
    type SearchJob, toggleSavedJobMock
} from "./searchJobsMockService.ts";
import SearchJobsFilters, {type SelectOption, type SortOption, type VerificationFilter} from "./SearchJobsFilters.tsx";

type SearchJobView = SearchJob & {
    isSaved: boolean
    isNegativeMatch: boolean
    positiveScore: number
    matchedPositiveKeywords: string[]
    missingMustHaveKeywords: string[]
}

type BadgeTone =
    | "green"
    | "amber"
    | "blue"
    | "red"
    | "purple"
    | "slate"
    | "emerald"

const WORKPLACE_OPTIONS: SelectOption[] = [
    {value: "Remote", label: "Remote"},
    {value: "Hybrid", label: "Hybrid"},
    {value: "On-site", label: "On-site"},
]

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message
    return "Unexpected error."
}

const normalizeText = (value: unknown) =>
    String(value ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")

const buildJobHaystack = (job: SearchJob) =>
    [
        job.title,
        job.company.name,
        job.location,
        job.workplaceType,
        job.sourceLabel,
        job.description,
        job.seniority,
        job.jobType,
        job.experienceYears,
        job.archetype,
        ...job.keywords,
    ].join(" ")

const matchesKeyword = (haystack: string, keyword: string) =>
    normalizeText(haystack).includes(normalizeText(keyword))

const formatDateValue = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value))

const getPostedText = (value: string) => {
    const postedTime = new Date(value).getTime()
    const diffMs = Math.max(Date.now() - postedTime, 0)
    const diffDays = Math.floor(diffMs / 86_400_000)

    if (diffDays <= 0) return "Posted today"
    if (diffDays === 1) return "Posted 1d ago"

    return `Posted ${diffDays}d ago`
}

const formatApplicantsLabel = (value: number | null) => {
    if (value == null) return "Applicants unknown"
    if (value === 1) return "1 applicant"

    return `${value} applicants`
}

const getBadgeClasses = (tone: BadgeTone) => {
    const tones: Record<BadgeTone, string> = {
        green: "border-green-500/30 bg-green-500/10 text-green-300",
        amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
        blue: "border-sky-500/30 bg-sky-500/10 text-sky-300",
        red: "border-red-500/30 bg-red-500/10 text-red-300",
        purple: "border-violet-500/30 bg-violet-500/10 text-violet-300",
        slate: "border-slate-600 bg-slate-800/80 text-slate-200",
        emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    }

    return tones[tone]
}

function Badge({
                   tone,
                   children,
               }: {
    tone: BadgeTone
    children: React.ReactNode
}) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${getBadgeClasses(tone)}`}
        >
            {children}
        </span>
    )
}

function ScoreBadge({ score }: { score: number }) {
    return (
        <Badge tone={score > 0 ? "emerald" : "slate"}>
            <Sparkles size={12} />
            Keyword Score {score}
        </Badge>
    )
}

function getArchetypeLabel(value: string) {
    const labels: Record<string, string> = {
        backend_python_pure: "🐍 Pure Python Backend",
        backend_python_with_minor_cross_functional_signals: "🧩 Backend Python",
        backend_python_fullstack: "🧱 Python Full-Stack",
        platform_or_internal_systems_python: "🏗️ Platform/Internal Systems",
        ai_or_llm_python: "✨ AI/LLM Python",
        qa_python: "✅ QA Python",
        generic_backend_non_python: "🏷️ Generic Backend",
        non_python_junior: "⚠️ Non-Python Junior",
    }

    return labels[value] ?? value
}

function getTechStack(job: SearchJob) {
    return job.keywords.slice(0, 10)
}

function createOptions<T>(
    items: T[],
    getValue: (item: T) => string | null | undefined,
    getLabel?: (item: T) => string | null | undefined,
): SelectOption[] {
    const map = new Map<string, string>()

    items.forEach((item) => {
        const value = getValue(item)
        if (!value) return

        map.set(value, getLabel?.(item) ?? value)
    })

    return [...map.entries()]
        .map(([value, label]) => ({value, label}))
        .sort((a, b) => a.label.localeCompare(b.label))
}

function FetchJobsModal({
                            isOpen,
                            count,
                            query,
                            loading,
                            progress,
                            onCountChange,
                            onQueryChange,
                            onClose,
                            onConfirm,
                        }: {
    isOpen: boolean
    count: number
    query: string
    loading: boolean
    progress: FetchJobsProgress | null
    onCountChange: (value: number) => void
    onQueryChange: (value: string) => void
    onClose: () => void
    onConfirm: () => void
}) {
    if (!isOpen) return null

    const progressPercent =
        progress && progress.total > 0
            ? Math.round((progress.current / progress.total) * 100)
            : progress?.step === "fetching"
                ? 10
                : 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100">
                        <RefreshCw size={20} className="text-sky-400"/>
                        Fetch New Jobs
                    </h2>

                    {!loading && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <p className="mb-4 text-sm text-slate-400">
                    This uses mock data and simulates the old backend flow.
                </p>

                <label
                    htmlFor="fetch-query"
                    className="mb-2 block text-sm font-medium text-slate-200"
                >
                    Search query
                </label>

                <input
                    id="fetch-query"
                    type="text"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    disabled={loading}
                    placeholder="e.g. Python backend, React, FastAPI"
                    className="mb-5 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500 disabled:opacity-60"
                />

                <div className="mb-6 flex flex-col items-center gap-4">
                    <div className="flex items-center gap-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-3">
                        <button
                            type="button"
                            onClick={() => onCountChange(Math.max(10, count - 10))}
                            disabled={loading || count <= 10}
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700 text-xl font-bold text-slate-200 transition hover:bg-slate-600 disabled:opacity-50"
                        >
                            -
                        </button>

                        <div className="flex w-20 flex-col items-center">
                            <span className="text-3xl font-bold text-sky-400">
                                {count}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500">
                                Jobs
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => onCountChange(Math.min(100, count + 10))}
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
                                type="button"
                                onClick={() => onCountChange(preset)}
                                disabled={loading}
                                className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                                    count === preset
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
                    <div className="rounded-xl border border-sky-900/40 bg-slate-800/40 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-medium text-sky-400">
                                <RefreshCw
                                    size={12}
                                    className="mr-1.5 inline animate-spin"
                                />
                                {progress?.message ?? "Starting mock fetch..."}
                            </span>

                            <span className="text-xs font-bold text-sky-300">
                                {progressPercent}%
                            </span>
                        </div>

                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950">
                            <div
                                className="h-full rounded-full bg-sky-500 transition-all duration-300"
                                style={{width: `${progressPercent}%`}}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={onConfirm}
                            className="flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-sky-900/20 transition hover:bg-sky-500"
                        >
                            Fetch Mock Jobs
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function JobListItem({
                         job,
                         isSelected,
                         onSelect,
                     }: {
    job: SearchJobView
    isSelected: boolean
    onSelect: (jobId: string) => void
}) {
    const selectedClasses = isSelected
        ? job.isNegativeMatch
            ? "border-red-500/70 bg-red-950/40"
            : job.isSaved
                ? "border-emerald-400/70 bg-emerald-950/30"
                : "border-sky-400/70 bg-sky-950/40"
        : job.isNegativeMatch
            ? "border-red-900/30 bg-red-950/10 opacity-60 hover:border-red-800/40 hover:bg-red-900/20 hover:opacity-100"
            : job.isSaved
                ? "border-emerald-500/40 bg-emerald-950/15 hover:border-emerald-400/60 hover:bg-emerald-950/25"
                : "border-slate-800 bg-[#0a1728] hover:border-slate-700 hover:bg-slate-800/40"

    return (
        <button
            type="button"
            onClick={() => onSelect(job.id)}
            className={`mx-3 my-2 block w-[calc(100%-1.5rem)] rounded-2xl border p-4 text-left transition-all ${selectedClasses}`}
        >
            <div className="flex gap-3">
                <img
                    src={job.company.logoUrl}
                    alt={`${job.company.name} logo`}
                    className={`h-12 w-12 shrink-0 rounded-xl border border-slate-700 bg-slate-900 object-contain ${
                        job.isNegativeMatch ? "grayscale" : ""
                    }`}
                    onError={(event) => {
                        event.currentTarget.src = placeholderLogo(job.company.name)
                    }}
                />

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3
                                className={`truncate text-[18px] font-semibold leading-tight ${
                                    job.isNegativeMatch
                                        ? "text-red-200/70"
                                        : "text-slate-100"
                                }`}
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
                                />
                            )}

                            {job.isNegativeMatch && (
                                <XCircle size={16} className="text-red-500"/>
                            )}

                            {job.verified && (
                                <ShieldCheck size={16} className="text-emerald-400"/>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <ScoreBadge score={job.positiveScore} />

                        <Badge tone="purple">
                            <Code2 size={12}/>
                            Python Score: {Math.round(job.pythonScore)}
                        </Badge>

                        <Badge tone="slate">
                            <Briefcase size={12}/>
                            {job.seniority}
                        </Badge>

                        <Badge tone="blue">{job.workplaceType}</Badge>

                        <Badge tone="amber">
                            <Clock3 size={12}/>
                            {job.experienceYears} exp
                        </Badge>

                        <Badge tone="emerald">
                            <Users size={12}/>
                            {formatApplicantsLabel(job.applicantsTotal)}
                        </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-700/50 pt-3">
                        {getTechStack(job)
                            .slice(0, 5)
                            .map((tech) => (
                                <span
                                    key={`${job.id}-${tech}`}
                                    className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] font-semibold text-slate-300"
                                >
                                    {tech}
                                </span>
                            ))}
                    </div>
                </div>
            </div>
        </button>
    )
}

function InfoCard({
                      icon,
                      label,
                      value,
                  }: {
    icon: React.ReactNode
    label: string
    value: string
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/70 px-4 py-3">
            <span className="shrink-0 text-slate-400">{icon}</span>

            <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    {label}
                </p>
                <p className="truncate text-sm text-slate-200">{value}</p>
            </div>
        </div>
    )
}

function JobDetails({
                        job,
                        maxPythonScore,
                        onToggleSaved,
                    }: {
    job: SearchJobView | null
    maxPythonScore: number
    onToggleSaved: (job: SearchJobView) => void
}) {
    if (!job) {
        return (
            <div className="flex h-full items-center justify-center text-slate-400">
                Select a job to see the details.
            </div>
        )
    }

    const normalizedPythonScore =
        maxPythonScore > 0
            ? Math.max(0, Math.min((job.pythonScore / maxPythonScore) * 100, 100))
            : 0

    return (
        <div className="h-full overflow-y-auto px-6 py-7 md:px-8">
            <div className="mb-8 flex items-start gap-5">
                <img
                    src={job.company.logoUrl}
                    alt={`${job.company.name} logo`}
                    className="h-16 w-16 rounded-xl border border-slate-700 bg-slate-900 object-contain"
                    onError={(event) => {
                        event.currentTarget.src = placeholderLogo(job.company.name)
                    }}
                />

                <div className="min-w-0 flex-1">
                    <h2 className="text-3xl font-bold leading-tight text-white">
                        {job.title}

                        {job.isNegativeMatch && (
                            <span
                                className="ml-3 inline-flex items-center gap-1 align-middle rounded-md border border-red-900 bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
                                <XCircle size={12}/> Negative Match
                            </span>
                        )}
                    </h2>

                    <p className="mt-1 text-xl text-slate-300">{job.company.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{job.location}</p>
                    <p className="mt-1 text-xs text-slate-500">Job ID: {job.jobId}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <ScoreBadge score={job.positiveScore} />

                        <Badge tone="purple">
                            <Code2 size={12}/>
                            Python Score: {Math.round(job.pythonScore)}
                        </Badge>

                        {job.verified && <Badge tone="green">Verified</Badge>}
                        {job.reposted && <Badge tone="amber">Reposted</Badge>}
                        <Badge tone="blue">{job.workplaceType}</Badge>

                        <Badge tone="emerald">
                            <Users size={12}/>
                            {formatApplicantsLabel(job.applicantsTotal)}
                        </Badge>

                        <Badge tone="slate">
                            <Briefcase size={12}/>
                            {job.seniority}
                        </Badge>

                        <Badge tone="amber">
                            <Clock3 size={12}/>
                            {job.experienceYears} exp
                        </Badge>
                    </div>

                    <div className="mt-3">
                        <span
                            className="inline-flex max-w-full items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-200">
                            {getArchetypeLabel(job.archetype)}
                        </span>
                    </div>

                    {job.matchedPositiveKeywords.length > 0 && (
                        <p className="mt-3 text-sm text-slate-400">
                            Positive matches:{" "}
                            <span className="text-slate-200">
                                {job.matchedPositiveKeywords.join(", ")}
                            </span>
                        </p>
                    )}

                    {job.missingMustHaveKeywords.length > 0 && (
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
                                    Relative to the strongest Python match in the current
                                    filtered list
                                </p>
                            </div>

                            <div className="text-right">
                                <p className="text-2xl font-semibold text-indigo-300">
                                    {Math.round(job.pythonScore)}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {Math.round(normalizedPythonScore)}% of current max
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-300"
                                style={{width: `${normalizedPythonScore}%`}}
                            />
                        </div>

                        <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50">
                            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-200">
                                Why this score?
                            </summary>

                            <div className="space-y-4 border-t border-slate-800 px-4 py-4 text-sm text-slate-300">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                                        Positive Signals
                                    </p>

                                    <ul className="mt-2 space-y-2">
                                        {job.scoreBreakdown.positive.length > 0 ? (
                                            job.scoreBreakdown.positive.map((item) => (
                                                <li
                                                    key={`${item.label}-${item.points}`}
                                                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
                                                >
                                                    <div className="flex justify-between gap-3">
                                                        <p className="font-medium text-slate-100">
                                                            {item.label}
                                                        </p>
                                                        <span className="text-emerald-300">
                                                            +{item.points}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-xs text-slate-400">
                                                        {item.source}
                                                    </p>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="italic text-slate-500">None.</li>
                                        )}
                                    </ul>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                                        Negative Signals
                                    </p>

                                    <ul className="mt-2 space-y-2">
                                        {job.scoreBreakdown.negative.length > 0 ? (
                                            job.scoreBreakdown.negative.map((item) => (
                                                <li
                                                    key={`${item.label}-${item.points}`}
                                                    className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2"
                                                >
                                                    <div className="flex justify-between gap-3">
                                                        <p className="font-medium text-slate-100">
                                                            {item.label}
                                                        </p>
                                                        <span className="text-amber-300">
                                                            {item.points}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-xs text-slate-400">
                                                        {item.source}
                                                    </p>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="italic text-slate-500">None.</li>
                                        )}
                                    </ul>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Category Totals
                                    </p>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {Object.entries(
                                            job.scoreBreakdown.categoryTotals,
                                        ).map(([label, value]) => (
                                            <span
                                                key={label}
                                                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200"
                                            >
                                                {label}: {value}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </details>
                    </section>
                </div>
            </div>

            <div className="mb-8 flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={() => onToggleSaved(job)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold transition ${
                        job.isSaved
                            ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20"
                            : "border-slate-700 bg-slate-800 text-slate-200 hover:border-emerald-500/40 hover:bg-slate-700"
                    }`}
                >
                    <BookmarkCheck
                        size={16}
                        className={job.isSaved ? "text-emerald-300" : "text-slate-400"}
                    />
                    {job.isSaved ? "Saved" : "Save"}
                </button>

                <a
                    href={job.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
                >
                    <ExternalLink size={16}/>
                    Open Job
                </a>

                <a
                    href={job.company.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 font-semibold text-slate-100 transition hover:bg-slate-700"
                >
                    <Building2 size={16}/>
                    Company Page
                </a>

                {job.company.websiteUrl && (
                    <a
                        href={job.company.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 font-semibold text-slate-100 transition hover:bg-slate-700"
                    >
                        <Building2 size={16}/>
                        Company Website
                    </a>
                )}
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                <InfoCard
                    icon={<MapPin size={18}/>}
                    label="Location"
                    value={job.location}
                />
                <InfoCard
                    icon={<Briefcase size={18}/>}
                    label="Workplace Type"
                    value={job.workplaceType}
                />
                <InfoCard
                    icon={<Clock3 size={18}/>}
                    label="Posted At"
                    value={formatDateValue(job.postedAt)}
                />
                <InfoCard
                    icon={<Users size={18}/>}
                    label="Applicants"
                    value={formatApplicantsLabel(job.applicantsTotal)}
                />
                <InfoCard
                    icon={<ShieldCheck size={18}/>}
                    label="Verification"
                    value={job.verified ? "Verified" : "Not verified"}
                />
                <InfoCard
                    icon={<Sparkles size={18}/>}
                    label="Keyword Score"
                    value={String(job.positiveScore)}
                />
            </div>

            <section className="mb-8">
                <h3 className="mb-4 flex items-center border-b border-slate-800 pb-2 text-xl font-semibold text-slate-100">
                    <Code2 size={18} className="mr-2"/>
                    Detected Stack
                </h3>

                <div className="flex flex-wrap gap-2">
                    {getTechStack(job).map((tech) => (
                        <span
                            key={`${job.id}-detail-${tech}`}
                            className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-sm font-semibold text-slate-300"
                        >
                            {tech}
                        </span>
                    ))}
                </div>
            </section>

            <section>
                <h3 className="mb-4 flex items-center border-b border-slate-800 pb-2 text-xl font-semibold text-slate-100">
                    About This Listing
                </h3>

                <div
                    className="whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-800/60 p-4 text-sm leading-7 text-slate-300">
                    {job.description}
                </div>
            </section>
        </div>
    )
}

export default function SearchJobsPage() {
    const [jobs, setJobs] = useState<SearchJob[]>([])
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
    const [savedJobIds, setSavedJobIds] = useState<string[]>(() =>
        readSavedJobIdsMock(),
    )

    const [loading, setLoading] = useState(true)
    const [progressData, setProgressData] = useState<FetchJobsProgress | null>(
        null,
    )
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null)
    const [loadedFromCache, setLoadedFromCache] = useState(false)

    const [isFetchModalOpen, setIsFetchModalOpen] = useState(false)
    const [fetchCount, setFetchCount] = useState(10)
    const [fetchQuery, setFetchQuery] = useState("")

    const [searchTerm, setSearchTerm] = useState("")
    const [verificationFilter, setVerificationFilter] =
        useState<VerificationFilter>("All")
    const [sourceFilter, setSourceFilter] = useState("All")
    const [sortBy, setSortBy] = useState<SortOption>("relevance")
    const [showHiddenJobs, setShowHiddenJobs] = useState(false)

    const [positiveKeywords, setPositiveKeywords] = useState<string[]>([
        "python",
        "sql",
        "docker",
        "flask",
        "fastapi",
        "postgresql",
        "django",
    ])
    const [newPositiveKeyword, setNewPositiveKeyword] = useState("")

    const [mustHaveKeywords, setMustHaveKeywords] = useState<string[]>(["python"])
    const [newMustHaveKeyword, setNewMustHaveKeyword] = useState("")

    const [negativeKeywords, setNegativeKeywords] = useState<string[]>([
        "php",
        "java",
        "junior",
    ])
    const [newNegativeKeyword, setNewNegativeKeyword] = useState("")

    const [negativeCompanies, setNegativeCompanies] = useState<string[]>([])
    const [excludedWorkplaceTypes, setExcludedWorkplaceTypes] = useState<string[]>(
        [],
    )
    const [maxApplicantsLimit, setMaxApplicantsLimit] = useState(
        Number.MAX_SAFE_INTEGER,
    )

    useEffect(() => {
        let isMounted = true

        const loadInitialJobs = async () => {
            setLoading(true)
            setErrorMessage(null)

            try {
                const result = await getInitialSearchJobsMockData()

                if (!isMounted) return

                setJobs(result.jobs)
                setSelectedJobId(result.jobs[0]?.id ?? null)
                setCacheTimestamp(result.cachedAt)
                setLoadedFromCache(result.loadedFromCache)
            } catch (error) {
                if (!isMounted) return

                setErrorMessage(getErrorMessage(error))
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        void loadInitialJobs()

        return () => {
            isMounted = false
        }
    }, [])

    const sourceOptions = useMemo(
        () =>
            createOptions(
                jobs,
                (job) => job.sourceKey,
                (job) => job.sourceLabel,
            ),
        [jobs],
    )

    const companyOptions = useMemo(
        () => createOptions(jobs, (job) => job.company.name),
        [jobs],
    )

    const maxPossibleApplicants = useMemo(() => {
        const values = jobs
            .map((job) => job.applicantsTotal ?? 0)
            .filter((value) => Number.isFinite(value))

        return Math.max(100, ...values)
    }, [jobs])

    const filteredJobsState = useMemo(() => {
        let result = jobs.map<SearchJobView>((job) => {
            const haystack = buildJobHaystack(job)

            const matchedPositiveKeywords = positiveKeywords.filter((keyword) =>
                matchesKeyword(haystack, keyword),
            )

            const missingMustHaveKeywords = mustHaveKeywords.filter(
                (keyword) => !matchesKeyword(haystack, keyword),
            )

            const matchesNegativeKeyword = negativeKeywords.some((keyword) =>
                matchesKeyword(haystack, keyword),
            )

            const matchesNegativeCompany = negativeCompanies.includes(
                job.company.name,
            )

            const matchesExcludedWorkplace = excludedWorkplaceTypes.includes(
                job.workplaceType,
            )

            const exceedsApplicantsLimit =
                maxApplicantsLimit !== Number.MAX_SAFE_INTEGER &&
                job.applicantsTotal != null &&
                job.applicantsTotal > maxApplicantsLimit

            const isNegativeMatch =
                matchesNegativeKeyword ||
                matchesNegativeCompany ||
                matchesExcludedWorkplace ||
                exceedsApplicantsLimit ||
                missingMustHaveKeywords.length > 0

            return {
                ...job,
                isSaved: savedJobIds.includes(job.id),
                isNegativeMatch,
                positiveScore: matchedPositiveKeywords.length,
                matchedPositiveKeywords,
                missingMustHaveKeywords,
            }
        })

        if (searchTerm.trim()) {
            const query = normalizeText(searchTerm)

            result = result.filter((job) =>
                normalizeText(buildJobHaystack(job)).includes(query),
            )
        }

        if (verificationFilter === "Verified") {
            result = result.filter((job) => job.verified)
        }

        if (verificationFilter === "Unverified") {
            result = result.filter((job) => !job.verified)
        }

        if (sourceFilter !== "All") {
            result = result.filter((job) => job.sourceKey === sourceFilter)
        }

        const negativeMatchCount = result.filter(
            (job) => job.isNegativeMatch,
        ).length

        const visibleJobs = result.filter((job) => !job.isNegativeMatch)
        const hiddenJobs = result.filter((job) => job.isNegativeMatch)

        result = showHiddenJobs ? [...visibleJobs, ...hiddenJobs] : visibleJobs

        result.sort((a, b) => {
            if (a.isNegativeMatch !== b.isNegativeMatch) {
                return a.isNegativeMatch ? 1 : -1
            }

            if (sortBy === "relevance") {
                const scoreA = a.pythonScore + a.positiveScore * 12
                const scoreB = b.pythonScore + b.positiveScore * 12

                if (scoreA !== scoreB) return scoreB - scoreA

                return (
                    new Date(b.postedAt).getTime() -
                    new Date(a.postedAt).getTime()
                )
            }

            if (sortBy === "keywordScore") {
                return b.positiveScore - a.positiveScore
            }

            if (sortBy === "pythonScore") {
                return b.pythonScore - a.pythonScore
            }

            if (sortBy === "recent") {
                return (
                    new Date(b.postedAt).getTime() -
                    new Date(a.postedAt).getTime()
                )
            }

            if (sortBy === "applicants") {
                return (a.applicantsTotal ?? Infinity) - (b.applicantsTotal ?? Infinity)
            }

            if (sortBy === "title") {
                return a.title.localeCompare(b.title)
            }

            if (sortBy === "company") {
                return a.company.name.localeCompare(b.company.name)
            }

            return 0
        })

        return {
            filteredJobs: result,
            negativeMatchCount,
        }
    }, [
        jobs,
        positiveKeywords,
        mustHaveKeywords,
        negativeKeywords,
        negativeCompanies,
        excludedWorkplaceTypes,
        maxApplicantsLimit,
        savedJobIds,
        searchTerm,
        verificationFilter,
        sourceFilter,
        showHiddenJobs,
        sortBy,
    ])

    const {filteredJobs, negativeMatchCount} = filteredJobsState

    const savedJobsCount = useMemo(
        () => filteredJobs.filter((job) => job.isSaved).length,
        [filteredJobs],
    )

    const maxPythonScore = useMemo(() => {
        if (filteredJobs.length === 0) return 0

        return Math.max(...filteredJobs.map((job) => job.pythonScore))
    }, [filteredJobs])

    useEffect(() => {
        if (filteredJobs.length === 0) {
            setSelectedJobId(null)
            return
        }

        const stillExists = filteredJobs.some((job) => job.id === selectedJobId)

        if (!stillExists) {
            setSelectedJobId(filteredJobs[0].id)
        }
    }, [filteredJobs, selectedJobId])

    const selectedJob =
        filteredJobs.find((job) => job.id === selectedJobId) ?? null

    const addKeyword = (
        event: FormEvent<HTMLFormElement>,
        value: string,
        currentKeywords: string[],
        onChange: (keywords: string[]) => void,
        onInputChange: (value: string) => void,
    ) => {
        event.preventDefault()

        const normalized = value.trim().toLowerCase()

        if (normalized && !currentKeywords.includes(normalized)) {
            onChange([...currentKeywords, normalized])
        }

        onInputChange("")
    }

    const removeKeyword = (
        keyword: string,
        currentKeywords: string[],
        onChange: (keywords: string[]) => void,
    ) => {
        onChange(currentKeywords.filter((item) => item !== keyword))
    }

    const toggleValue = (
        value: string,
        currentValues: string[],
        onChange: (values: string[]) => void,
    ) => {
        if (currentValues.includes(value)) {
            onChange(currentValues.filter((item) => item !== value))
            return
        }

        onChange([...currentValues, value])
    }

    const handleFetchJobs = async () => {
        setLoading(true)
        setErrorMessage(null)
        setProgressData(null)

        try {
            const result = await fetchJobsMock({
                count: fetchCount,
                query: fetchQuery,
                onProgress: setProgressData,
            })

            setJobs(result.jobs)
            setSelectedJobId(result.jobs[0]?.id ?? null)
            setCacheTimestamp(result.cachedAt)
            setLoadedFromCache(result.loadedFromCache)
            setIsFetchModalOpen(false)
        } catch (error) {
            setErrorMessage(getErrorMessage(error))
        } finally {
            setLoading(false)
            setProgressData(null)
        }
    }

    const handleClearCache = () => {
        clearJobsCacheMock()
        setJobs([])
        setSelectedJobId(null)
        setCacheTimestamp(null)
        setLoadedFromCache(false)
        setErrorMessage(null)
        setProgressData(null)
        setIsFetchModalOpen(true)
    }

    const handleToggleSaved = (job: SearchJobView) => {
        setSavedJobIds(toggleSavedJobMock(job.id))
    }

    const handleMaxApplicantsLimitChange = (value: number) => {
        if (value >= maxPossibleApplicants) {
            setMaxApplicantsLimit(Number.MAX_SAFE_INTEGER)
            return
        }

        setMaxApplicantsLimit(value)
    }

    return (
        <>
            <FetchJobsModal
                isOpen={isFetchModalOpen}
                count={fetchCount}
                query={fetchQuery}
                loading={loading}
                progress={progressData}
                onCountChange={setFetchCount}
                onQueryChange={setFetchQuery}
                onClose={() => setIsFetchModalOpen(false)}
                onConfirm={() => void handleFetchJobs()}
            />

            <div
                className="mx-auto flex h-[calc(100vh-7rem)] w-full max-w-7xl overflow-hidden rounded-2xl border border-slate-800 bg-[#081120] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
                <aside className="flex w-[430px] shrink-0 flex-col border-r border-slate-800 bg-[#0b1526]">
                    <SearchJobsFilters
                        searchTerm={searchTerm}
                        onSearchTermChange={setSearchTerm}
                        verificationFilter={verificationFilter}
                        onVerificationFilterChange={setVerificationFilter}
                        sourceFilter={sourceFilter}
                        onSourceFilterChange={setSourceFilter}
                        sortBy={sortBy}
                        onSortByChange={setSortBy}
                        positiveKeywords={positiveKeywords}
                        newPositiveKeyword={newPositiveKeyword}
                        onNewPositiveKeywordChange={setNewPositiveKeyword}
                        onAddPositiveKeyword={(event) =>
                            addKeyword(
                                event,
                                newPositiveKeyword,
                                positiveKeywords,
                                setPositiveKeywords,
                                setNewPositiveKeyword,
                            )
                        }
                        onRemovePositiveKeyword={(keyword) =>
                            removeKeyword(
                                keyword,
                                positiveKeywords,
                                setPositiveKeywords,
                            )
                        }
                        mustHaveKeywords={mustHaveKeywords}
                        newMustHaveKeyword={newMustHaveKeyword}
                        onNewMustHaveKeywordChange={setNewMustHaveKeyword}
                        onAddMustHaveKeyword={(event) =>
                            addKeyword(
                                event,
                                newMustHaveKeyword,
                                mustHaveKeywords,
                                setMustHaveKeywords,
                                setNewMustHaveKeyword,
                            )
                        }
                        onRemoveMustHaveKeyword={(keyword) =>
                            removeKeyword(keyword, mustHaveKeywords, setMustHaveKeywords)
                        }
                        negativeKeywords={negativeKeywords}
                        newNegativeKeyword={newNegativeKeyword}
                        onNewNegativeKeywordChange={setNewNegativeKeyword}
                        onAddNegativeKeyword={(event) =>
                            addKeyword(
                                event,
                                newNegativeKeyword,
                                negativeKeywords,
                                setNegativeKeywords,
                                setNewNegativeKeyword,
                            )
                        }
                        onRemoveNegativeKeyword={(keyword) =>
                            removeKeyword(keyword, negativeKeywords, setNegativeKeywords)
                        }
                        negativeCompanies={negativeCompanies}
                        onToggleNegativeCompany={(company) =>
                            toggleValue(company, negativeCompanies, setNegativeCompanies)
                        }
                        excludedWorkplaceTypes={excludedWorkplaceTypes}
                        onToggleExcludedWorkplaceType={(workplaceType) =>
                            toggleValue(
                                workplaceType,
                                excludedWorkplaceTypes,
                                setExcludedWorkplaceTypes,
                            )
                        }
                        maxApplicantsLimit={maxApplicantsLimit}
                        maxPossibleApplicants={maxPossibleApplicants}
                        onMaxApplicantsLimitChange={handleMaxApplicantsLimitChange}
                        showHiddenJobs={showHiddenJobs}
                        onShowHiddenJobsChange={setShowHiddenJobs}
                        sourceOptions={sourceOptions}
                        companyOptions={companyOptions}
                        workplaceOptions={WORKPLACE_OPTIONS}
                        cacheTimestamp={cacheTimestamp}
                        loadedFromCache={loadedFromCache}
                        loading={loading}
                        errorMessage={errorMessage}
                        onOpenFetchModal={() => setIsFetchModalOpen(true)}
                        onClearCache={handleClearCache}
                        filteredCount={filteredJobs.length}
                        hiddenCount={negativeMatchCount}
                        savedCount={savedJobsCount}
                    />

                    <div className="flex-1 overflow-y-auto py-1">
                        {loading && jobs.length === 0 ? (
                            <div
                                className="flex h-full items-center justify-center px-8 text-center text-sm font-semibold text-slate-400">
                                Loading mock jobs...
                            </div>
                        ) : filteredJobs.length > 0 ? (
                            filteredJobs.map((job) => (
                                <JobListItem
                                    key={job.id}
                                    job={job}
                                    isSelected={selectedJobId === job.id}
                                    onSelect={setSelectedJobId}
                                />
                            ))
                        ) : (
                            <div
                                className="flex h-full flex-col items-center justify-center px-8 text-center text-slate-400">
                                <Filter className="mb-4 text-slate-500" size={42}/>
                                <h3 className="text-lg font-semibold text-slate-200">
                                    No jobs found
                                </h3>
                                <p className="mt-2 max-w-md text-sm">
                                    Try changing the search term or one of the filters.
                                </p>
                            </div>
                        )}
                    </div>
                </aside>

                <main className="min-w-0 flex-1 bg-[#0d1728]">
                    <JobDetails
                        job={selectedJob}
                        maxPythonScore={maxPythonScore}
                        onToggleSaved={handleToggleSaved}
                    />
                </main>
            </div>
        </>
    )
}