import {useEffect, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction} from "react"
import {
    Bookmark,
    BookmarkCheck,
    Briefcase,
    Building2,
    Workflow,
    CalendarDays,
    ChevronRight,
    Clock3,
    Database,
    ExternalLink,
    Filter,
    MapPin,
    RefreshCw,
    Search,
    ShieldCheck,
    Sparkles,
    Tags,
    Users,
    X,
    Zap,
} from "lucide-react"

import type {SortOption} from "./SearchJobsFilters.tsx"

import {
    type SearchJobsProgress,
    placeholderLogo,
    type ScoreSignal,
    type SearchJob,
    type SearchJobsMeta,
} from "./searchJobsService.ts"


import {
    extractExperienceFromDescription,
    formatTechLabel,
    getJobAgeMeta,
    normalizeTechText,
    getRuntimeJobKeywords,
    getTechIcon,
    isPositiveKeywordMatch,
    splitStackAndRoleSignals,
} from "../job-analysis/jobUtils.ts"
import type {Experience} from "../job-analysis/jobUtils.ts"

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

const getEffectiveArchetype = (job: Pick<SearchJob, "aiArchetype" | "archetype">) =>
    (job.aiArchetype || job.archetype || "").trim()

type ArchetypeVisual = {
    label: string
    prefix: string
    className: string
}

const ARCHETYPE_VISUALS: Record<string, ArchetypeVisual> = {
    backend_python_pure: {
        prefix: "Target",
        label: "Backend Python",
        className: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
    },
    backend_python_with_minor_cross_functional_signals: {
        prefix: "Target-ish",
        label: "Backend Python+",
        className: "border-teal-400/35 bg-teal-500/10 text-teal-200",
    },
    ai_or_llm_python: {
        prefix: "Mixed",
        label: "AI/LLM Python",
        className: "border-violet-400/35 bg-violet-500/10 text-violet-200",
    },
    fullstack_python: {
        prefix: "Mismatch",
        label: "Fullstack",
        className: "border-amber-400/35 bg-amber-500/10 text-amber-200",
    },
    data_platform_python: {
        prefix: "Mismatch",
        label: "Data Platform",
        className: "border-cyan-400/35 bg-cyan-500/10 text-cyan-200",
    },
    ai_training_or_evaluation_python: {
        prefix: "Mismatch",
        label: "AI Evaluation",
        className: "border-red-400/35 bg-red-500/10 text-red-200",
    },
    platform_or_internal_systems_python: {
        prefix: "Mismatch",
        label: "Platform/Internal",
        className: "border-orange-400/35 bg-orange-500/10 text-orange-200",
    },
    generic_python: {
        prefix: "Generic",
        label: "Generic Python",
        className: "border-slate-500/40 bg-slate-800/70 text-slate-300",
    },
    unscored: {
        prefix: "Score",
        label: "Not scored",
        className: "border-slate-600 bg-slate-900/80 text-slate-400",
    },
}

const humanizeArchetype = (archetype: string) =>
    archetype
        .trim()
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")

const getArchetypeVisual = (archetype: string): ArchetypeVisual => {
    const normalized = archetype.trim().toLowerCase()

    return (
        ARCHETYPE_VISUALS[normalized] || {
            prefix: "Profile",
            label: humanizeArchetype(archetype),
            className: "border-sky-400/35 bg-sky-500/10 text-sky-200",
        }
    )
}

function ArchetypeBadge({
                            job,
                            compact = false,
                        }: {
    job: Pick<SearchJob, "aiArchetype" | "archetype">
    compact?: boolean
}) {
    const archetype = getEffectiveArchetype(job)

    if (!archetype) return null

    const visual = getArchetypeVisual(archetype)
    const title = `${visual.prefix} · ${visual.label} (${archetype})`

    return (
        <span
            title={title}
            aria-label={title}
            className={`inline-flex w-fit items-center gap-1.5 rounded-full border font-extrabold ${
                compact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-xs"
            } ${visual.className}`}
        >
            <Tags size={compact ? 11 : 13} className="opacity-75"/>

            {!compact && (
                <>
                    <span className="opacity-70">{visual.prefix}</span>
                    <span className="opacity-40">·</span>
                </>
            )}

            <span>{visual.label}</span>
        </span>
    )
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


const ENGINEERING_PRACTICE_SIGNALS = new Set([
    "serverless",
    "microservices",
    "tdd",
    "ddd",
])

function RoleSignalBadge({
                             signal,
                             positive,
                         }: {
    signal: string
    positive: boolean
}) {
    const label = formatTechLabel(signal)
    const normalizedLabel = normalizeTechText(label)
    const isEngineeringPractice = ENGINEERING_PRACTICE_SIGNALS.has(normalizedLabel)

    const title = isEngineeringPractice
        ? positive
            ? `${label}: positive engineering practice signal`
            : `${label}: engineering practice signal`
        : positive
            ? `${label}: positive role signal`
            : `${label}: role signal`

    const className = isEngineeringPractice
        ? positive
            ? "border-violet-400/50 bg-violet-500/15 text-violet-200 shadow-[0_0_0_1px_rgba(167,139,250,0.12)]"
            : "border-violet-400/35 bg-violet-500/10 text-violet-200"
        : positive
            ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200 shadow-[0_0_0_1px_rgba(52,211,153,0.12)]"
            : "border-slate-600 bg-slate-900/70 text-slate-300"

    return (
        <span
            title={title}
            aria-label={title}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${className}`}
        >
            {isEngineeringPractice ? (
                <Workflow size={13} className="opacity-85"/>
            ) : (
                <Briefcase size={13} className="opacity-80"/>
            )}
            {label}
        </span>
    )
}


const getRuntimeExperience = (job: SearchJob) =>
    extractExperienceFromDescription(
        [
            job.title,
            job.description,
            job.description_full,
            job.description_snippet,
            job.premium_title,
            job.premium_description,
        ]
            .filter(Boolean)
            .join("\n\n"),
    )


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


function JobAgeBadge({postedAt}: { postedAt: string }) {
    const age = getJobAgeMeta(postedAt)

    const toneClasses = {
        green: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
        amber: "border-amber-400/40 bg-amber-500/10 text-amber-200",
        red: "border-red-400/40 bg-red-500/10 text-red-200",
        slate: "border-slate-700 bg-slate-900/80 text-slate-300",
    }

    const title =
        age.totalDays == null
            ? "Posted date not available"
            : `Posted ${formatDateDistance(postedAt)} · ${formatFullDate(postedAt)}`

    return (
        <span
            title={title}
            aria-label={title}
            className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold shadow-sm ${toneClasses[age.tone]}`}
        >
            <Clock3 size={14} className="opacity-90"/>
            <span>{age.label}</span>
        </span>
    )
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

const getExperienceTone = (experience: Experience) => {
    const years = experience.min

    if (years <= 2) {
        return {
            label: experience.text,
            hint: "Lower experience requirement",
            className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
        }
    }

    if (years <= 4) {
        return {
            label: experience.text,
            hint: "Moderate experience requirement",
            className: "border-amber-400/40 bg-amber-500/10 text-amber-200",
        }
    }

    return {
        label: experience.text,
        hint: "Higher experience requirement",
        className: "border-red-400/40 bg-red-500/10 text-red-200",
    }
}

function ExperienceBadge({experience}: { experience: Experience }) {
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

const formatScoreLabel = (label: string) =>
    label
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")

const formatScoreValue = (value: number) =>
    Math.abs(value % 1) < Number.EPSILON
        ? String(Math.round(value))
        : value.toFixed(2)

const formatSignedPoints = (value: unknown) => {
    const numericValue = Number(value)

    if (!Number.isFinite(numericValue)) return null

    return `${numericValue >= 0 ? "+" : ""}${formatScoreValue(numericValue)}`
}

const getShortSource = (value: unknown) => {
    if (!value) return null

    const trimmed = String(value).trim().replace(/\s+/g, " ")

    return trimmed.length <= 120 ? trimmed : `${trimmed.slice(0, 117)}...`
}

const getStringList = (value: unknown) =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : []

function ScoreBreakdownList({
                                items,
                                tone,
                            }: {
    items: ScoreSignal[]
    tone: "positive" | "negative"
}) {
    if (items.length === 0) {
        return <p className="mt-2 text-sm text-slate-500">None.</p>
    }

    const toneClasses =
        tone === "positive"
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-amber-500/20 bg-amber-500/5"
    const pointsClasses = tone === "positive" ? "text-emerald-300" : "text-amber-300"

    return (
        <ul className="mt-2 space-y-2">
            {items.map((item, index) => {
                const label = item.label || "Unnamed signal"
                const points = formatSignedPoints(item.points)
                const source = getShortSource(item.source)

                return (
                    <li
                        key={`${label}-${item.source || "no-source"}-${index}`}
                        className={`rounded-xl border px-3 py-2 ${toneClasses}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold text-slate-100">{label}</p>

                            {points && (
                                <span className={`shrink-0 font-black ${pointsClasses}`}>
                                    {points}
                                </span>
                            )}
                        </div>

                        {source && <p className="mt-1 text-xs text-slate-400">{source}</p>}
                    </li>
                )
            })}
        </ul>
    )
}

function StringReasonList({items}: { items: string[] }) {
    if (items.length === 0) return null

    return (
        <ul className="mt-2 space-y-1 text-sm text-slate-200">
            {items.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
            ))}
        </ul>
    )
}

function ScoreReasoningPanel({job}: { job: JobView }) {
    const scoreBreakdown = job.aiScoreBreakdown || null
    const positiveSignals = scoreBreakdown?.positive || job.scoreBreakdown.positive || []
    const negativeSignals = scoreBreakdown?.negative || job.scoreBreakdown.negative || []
    const categoryEntries = Object.entries(
        scoreBreakdown?.category_totals ||
        job.scoreBreakdown.categoryTotals ||
        job.aiCategoryScores ||
        {},
    ).filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    const matchedKeywordGroups = Object.entries(job.aiMatchedKeywords || {}).filter(
        ([, keywords]) => Array.isArray(keywords) && keywords.length > 0,
    )
    const bonusReasons = job.aiBonusReasons || []
    const penaltyReasons = job.aiPenaltyReasons || []
    const suspiciousReasons = job.aiSuspiciousReasons || []
    const finalScore =
        typeof scoreBreakdown?.final_score === "number" &&
        Number.isFinite(scoreBreakdown.final_score)
            ? scoreBreakdown.final_score
            : job.aiScore
    const archetypeSignals = getStringList(job.aiSignals)
    const evidence = getStringList(job.aiEvidence)
    const hasScoreReasoning =
        Boolean(scoreBreakdown) ||
        Boolean(job.aiArchetype) ||
        typeof job.aiSuspicious === "boolean" ||
        archetypeSignals.length > 0 ||
        evidence.length > 0 ||
        suspiciousReasons.length > 0 ||
        bonusReasons.length > 0 ||
        penaltyReasons.length > 0 ||
        categoryEntries.length > 0 ||
        matchedKeywordGroups.length > 0

    if (!hasScoreReasoning) return null

    return (
        <details className="mt-4 border-t border-slate-800 pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-slate-100 marker:content-none">
                <span>Why this score?</span>
                <ChevronRight size={16} className="shrink-0 text-slate-500"/>
            </summary>

            <div className="mt-4 space-y-4 text-sm text-slate-300">
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                            Final score
                        </p>
                        <p className="mt-1 text-slate-100">{formatScoreValue(finalScore)}</p>
                    </div>

                    {job.aiArchetype && (
                        <div>
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                                Archetype
                            </p>
                            <p className="mt-1 text-slate-100">
                                {formatScoreLabel(job.aiArchetype)}
                            </p>
                        </div>
                    )}
                </div>

                <div>
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-400">
                        Positive signals
                    </p>
                    <ScoreBreakdownList items={positiveSignals} tone="positive"/>
                </div>

                <div>
                    <p className="text-xs font-black uppercase tracking-wide text-amber-400">
                        Negative signals
                    </p>
                    <ScoreBreakdownList items={negativeSignals} tone="negative"/>
                </div>

                {categoryEntries.length > 0 && (
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                            Category totals
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {categoryEntries.map(([label, value]) => (
                                <span
                                    key={label}
                                    className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-200"
                                >
                                    {formatScoreLabel(label)}: {formatScoreValue(value)}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {matchedKeywordGroups.length > 0 && (
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                            Matched keywords
                        </p>
                        <div className="mt-2 space-y-2">
                            {matchedKeywordGroups.map(([group, keywords]) => (
                                <div key={group}>
                                    <p className="text-xs font-bold text-slate-500">
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

                {bonusReasons.length > 0 && positiveSignals.length === 0 && (
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-emerald-400">
                            Bonus reasons
                        </p>
                        <StringReasonList items={bonusReasons}/>
                    </div>
                )}

                {penaltyReasons.length > 0 && negativeSignals.length === 0 && (
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-amber-400">
                            Penalties
                        </p>
                        <StringReasonList items={penaltyReasons}/>
                    </div>
                )}

                {archetypeSignals.length > 0 && (
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-sky-400">
                            Archetype signals
                        </p>
                        <StringReasonList items={archetypeSignals}/>
                    </div>
                )}

                {typeof job.aiSuspicious === "boolean" && (
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                            Suspicious
                        </p>
                        <p className={job.aiSuspicious ? "mt-1 text-red-300" : "mt-1 text-slate-100"}>
                            {job.aiSuspicious ? "Yes" : "No"}
                        </p>
                    </div>
                )}

                {suspiciousReasons.length > 0 && (
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-red-400">
                            Suspicious reasons
                        </p>
                        <StringReasonList items={suspiciousReasons}/>
                    </div>
                )}

                {evidence.length > 0 && (
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                            Evidence
                        </p>
                        <StringReasonList items={evidence}/>
                    </div>
                )}
            </div>
        </details>
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
const ESTIMATED_JOB_CARD_HEIGHT_PX = 148

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
                Loading jobs...
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
                    Change the filters or fetch jobs from the backend.
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

                                    <div className="mt-2">
                                        <ArchetypeBadge job={job} compact/>
                                    </div>

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
                No description available for this job.
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
    const runtimeExperience = getRuntimeExperience(job)

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
                            <ArchetypeBadge job={job}/>

                            <div className="flex flex-wrap gap-2">
                                {job.verified && <SmallPill tone="green">Verified</SmallPill>}

                                <SmallPill tone={job.workplaceType === "Remote" ? "blue" : "default"}>
                                    {job.workplaceType}
                                </SmallPill>

                                {job.isHidden && <SmallPill tone="red">Filtered</SmallPill>}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <SeniorityBadge seniority={job.seniority}/>
                                {runtimeExperience && (
                                    <ExperienceBadge experience={runtimeExperience}/>
                                )}
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
                    {(() => {
                        const runtimeKeywords = getRuntimeJobKeywords(job)
                        const {stackKeywords, roleSignals} = splitStackAndRoleSignals(
                            runtimeKeywords,
                            job.seniority,
                        )

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
                                                positive={isPositiveKeywordMatch(
                                                    item,
                                                    job.matchedPositiveKeywords,
                                                )}
                                            />
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-500">
                                            No concrete tech stack detected in this payload.
                                        </p>
                                    )}
                                </div>

                                <div className="mt-5 border-t border-slate-800 pt-4">
                                    <h3 className="text-sm font-extrabold text-slate-300">
                                        Role signals
                                    </h3>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {roleSignals.length > 0 ? (
                                            roleSignals.map((item) => (
                                                <RoleSignalBadge
                                                    key={item}
                                                    signal={item}
                                                    positive={isPositiveKeywordMatch(
                                                        item,
                                                        job.matchedPositiveKeywords,
                                                    )}
                                                />
                                            ))
                                        ) : (
                                            <p className="text-sm text-slate-500">
                                                No role signals detected in this payload.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-5 border-t border-slate-800 pt-4">
                                    <h3 className="text-sm font-extrabold text-slate-300">
                                        Job metrics
                                    </h3>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <ApplicantsBadge applicants={job.applicantsTotal}/>
                                        <JobAgeBadge postedAt={job.postedAt}/>
                                    </div>
                                </div>
                            </>
                        )
                    })()}
                </section>

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

                        <ScoreReasoningPanel job={job}/>
                    </div>
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


const formatRemainingTime = (ms: number | null) => {
    if (!Number.isFinite(ms) || !ms || ms <= 0) return "—"

    const totalSeconds = Math.ceil(ms / 1000)

    if (totalSeconds < 60) return `${totalSeconds}s`

    const totalMinutes = Math.ceil(totalSeconds / 60)

    if (totalMinutes < 60) return `${totalMinutes}min`

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}min`
}

const formatEta = (date: Date | null) => {
    if (!date) return "—"

    return date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    })
}

function ProgressMetric({
                            label,
                            value,
                        }: {
    label: string
    value: string
}) {
    return (
        <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {label}
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-100">
                {value}
            </p>
        </div>
    )
}

function LiveProgressBar({progress}: { progress: SearchJobsProgress | null }) {
    const [enrichStartedAt, setEnrichStartedAt] = useState<number | null>(null)
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
        if (!progress) {
            setEnrichStartedAt(null)
            setNow(Date.now())
            return
        }

        if (progress.step !== "enriching") {
            setEnrichStartedAt(null)
            setNow(Date.now())
            return
        }

        if (progress.total > 0 && enrichStartedAt === null) {
            setEnrichStartedAt(Date.now())
            setNow(Date.now())
        }
    }, [progress, enrichStartedAt])

    useEffect(() => {
        if (!progress || progress.step !== "enriching" || !enrichStartedAt) {
            return
        }

        const intervalId = window.setInterval(() => {
            setNow(Date.now())
        }, 1000)

        return () => window.clearInterval(intervalId)
    }, [progress, enrichStartedAt])

    if (!progress) {
        return (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                    <RefreshCw size={14} className="animate-spin"/>
                    Starting LinkedIn fetch...
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full w-[8%] rounded-full bg-sky-400"/>
                </div>
            </div>
        )
    }

    const {step, message, current = 0, total = 0} = progress

    let percent = 0

    if (step === "fetching") {
        percent = 10
    } else if (step === "parsing") {
        percent = 20
    } else if (step === "enriching" && total > 0) {
        percent = 20 + (current / total) * 80
    } else if (total > 0) {
        percent = (current / total) * 100
    }

    const safePercent = Math.min(100, Math.max(0, Math.round(percent)))

    const elapsedMs =
        step === "enriching" && enrichStartedAt
            ? Math.max(now - enrichStartedAt, 0)
            : 0

    const elapsedMinutes = elapsedMs / 60_000

    const jobsPerMinute =
        step === "enriching" && current > 0 && elapsedMinutes > 0
            ? current / elapsedMinutes
            : null

    const remainingJobs =
        step === "enriching" && total > 0
            ? Math.max(total - current, 0)
            : null

    const remainingMs =
        jobsPerMinute && remainingJobs != null
            ? (remainingJobs / jobsPerMinute) * 60_000
            : null

    const eta =
        remainingMs && Number.isFinite(remainingMs)
            ? new Date(now + remainingMs)
            : null

    return (
        <div className="rounded-2xl border border-sky-900/40 bg-slate-900/60 p-4 shadow-[0_0_15px_rgba(14,165,233,0.08)]">
            <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
                <span className="inline-flex min-w-0 items-center gap-2 text-sky-300">
                    <RefreshCw size={14} className="shrink-0 animate-spin"/>
                    <span className="truncate">{message}</span>
                </span>

                <span className="shrink-0 text-sky-200">{safePercent}%</span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                    className="h-full rounded-full bg-sky-400 transition-all duration-300 ease-out"
                    style={{width: `${safePercent}%`}}
                />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <ProgressMetric
                    label="jobs processados"
                    value={total > 0 ? `${current}/${total}` : "—"}
                />

                <ProgressMetric
                    label="jobs faltando"
                    value={remainingJobs != null ? `${remainingJobs} jobs` : "—"}
                />

                <ProgressMetric
                    label="tempo restante"
                    value={formatRemainingTime(remainingMs)}
                />

                <ProgressMetric
                    label="ETA"
                    value={formatEta(eta)}
                />
            </div>
        </div>
    )
}

const formatCountMap = (value?: Record<string, number>) =>
    Object.entries(value || {})
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => `${key}: ${count}`)

const getPrefilterRejectedJobs = (meta: SearchJobsMeta | null) =>
    meta?.prefilter?.rejected_jobs || meta?.prefilter?.sample_rejected || []

export function PrefilterAuditPanel({meta}: { meta: SearchJobsMeta | null }) {
    const [isOpen, setIsOpen] = useState(false)
    const prefilter = meta?.prefilter || null
    const rejectedJobs = getPrefilterRejectedJobs(meta)

    if (!prefilter) {
        return (
            <div className="border-t border-slate-800 bg-slate-950 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Filter size={14}/>
                    Prefilter report unavailable for this cache.
                </div>
            </div>
        )
    }

    const cardsChecked = prefilter.cards_checked ?? 0
    const accepted = prefilter.accepted_for_expensive_enrichment ?? 0
    const rejected = prefilter.rejected_before_expensive_enrichment ?? rejectedJobs.length
    const missingCounts = formatCountMap(prefilter.missing_must_have_counts)
    const negativeCounts = formatCountMap(prefilter.matched_negative_counts)
    const rules = prefilter.rules || {}

    return (
        <div className="shrink-0 border-t border-slate-800 bg-slate-950">
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-900/70"
            >
                <span className="inline-flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-400/30 bg-red-500/10 text-red-200">
                        <Filter size={15}/>
                    </span>

                    <span className="min-w-0">
                        <span className="block text-sm font-black text-slate-100">
                            Prefilter report
                        </span>
                        <span className="block truncate text-xs font-bold text-slate-500">
                            {rejected} rejected before enrichment · {accepted} enriched · {cardsChecked} checked
                        </span>
                    </span>
                </span>

                <ChevronRight
                    size={18}
                    className={`shrink-0 text-slate-500 transition ${
                        isOpen ? "rotate-90" : ""
                    }`}
                />
            </button>

            {isOpen && (
                <div className="max-h-[42vh] overflow-y-auto border-t border-slate-800 px-4 py-4">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                Checked
                            </p>
                            <p className="mt-1 text-2xl font-black text-slate-100">
                                {cardsChecked}
                            </p>
                        </div>

                        <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-300/70">
                                Enriched
                            </p>
                            <p className="mt-1 text-2xl font-black text-emerald-200">
                                {accepted}
                            </p>
                        </div>

                        <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wide text-red-300/70">
                                Skipped
                            </p>
                            <p className="mt-1 text-2xl font-black text-red-200">
                                {rejected}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <PrefilterAuditBlock
                            label="Rules"
                            items={[
                                `must: ${(rules.must_have_keywords || []).join(", ") || "-"}`,
                                `negative: ${(rules.negative_keywords || []).join(", ") || "-"}`,
                                `companies: ${(rules.negative_companies || []).join(", ") || "-"}`,
                                `max applicants: ${rules.max_applicants ?? "-"}`,
                            ]}
                        />

                        <PrefilterAuditBlock
                            label="Top reject signals"
                            items={[
                                ...missingCounts.map((item) => `missing ${item}`),
                                ...negativeCounts.map((item) => `negative ${item}`),
                            ]}
                            emptyLabel="No reject signals recorded."
                        />
                    </div>

                    <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(130px,0.35fr)] gap-3 border-b border-slate-800 bg-slate-900/80 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                            <span>Rejected job</span>
                            <span>Reason</span>
                        </div>

                        {rejectedJobs.length > 0 ? (
                            rejectedJobs.map((job, index) => (
                                <div
                                    key={`${job.job_id || job.title || "job"}-${index}`}
                                    className="grid grid-cols-[minmax(0,1fr)_minmax(130px,0.35fr)] gap-3 border-b border-slate-800/70 px-3 py-3 last:border-b-0"
                                >
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <p className="truncate text-sm font-extrabold text-slate-100">
                                                {job.title || "Untitled job"}
                                            </p>

                                            {job.job_url && (
                                                <a
                                                    href={job.job_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="shrink-0 text-slate-500 transition hover:text-sky-300"
                                                    aria-label="Open rejected job"
                                                >
                                                    <ExternalLink size={13}/>
                                                </a>
                                            )}
                                        </div>

                                        <p className="mt-1 truncate text-xs font-bold text-slate-500">
                                            {[job.company, job.location, job.job_id]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </p>

                                        {job.details_unavailable && (
                                            <p className="mt-1 text-[11px] font-bold text-amber-300">
                                                Details unavailable; card data was used.
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-start gap-1.5">
                                        {(job.reasons || []).length > 0 ? (
                                            (job.reasons || []).map((reason) => (
                                                <span
                                                    key={reason}
                                                    className="rounded-md border border-red-400/25 bg-red-500/10 px-2 py-1 text-[11px] font-bold text-red-200"
                                                >
                                                    {reason}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs font-bold text-slate-500">
                                                No reason recorded
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-5 text-sm font-bold text-slate-500">
                                No rejected jobs recorded.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

function PrefilterAuditBlock({
                                 label,
                                 items,
                                 emptyLabel = "None",
                             }: {
    label: string
    items: string[]
    emptyLabel?: string
}) {
    const visibleItems = items.filter(Boolean)

    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                {label}
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
                {visibleItems.length > 0 ? (
                    visibleItems.map((item) => (
                        <span
                            key={item}
                            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-bold text-slate-300"
                        >
                            {item}
                        </span>
                    ))
                ) : (
                    <span className="text-xs font-bold text-slate-500">
                        {emptyLabel}
                    </span>
                )}
            </div>
        </div>
    )
}

type FetchRequestPreview = {
    linkedinKeywords: string
    linkedinExcludedKeywords: string[]
    effectiveLinkedinQuery: string
    prefilterMustHaveKeywords: string[]
    prefilterNegativeKeywords: string[]
    prefilterNegativeCompanies: string[]
    geoId: string
    distance: number
    dropPrefiltered: boolean
}

function QueryPreviewRow({
                             label,
                             value,
                         }: {
    label: string
    value: ReactNode
}) {
    return (
        <div className="grid gap-1 border-b border-slate-800/70 py-2 last:border-b-0 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-3">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                {label}
            </span>
            <div className="min-w-0 text-xs font-bold leading-5 text-slate-300">
                {value}
            </div>
        </div>
    )
}

function QueryPreviewChips({
                               values,
                               emptyLabel = "-",
                               tone = "slate",
                               onRemove,
                           }: {
    values: string[]
    emptyLabel?: string
    tone?: "slate" | "red" | "emerald"
    onRemove?: (value: string) => void
}) {
    const className = {
        slate: "border-slate-700 bg-slate-950 text-slate-300",
        red: "border-red-400/25 bg-red-500/10 text-red-200",
        emerald: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    }[tone]

    if (values.length === 0) {
        return <span className="text-slate-500">{emptyLabel}</span>
    }

    return (
        <div className="flex flex-wrap gap-1.5">
            {values.map((value) => (
                <span
                    key={value}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold ${className}`}
                >
                    {value}
                    {onRemove && (
                        <button
                            type="button"
                            onClick={() => onRemove(value)}
                            className="rounded p-0.5 opacity-70 transition hover:bg-slate-950/70 hover:opacity-100"
                            aria-label={`Remove ${value}`}
                        >
                            <X size={11}/>
                        </button>
                    )}
                </span>
            ))}
        </div>
    )
}

function FetchRequestPreviewPanel({
                                      preview,
                                      onRemoveExcludedKeyword,
                                  }: {
    preview: FetchRequestPreview
    onRemoveExcludedKeyword?: (value: string) => void
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/55 p-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-100">
                <Search size={14} className="text-sky-300"/>
                Request preview
            </div>

            <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3">
                <QueryPreviewRow
                    label="LinkedIn query"
                    value={
                        <code className="break-words rounded bg-slate-900 px-1.5 py-0.5 text-[11px] text-sky-200">
                            {preview.effectiveLinkedinQuery}
                        </code>
                    }
                />

                <QueryPreviewRow
                    label="keywords"
                    value={
                        <code className="break-words rounded bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-200">
                            {preview.linkedinKeywords}
                        </code>
                    }
                />

                <QueryPreviewRow
                    label="excluded"
                    value={
                        <QueryPreviewChips
                            values={preview.linkedinExcludedKeywords}
                            tone="red"
                            onRemove={onRemoveExcludedKeyword}
                        />
                    }
                />

                <QueryPreviewRow
                    label="prefilter must"
                    value={
                        <QueryPreviewChips
                            values={preview.prefilterMustHaveKeywords}
                            tone="emerald"
                        />
                    }
                />

                <QueryPreviewRow
                    label="prefilter no"
                    value={
                        <QueryPreviewChips
                            values={preview.prefilterNegativeKeywords}
                            tone="red"
                            onRemove={onRemoveExcludedKeyword}
                        />
                    }
                />

                <QueryPreviewRow
                    label="companies"
                    value={
                        <QueryPreviewChips
                            values={preview.prefilterNegativeCompanies}
                        />
                    }
                />

                <QueryPreviewRow
                    label="scope"
                    value={`geo ${preview.geoId} · ${preview.distance} mi · ${
                        preview.dropPrefiltered ? "drop rejected before enrichment" : "keep rejected"
                    }`}
                />
            </div>
        </div>
    )
}

const uniqueTextValues = (values: string[]) =>
    [...new Set(values.map((value) => value.trim()).filter(Boolean))]

function addExcludedKeyword(
    newKeyword: string,
    setNewKeyword: (value: string) => void,
    setKeywords: Dispatch<SetStateAction<string[]>>,
) {
    const trimmed = newKeyword.trim()
    if (!trimmed) return

    setKeywords((current) => uniqueTextValues([...current, trimmed]))
    setNewKeyword("")
}


export function FetchJobsModal({
                                   fetchCount,
                                   setFetchCount,
                                   fetchQuery,
                                   setFetchQuery,
                                   fetchExcludedKeywords,
                                   setFetchExcludedKeywords,
                                   newFetchExcludedKeyword,
                                   setNewFetchExcludedKeyword,
                                   loading,
                                   progress,
                                   requestPreview,
                                   meta,
                                   onClose,
                                   onSubmit,
                               }: {
    fetchCount: number
    setFetchCount: (value: number) => void
    fetchQuery: string
    setFetchQuery: (value: string) => void
    fetchExcludedKeywords: string[]
    setFetchExcludedKeywords: Dispatch<SetStateAction<string[]>>
    newFetchExcludedKeyword: string
    setNewFetchExcludedKeyword: (value: string) => void
    loading: boolean
    progress: SearchJobsProgress | null
    requestPreview: FetchRequestPreview
    meta: SearchJobsMeta | null
    onClose: () => void
    onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
    const removeExcludedKeyword = (keyword: string) => {
        setFetchExcludedKeywords((current) =>
            current.filter((item) => item !== keyword),
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <form
                onSubmit={onSubmit}
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-sky-400">
                            Backend fetch
                        </p>

                        <h2 className="mt-1 text-xl font-black text-slate-50">
                            Load LinkedIn jobs
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-slate-400">
                            Streams LinkedIn jobs from the backend, scores them, and saves them in local cache.
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
                            Search query
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
                                placeholder="Defaults to your must-have keywords"
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500"
                            />
                        </div>
                    </label>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/55 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-slate-300">
                                LinkedIn NOT terms
                            </span>

                            <span className="text-[11px] font-bold text-slate-500">
                                {fetchExcludedKeywords.length} active
                            </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {fetchExcludedKeywords.length > 0 ? (
                                fetchExcludedKeywords.map((keyword) => (
                                    <span
                                        key={keyword}
                                        className="inline-flex items-center gap-1.5 rounded-md border border-red-400/25 bg-red-500/10 px-2 py-1 text-[11px] font-bold text-red-200"
                                    >
                                        NOT {keyword}
                                        <button
                                            type="button"
                                            onClick={() => removeExcludedKeyword(keyword)}
                                            disabled={loading}
                                            className="rounded p-0.5 opacity-70 transition hover:bg-slate-950/70 hover:opacity-100 disabled:opacity-40"
                                            aria-label={`Remove NOT ${keyword}`}
                                        >
                                            <X size={11}/>
                                        </button>
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs font-bold text-slate-500">
                                    No NOT terms will be sent to LinkedIn.
                                </span>
                            )}
                        </div>

                        <div className="mt-3 flex gap-2">
                            <input
                                type="text"
                                value={newFetchExcludedKeyword}
                                onChange={(event) => setNewFetchExcludedKeyword(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key !== "Enter") return
                                    event.preventDefault()
                                    addExcludedKeyword(
                                        newFetchExcludedKeyword,
                                        setNewFetchExcludedKeyword,
                                        setFetchExcludedKeywords,
                                    )
                                }}
                                disabled={loading}
                                placeholder="Add another NOT term"
                                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-500 disabled:opacity-50"
                            />

                            <button
                                type="button"
                                onClick={() =>
                                    addExcludedKeyword(
                                        newFetchExcludedKeyword,
                                        setNewFetchExcludedKeyword,
                                        setFetchExcludedKeywords,
                                    )
                                }
                                disabled={loading || !newFetchExcludedKeyword.trim()}
                                className="rounded-lg border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-xs font-black text-sky-200 transition hover:bg-sky-500 hover:text-slate-950 disabled:opacity-40"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    <div>
                        <span className="text-xs font-bold text-slate-300">
                            Amount of jobs
                        </span>

                        <div className="mx-auto mt-3 flex w-fit items-center gap-5 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                            <button
                                type="button"
                                onClick={() => setFetchCount(Math.max(1, fetchCount - 5))}
                                disabled={loading || fetchCount <= 1}
                                className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-lg font-black text-slate-400 transition hover:bg-slate-700 hover:text-white disabled:opacity-40"
                                aria-label="Decrease jobs amount"
                            >
                                -
                            </button>

                            <div className="min-w-16 text-center">
                                <p className="text-3xl font-black leading-none text-sky-400">
                                    {fetchCount}
                                </p>

                                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                    jobs
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setFetchCount(Math.min(100, fetchCount + 5))}
                                disabled={loading || fetchCount >= 100}
                                className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700 text-lg font-black text-slate-100 transition hover:bg-sky-500 hover:text-slate-950 disabled:opacity-40"
                                aria-label="Increase jobs amount"
                            >
                                +
                            </button>
                        </div>

                        <div className="mt-3 flex justify-center gap-2">
                            {[10, 25, 50, 100].map((amount) => (
                                <button
                                    key={amount}
                                    type="button"
                                    onClick={() => setFetchCount(amount)}
                                    disabled={loading}
                                    className={`rounded-lg border px-3 py-1 text-xs font-bold transition ${
                                        fetchCount === amount
                                            ? "border-sky-400 bg-sky-500/15 text-sky-300"
                                            : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-sky-500/50 hover:text-slate-200"
                                    }`}
                                >
                                    {amount}
                                </button>
                            ))}
                        </div>
                    </div>

                    <FetchRequestPreviewPanel
                        preview={requestPreview}
                        onRemoveExcludedKeyword={loading ? undefined : removeExcludedKeyword}
                    />

                    {loading && (
                        <LiveProgressBar progress={progress}/>
                    )}

                    {meta?.prefilter && (
                        <div className="overflow-hidden rounded-xl border border-slate-800">
                            <PrefilterAuditPanel meta={meta}/>
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
                        className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-2 text-sm font-black text-slate-950 shadow-lg shadow-sky-950/30 transition hover:bg-sky-400 disabled:opacity-50"
                    >
                        <Database size={16}/>
                        Start Fetching
                    </button>
                </div>
            </form>
        </div>
    )
}
