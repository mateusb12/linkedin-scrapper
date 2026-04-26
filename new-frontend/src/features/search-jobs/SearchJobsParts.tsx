import type {FormEvent, ReactNode} from "react"
import {
    Bookmark,
    BookmarkCheck,
    Briefcase,
    Building2,
    CalendarDays,
    Clock3,
    ExternalLink,
    Filter,
    MapPin,
    RefreshCw,
    Search, ShieldCheck,
    Sparkles,
    Users,
    X,
    Zap,
} from "lucide-react"

import type {SortOption} from "./SearchJobsFilters.tsx"

import {
    type FetchJobsProgress,
    placeholderLogo,
    type SearchJob,
} from "./searchJobsMockService.ts"


import {getTechIcon} from "../job-analysis/jobUtils.ts"

export type JobView = SearchJob & {
    isSaved: boolean
    visibleScore: number
    isHidden: boolean
    hiddenReasons: string[]
    matchedPositiveKeywords: string[]
    matchedNegativeKeywords: string[]
    missingMustHaveKeywords: string[]
}

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

const TECH_LABEL_ALIASES: Record<string, string> = {
    api: "API",
    aws: "AWS",
    azure: "Azure",
    backend: "Backend",
    django: "Django",
    docker: "Docker",
    fastapi: "FastAPI",
    flask: "Flask",
    frontend: "Frontend",
    gemini: "Gemini",
    git: "Git",
    java: "Java",
    javascript: "JavaScript",
    kafka: "Kafka",
    kubernetes: "Kubernetes",
    langchain: "LangChain",
    linux: "Linux",
    llm: "LLM",
    mysql: "MySQL",
    nextjs: "NextJS",
    node: "Node.js",
    nodejs: "Node.js",
    "node.js": "Node.js",
    oracle: "Oracle",
    pandas: "Pandas",
    php: "PHP",
    postgres: "PostgreSQL",
    postgresql: "PostgreSQL",
    python: "Python",
    rabbitmq: "RabbitMQ",
    react: "React",
    "react native": "React Native",
    reactnative: "React Native",
    redis: "Redis",
    remote: "Remote",
    sql: "SQL",
    terraform: "Terraform",
    typescript: "TypeScript",
    vue: "Vue",
}

const formatTechLabel = (tech: string) => {
    const normalized = tech.trim().toLowerCase()

    return (
        TECH_LABEL_ALIASES[normalized] ??
        tech
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase())
    )
}

const normalizeTechText = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[-_.]/g, " ")
        .replace(/\s+/g, " ")



const GENERIC_JOB_SIGNAL_KEYWORDS = new Set([
    "api",
    "backend",
    "frontend",
    "remote",
    "hybrid",
    "on site",
    "on-site",
    "onsite",
    "presential",
    "presencial",
    "full stack",
    "fullstack",
    "full-stack",
    "platform",
    "data engineering",
    "data engineer",
    "qa",
    "qa automation",
    "automation",
    "mobile",
    "junior",
    "júnior",
    "pleno",
    "senior",
    "sênior",
    "intern",
    "internship",
    "estagio",
    "estágio",
])

const isGenericJobSignal = (keyword: string) => {
    const normalizedKeyword = normalizeTechText(keyword)
    const normalizedLabel = normalizeTechText(formatTechLabel(keyword))

    return (
        GENERIC_JOB_SIGNAL_KEYWORDS.has(normalizedKeyword) ||
        GENERIC_JOB_SIGNAL_KEYWORDS.has(normalizedLabel)
    )
}

const matchesPositiveKeyword = (value: string, positiveKeywords: string[]) => {
    const normalizedValue = normalizeTechText(value)
    const normalizedLabel = normalizeTechText(formatTechLabel(value))

    return positiveKeywords.some((keyword) => {
        const normalizedKeyword = normalizeTechText(keyword)

        return (
            normalizedKeyword === normalizedValue ||
            normalizedKeyword === normalizedLabel
        )
    })
}


function TechBadge({
                       tech,
                       positive,
                   }: {
    tech: string
    positive: boolean
}) {
    const label = formatTechLabel(tech)
    const icon = getTechIcon(label)

    return (
        <span
            title={positive ? `${label}: positive keyword match` : label}
            aria-label={positive ? `${label}: positive keyword match` : label}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                positive
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200 shadow-[0_0_0_1px_rgba(52,211,153,0.12)]"
                    : "border-slate-700 bg-slate-950 text-slate-300"
            }`}
        >
            {icon && (
                <img
                    src={icon}
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4 rounded-sm object-contain"
                />
            )}
            {label}
        </span>
    )
}

const getApplicantsTone = (applicants?: number | null) => {
    if (applicants == null) {
        return {
            label: "Applicants not shown",
            level: "Unknown competition",
            className: "border-slate-700 bg-slate-900/80 text-slate-300",
        }
    }

    if (applicants < 117) {
        return {
            label: `${applicants} applicants`,
            level: "Low competition",
            className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
        }
    }

    if (applicants < 468) {
        return {
            label: `${applicants} applicants`,
            level: "Medium competition",
            className: "border-amber-400/40 bg-amber-500/10 text-amber-200",
        }
    }

    if (applicants < 1820) {
        return {
            label: `${applicants} applicants`,
            level: "High competition",
            className: "border-orange-400/40 bg-orange-500/10 text-orange-200",
        }
    }

    return {
        label: `${applicants} applicants`,
        level: "Very high competition",
        className: "border-red-400/40 bg-red-500/10 text-red-200",
    }
}


function RoleSignalBadge({
                            signal,
                            positive,
                        }: {
    signal: string
    positive: boolean
}) {
    const label = formatTechLabel(signal)

    return (
        <span
            title={positive ? `${label}: positive role signal` : `${label}: role signal`}
            aria-label={positive ? `${label}: positive role signal` : `${label}: role signal`}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                positive
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200 shadow-[0_0_0_1px_rgba(52,211,153,0.12)]"
                    : "border-slate-600 bg-slate-900/70 text-slate-300"
            }`}
        >
            <Briefcase size={13} className="opacity-80"/>
            {label}
        </span>
    )
}


function ApplicantsBadge({
                             applicants,
                             compact = false,
                         }: {
    applicants?: number | null
    compact?: boolean
}) {
    const tone = getApplicantsTone(applicants)

    return (
        <span
            title={`${tone.label} · ${tone.level}`}
            aria-label={`${tone.label} · ${tone.level}`}
            className={`inline-flex w-fit items-center justify-self-start gap-1.5 rounded-full border font-extrabold shadow-sm ${
                tone.className
            } ${
                compact
                    ? "px-2 py-0.5 text-[11px]"
                    : "px-3 py-1.5 text-xs"
            }`}
        >
            <Users size={compact ? 12 : 14} className="opacity-90"/>
            <span>{applicants == null ? "N/A" : applicants}</span>
            {!compact && <span className="font-bold opacity-90">applicants</span>}
        </span>
    )
}


const getSeniorityTone = (seniority?: string | null) => {
    const value = (seniority ?? "").trim().toLowerCase()

    if (value.includes("jun")) {
        return {
            label: seniority || "Junior",
            hint: "Junior level",
            className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
        }
    }

    if (value.includes("plen") || value.includes("mid")) {
        return {
            label: seniority || "Mid level",
            hint: "Mid level",
            className: "border-sky-400/40 bg-sky-500/10 text-sky-200",
        }
    }

    if (value.includes("sen")) {
        return {
            label: seniority || "Senior",
            hint: "Senior level",
            className: "border-purple-400/40 bg-purple-500/10 text-purple-200",
        }
    }

    if (value.includes("estag") || value.includes("intern")) {
        return {
            label: seniority || "Internship",
            hint: "Internship level",
            className: "border-amber-400/40 bg-amber-500/10 text-amber-200",
        }
    }

    return {
        label: seniority || "Not specified",
        hint: "Seniority",
        className: "border-slate-700 bg-slate-900/80 text-slate-300",
    }
}

function SeniorityBadge({seniority}: { seniority?: string | null }) {
    const tone = getSeniorityTone(seniority)

    return (
        <span
            title={`${tone.hint}: ${tone.label}`}
            aria-label={`${tone.hint}: ${tone.label}`}
            className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold shadow-sm ${tone.className}`}
        >
            <ShieldCheck size={14} className="opacity-90"/>
            <span>{tone.label}</span>
        </span>
    )
}

const getExperienceTone = (experience?: string | null) => {
    const value = (experience ?? "").trim()
    const normalized = value.toLowerCase()
    const match = normalized.match(/(\d+)/)
    const years = match ? Number(match[1]) : null

    if (years == null) {
        return {
            label: value || "Not specified",
            hint: "Experience required",
            className: "border-slate-700 bg-slate-900/80 text-slate-300",
        }
    }

    if (years <= 2) {
        return {
            label: value,
            hint: "Lower experience requirement",
            className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
        }
    }

    if (years <= 4) {
        return {
            label: value,
            hint: "Moderate experience requirement",
            className: "border-amber-400/40 bg-amber-500/10 text-amber-200",
        }
    }

    return {
        label: value,
        hint: "Higher experience requirement",
        className: "border-red-400/40 bg-red-500/10 text-red-200",
    }
}

function ExperienceBadge({experience}: { experience?: string | null }) {
    const tone = getExperienceTone(experience)

    return (
        <span
            title={`${tone.hint}: ${tone.label}`}
            aria-label={`${tone.hint}: ${tone.label}`}
            className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold shadow-sm ${tone.className}`}
        >
            <Clock3 size={14} className="opacity-90"/>
            <span>{tone.label}</span>
        </span>
    )
}


const getJobCardClassName = (job: JobView, selected: boolean) => {
    if (job.isHidden) {
        return selected
            ? "border-red-400/90 bg-red-950/45 shadow-[inset_4px_0_0_#f87171] ring-1 ring-red-500/40"
            : "border-red-500/60 bg-red-950/30 hover:border-red-400/80 hover:bg-red-950/40"
    }

    if (job.isSaved) {
        return selected
            ? "border-emerald-400/90 bg-emerald-950/40 shadow-[inset_4px_0_0_#34d399] ring-1 ring-emerald-500/40"
            : "border-emerald-500/50 bg-emerald-950/20 hover:border-emerald-400/70 hover:bg-emerald-950/30"
    }

    return selected
        ? "border-sky-400/70 bg-sky-500/10 shadow-[inset_3px_0_0_#38bdf8]"
        : "border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-900/70"
}

type SmallPillTone = "default" | "green" | "blue" | "amber" | "red"

function SmallPill({
                       children,
                       tone = "default",
                   }: {
    children: ReactNode
    tone?: SmallPillTone
}) {
    const toneClasses: Record<SmallPillTone, string> = {
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

function ScoreBadge({
                        score,
                        label = "Python score",
                    }: {
    score: number
    label?: string
}) {
    const roundedScore = Math.round(score)

    return (
        <span
            title={`${label}: ${roundedScore}`}
            aria-label={`${label}: ${roundedScore}`}
            className={`inline-flex cursor-help items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-extrabold ${getScoreTone(score)}`}
        >
            <Zap size={13}/>
            {roundedScore}
        </span>
    )
}

function HighlightBadge({
                            title,
                            icon,
                            children,
                            className,
                        }: {
    title: string
    icon: ReactNode
    children: ReactNode
    className: string
}) {
    return (
        <span
            title={title}
            aria-label={title}
            className={`inline-flex cursor-help items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-extrabold ${className}`}
        >
            {icon}
            {children}
        </span>
    )
}

function JobSortHighlightBadge({
                                   job,
                                   sortBy,
                               }: {
    job: JobView
    sortBy: SortOption
}) {
    switch (sortBy) {
        case "keywordScore":
            return (
                <HighlightBadge
                    title={`Keyword score: ${job.keywords.length} detected keywords`}
                    icon={<Sparkles size={13}/>}
                    className="border-amber-400/50 bg-amber-400/10 text-amber-200"
                >
                    {job.keywords.length}
                </HighlightBadge>
            )

        case "applicants": {
            const applicantsLabel =
                job.applicantsTotal == null
                    ? "Applicants: not available"
                    : `Applicants: ${job.applicantsTotal}`

            return (
                <HighlightBadge
                    title={applicantsLabel}
                    icon={<Users size={13}/>}
                    className="border-purple-400/50 bg-purple-400/10 text-purple-200"
                >
                    {job.applicantsTotal == null ? "N/A" : job.applicantsTotal}
                </HighlightBadge>
            )
        }

        case "pythonScore":
            return <ScoreBadge score={job.pythonScore} label="Python score"/>

        case "recent":
            return (
                <HighlightBadge
                    title={`Posted date: ${formatFullDate(job.postedAt)}`}
                    icon={<Clock3 size={13}/>}
                    className="border-sky-400/50 bg-sky-400/10 text-sky-200"
                >
                    {formatDateDistance(job.postedAt)}
                </HighlightBadge>
            )

        case "title":
            return (
                <HighlightBadge
                    title="Title sort: A-Z"
                    icon={<Briefcase size={13}/>}
                    className="border-slate-500/60 bg-slate-700/40 text-slate-200"
                >
                    A-Z
                </HighlightBadge>
            )

        case "company":
            return (
                <HighlightBadge
                    title="Company sort: A-Z"
                    icon={<Building2 size={13}/>}
                    className="border-slate-500/60 bg-slate-700/40 text-slate-200"
                >
                    A-Z
                </HighlightBadge>
            )

        case "relevance":
        default:
            return <ScoreBadge score={job.visibleScore} label="Relevance score"/>
    }
}

const VISIBLE_JOB_ROWS = 10
const ESTIMATED_JOB_CARD_HEIGHT_PX = 132

export function JobListInsideFilters({
                                         jobs,
                                         selectedJobId,
                                         onSelectJob,
                                         loading,
                                         sortBy,
                                     }: {
    jobs: JobView[]
    selectedJobId: string | null
    onSelectJob: (id: string) => void
    loading: boolean
    sortBy: SortOption
}) {
    if (loading && jobs.length === 0) {
        return (
            <div
                className="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
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
        <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-black text-slate-100">
                    <Briefcase size={16} className="text-sky-400"/>
                    Jobs
                </p>

                <span className="text-xs font-semibold text-slate-500">
                    {jobs.length} visible
                </span>
            </div>

            <div
                className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]"
                style={{
                    maxHeight: `calc((${ESTIMATED_JOB_CARD_HEIGHT_PX}px * ${VISIBLE_JOB_ROWS}) + (0.5rem * ${VISIBLE_JOB_ROWS - 1}))`,
                }}
            >
                {jobs.map((job) => {
                    const selected = job.id === selectedJobId

                    return (
                        <button
                            key={job.id}
                            type="button"
                            onClick={() => onSelectJob(job.id)}
                            className={`w-full rounded-xl border p-3 text-left transition ${getJobCardClassName(job, selected)}`}
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

                                        <JobSortHighlightBadge job={job} sortBy={sortBy}/>
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

                                        <ApplicantsBadge applicants={job.applicantsTotal} compact/>

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

export function SelectedJobPreview({
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

                        <div className="mt-3 space-y-2">
                            <div className="flex flex-wrap gap-2">
                                {job.verified && <SmallPill tone="green">Verified</SmallPill>}

                                <SmallPill tone={job.workplaceType === "Remote" ? "blue" : "default"}>
                                    {job.workplaceType}
                                </SmallPill>

                                {job.isHidden && <SmallPill tone="red">Filtered</SmallPill>}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <ApplicantsBadge applicants={job.applicantsTotal}/>
                                <SeniorityBadge seniority={job.seniority}/>
                                <ExperienceBadge experience={job.experienceYears}/>
                            </div>
                        </div>
                    </div>

                    <ScoreBadge score={job.visibleScore} label="Relevance score"/>
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

                        <ApplicantsBadge applicants={job.applicantsTotal}/>
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
                    {(() => {
                        const stackKeywords = job.keywords.filter(
                            (item) => !isGenericJobSignal(item),
                        )

                        const roleSignals = job.keywords.filter(isGenericJobSignal)

                        return (
                            <>
                                <h2 className="text-lg font-extrabold text-slate-50">
                                    Detected stack
                                </h2>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {stackKeywords.length > 0 ? (
                                        stackKeywords.map((item) => (
                                            <TechBadge
                                                key={item}
                                                tech={item}
                                                positive={matchesPositiveKeyword(
                                                    item,
                                                    job.matchedPositiveKeywords,
                                                )}
                                            />
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-500">
                                            No concrete tech stack detected in this mock payload.
                                        </p>
                                    )}
                                </div>

                                {roleSignals.length > 0 && (
                                    <div className="mt-5 border-t border-slate-800 pt-4">
                                        <h3 className="text-sm font-extrabold text-slate-300">
                                            Role signals
                                        </h3>

                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {roleSignals.map((item) => (
                                                <RoleSignalBadge
                                                    key={item}
                                                    signal={item}
                                                    positive={matchesPositiveKeyword(
                                                        item,
                                                        job.matchedPositiveKeywords,
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )
                    })()}
                </section>

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

export function FetchJobsModal({
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
