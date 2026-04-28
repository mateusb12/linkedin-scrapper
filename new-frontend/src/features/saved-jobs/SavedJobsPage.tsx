import {Fragment, useCallback, useEffect, useMemo, useState} from "react"
import {
    Bookmark,
    CalendarDays,
    ChevronDown,
    ChevronUp,
    Code2,
    Database,
    ExternalLink,
    Loader2,
    MapPin,
    RefreshCw,
    Search,
    Trash2,
    Users,
} from "lucide-react"

import SavedJobContextBuilder from "./SavedJobContextBuilder.tsx"
import SavedJobScoreInput from "./SavedJobScoreInput.tsx"
import SavedJobsExportPanel from "./SavedJobsExportPanel.tsx"
import {
    clearSavedJobsCacheMock,
    fetchMockResumes,
    fetchSavedJobsMock,
    readSavedJobScoresMock,
    refreshSavedJobsMock,
    saveSavedJobScoreMock,
    type MockResume,
    type SavedJob,
    type SavedJobScoreMap,
} from "./savedJobsMockService.ts"
import {
    buildSavedJobSearchText,
    cleanJobDescription,
    getCompactJobPayload,
    normalizeSavedJobsText,
} from "./savedJobsUtils.ts"

const SAVED_TAB = "saved" as const

const TECH_BADGE_CLASS: Record<string, string> = {
    python: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    fastapi: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    django: "border-green-500/30 bg-green-500/10 text-green-300",
    flask: "border-lime-500/30 bg-lime-500/10 text-lime-300",
    react: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    typescript: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    javascript: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    postgresql: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
    mongodb: "border-emerald-600/30 bg-emerald-600/10 text-emerald-200",
    sql: "border-slate-500/30 bg-slate-500/10 text-slate-300",
    docker: "border-blue-600/30 bg-blue-600/10 text-blue-200",
    aws: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    gcp: "border-red-500/30 bg-red-500/10 text-red-300",
    azure: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    api: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
    rest: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
    backend: "border-purple-500/30 bg-purple-500/10 text-purple-300",
}

const PRIORITY_KEYWORDS = [
    "python",
    "fastapi",
    "django",
    "flask",
    "postgresql",
    "sql",
    "docker",
    "aws",
    "gcp",
    "azure",
    "backend",
    "api",
    "rest",
]

function formatDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "Recently"

    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "2-digit",
    }).format(date)
}

function getScore(job: SavedJob, scores: SavedJobScoreMap) {
    return scores[job.jobId] ?? scores[job.id] ?? Math.round(job.pythonScore)
}

function formatNumber(value: number | null) {
    if (value == null) return "n/a"
    return new Intl.NumberFormat("en-US").format(value)
}

function getScoreVisual(score: number) {
    if (score >= 80) {
        return {
            row: "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]",
            border: "border-l-emerald-400",
            badge: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
            bar: "bg-emerald-400",
            label: "High fit",
        }
    }

    if (score >= 60) {
        return {
            row: "bg-sky-500/[0.035] hover:bg-sky-500/[0.07]",
            border: "border-l-sky-400",
            badge: "border-sky-400/40 bg-sky-500/15 text-sky-200",
            bar: "bg-sky-400",
            label: "Good fit",
        }
    }

    if (score >= 35) {
        return {
            row: "bg-amber-500/[0.035] hover:bg-amber-500/[0.07]",
            border: "border-l-amber-400",
            badge: "border-amber-400/40 bg-amber-500/15 text-amber-200",
            bar: "bg-amber-400",
            label: "Review",
        }
    }

    return {
        row: "bg-red-500/[0.03] hover:bg-red-500/[0.06]",
        border: "border-l-red-400",
        badge: "border-red-400/40 bg-red-500/15 text-red-200",
        bar: "bg-red-400",
        label: "Low fit",
    }
}

function getLevelClass(level: string) {
    const normalized = normalizeSavedJobsText(level)

    if (normalized.includes("senior")) {
        return "border-purple-500/30 bg-purple-500/10 text-purple-300"
    }

    if (normalized.includes("pleno") || normalized.includes("mid")) {
        return "border-blue-500/30 bg-blue-500/10 text-blue-300"
    }

    if (normalized.includes("junior") || normalized.includes("entry")) {
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    }

    return "border-gray-600 bg-gray-900/70 text-gray-300"
}

function getCompetitionClass(applicants: number | null) {
    if (applicants == null) return "border-gray-600 bg-gray-900/70 text-gray-300"
    if (applicants >= 800) return "border-red-500/30 bg-red-500/10 text-red-300"
    if (applicants >= 250) return "border-amber-500/30 bg-amber-500/10 text-amber-300"
    return "border-green-500/30 bg-green-500/10 text-green-300"
}

function getStatusTone() {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
}

function getVisibleKeywords(job: SavedJob) {
    const priority = job.keywords.filter((keyword) =>
        PRIORITY_KEYWORDS.includes(normalizeSavedJobsText(keyword)),
    )
    const rest = job.keywords.filter((keyword) => !priority.includes(keyword))

    return [...priority, ...rest].slice(0, 6)
}

function TechStackBadges({job}: {job: SavedJob}) {
    const visibleKeywords = getVisibleKeywords(job)
    const hiddenCount = Math.max(job.keywords.length - visibleKeywords.length, 0)

    if (visibleKeywords.length === 0) {
        return <span className="text-sm font-semibold text-gray-500">n/a</span>
    }

    return (
        <div className="grid max-w-[250px] grid-cols-2 gap-1.5">
            {visibleKeywords.map((keyword) => {
                const normalized = normalizeSavedJobsText(keyword)
                const className =
                    TECH_BADGE_CLASS[normalized] ??
                    "border-gray-600 bg-gray-900/70 text-gray-200"

                return (
                    <span
                        key={keyword}
                        className={`inline-flex w-fit rounded-md border px-2 py-0.5 text-[11px] font-extrabold ${className}`}
                    >
                        {keyword}
                    </span>
                )
            })}

            {hiddenCount > 0 && (
                <span className="inline-flex w-fit rounded-md border border-gray-600 bg-gray-700 px-2 py-0.5 text-[11px] font-extrabold text-gray-300">
                    +{hiddenCount}
                </span>
            )}
        </div>
    )
}

function SignalPills({job}: {job: SavedJob}) {
    const positive = job.scoreBreakdown.positive.slice(0, 2)
    const negative = job.scoreBreakdown.negative.slice(0, 1)

    if (positive.length === 0 && negative.length === 0) {
        return <span className="text-xs font-semibold text-gray-500">No scoring signals</span>
    }

    return (
        <div className="space-y-1.5">
            {positive.map((signal) => (
                <span
                    key={`${signal.label}-${signal.points}`}
                    title={signal.source}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-extrabold text-emerald-200"
                >
                    +{signal.points} {signal.label}
                </span>
            ))}

            {negative.map((signal) => (
                <span
                    key={`${signal.label}-${signal.points}`}
                    title={signal.source}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border border-red-500/25 bg-red-500/10 px-2 py-1 text-[11px] font-extrabold text-red-200"
                >
                    {signal.points} {signal.label}
                </span>
            ))}
        </div>
    )
}

function JobMetaPill({children}: {children: React.ReactNode}) {
    return (
        <span className="inline-flex items-center rounded-full border border-gray-800 bg-gray-950 px-2.5 py-1 text-[11px] font-bold text-gray-300">
            {children}
        </span>
    )
}

export default function SavedJobsPage() {
    const [jobs, setJobs] = useState<SavedJob[]>([])
    const [scores, setScores] = useState<SavedJobScoreMap>(() => readSavedJobScoresMock())
    const [resumes, setResumes] = useState<MockResume[]>([])
    const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showBuilder, setShowBuilder] = useState(false)
    const [cacheState, setCacheState] = useState<"mock" | "cleared">("mock")

    const loadJobs = useCallback(async function loadJobs() {
        try {
            setError(null)
            setIsLoading(true)
            setExpandedJobId(null)
            const loadedJobs = await fetchSavedJobsMock(SAVED_TAB)
            setJobs(loadedJobs)
            setCacheState("mock")
        } catch (loadError) {
            console.error(loadError)
            setError("Could not load saved jobs mock data.")
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadJobs()
        }, 0)

        return () => window.clearTimeout(timeoutId)
    }, [loadJobs])

    useEffect(() => {
        let isMounted = true

        fetchMockResumes()
            .then((mockResumes) => {
                if (!isMounted) return
                setResumes(mockResumes)
                setSelectedResumeId((current) => current ?? mockResumes[0]?.id ?? null)
            })
            .catch((resumeError) => {
                console.error(resumeError)
            })

        return () => {
            isMounted = false
        }
    }, [])

    const rankedJobs = useMemo(() => {
        const normalizedSearch = normalizeSavedJobsText(searchTerm.trim())

        return jobs
            .filter((job) => {
                if (!normalizedSearch) return true
                return buildSavedJobSearchText(job).includes(normalizedSearch)
            })
            .map((job) => ({
                job,
                score: getScore(job, scores),
            }))
            .sort((a, b) => b.score - a.score || a.job.title.localeCompare(b.job.title))
    }, [jobs, scores, searchTerm])

    async function handleRefresh() {
        try {
            setError(null)
            setIsRefreshing(true)
            setExpandedJobId(null)
            const refreshedJobs = await refreshSavedJobsMock(SAVED_TAB)
            setJobs(refreshedJobs)
            setCacheState("mock")
        } catch (refreshError) {
            console.error(refreshError)
            setError("Could not refresh saved jobs mock data.")
        } finally {
            setIsRefreshing(false)
        }
    }

    function handleClearCache() {
        clearSavedJobsCacheMock(SAVED_TAB)
        setJobs([])
        setExpandedJobId(null)
        setCacheState("cleared")
    }

    function handleScoreSave(jobId: string, score: number) {
        setScores(saveSavedJobScoreMock(jobId, score))
    }

    function toggleExpanded(jobId: string) {
        setExpandedJobId((current) => (current === jobId ? null : jobId))
    }

    const exportPayload = useMemo(
        () => rankedJobs.map(({job, score}) => getCompactJobPayload(job, score)),
        [rankedJobs],
    )

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
            <section className="overflow-hidden rounded-lg border border-gray-800 bg-gray-950 shadow-2xl">
                <div className="border-b border-gray-800 bg-gradient-to-r from-gray-950 via-gray-900 to-emerald-950/30 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="grid size-12 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-500/10">
                                <Bookmark className="text-emerald-300" size={24}/>
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-2xl font-black tracking-tight text-white">
                                        Saved Jobs
                                    </h1>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5 text-[11px] font-bold text-gray-400">
                                        <Database size={12}/>
                                        {cacheState === "cleared" ? "cache cleared" : "mock cache"}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm font-medium text-gray-400">
                                    Rank saved jobs locally, search across job content, and build resume context from mock data.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="relative sm:w-80">
                                <Search
                                    size={16}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                                />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Search title, company, stack..."
                                    className="h-11 w-full rounded-lg border border-gray-700 bg-gray-950 pl-10 pr-3 text-sm font-medium text-gray-100 outline-none transition placeholder:text-gray-600 focus:border-emerald-500"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleRefresh}
                                disabled={isLoading || isRefreshing}
                                title="Refresh mock data"
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-black text-gray-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <RefreshCw
                                    size={17}
                                    className={isRefreshing ? "animate-spin" : ""}
                                />
                                Refresh
                            </button>

                            <button
                                type="button"
                                onClick={handleClearCache}
                                title="Clear saved jobs cache"
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-4 text-sm font-black text-red-200 transition hover:bg-red-500/20"
                            >
                                <Trash2 size={17}/>
                                Clear
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4">
                    <SavedJobsExportPanel
                        items={exportPayload}
                        onOpenBuilder={() => setShowBuilder(true)}
                    />
                </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-gray-800 bg-gray-950 shadow-2xl">
                {isLoading ? (
                    <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-gray-400">
                        <Loader2 className="animate-spin text-emerald-300" size={34}/>
                        <span className="text-sm font-bold">Loading mock jobs...</span>
                    </div>
                ) : error ? (
                    <div className="min-h-80 p-10 text-center text-red-300">{error}</div>
                ) : rankedJobs.length === 0 ? (
                    <div className="flex min-h-80 flex-col items-center justify-center gap-3 p-10 text-center">
                        <Bookmark size={34} className="text-gray-700"/>
                        <h2 className="text-lg font-black text-gray-200">No jobs to show</h2>
                        <p className="max-w-md text-sm font-medium leading-6 text-gray-500">
                            {cacheState === "cleared"
                                ? "The saved jobs cache was cleared locally. Use Refresh to restore mock data."
                                : "Try a different search term."}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full table-fixed border-separate border-spacing-0 text-left">
                                <thead>
                                    <tr>
                                        <th className="w-[12%] border-b border-gray-800 bg-gray-900 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                            Score
                                        </th>
                                        <th className="w-[28%] border-b border-gray-800 bg-gray-900 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                            Job Identity
                                        </th>
                                        <th className="w-[18%] border-b border-gray-800 bg-gray-900 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                            Tech Stack
                                        </th>
                                        <th className="w-[18%] border-b border-gray-800 bg-gray-900 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                            Fit Signals
                                        </th>
                                        <th className="w-[10%] border-b border-gray-800 bg-gray-900 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                            Posted
                                        </th>
                                        <th className="w-[10%] border-b border-gray-800 bg-gray-900 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                            Competition
                                        </th>
                                        <th className="w-[4%] border-b border-gray-800 bg-gray-900 px-4 py-4 text-right text-xs font-black uppercase tracking-wider text-gray-500">
                                            Open
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankedJobs.map(({job, score}) => {
                                        const scoreVisual = getScoreVisual(score)

                                        return (
                                            <Fragment key={job.jobId}>
                                                <tr className={`align-top transition ${scoreVisual.row}`}>
                                                    <td className={`border-b border-l-4 border-gray-800/80 px-4 py-5 ${scoreVisual.border}`}>
                                                        <span className={`mb-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${scoreVisual.badge}`}>
                                                            {scoreVisual.label}
                                                        </span>
                                                        <div className="mb-3 h-1.5 w-24 overflow-hidden rounded-full bg-gray-800">
                                                            <div
                                                                className={`h-full rounded-full ${scoreVisual.bar}`}
                                                                style={{width: `${Math.max(0, Math.min(100, score))}%`}}
                                                            />
                                                        </div>
                                                    <SavedJobScoreInput
                                                        initialScore={score}
                                                        onSave={(nextScore) =>
                                                            handleScoreSave(job.jobId, nextScore)
                                                        }
                                                    />
                                                </td>
                                                    <td className="border-b border-gray-800/80 px-4 py-5">
                                                    <div className="flex items-start gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleExpanded(job.jobId)}
                                                            className="mt-0.5 rounded p-1 text-gray-500 transition hover:bg-gray-900 hover:text-emerald-300"
                                                            aria-label="Toggle description"
                                                        >
                                                            {expandedJobId === job.jobId ? (
                                                                <ChevronUp size={17}/>
                                                            ) : (
                                                                <ChevronDown size={17}/>
                                                            )}
                                                        </button>
                                                        <div className="min-w-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleExpanded(job.jobId)}
                                                                    className="line-clamp-2 text-left text-base font-extrabold leading-6 text-white transition hover:text-emerald-200"
                                                            >
                                                                {job.title}
                                                            </button>
                                                                <p className="mt-1.5 text-sm font-bold text-gray-300">
                                                                    {job.company.name}
                                                            </p>
                                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
                                                                    <span className="inline-flex items-start gap-1">
                                                                        <MapPin size={14} className="mt-0.5 shrink-0"/>
                                                                        {job.location}
                                                                    </span>
                                                                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-bold text-blue-300">
                                                                        {job.workplaceType}
                                                                    </span>
                                                                    {job.verified && (
                                                                        <span className="rounded-full bg-green-500/10 px-2 py-0.5 font-bold text-green-300">
                                                                            Verified
                                                                        </span>
                                                                    )}
                                                                    {job.reposted && (
                                                                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-bold text-amber-300">
                                                                            Reposted
                                                                        </span>
                                                                    )}
                                                                </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                    <td className="border-b border-gray-800/80 px-4 py-5">
                                                        <div className="flex items-start gap-2">
                                                            <Code2 size={16} className="mt-1 shrink-0 text-gray-500"/>
                                                            <div>
                                                                <TechStackBadges job={job}/>
                                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${getLevelClass(job.seniority)}`}>
                                                                        {job.seniority}
                                                                    </span>
                                                                    <JobMetaPill>{job.jobType}</JobMetaPill>
                                                                    <JobMetaPill>{job.experienceYears}</JobMetaPill>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="border-b border-gray-800/80 px-4 py-5">
                                                        <SignalPills job={job}/>
                                                    </td>
                                                    <td className="border-b border-gray-800/80 px-4 py-5">
                                                        <div className="flex items-start gap-2">
                                                            <CalendarDays size={16} className="mt-1 shrink-0 text-gray-500"/>
                                                            <div>
                                                                <p className="text-sm font-extrabold text-gray-100">
                                                                    {formatDate(job.postedAt)}
                                                                </p>
                                                                <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${getStatusTone()}`}>
                                                                    Saved
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="border-b border-gray-800/80 px-4 py-5">
                                                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-extrabold ${getCompetitionClass(job.applicantsTotal)}`}>
                                                            <Users size={15}/>
                                                            {formatNumber(job.applicantsTotal)}
                                                        </span>
                                                        <p className="mt-2 text-xs font-medium text-gray-500">
                                                            applicants
                                                        </p>
                                                    </td>
                                                    <td className="border-b border-gray-800/80 px-4 py-5 text-right">
                                                        <a
                                                            href={job.jobUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center justify-center rounded-lg border border-gray-700 p-2 text-gray-300 transition hover:border-emerald-400/40 hover:text-emerald-200"
                                                            aria-label="Open job"
                                                        >
                                                            <ExternalLink size={16}/>
                                                        </a>
                                                    </td>
                                            </tr>
                                            {expandedJobId === job.jobId && (
                                                <tr>
                                                        <td colSpan={7} className="border-b border-gray-800 bg-gray-900/80 px-6 py-5">
                                                            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                                                                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-gray-800 bg-gray-950 p-4 text-sm leading-6 text-gray-300">
                                                                    {cleanJobDescription(job.description)}
                                                                </pre>
                                                                <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
                                                                    <p className="text-xs font-black uppercase tracking-wider text-gray-500">
                                                                        Why it matters
                                                                    </p>
                                                                    <p className="mt-2 text-sm font-bold leading-6 text-gray-300">
                                                                        {job.insight}
                                                                    </p>
                                                                    <div className="mt-4 space-y-2">
                                                                        {job.scoreBreakdown.positive.slice(0, 4).map((signal) => (
                                                                            <p key={signal.label} className="text-xs leading-5 text-emerald-200">
                                                                                +{signal.points} {signal.source}
                                                                            </p>
                                                                        ))}
                                                                        {job.scoreBreakdown.negative.slice(0, 3).map((signal) => (
                                                                            <p key={signal.label} className="text-xs leading-5 text-red-200">
                                                                                {signal.points} {signal.source}
                                                                            </p>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                    </td>
                                                </tr>
                                            )}
                                            </Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid gap-3 p-3 lg:hidden">
                            {rankedJobs.map(({job, score}) => {
                                const scoreVisual = getScoreVisual(score)

                                return (
                                    <article
                                        key={job.jobId}
                                        className={`rounded-lg border border-l-4 border-gray-800 p-4 ${scoreVisual.border} ${scoreVisual.row}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="mb-2 flex flex-wrap gap-2">
                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${scoreVisual.badge}`}>
                                                        {scoreVisual.label}
                                                    </span>
                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${getStatusTone()}`}>
                                                        Saved
                                                    </span>
                                                </div>
                                                <h2 className="text-base font-black text-white">{job.title}</h2>
                                                <p className="mt-1 text-sm font-bold text-gray-300">
                                                    {job.company.name}
                                                </p>
                                            </div>
                                            <SavedJobScoreInput
                                                initialScore={score}
                                                onSave={(nextScore) => handleScoreSave(job.jobId, nextScore)}
                                            />
                                        </div>

                                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                                            <div
                                                className={`h-full rounded-full ${scoreVisual.bar}`}
                                                style={{width: `${Math.max(0, Math.min(100, score))}%`}}
                                            />
                                        </div>

                                        <div className="mt-4">
                                            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                                <Code2 size={13}/>
                                                Tech Stack
                                            </p>
                                            <TechStackBadges job={job}/>
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                                    Profile
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${getLevelClass(job.seniority)}`}>
                                                        {job.seniority}
                                                    </span>
                                                    <JobMetaPill>{job.jobType}</JobMetaPill>
                                                    <JobMetaPill>{job.experienceYears}</JobMetaPill>
                                                </div>
                                            </div>

                                            <div>
                                                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                                    Competition
                                                </p>
                                                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold ${getCompetitionClass(job.applicantsTotal)}`}>
                                                    <Users size={14}/>
                                                    {formatNumber(job.applicantsTotal)}
                                                </span>
                                            </div>
                                        </div>

                                        <p className="mt-4 flex items-start gap-2 text-sm font-medium text-gray-400">
                                            <MapPin size={15} className="mt-0.5 shrink-0 text-gray-600"/>
                                            {job.location}
                                        </p>

                                        <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950/70 p-3">
                                            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                                Fit Signals
                                            </p>
                                            <SignalPills job={job}/>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between gap-3">
                                            <p className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                                <CalendarDays size={14}/>
                                                {formatDate(job.postedAt)}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpanded(job.jobId)}
                                                    className="rounded-lg border border-gray-700 p-2 text-gray-300"
                                                    aria-label="Toggle description"
                                                >
                                                    {expandedJobId === job.jobId ? (
                                                        <ChevronUp size={16}/>
                                                    ) : (
                                                        <ChevronDown size={16}/>
                                                    )}
                                                </button>
                                                <a
                                                    href={job.jobUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="rounded-lg border border-gray-700 p-2 text-gray-300"
                                                    aria-label="Open job"
                                                >
                                                    <ExternalLink size={16}/>
                                                </a>
                                            </div>
                                        </div>

                                        {expandedJobId === job.jobId && (
                                            <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm leading-6 text-gray-300">
                                                {cleanJobDescription(job.description)}
                                            </pre>
                                        )}
                                    </article>
                                )
                            })}
                        </div>
                    </>
                )}
            </section>

            <SavedJobContextBuilder
                isOpen={showBuilder}
                jobs={rankedJobs}
                resumes={resumes}
                selectedResumeId={selectedResumeId}
                onResumeChange={setSelectedResumeId}
                onClose={() => setShowBuilder(false)}
            />
        </div>
    )
}
