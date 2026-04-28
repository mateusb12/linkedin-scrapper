import {Fragment, useCallback, useEffect, useMemo, useState} from "react"
import {
    Archive,
    Bookmark,
    Briefcase,
    ChevronDown,
    ChevronUp,
    Database,
    ExternalLink,
    Layers,
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
    type SavedJobsTab,
} from "./savedJobsMockService.ts"
import {
    buildSavedJobSearchText,
    cleanJobDescription,
    getCompactJobPayload,
    normalizeSavedJobsText,
} from "./savedJobsUtils.ts"

const TABS: Array<{
    id: SavedJobsTab
    label: string
    icon: typeof Bookmark
}> = [
    {id: "saved", label: "Saved", icon: Bookmark},
    {id: "applied", label: "Applied", icon: Briefcase},
    {id: "in_progress", label: "In Progress", icon: Layers},
    {id: "archived", label: "Archived", icon: Archive},
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

function getStatusTone(status: string) {
    const normalized = status.toLowerCase()
    if (normalized.includes("interview") || normalized.includes("pending")) {
        return "border-sky-400/30 bg-sky-500/10 text-sky-200"
    }
    if (normalized.includes("applied") || normalized.includes("viewed")) {
        return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
    }
    if (normalized.includes("archived") || normalized.includes("longer")) {
        return "border-red-400/30 bg-red-500/10 text-red-200"
    }

    return "border-gray-700 bg-gray-900 text-gray-300"
}

function JobMetaPill({children}: {children: React.ReactNode}) {
    return (
        <span className="inline-flex items-center rounded-full border border-gray-800 bg-gray-950 px-2.5 py-1 text-[11px] font-bold text-gray-300">
            {children}
        </span>
    )
}

export default function SavedJobsPage() {
    const [activeTab, setActiveTab] = useState<SavedJobsTab>("saved")
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

    const loadJobs = useCallback(async function loadJobs(tab: SavedJobsTab) {
        try {
            setError(null)
            setIsLoading(true)
            setExpandedJobId(null)
            const loadedJobs = await fetchSavedJobsMock(tab)
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
            void loadJobs(activeTab)
        }, 0)

        return () => window.clearTimeout(timeoutId)
    }, [activeTab, loadJobs])

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
            const refreshedJobs = await refreshSavedJobsMock(activeTab)
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
        clearSavedJobsCacheMock(activeTab)
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
                                title="Clear this tab cache"
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-4 text-sm font-black text-red-200 transition hover:bg-red-500/20"
                            >
                                <Trash2 size={17}/>
                                Clear
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 flex gap-2 overflow-x-auto">
                        {TABS.map((tab) => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-black transition ${
                                        isActive
                                            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                                            : "border-transparent text-gray-400 hover:border-gray-700 hover:bg-gray-900 hover:text-gray-200"
                                    }`}
                                >
                                    <Icon size={16}/>
                                    {tab.label}
                                </button>
                            )
                        })}
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
                                ? "This tab cache was cleared locally. Use Refresh to restore mock data."
                                : "Try a different search term or tab."}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full border-collapse text-left">
                                <thead className="border-b border-gray-800 bg-gray-900 text-xs font-black uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3">Score</th>
                                        <th className="px-4 py-3">Role & Company</th>
                                        <th className="px-4 py-3">Seniority</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Applicants</th>
                                        <th className="px-4 py-3">Location</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {rankedJobs.map(({job, score}) => (
                                        <Fragment key={job.jobId}>
                                            <tr className="align-top transition hover:bg-emerald-500/[0.03]">
                                                <td className="px-4 py-4">
                                                    <SavedJobScoreInput
                                                        initialScore={score}
                                                        onSave={(nextScore) =>
                                                            handleScoreSave(job.jobId, nextScore)
                                                        }
                                                    />
                                                </td>
                                                <td className="min-w-80 px-4 py-4">
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
                                                                className="text-left text-sm font-black text-gray-100 transition hover:text-emerald-200"
                                                            >
                                                                {job.title}
                                                            </button>
                                                            <p className="mt-1 text-xs font-bold text-gray-500">
                                                                {job.company.name} · {formatDate(job.postedAt)}
                                                            </p>
                                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                                {job.keywords.slice(0, 5).map((keyword) => (
                                                                    <JobMetaPill key={keyword}>{keyword}</JobMetaPill>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-sm font-bold text-gray-300">
                                                    {job.seniority}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-bold text-gray-300">
                                                    {job.jobType}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-bold text-gray-300">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Users size={14} className="text-gray-500"/>
                                                        {job.applicantsTotal ?? "n/a"}
                                                    </span>
                                                </td>
                                                <td className="min-w-48 px-4 py-4 text-sm font-bold text-gray-300">
                                                    <span className="inline-flex items-start gap-1.5">
                                                        <MapPin size={14} className="mt-0.5 shrink-0 text-gray-500"/>
                                                        {job.location}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${getStatusTone(job.statusLabel)}`}>
                                                        {job.statusLabel}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-right">
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
                                                    <td colSpan={8} className="bg-gray-900/70 px-6 py-5">
                                                        <p className="mb-3 text-sm font-bold text-gray-300">
                                                            {job.insight}
                                                        </p>
                                                        <pre className="max-h-[420px] whitespace-pre-wrap rounded-lg border border-gray-800 bg-gray-950 p-4 text-sm leading-6 text-gray-300">
                                                            {cleanJobDescription(job.description)}
                                                        </pre>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid gap-3 p-3 lg:hidden">
                            {rankedJobs.map(({job, score}) => (
                                <article
                                    key={job.jobId}
                                    className="rounded-lg border border-gray-800 bg-gray-900 p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h2 className="text-base font-black text-white">{job.title}</h2>
                                            <p className="mt-1 text-sm font-bold text-gray-500">
                                                {job.company.name}
                                            </p>
                                        </div>
                                        <SavedJobScoreInput
                                            initialScore={score}
                                            onSave={(nextScore) => handleScoreSave(job.jobId, nextScore)}
                                        />
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <JobMetaPill>{job.seniority}</JobMetaPill>
                                        <JobMetaPill>{job.jobType}</JobMetaPill>
                                        <JobMetaPill>{job.experienceYears}</JobMetaPill>
                                    </div>

                                    <p className="mt-3 flex items-start gap-2 text-sm font-medium text-gray-400">
                                        <MapPin size={15} className="mt-0.5 shrink-0 text-gray-600"/>
                                        {job.location}
                                    </p>

                                    <div className="mt-4 flex items-center justify-between gap-3">
                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${getStatusTone(job.statusLabel)}`}>
                                            {job.statusLabel}
                                        </span>
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
                            ))}
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
