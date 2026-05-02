import {useEffect, useMemo, useRef, useState, type MouseEvent} from "react"
import {
    AlertTriangle,
    Briefcase,
    CalendarDays,
    CheckCheck,
    CheckCircle2,
    CircleDot,
    Clock,
    Code2,
    Loader2,
    Mail,
    MapPin,
    RefreshCw,
    Search,
    Send,
    ShieldAlert,
    TrendingUp,
    Users,
    X,
    XCircle,
} from "lucide-react"

import {
    type AppliedJob,
    type ApplicationStatus,
    type FullSyncReport,
    type FullSyncReportRow,
    formatDateBR,
    formatTimeAgo,
    formatTimeBR,
    parseBackendDate,
    syncAppliedFullSelectedStream,
    syncAppliedSmartStream,
} from "./appliedJobsService.ts"
import AppliedJobDetailModal from "./AppliedJobDetailModal.tsx"
import {
    formatTechLabel,
    getRuntimeJobKeywords,
    getTechIcon,
    splitStackAndRoleSignals,
} from "../job-analysis/jobUtils.ts"

function extractLevel(job: AppliedJob): string | null {
    const text = `${job.title} ${job.description}`.toLowerCase()

    if (/(senior|sênior|5\+|5 anos|5 or more)/i.test(text)) {
        return "Senior"
    }

    if (/(pleno|mid-level|mid level|4 anos|4 or more)/i.test(text)) {
        return "Pleno"
    }

    if (/(junior|júnior|entry-level|entry level)/i.test(text)) {
        return "Junior"
    }

    return null
}

function getLevelClass(level: string) {
    if (level === "Senior") {
        return "border-purple-500/30 bg-purple-500/10 text-purple-300"
    }

    if (level === "Pleno") {
        return "border-blue-500/30 bg-blue-500/10 text-blue-300"
    }

    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
}

function getStatusClass(status: ApplicationStatus) {
    const statusClassMap: Record<ApplicationStatus, string> = {
        Waiting: "border-amber-500/30 bg-amber-500/10 text-amber-300",
        Applied: "border-blue-500/30 bg-blue-500/10 text-blue-300",
        Accepted: "border-green-500/30 bg-green-500/10 text-green-300",
        Refused: "border-red-500/30 bg-red-500/10 text-red-300",
    }

    return statusClassMap[status]
}

function getStatusIcon(status: ApplicationStatus) {
    if (status === "Accepted") return <CheckCircle2 size={15}/>
    if (status === "Refused") return <XCircle size={15}/>
    if (status === "Applied") return <Send size={15}/>

    return <Clock size={15}/>
}

function getCompetitionClass(applicants: number, applicantsVelocity: number) {
    if (applicants >= 800 || applicantsVelocity >= 30) {
        return "border-red-500/30 bg-red-500/10 text-red-300"
    }

    if (applicants >= 250 || applicantsVelocity >= 10) {
        return "border-amber-500/30 bg-amber-500/10 text-amber-300"
    }

    return "border-green-500/30 bg-green-500/10 text-green-300"
}

function getLastUpdateValue(job: AppliedJob) {
    return job.updatedAt ?? job.createdAt ?? job.appliedAt
}

function getDaysSince(value: string | undefined) {
    const date = parseBackendDate(value)
    if (!date) return null

    return Math.max(Math.floor((Date.now() - date.getTime()) / 86_400_000), 0)
}

function getStalenessClass(days: number | null) {
    if (days === null) return "border-gray-600 bg-gray-700/40 text-gray-300"

    if (days >= 7) {
        return "border-red-500/40 bg-red-500/10 text-red-300"
    }

    if (days >= 2) {
        return "border-amber-500/40 bg-amber-500/10 text-amber-300"
    }

    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
}

function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(value)
}

function clampProgress(value: number) {
    return Math.min(Math.max(Math.round(value), 0), 100)
}

function getNumericJobId(job: AppliedJob) {
    return job.urn.match(/\d{6,}/)?.[0] ?? job.id ?? job.urn
}

function sortJobsByLastUpdateAsc(jobs: AppliedJob[]) {
    return [...jobs].sort((a, b) => {
        const first = new Date(getLastUpdateValue(a) ?? "").getTime()
        const second = new Date(getLastUpdateValue(b) ?? "").getTime()

        if (Number.isNaN(first) && Number.isNaN(second)) return 0
        if (Number.isNaN(first)) return -1
        if (Number.isNaN(second)) return 1

        return first - second
    })
}

function formatReportValue(value: unknown) {
    if (value === null || value === undefined || value === "") return "empty"
    if (typeof value === "boolean") return value ? "yes" : "no"
    return String(value)
}

function getApplicantDiffLabel(row: FullSyncReportRow) {
    const applicantChange = row.changes?.applicants ?? row.unchanged?.applicants

    if (!applicantChange) return "applicants unknown"

    return `${formatReportValue(applicantChange.from)} -> ${formatReportValue(applicantChange.to)} applicants`
}

function getOtherChangeLabels(row: FullSyncReportRow) {
    return Object.entries(row.changes ?? {})
        .filter(([key]) => key !== "applicants")
        .map(([key, change]) => `${key}: ${formatReportValue(change.from)} -> ${formatReportValue(change.to)}`)
}

type TechStackBadgesProps = {
    stack: string[]
}

function TechStackBadges({stack}: TechStackBadgesProps) {
    const visibleStack = stack.slice(0, 6)
    const hiddenCount = Math.max(stack.length - visibleStack.length, 0)

    if (stack.length === 0) {
        return <span className="text-sm font-semibold text-gray-500">—</span>
    }

    return (
        <div className="grid max-w-[220px] grid-cols-2 gap-1.5">
            {visibleStack.map(tech => (
                <AppliedTechBadge key={tech} tech={tech}/>
            ))}

            {hiddenCount > 0 && (
                <span
                    className="inline-flex w-fit rounded-md border border-gray-600 bg-gray-700 px-2 py-0.5 text-[11px] font-extrabold text-gray-300">
                    +{hiddenCount}
                </span>
            )}
        </div>
    )
}

function getSubjectPreview(subject: string) {
    const maxLength = 22

    if (subject.length <= maxLength) return subject

    return `${subject.slice(0, maxLength).trim()}…`
}

type EmailPreviewProps = {
    email: NonNullable<AppliedJob["lastEmail"]>
}

function EmailPreview({email}: EmailPreviewProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    function handleClick(event: MouseEvent<HTMLButtonElement>) {
        event.stopPropagation()
        setIsExpanded(current => !current)
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            className="mt-3 block max-w-full rounded-lg border border-gray-700 bg-gray-950/50 p-2.5 text-left transition hover:border-gray-500 hover:bg-gray-950/80"
        >
            <p className="flex items-start gap-1.5 text-xs font-bold leading-5 text-gray-300">
                <Mail size={13} className="mt-0.5 shrink-0"/>

                <span
                    className={
                        isExpanded
                            ? "break-words whitespace-normal"
                            : "inline-block max-w-[110px] truncate align-bottom"
                    }
                >
                    {isExpanded ? email.subject : getSubjectPreview(email.subject)}
                </span>
            </p>

            <p className="mt-1 text-[10px] text-gray-500">
                {isExpanded ? "click to collapse" : formatTimeAgo(email.receivedAt)}
            </p>
        </button>
    )
}

type ApplicationMobileCardProps = {
    job: AppliedJob
    onSelect: (job: AppliedJob) => void
}

function AppliedTechBadge({tech}: { tech: string }) {
    const label = formatTechLabel(tech)
    const icon = getTechIcon(label)

    return (
        <span
            title={label}
            aria-label={label}
            className="inline-flex min-w-[84px] items-center justify-center gap-2 rounded-md border border-gray-700 bg-gray-900/70 px-2.5 py-1 text-xs font-extrabold text-gray-200"
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

function getAppliedJobStack(job: AppliedJob) {
    const runtimeKeywords = getRuntimeJobKeywords({
        title: job.title,
        description: job.description,
    })

    return splitStackAndRoleSignals(runtimeKeywords).stackKeywords
}

function ApplicationMobileCard({job, onSelect}: ApplicationMobileCardProps) {
    const stack = getAppliedJobStack(job)
    const level = extractLevel(job)
    const lastUpdate = getLastUpdateValue(job)
    const daysSinceUpdate = getDaysSince(lastUpdate)

    return (
        <article
            onClick={() => onSelect(job)}
            className="cursor-pointer rounded-xl border border-gray-700 bg-gray-900/60 p-4 shadow-lg transition hover:border-gray-600 hover:bg-gray-900/80"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h4 className="truncate text-base font-extrabold text-white">
                        {job.title}
                    </h4>

                    <p className="mt-1 text-sm font-bold text-gray-300">
                        {job.company}
                    </p>
                </div>

                <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${getStatusClass(
                        job.applicationStatus,
                    )}`}
                >
                    {getStatusIcon(job.applicationStatus)}
                    {job.applicationStatus}
                </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
                <span className="inline-flex items-center gap-1">
                    <MapPin size={13}/>
                    {job.location}
                </span>

                {job.workRemoteAllowed && (
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-bold text-blue-300">
                        Remote
                    </span>
                )}
            </div>

            <div className="mt-4 space-y-3">
                <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                        Tech Stack
                    </p>
                    <TechStackBadges stack={stack}/>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                            Level
                        </p>

                        {level ? (
                            <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${getLevelClass(
                                    level,
                                )}`}
                            >
                                {level}
                            </span>
                        ) : (
                            <span className="text-sm text-gray-500">—</span>
                        )}
                    </div>

                    <div>
                        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                            Applied
                        </p>
                        <p className="text-sm font-extrabold text-gray-200">
                            {formatDateBR(job.appliedAt)}
                        </p>
                        <p className="text-xs text-gray-500">
                            {formatTimeBR(job.appliedAt)} · {formatTimeAgo(job.appliedAt)}
                        </p>
                    </div>
                </div>

                <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                        Competitors
                    </p>
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold ${getCompetitionClass(
                            job.applicants,
                            job.applicantsVelocity,
                        )}`}
                    >
                        <Users size={14}/>
                        {formatNumber(job.applicants)} applicants
                        <span className="text-[10px] opacity-80">
                            +{job.applicantsVelocity}/day
                        </span>
                    </span>
                </div>

                <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                        Last Update
                    </p>
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold ${getStalenessClass(
                            daysSinceUpdate,
                        )}`}
                    >
                        <Clock size={14}/>
                        {lastUpdate ? formatTimeAgo(lastUpdate) : "unknown"}
                    </span>
                </div>

                {job.lastEmail && <EmailPreview email={job.lastEmail}/>}
            </div>
        </article>
    )
}

type RecentApplicationsProps = {
    jobs: AppliedJob[]
    isLoading: boolean
    error: string | null
    onRefresh: () => Promise<void>
    onError: (message: string | null) => void
}

type FullSyncModalProps = {
    jobs: AppliedJob[]
    selectedJobIds: Set<string>
    isSyncing: boolean
    onClose: () => void
    onToggleJob: (job: AppliedJob) => void
    onSelectAll: () => void
    onClear: () => void
    onSubmit: () => void
    progress: number
    message: string
    report: FullSyncReport | null
}

type FullSyncReportSectionProps = {
    title: string
    rows: FullSyncReportRow[]
    tone: "updated" | "unchanged" | "failed" | "skipped"
}

function FullSyncReportSection({title, rows, tone}: FullSyncReportSectionProps) {
    if (rows.length === 0) return null

    const toneConfigMap = {
        updated: {
            Icon: CheckCheck,
            panelClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
            headerClass: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
            itemClass: "border-emerald-400/15 bg-gray-950/35",
            dotClass: "bg-emerald-300",
        },
        unchanged: {
            Icon: CircleDot,
            panelClass: "border-sky-500/30 bg-sky-500/10 text-sky-100",
            headerClass: "border-sky-400/30 bg-sky-400/10 text-sky-200",
            itemClass: "border-sky-400/15 bg-gray-950/35",
            dotClass: "bg-sky-300",
        },
        failed: {
            Icon: ShieldAlert,
            panelClass: "border-red-500/30 bg-red-500/10 text-red-100",
            headerClass: "border-red-400/30 bg-red-400/10 text-red-200",
            itemClass: "border-red-400/15 bg-gray-950/35",
            dotClass: "bg-red-300",
        },
        skipped: {
            Icon: AlertTriangle,
            panelClass: "border-amber-500/30 bg-amber-500/10 text-amber-100",
            headerClass: "border-amber-400/30 bg-amber-400/10 text-amber-200",
            itemClass: "border-amber-400/15 bg-gray-950/35",
            dotClass: "bg-amber-300",
        },
    }

    const config = toneConfigMap[tone]
    const Icon = config.Icon

    return (
        <div className={`rounded-xl border p-3 shadow-lg ${config.panelClass}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${config.headerClass}`}>
                        <Icon size={16}/>
                    </span>

                    <div className="min-w-0">
                        <p className="truncate text-xs font-black uppercase tracking-wider">
                            {title}
                        </p>
                        <p className="text-[11px] font-bold opacity-70">
                            {rows.length} {rows.length === 1 ? "job" : "jobs"}
                        </p>
                    </div>
                </div>

                <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-black tabular-nums ${config.headerClass}`}>
                    {rows.length}
                </span>
            </div>

            <div className="max-h-44 space-y-2 overflow-auto pr-1">
                {rows.map(row => {
                    const otherChangeLabels = getOtherChangeLabels(row).slice(0, 3)
                    const isProblem = tone === "failed" || tone === "skipped"

                    return (
                        <div
                            key={`${row.job_id}-${row.title}`}
                            className={`rounded-lg border p-2.5 ${config.itemClass}`}
                        >
                            <div className="flex items-start gap-2.5">
                                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${config.dotClass}`}/>

                                <div className="min-w-0 flex-1">
                                    <p className="line-clamp-1 text-xs font-extrabold text-white">
                                        {row.company ?? "Unknown"} · {row.title ?? row.job_id}
                                    </p>

                                    {isProblem ? (
                                        <p className="mt-1.5 text-[11px] font-semibold leading-5 opacity-85">
                                            {row.error ?? row.reason ?? "No details"}
                                        </p>
                                    ) : (
                                        <>
                                            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-gray-950/45 px-2 py-0.5 text-[11px] font-extrabold opacity-95">
                                                <TrendingUp size={12}/>
                                                {getApplicantDiffLabel(row)}
                                            </p>

                                            {otherChangeLabels.map(label => (
                                                <p key={label} className="mt-1 text-[11px] font-semibold opacity-70">
                                                    {label}
                                                </p>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function FullSyncModal({
                           jobs,
                           selectedJobIds,
                           isSyncing,
                           onClose,
                           onToggleJob,
                           onSelectAll,
                           onClear,
                           onSubmit,
                           progress,
                           message,
                           report,
                       }: FullSyncModalProps) {
    const sortedJobs = useMemo(() => sortJobsByLastUpdateAsc(jobs), [jobs])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 p-4">
            <div
                className="flex max-h-[86vh] w-full max-w-5xl flex-col rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-gray-700 px-5 py-4">
                    <div>
                        <h3 className="text-xl font-black text-white">Full Sync</h3>
                        <p className="mt-1 text-sm font-semibold text-gray-400">
                            {selectedJobIds.size} selected · oldest updates first
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSyncing}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-700 text-gray-300 transition hover:border-gray-500 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Close full sync modal"
                    >
                        <X size={18}/>
                    </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-5 py-3">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onSelectAll}
                            disabled={isSyncing}
                            className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-extrabold text-gray-200 transition hover:border-gray-500 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Select all
                        </button>
                        <button
                            type="button"
                            onClick={onClear}
                            disabled={isSyncing || selectedJobIds.size === 0}
                            className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-extrabold text-gray-200 transition hover:border-gray-500 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Clear
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={isSyncing || selectedJobIds.size === 0}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-extrabold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSyncing ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
                        Update selected
                    </button>
                </div>

                {(isSyncing || report) && (
                    <div className="border-b border-gray-800 px-5 py-3">
                        {isSyncing && (
                            <>
                                <div
                                    className="mb-2 flex items-center justify-between gap-3 text-xs font-extrabold text-emerald-200">
                                    <span className="truncate">{message || "Refreshing selected jobs"}</span>
                                    <span className="tabular-nums">{progress}%</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-gray-950/70">
                                    <div
                                        className="h-full rounded-full bg-emerald-400 transition-[width] duration-500"
                                        style={{width: `${progress}%`}}
                                    />
                                </div>
                            </>
                        )}

                        {report && (
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <FullSyncReportSection title="Updated" rows={report.updated} tone="updated"/>
                                <FullSyncReportSection title="Not updated" rows={report.unchanged} tone="unchanged"/>
                                <FullSyncReportSection title="Failed" rows={report.failed} tone="failed"/>
                                <FullSyncReportSection title="Skipped" rows={report.skipped} tone="skipped"/>
                            </div>
                        )}
                    </div>
                )}

                <div className="overflow-auto">
                    <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0">
                        <colgroup>
                            <col className="w-[7%]"/>
                            <col className="w-[35%]"/>
                            <col className="w-[18%]"/>
                            <col className="w-[18%]"/>
                            <col className="w-[22%]"/>
                        </colgroup>
                        <thead className="sticky top-0 bg-gray-900">
                        <tr className="text-left">
                            <th className="border-b border-gray-700 px-4 py-3 text-xs font-black uppercase text-gray-500">Pick</th>
                            <th className="border-b border-gray-700 px-4 py-3 text-xs font-black uppercase text-gray-500">Job</th>
                            <th className="border-b border-gray-700 px-4 py-3 text-xs font-black uppercase text-gray-500">Applicants</th>
                            <th className="border-b border-gray-700 px-4 py-3 text-xs font-black uppercase text-gray-500">Applied</th>
                            <th className="border-b border-gray-700 px-4 py-3 text-xs font-black uppercase text-gray-500">Last
                                Update
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {sortedJobs.map(job => {
                            const jobId = getNumericJobId(job)
                            const lastUpdate = getLastUpdateValue(job)
                            const daysSinceUpdate = getDaysSince(lastUpdate)
                            const isSelected = selectedJobIds.has(jobId)

                            return (
                                <tr
                                    key={job.urn}
                                    onClick={() => !isSyncing && onToggleJob(job)}
                                    className={`cursor-pointer align-top transition ${isSelected ? "bg-emerald-500/10" : "hover:bg-gray-800/70"}`}
                                >
                                    <td className="border-b border-gray-800 px-4 py-4">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={isSyncing}
                                            onChange={() => onToggleJob(job)}
                                            onClick={event => event.stopPropagation()}
                                            className="h-4 w-4 accent-emerald-500"
                                            aria-label={`Select ${job.title}`}
                                        />
                                    </td>
                                    <td className="border-b border-gray-800 px-4 py-4">
                                        <p className="line-clamp-2 text-sm font-extrabold text-white">{job.title}</p>
                                        <p className="mt-1 text-xs font-bold text-gray-400">{job.company}</p>
                                    </td>
                                    <td className="border-b border-gray-800 px-4 py-4">
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold ${getCompetitionClass(job.applicants, job.applicantsVelocity)}`}>
                                            <Users size={14}/>
                                            {formatNumber(job.applicants)}
                                        </span>
                                    </td>
                                    <td className="border-b border-gray-800 px-4 py-4">
                                        <p className="text-sm font-extrabold text-gray-100">{formatDateBR(job.appliedAt)}</p>
                                        <p className="mt-1 text-xs text-gray-500">{formatTimeAgo(job.appliedAt)}</p>
                                    </td>
                                    <td className="border-b border-gray-800 px-4 py-4">
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold ${getStalenessClass(daysSinceUpdate)}`}>
                                            <Clock size={14}/>
                                            {lastUpdate ? formatTimeAgo(lastUpdate) : "unknown"}
                                        </span>
                                        {lastUpdate && (
                                            <p className="mt-1 text-xs text-gray-500">
                                                {formatDateBR(lastUpdate)} {formatTimeBR(lastUpdate)}
                                            </p>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default function RecentApplications({
                                               jobs,
                                               isLoading,
                                               error,
                                               onRefresh,
                                               onError,
                                           }: RecentApplicationsProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedJob, setSelectedJob] = useState<AppliedJob | null>(null)
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncProgress, setSyncProgress] = useState(0)
    const [syncMessage, setSyncMessage] = useState("")
    const [isFullSyncOpen, setIsFullSyncOpen] = useState(false)
    const [selectedFullSyncJobIds, setSelectedFullSyncJobIds] = useState<Set<string>>(new Set())
    const [isFullSyncing, setIsFullSyncing] = useState(false)
    const [fullSyncProgress, setFullSyncProgress] = useState(0)
    const [fullSyncMessage, setFullSyncMessage] = useState("")
    const [fullSyncReport, setFullSyncReport] = useState<FullSyncReport | null>(null)
    const closeSyncStreamRef = useRef<(() => void) | null>(null)
    const closeFullSyncStreamRef = useRef<(() => void) | null>(null)

    useEffect(() => {
        return () => {
            closeSyncStreamRef.current?.()
            closeFullSyncStreamRef.current?.()
        }
    }, [])

    const totalApplicants = useMemo(
        () => jobs.reduce((sum, job) => sum + job.applicants, 0),
        [jobs],
    )

    const filteredJobs = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()

        if (!term) return jobs

        return jobs.filter(job =>
            [
                job.title,
                job.company,
                job.location,
                job.description,
                job.applicationStatus,
            ].some(value => value.toLowerCase().includes(term)),
        )
    }, [jobs, searchTerm])

    const hasActiveSearch = searchTerm.trim().length > 0

    function handleSmartSync() {
        onError(null)
        setIsSyncing(true)
        setSyncProgress(3)
        setSyncMessage("Looking for new applied jobs")
        closeSyncStreamRef.current?.()

        closeSyncStreamRef.current = syncAppliedSmartStream({
            onProgress: data => {
                setSyncProgress(clampProgress(data.progress ?? 10))
                setSyncMessage(data.message ?? "Appending new applied jobs")
            },
            onFinish: data => {
                const syncedCount = data.syncedCount ?? data.synced_count ?? 0

                console.info(`Smart sync inserted ${syncedCount} applied jobs.`)
                setSyncProgress(100)
                setSyncMessage(data.message ?? "Smart sync finished")
                closeSyncStreamRef.current = null
                void onRefresh().finally(() => {
                    setIsSyncing(false)
                })
            },
            onError: syncError => {
                console.error(syncError)
                closeSyncStreamRef.current = null
                setIsSyncing(false)
                setSyncProgress(0)
                setSyncMessage("")
                onError("Could not sync applied jobs.")
            },
        })
    }

    function toggleFullSyncJob(job: AppliedJob) {
        const jobId = getNumericJobId(job)

        setSelectedFullSyncJobIds(current => {
            const next = new Set(current)

            if (next.has(jobId)) {
                next.delete(jobId)
            } else {
                next.add(jobId)
            }

            return next
        })
    }

    function selectAllFullSyncJobs() {
        setSelectedFullSyncJobIds(new Set(jobs.map(getNumericJobId)))
    }

    function openFullSyncModal() {
        setFullSyncReport(null)
        setFullSyncProgress(0)
        setFullSyncMessage("")
        setIsFullSyncOpen(true)
    }

    function handleFullSyncSelected() {
        onError(null)
        setIsFullSyncing(true)
        setFullSyncProgress(2)
        setFullSyncMessage("Starting full sync")
        setFullSyncReport(null)
        closeFullSyncStreamRef.current?.()

        closeFullSyncStreamRef.current = syncAppliedFullSelectedStream({
            jobIds: [...selectedFullSyncJobIds],
            onProgress: data => {
                setFullSyncProgress(clampProgress(data.progress ?? 5))
                setFullSyncMessage(data.message ?? "Refreshing selected jobs")
            },
            onFinish: data => {
                console.info(`Full sync checked ${data.syncedCount} applied jobs.`)
                setFullSyncProgress(100)
                setFullSyncMessage(data.message ?? "Full sync finished")
                setFullSyncReport(data.report ?? null)
                closeFullSyncStreamRef.current = null
                void onRefresh().finally(() => {
                    setIsFullSyncing(false)
                })
            },
            onError: fullSyncError => {
                console.error(fullSyncError)
                closeFullSyncStreamRef.current = null
                setIsFullSyncing(false)
                setFullSyncProgress(0)
                setFullSyncMessage("")
                onError("Could not full sync selected applied jobs.")
            },
        })
    }

    return (
        <section className="mt-6 rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-xl">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-2xl font-bold text-white">
                        <Briefcase className="text-blue-400" size={22}/>
                        Recent Applications
                    </h3>

                    <p className="mt-2 text-sm font-medium text-gray-400">
                        {jobs.length} applications · {formatNumber(totalApplicants)} total competitors
                        {hasActiveSearch && (
                            <span
                                className="ml-2 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-extrabold text-blue-300">
                                {filteredJobs.length} matching
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => void onRefresh()}
                        disabled={isLoading || isSyncing}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-200 transition hover:border-gray-500 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""}/>
                        Refresh
                    </button>

                    <button
                        type="button"
                        onClick={() => void handleSmartSync()}
                        disabled={isLoading || isSyncing}
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSyncing ? (
                            <Loader2 size={16} className="animate-spin"/>
                        ) : (
                            <RefreshCw size={16}/>
                        )}
                        Smart Sync
                    </button>

                    <button
                        type="button"
                        onClick={openFullSyncModal}
                        disabled={isLoading || isSyncing || isFullSyncing}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isFullSyncing ? (
                            <Loader2 size={16} className="animate-spin"/>
                        ) : (
                            <RefreshCw size={16}/>
                        )}
                        Full Sync
                    </button>
                </div>
            </div>

            {isSyncing && (
                <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs font-extrabold text-blue-200">
                        <span className="truncate">{syncMessage || "Syncing applied jobs"}</span>
                        <span className="tabular-nums">{syncProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-950/70">
                        <div
                            className="h-full rounded-full bg-blue-400 transition-[width] duration-500"
                            style={{width: `${syncProgress}%`}}
                        />
                    </div>
                </div>
            )}

            <div className="mb-4">
                <label htmlFor="applications-search" className="sr-only">
                    Search applications
                </label>

                <div className="relative">
                    <Search
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                    />

                    <input
                        id="applications-search"
                        type="text"
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        placeholder="Search by title, company, location, status or stack..."
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/70 py-3 pl-11 pr-4 text-sm font-semibold text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-blue-500/60 focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
            </div>

            {error && (
                <div
                    className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div
                    className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/40">
                    <div className="flex items-center gap-3 text-sm font-bold text-gray-300">
                        <Loader2 className="animate-spin text-blue-400" size={20}/>
                        Loading applications...
                    </div>
                </div>
            ) : (
                <>
                    {filteredJobs.length === 0 ? (
                        <div
                            className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/40 px-6 text-center">
                            <div>
                                <p className="text-base font-extrabold text-gray-200">
                                    No applications found for this search.
                                </p>
                                <p className="mt-2 text-sm font-medium text-gray-500">
                                    Try another title, company, location, status or stack.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4 lg:hidden">
                                {filteredJobs.map(job => (
                                    <ApplicationMobileCard
                                        key={job.urn}
                                        job={job}
                                        onSelect={setSelectedJob}
                                    />
                                ))}
                            </div>

                            <div className="hidden lg:block">
                                <table className="w-full table-fixed border-separate border-spacing-0">
                                    <colgroup>
                                        <col className="w-[25%]"/>
                                        <col className="w-[25%]"/>
                                        <col className="w-[8%]"/>
                                        <col className="w-[10%]"/>
                                        <col className="w-[10%]"/>
                                        <col className="w-[9%]"/>
                                        <col className="w-[13%]"/>
                                    </colgroup>
                                    <thead>
                                    <tr className="text-left">
                                        <th className="w-[28%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                            Job Identity
                                        </th>

                                        <th className="w-[20%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                            Tech Stack
                                        </th>

                                        <th className="w-[8%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                            Level
                                        </th>

                                        <th className="w-[10%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                            Applied Date
                                        </th>

                                        <th className="w-[8%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                            Last Update
                                        </th>

                                        <th className="w-[12%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                            Competitors
                                        </th>

                                        <th className="w-[14%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                            Status
                                        </th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {filteredJobs.map(job => {
                                        const stack = getAppliedJobStack(job)
                                        const level = extractLevel(job)
                                        const lastUpdate = getLastUpdateValue(job)
                                        const daysSinceUpdate = getDaysSince(lastUpdate)

                                        return (
                                            <tr
                                                key={job.urn}
                                                onClick={() => setSelectedJob(job)}
                                                className="cursor-pointer align-top transition hover:bg-gray-700/20"
                                            >
                                                <td className="border-b border-gray-700/70 px-4 py-5">
                                                    <div className="pr-4">
                                                        <p className="line-clamp-2 text-base font-extrabold leading-6 text-white">
                                                            {job.title}
                                                        </p>

                                                        <p className="mt-1.5 text-sm font-bold text-gray-300">
                                                            {job.company}
                                                        </p>

                                                        <div
                                                            className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
                                                            <span className="inline-flex items-center gap-1">
                                                                <MapPin size={14}/>
                                                                {job.location}
                                                            </span>

                                                            {job.workRemoteAllowed && (
                                                                <span
                                                                    className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-300">
                                                                    Remote
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="border-b border-gray-700/70 px-4 py-5">
                                                    <div className="flex items-start gap-2">
                                                        <Code2
                                                            size={16}
                                                            className="mt-1 shrink-0 text-gray-500"
                                                        />
                                                        <TechStackBadges stack={stack}/>
                                                    </div>
                                                </td>

                                                <td className="border-b border-gray-700/70 px-4 py-5">
                                                    {level ? (
                                                        <span
                                                            className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-extrabold ${getLevelClass(
                                                                level,
                                                            )}`}
                                                        >
                                                            {level}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-gray-500"/>
                                                    )}
                                                </td>

                                                <td className="border-b border-gray-700/70 px-4 py-5">
                                                    <div className="flex items-start gap-2">
                                                        <CalendarDays
                                                            size={16}
                                                            className="mt-1 shrink-0 text-gray-500"
                                                        />

                                                        <div>
                                                            <p className="text-sm font-extrabold text-gray-100">
                                                                {formatDateBR(job.appliedAt)}
                                                            </p>
                                                            <p className="mt-1 text-xs font-semibold text-gray-400">
                                                                {formatTimeBR(job.appliedAt)}
                                                            </p>
                                                            <p className="mt-1 text-xs text-gray-500">
                                                                {formatTimeAgo(job.appliedAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="border-b border-gray-700/70 px-4 py-5">
                                                    <span
                                                        title={lastUpdate ? `Last update: ${formatDateBR(lastUpdate)} ${formatTimeBR(lastUpdate)}` : "Last update unknown"}
                                                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold ${getStalenessClass(
                                                            daysSinceUpdate,
                                                        )}`}
                                                    >
                                                        <Clock size={14}/>
                                                        {lastUpdate ? formatTimeAgo(lastUpdate) : "unknown"}
                                                    </span>
                                                    {lastUpdate && (
                                                        <p className="mt-1.5 text-xs font-semibold text-gray-500">
                                                            {formatTimeBR(lastUpdate)}
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="border-b border-gray-700/70 px-4 py-5">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-extrabold ${getCompetitionClass(
                                                            job.applicants,
                                                            job.applicantsVelocity,
                                                        )}`}
                                                    >
                                                        <Users size={15}/>
                                                        {formatNumber(job.applicants)}
                                                    </span>
                                                </td>

                                                <td className="border-b border-gray-700/70 px-4 py-5">
                                                    <div className="max-w-full">
                                                        <span
                                                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold ${getStatusClass(
                                                                job.applicationStatus,
                                                            )}`}
                                                        >
                                                            {getStatusIcon(job.applicationStatus)}
                                                            {job.applicationStatus}
                                                        </span>

                                                        {job.lastEmail && <EmailPreview email={job.lastEmail}/>}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </>
            )}

            <AppliedJobDetailModal
                job={selectedJob}
                onClose={() => setSelectedJob(null)}
            />

            {isFullSyncOpen && (
                <FullSyncModal
                    jobs={jobs}
                    selectedJobIds={selectedFullSyncJobIds}
                    isSyncing={isFullSyncing}
                    onClose={() => setIsFullSyncOpen(false)}
                    onToggleJob={toggleFullSyncJob}
                    onSelectAll={selectAllFullSyncJobs}
                    onClear={() => setSelectedFullSyncJobIds(new Set())}
                    onSubmit={() => void handleFullSyncSelected()}
                    progress={fullSyncProgress}
                    message={fullSyncMessage}
                    report={fullSyncReport}
                />
            )}
        </section>
    )
}
