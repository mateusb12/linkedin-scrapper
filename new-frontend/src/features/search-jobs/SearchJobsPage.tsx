import {useEffect, useMemo, useState, type FormEvent} from "react"
import {
    Bookmark,
    BookmarkCheck,
    Briefcase,
    Building2,
    CalendarDays,
    CheckCircle2,
    Clock3,
    ExternalLink,
    Filter,
    MapPin,
    RefreshCw,
    Search,
    ShieldCheck,
    Sparkles,
    Target,
    Users,
    X,
    Zap,
} from "lucide-react"

import SearchJobsFilters, {
    type SelectOption,
    type SortOption,
    type VerificationFilter,
} from "./SearchJobsFilters.tsx"

import {
    clearJobsCacheMock,
    fetchJobsMock,
    type FetchJobsProgress,
    getInitialSearchJobsMockData,
    placeholderLogo,
    readSavedJobIdsMock,
    type SearchJob,
    toggleSavedJobMock,
} from "./searchJobsMockService.ts"

type JobView = SearchJob & {
    isSaved: boolean
    visibleScore: number
    isHidden: boolean
    hiddenReasons: string[]
    matchedPositiveKeywords: string[]
    matchedNegativeKeywords: string[]
    missingMustHaveKeywords: string[]
}

const DEFAULT_POSITIVE_KEYWORDS = [
    "python",
    "sql",
    "flask",
    "fastapi",
    "postgresql",
    "django",
    "backend",
]

const DEFAULT_MUST_HAVE_KEYWORDS = ["python"]
const DEFAULT_NEGATIVE_KEYWORDS = ["php"]

const normalizeText = (value: string) =>
    value
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")

const unique = (values: string[]) =>
    [...new Set(values.map((value) => value.trim()).filter(Boolean))]

const formatDateDistance = (value: string) => {
    const date = new Date(value)
    const now = new Date()

    if (Number.isNaN(date.getTime())) return "Recently"

    const diffDays = Math.max(
        0,
        Math.floor((now.getTime() - date.getTime()) / 86_400_000),
    )

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "1 day ago"
    if (diffDays < 30) return `${diffDays} days ago`

    const diffMonths = Math.floor(diffDays / 30)
    return diffMonths === 1 ? "1 month ago" : `${diffMonths} months ago`
}

const formatFullDate = (value: string) => {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return "No date"

    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date)
}

const shortText = (value: string, maxLength: number) => {
    if (value.length <= maxLength) return value
    return `${value.slice(0, maxLength).trim()}...`
}

const buildSearchableText = (job: SearchJob) =>
    normalizeText(
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
        ].join(" "),
    )

const buildUniqueOptions = (
    values: Array<{ value: string; label: string }>,
): SelectOption[] => {
    const map = new Map<string, string>()

    values.forEach((option) => {
        if (!map.has(option.value)) {
            map.set(option.value, option.label)
        }
    })

    return [...map.entries()]
        .map(([value, label]) => ({value, label}))
        .sort((a, b) => a.label.localeCompare(b.label))
}

const getScoreTone = (score: number) => {
    if (score >= 75) return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
    if (score >= 55) return "border-sky-400/40 bg-sky-400/10 text-sky-200"
    if (score >= 35) return "border-amber-400/40 bg-amber-400/10 text-amber-200"

    return "border-red-400/40 bg-red-400/10 text-red-200"
}

const getScoreBarClassName = (score: number) => {
    if (score >= 75) return "bg-emerald-400"
    if (score >= 55) return "bg-sky-400"
    if (score >= 35) return "bg-amber-400"

    return "bg-red-400"
}

function ScoreBadge({score}: { score: number }) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-extrabold ${getScoreTone(score)}`}
        >
            <Zap size={13}/>
            {Math.round(score)}
        </span>
    )
}

function SmallPill({
                       children,
                       tone = "default",
                   }: {
    children: string
    tone?: "default" | "green" | "blue" | "amber" | "red"
}) {
    const toneClasses = {
        default: "border-slate-700 bg-slate-800/70 text-slate-300",
        green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        blue: "border-sky-500/30 bg-sky-500/10 text-sky-300",
        amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
        red: "border-red-500/30 bg-red-500/10 text-red-300",
    }

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${toneClasses[tone]}`}
        >
            {children}
        </span>
    )
}

function JobListInsideFilters({
                                  jobs,
                                  selectedJobId,
                                  onSelectJob,
                                  loading,
                              }: {
    jobs: JobView[]
    selectedJobId: string | null
    onSelectJob: (id: string) => void
    loading: boolean
}) {
    if (loading && jobs.length === 0) {
        return (
            <div className="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
                <RefreshCw size={16} className="mr-2 animate-spin text-sky-400"/>
                Loading mock jobs...
            </div>
        )
    }

    if (jobs.length === 0) {
        return (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
                <Briefcase size={28} className="mx-auto text-slate-600"/>

                <p className="mt-3 text-sm font-extrabold text-slate-300">
                    No jobs found
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                    Change the filters or fetch a new mock dataset.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-black text-slate-100">
                    <Briefcase size={16} className="text-sky-400"/>
                    Jobs
                </p>

                <span className="text-xs font-semibold text-slate-500">
                    {jobs.length} visible
                </span>
            </div>

            <div className="space-y-2">
                {jobs.map((job) => {
                    const selected = job.id === selectedJobId

                    const cardClassName = job.isHidden
                        ? selected
                            ? "border-red-400/90 bg-red-950/45 shadow-[inset_4px_0_0_#f87171] ring-1 ring-red-500/40"
                            : "border-red-500/60 bg-red-950/30 hover:border-red-400/80 hover:bg-red-950/40"
                        : job.isSaved
                            ? selected
                                ? "border-emerald-400/90 bg-emerald-950/40 shadow-[inset_4px_0_0_#34d399] ring-1 ring-emerald-500/40"
                                : "border-emerald-500/50 bg-emerald-950/20 hover:border-emerald-400/70 hover:bg-emerald-950/30"
                            : selected
                                ? "border-sky-400/70 bg-sky-500/10 shadow-[inset_3px_0_0_#38bdf8]"
                                : "border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-900/70"

                    return (
                        <button
                            key={job.id}
                            type="button"
                            onClick={() => onSelectJob(job.id)}
                            className={`w-full rounded-xl border p-3 text-left transition ${cardClassName}`}
                        >
                            <div className="flex gap-3">
                                <img
                                    src={job.company.logoUrl || placeholderLogo(job.company.name)}
                                    alt={`${job.company.name} logo`}
                                    onError={(event) => {
                                        event.currentTarget.src = placeholderLogo(job.company.name)
                                    }}
                                    className="h-11 w-11 flex-none rounded-md border border-slate-700 bg-slate-900 object-cover"
                                />

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h3 className="line-clamp-2 text-sm font-extrabold leading-5 text-sky-300">
                                                {job.title}
                                            </h3>

                                            <p className="mt-1 truncate text-xs font-semibold text-slate-200">
                                                {job.company.name}
                                            </p>
                                        </div>

                                        <ScoreBadge score={job.visibleScore}/>
                                    </div>

                                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-400">
                                        <MapPin size={12}/>
                                        {job.location}
                                    </p>

                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {job.verified && <SmallPill tone="green">Verified</SmallPill>}

                                        <SmallPill tone={job.workplaceType === "Remote" ? "blue" : "default"}>
                                            {job.workplaceType}
                                        </SmallPill>

                                        {job.jobType && <SmallPill>{job.jobType}</SmallPill>}

                                        {job.isHidden && <SmallPill tone="red">Filtered</SmallPill>}
                                    </div>

                                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">
                                        {job.description}
                                    </p>

                                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                        <span className="inline-flex items-center gap-1">
                                            <Clock3 size={12}/>
                                            {formatDateDistance(job.postedAt)}
                                        </span>

                                        <span className="inline-flex items-center gap-1">
                                            <Users size={12}/>
                                            {job.applicantsTotal == null
                                                ? "No applicants data"
                                                : `${job.applicantsTotal} applicants`}
                                        </span>

                                        {job.isSaved && (
                                            <span className="inline-flex items-center gap-1 text-emerald-300">
                                                <BookmarkCheck size={12}/>
                                                Saved
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function DescriptionBlock({text}: { text: string }) {
    const blocks = text.split(/\n{2,}/).filter(Boolean)

    if (blocks.length === 0) {
        return (
            <p className="text-sm leading-7 text-slate-400">
                No description available for this mock job.
            </p>
        )
    }

    return (
        <div className="space-y-4">
            {blocks.map((block) => {
                const key = block.slice(0, 40)
                const lines = block.split("\n").filter(Boolean)
                const isList = lines.every((line) => line.trim().startsWith("-"))

                if (isList) {
                    return (
                        <ul key={key} className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
                            {lines.map((line) => (
                                <li key={line}>{line.replace(/^-+\s*/, "")}</li>
                            ))}
                        </ul>
                    )
                }

                return (
                    <p key={key} className="whitespace-pre-line text-sm leading-7 text-slate-300">
                        {block}
                    </p>
                )
            })}
        </div>
    )
}

function MatchPanel({
                        title,
                        icon,
                        values,
                        tone,
                        emptyLabel,
                    }: {
    title: string
    icon: React.ReactNode
    values: string[]
    tone: "green" | "amber" | "red" | "blue"
    emptyLabel: string
}) {
    const toneClasses = {
        green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
        amber: "border-amber-500/25 bg-amber-500/10 text-amber-200",
        red: "border-red-500/25 bg-red-500/10 text-red-200",
        blue: "border-sky-500/25 bg-sky-500/10 text-sky-200",
    }

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <h4 className="flex items-center gap-2 text-sm font-extrabold text-slate-100">
                <span className={toneClasses[tone]}>{icon}</span>
                {title}
            </h4>

            {values.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {values.map((value) => (
                        <span
                            key={value}
                            className={`rounded-full border px-2.5 py-1 text-xs font-bold ${toneClasses[tone]}`}
                        >
                            {value}
                        </span>
                    ))}
                </div>
            ) : (
                <p className="mt-3 text-xs leading-5 text-slate-500">{emptyLabel}</p>
            )}
        </div>
    )
}

function SelectedJobPreview({
                                job,
                                onToggleSaved,
                                onOpenApply,
                            }: {
    job: JobView
    onToggleSaved: () => void
    onOpenApply: () => void
}) {
    return (
        <div className="h-full overflow-y-auto bg-slate-950 [scrollbar-gutter:stable]">
            <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 p-5 backdrop-blur">
                <div className="flex items-start gap-4">
                    <img
                        src={job.company.logoUrl || placeholderLogo(job.company.name)}
                        alt={`${job.company.name} logo`}
                        onError={(event) => {
                            event.currentTarget.src = placeholderLogo(job.company.name)
                        }}
                        className="h-16 w-16 rounded-lg border border-slate-700 bg-slate-900 object-cover"
                    />

                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sky-400">
                            LinkedIn style preview
                        </p>

                        <h1 className="mt-2 text-2xl font-black leading-tight text-white">
                            {job.title}
                        </h1>

                        <p className="mt-2 text-sm font-semibold text-slate-300">
                            {job.company.name}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                            {job.verified && <SmallPill tone="green">Verified</SmallPill>}

                            <SmallPill tone={job.workplaceType === "Remote" ? "blue" : "default"}>
                                {job.workplaceType}
                            </SmallPill>

                            <SmallPill>{job.seniority}</SmallPill>
                            <SmallPill>{job.experienceYears}</SmallPill>

                            {job.isHidden && <SmallPill tone="red">Filtered</SmallPill>}
                        </div>
                    </div>

                    <ScoreBadge score={job.visibleScore}/>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={onToggleSaved}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-extrabold text-slate-100 transition hover:border-sky-400/60 hover:bg-slate-800"
                    >
                        {job.isSaved ? <BookmarkCheck size={16}/> : <Bookmark size={16}/>}
                        {job.isSaved ? "Saved" : "Save"}
                    </button>

                    <button
                        type="button"
                        onClick={onOpenApply}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-sky-400"
                    >
                        Apply
                        <ExternalLink size={15}/>
                    </button>
                </div>
            </div>

            {job.isHidden && (
                <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-red-200">
                        <Filter size={16}/>
                        This job is currently filtered.
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                        {job.hiddenReasons.map((reason) => (
                            <SmallPill key={reason} tone="red">
                                {reason}
                            </SmallPill>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-5 p-5">
                <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                    <div className="grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
                        <span className="inline-flex items-center gap-2">
                            <Building2 size={15}/>
                            {job.company.name}
                        </span>

                        <span className="inline-flex items-center gap-2">
                            <MapPin size={15}/>
                            {job.location}
                        </span>

                        <span className="inline-flex items-center gap-2">
                            <CalendarDays size={15}/>
                            {formatFullDate(job.postedAt)}
                        </span>

                        <span className="inline-flex items-center gap-2">
                            <Users size={15}/>
                            {job.applicantsTotal == null
                                ? "Applicants not shown"
                                : `${job.applicantsTotal} applicants`}
                        </span>
                    </div>

                    <div className={`mt-5 rounded-2xl border p-4 ${getScoreTone(job.visibleScore)}`}>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">
                                    Python match
                                </p>

                                <p className="mt-1 text-3xl font-black">
                                    {Math.round(job.visibleScore)}
                                </p>
                            </div>

                            <Sparkles size={28}/>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950/50">
                            <div
                                className={`h-full rounded-full ${getScoreBarClassName(job.visibleScore)}`}
                                style={{width: `${Math.min(100, Math.max(0, job.visibleScore))}%`}}
                            />
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                    <h2 className="text-lg font-extrabold text-slate-50">
                        Detected stack
                    </h2>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {job.keywords.length > 0 ? (
                            job.keywords.map((item) => (
                                <span
                                    key={item}
                                    className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-300"
                                >
                                    {item}
                                </span>
                            ))
                        ) : (
                            <p className="text-sm text-slate-500">
                                No stack detected in this mock payload.
                            </p>
                        )}
                    </div>
                </section>

                <div className="grid gap-5 xl:grid-cols-3">
                    <MatchPanel
                        title="Positive"
                        icon={<CheckCircle2 size={15}/>}
                        values={job.matchedPositiveKeywords}
                        tone="green"
                        emptyLabel="No positive keyword matched yet."
                    />

                    <MatchPanel
                        title="Missing"
                        icon={<Target size={15}/>}
                        values={job.missingMustHaveKeywords}
                        tone="amber"
                        emptyLabel="No missing must-have keyword."
                    />

                    <MatchPanel
                        title="Negative"
                        icon={<Filter size={15}/>}
                        values={job.matchedNegativeKeywords}
                        tone="red"
                        emptyLabel="No negative keyword matched."
                    />
                </div>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                    <h2 className="text-lg font-extrabold text-slate-50">
                        About the job
                    </h2>

                    <div className="mt-4">
                        <DescriptionBlock text={job.description}/>
                    </div>
                </section>
            </div>
        </div>
    )
}

function FetchJobsModal({
                            fetchCount,
                            setFetchCount,
                            fetchQuery,
                            setFetchQuery,
                            loading,
                            progress,
                            onClose,
                            onSubmit,
                        }: {
    fetchCount: number
    setFetchCount: (value: number) => void
    fetchQuery: string
    setFetchQuery: (value: string) => void
    loading: boolean
    progress: FetchJobsProgress | null
    onClose: () => void
    onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
    const progressPercent = progress
        ? Math.round((progress.current / Math.max(1, progress.total)) * 100)
        : 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <form
                onSubmit={onSubmit}
                className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-sky-400">
                            Mock fetch
                        </p>

                        <h2 className="mt-1 text-xl font-black text-slate-50">
                            Load LinkedIn mock jobs
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-slate-400">
                            Simulates fetching, parsing and enriching jobs before saving them in local cache.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-xl border border-slate-700 p-2 text-slate-400 transition hover:bg-slate-900 hover:text-white disabled:opacity-50"
                    >
                        <X size={18}/>
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    <label className="block">
                        <span className="text-xs font-bold text-slate-300">
                            Amount of jobs
                        </span>

                        <input
                            type="number"
                            min={1}
                            max={100}
                            value={fetchCount}
                            onChange={(event) => setFetchCount(Number(event.target.value))}
                            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-bold text-slate-300">
                            Optional query
                        </span>

                        <div className="relative mt-2">
                            <Search
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                            />

                            <input
                                type="text"
                                value={fetchQuery}
                                onChange={(event) => setFetchQuery(event.target.value)}
                                placeholder="python, backend, remote..."
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500"
                            />
                        </div>
                    </label>

                    {progress && (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                            <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
                                <span>{progress.message}</span>
                                <span>{progressPercent}%</span>
                            </div>

                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                                <div
                                    className="h-full rounded-full bg-sky-400"
                                    style={{width: `${progressPercent}%`}}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-slate-900 hover:text-white disabled:opacity-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""}/>
                        Fetch mock jobs
                    </button>
                </div>
            </form>
        </div>
    )
}

export default function SearchJobsPage() {
    const [jobs, setJobs] = useState<SearchJob[]>([])
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

    const [searchTerm, setSearchTerm] = useState("")
    const [verificationFilter, setVerificationFilter] =
        useState<VerificationFilter>("All")
    const [sourceFilter, setSourceFilter] = useState("All")
    const [sortBy, setSortBy] = useState<SortOption>("relevance")

    const [positiveKeywords, setPositiveKeywords] = useState(DEFAULT_POSITIVE_KEYWORDS)
    const [newPositiveKeyword, setNewPositiveKeyword] = useState("")

    const [mustHaveKeywords, setMustHaveKeywords] = useState(DEFAULT_MUST_HAVE_KEYWORDS)
    const [newMustHaveKeyword, setNewMustHaveKeyword] = useState("")

    const [negativeKeywords, setNegativeKeywords] = useState(DEFAULT_NEGATIVE_KEYWORDS)
    const [newNegativeKeyword, setNewNegativeKeyword] = useState("")

    const [negativeCompanies, setNegativeCompanies] = useState<string[]>([])
    const [excludedWorkplaceTypes, setExcludedWorkplaceTypes] = useState<string[]>([])
    const [maxApplicantsLimit, setMaxApplicantsLimit] = useState(Number.MAX_SAFE_INTEGER)
    const [showHiddenJobs, setShowHiddenJobs] = useState(false)

    const [savedIds, setSavedIds] = useState<string[]>(() => readSavedJobIdsMock())

    const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null)
    const [loadedFromCache, setLoadedFromCache] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const [isFetchModalOpen, setIsFetchModalOpen] = useState(false)
    const [fetchCount, setFetchCount] = useState(75)
    const [fetchQuery, setFetchQuery] = useState("")
    const [fetchProgress, setFetchProgress] = useState<FetchJobsProgress | null>(null)

    useEffect(() => {
        let isMounted = true

        async function loadInitialJobs() {
            setLoading(true)
            setErrorMessage(null)

            try {
                const result = await getInitialSearchJobsMockData()

                if (!isMounted) return

                setJobs(result.jobs)
                setCacheTimestamp(result.cachedAt)
                setLoadedFromCache(result.loadedFromCache)
            } catch (error) {
                if (!isMounted) return

                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Could not load mock jobs.",
                )
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        void loadInitialJobs()

        return () => {
            isMounted = false
        }
    }, [])

    const maxPossibleApplicants = useMemo(() => {
        const applicants = jobs
            .map((job) => job.applicantsTotal ?? 0)
            .filter((value) => Number.isFinite(value))

        return Math.max(0, ...applicants)
    }, [jobs])

    const sourceOptions = useMemo(
        () =>
            buildUniqueOptions(
                jobs.map((job) => ({
                    value: job.sourceKey,
                    label: job.sourceLabel,
                })),
            ),
        [jobs],
    )

    const companyOptions = useMemo(
        () =>
            buildUniqueOptions(
                jobs.map((job) => ({
                    value: job.company.name,
                    label: job.company.name,
                })),
            ),
        [jobs],
    )

    const workplaceOptions = useMemo(
        () =>
            buildUniqueOptions(
                jobs.map((job) => ({
                    value: job.workplaceType,
                    label: job.workplaceType,
                })),
            ),
        [jobs],
    )

    const evaluatedJobs = useMemo<JobView[]>(() => {
        const normalizedSearchTerm = normalizeText(searchTerm.trim())

        return jobs
            .map((job) => {
                const searchableText = buildSearchableText(job)

                const matchesSearch =
                    !normalizedSearchTerm || searchableText.includes(normalizedSearchTerm)

                const matchesVerification =
                    verificationFilter === "All" ||
                    (verificationFilter === "Verified" && job.verified) ||
                    (verificationFilter === "Unverified" && !job.verified)

                const matchesSource =
                    sourceFilter === "All" || job.sourceKey === sourceFilter

                if (!matchesSearch || !matchesVerification || !matchesSource) {
                    return null
                }

                const matchedPositiveKeywords = unique(
                    positiveKeywords.filter((keyword) =>
                        searchableText.includes(normalizeText(keyword)),
                    ),
                )

                const matchedNegativeKeywords = unique(
                    negativeKeywords.filter((keyword) =>
                        searchableText.includes(normalizeText(keyword)),
                    ),
                )

                const missingMustHaveKeywords = unique(
                    mustHaveKeywords.filter(
                        (keyword) => !searchableText.includes(normalizeText(keyword)),
                    ),
                )

                const hiddenReasons: string[] = []

                if (missingMustHaveKeywords.length > 0) {
                    hiddenReasons.push(`Missing: ${missingMustHaveKeywords.join(", ")}`)
                }

                if (matchedNegativeKeywords.length > 0) {
                    hiddenReasons.push(`Negative: ${matchedNegativeKeywords.join(", ")}`)
                }

                if (negativeCompanies.includes(job.company.name)) {
                    hiddenReasons.push("Company excluded")
                }

                if (excludedWorkplaceTypes.includes(job.workplaceType)) {
                    hiddenReasons.push("Workplace excluded")
                }

                if (
                    maxApplicantsLimit !== Number.MAX_SAFE_INTEGER &&
                    job.applicantsTotal != null &&
                    job.applicantsTotal > maxApplicantsLimit
                ) {
                    hiddenReasons.push(`>${maxApplicantsLimit} applicants`)
                }

                const visibleScore = Math.max(
                    0,
                    Math.min(
                        100,
                        Math.round(
                            job.pythonScore +
                            matchedPositiveKeywords.length * 2 -
                            matchedNegativeKeywords.length * 8 -
                            missingMustHaveKeywords.length * 12,
                        ),
                    ),
                )

                return {
                    ...job,
                    isSaved: savedIds.includes(job.jobId),
                    visibleScore,
                    isHidden: hiddenReasons.length > 0,
                    hiddenReasons,
                    matchedPositiveKeywords,
                    matchedNegativeKeywords,
                    missingMustHaveKeywords,
                }
            })
            .filter((job): job is JobView => Boolean(job))
    }, [
        jobs,
        searchTerm,
        verificationFilter,
        sourceFilter,
        positiveKeywords,
        negativeKeywords,
        mustHaveKeywords,
        negativeCompanies,
        excludedWorkplaceTypes,
        maxApplicantsLimit,
        savedIds,
    ])

    const sortedJobs = useMemo(() => {
        const sortableJobs = [...evaluatedJobs]

        sortableJobs.sort((a, b) => {
            switch (sortBy) {
                case "keywordScore":
                    return b.keywords.length - a.keywords.length
                case "pythonScore":
                    return b.pythonScore - a.pythonScore
                case "recent":
                    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
                case "applicants":
                    return (
                        (a.applicantsTotal ?? Number.MAX_SAFE_INTEGER) -
                        (b.applicantsTotal ?? Number.MAX_SAFE_INTEGER)
                    )
                case "title":
                    return a.title.localeCompare(b.title)
                case "company":
                    return a.company.name.localeCompare(b.company.name)
                case "relevance":
                default:
                    return (
                        b.visibleScore - a.visibleScore ||
                        new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
                    )
            }
        })

        return sortableJobs
    }, [evaluatedJobs, sortBy])

    const visibleJobs = useMemo(
        () => (showHiddenJobs ? sortedJobs : sortedJobs.filter((job) => !job.isHidden)),
        [showHiddenJobs, sortedJobs],
    )

    const hiddenCount = useMemo(
        () => sortedJobs.filter((job) => job.isHidden).length,
        [sortedJobs],
    )

    const savedCount = useMemo(
        () => jobs.filter((job) => savedIds.includes(job.jobId)).length,
        [jobs, savedIds],
    )

    const selectedJob = useMemo(
        () =>
            visibleJobs.find((job) => job.id === selectedJobId) ??
            visibleJobs[0] ??
            null,
        [selectedJobId, visibleJobs],
    )

    useEffect(() => {
        if (!selectedJob) {
            setSelectedJobId(null)
            return
        }

        if (selectedJob.id !== selectedJobId) {
            setSelectedJobId(selectedJob.id)
        }
    }, [selectedJob, selectedJobId])

    const handleAddPositiveKeyword = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const keyword = normalizeText(newPositiveKeyword.trim())
        if (!keyword) return

        setPositiveKeywords((current) => unique([...current, keyword]))
        setNewPositiveKeyword("")
    }

    const handleAddMustHaveKeyword = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const keyword = normalizeText(newMustHaveKeyword.trim())
        if (!keyword) return

        setMustHaveKeywords((current) => unique([...current, keyword]))
        setNewMustHaveKeyword("")
    }

    const handleAddNegativeKeyword = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const keyword = normalizeText(newNegativeKeyword.trim())
        if (!keyword) return

        setNegativeKeywords((current) => unique([...current, keyword]))
        setNewNegativeKeyword("")
    }

    const toggleCompany = (company: string) => {
        setNegativeCompanies((current) =>
            current.includes(company)
                ? current.filter((item) => item !== company)
                : [...current, company],
        )
    }

    const toggleWorkplaceType = (workplaceType: string) => {
        setExcludedWorkplaceTypes((current) =>
            current.includes(workplaceType)
                ? current.filter((item) => item !== workplaceType)
                : [...current, workplaceType],
        )
    }

    const handleClearCache = () => {
        clearJobsCacheMock()
        setJobs([])
        setSelectedJobId(null)
        setCacheTimestamp(null)
        setLoadedFromCache(false)
        setFetchProgress(null)
    }

    const handleFetchJobs = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        setLoading(true)
        setErrorMessage(null)
        setFetchProgress(null)

        try {
            const result = await fetchJobsMock({
                count: fetchCount,
                query: fetchQuery,
                onProgress: setFetchProgress,
            })

            setJobs(result.jobs)
            setCacheTimestamp(result.cachedAt)
            setLoadedFromCache(result.loadedFromCache)
            setIsFetchModalOpen(false)
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Could not fetch mock jobs.",
            )
        } finally {
            setLoading(false)
        }
    }

    const handleToggleSaved = (job: JobView) => {
        setSavedIds(toggleSavedJobMock(job.jobId))
    }

    const handleOpenApply = (job: JobView) => {
        window.open(job.jobUrl, "_blank", "noopener,noreferrer")
    }

    return (
        <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden bg-[#09111f] text-slate-100 xl:grid-cols-[430px_minmax(0,1fr)]">
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
                onAddPositiveKeyword={handleAddPositiveKeyword}
                onRemovePositiveKeyword={(keyword) =>
                    setPositiveKeywords((current) =>
                        current.filter((item) => item !== keyword),
                    )
                }
                mustHaveKeywords={mustHaveKeywords}
                newMustHaveKeyword={newMustHaveKeyword}
                onNewMustHaveKeywordChange={setNewMustHaveKeyword}
                onAddMustHaveKeyword={handleAddMustHaveKeyword}
                onRemoveMustHaveKeyword={(keyword) =>
                    setMustHaveKeywords((current) =>
                        current.filter((item) => item !== keyword),
                    )
                }
                negativeKeywords={negativeKeywords}
                newNegativeKeyword={newNegativeKeyword}
                onNewNegativeKeywordChange={setNewNegativeKeyword}
                onAddNegativeKeyword={handleAddNegativeKeyword}
                onRemoveNegativeKeyword={(keyword) =>
                    setNegativeKeywords((current) =>
                        current.filter((item) => item !== keyword),
                    )
                }
                negativeCompanies={negativeCompanies}
                onToggleNegativeCompany={toggleCompany}
                excludedWorkplaceTypes={excludedWorkplaceTypes}
                onToggleExcludedWorkplaceType={toggleWorkplaceType}
                maxApplicantsLimit={maxApplicantsLimit}
                maxPossibleApplicants={maxPossibleApplicants}
                onMaxApplicantsLimitChange={(value) =>
                    setMaxApplicantsLimit(
                        value >= maxPossibleApplicants
                            ? Number.MAX_SAFE_INTEGER
                            : value,
                    )
                }
                showHiddenJobs={showHiddenJobs}
                onShowHiddenJobsChange={setShowHiddenJobs}
                sourceOptions={sourceOptions}
                companyOptions={companyOptions}
                workplaceOptions={workplaceOptions}
                cacheTimestamp={cacheTimestamp}
                loadedFromCache={loadedFromCache}
                loading={loading}
                errorMessage={errorMessage}
                onOpenFetchModal={() => setIsFetchModalOpen(true)}
                onClearCache={handleClearCache}
                filteredCount={visibleJobs.length}
                hiddenCount={hiddenCount}
                savedCount={savedCount}
                containerClassName="h-full min-h-0 overflow-y-auto overscroll-contain border-b-0 border-r border-slate-800 [scrollbar-gutter:stable]"
                resultsSlot={
                    <JobListInsideFilters
                        jobs={visibleJobs}
                        selectedJobId={selectedJobId}
                        onSelectJob={setSelectedJobId}
                        loading={loading}
                    />
                }
            />

            <section className="min-h-0 overflow-hidden bg-slate-950">
                {selectedJob ? (
                    <SelectedJobPreview
                        job={selectedJob}
                        onToggleSaved={() => handleToggleSaved(selectedJob)}
                        onOpenApply={() => handleOpenApply(selectedJob)}
                    />
                ) : (
                    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                        <Briefcase size={34} className="text-slate-600"/>

                        <p className="mt-4 text-sm font-extrabold text-slate-300">
                            Select a job
                        </p>

                        <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">
                            Pick one job from the existing filter/list panel to preview its details here.
                        </p>
                    </div>
                )}
            </section>

            {isFetchModalOpen && (
                <FetchJobsModal
                    fetchCount={fetchCount}
                    setFetchCount={setFetchCount}
                    fetchQuery={fetchQuery}
                    setFetchQuery={setFetchQuery}
                    loading={loading}
                    progress={fetchProgress}
                    onClose={() => setIsFetchModalOpen(false)}
                    onSubmit={handleFetchJobs}
                />
            )}
        </div>
    )
}
