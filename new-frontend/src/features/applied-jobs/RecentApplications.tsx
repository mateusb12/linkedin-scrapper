import {useMemo, useState, type MouseEvent} from "react"
import {
    Briefcase,
    CalendarDays,
    CheckCircle2,
    Clock,
    Code2,
    Loader2,
    Mail,
    MapPin,
    RefreshCw,
    Search,
    Send,
    Users,
    XCircle,
} from "lucide-react"

import {
    type AppliedJob,
    type ApplicationStatus,
    formatDateBR,
    formatTimeAgo,
    formatTimeBR,
    syncAppliedSmart,
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

function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(value)
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

function AppliedTechBadge({tech}: {tech: string}) {
    const label = formatTechLabel(tech)
    const icon = getTechIcon(label)

    return (
        <span
            title={label}
            aria-label={label}
            className="inline-flex min-w-[92px] items-center justify-center gap-2 rounded-md border border-gray-700 bg-gray-900/70 px-2.5 py-1 text-xs font-extrabold text-gray-200"
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

    async function handleSmartSync() {
        try {
            onError(null)
            setIsSyncing(true)

            const result = await syncAppliedSmart()
            const syncedCount = result.syncedCount ?? result.synced_count ?? 0

            console.info(`Smart sync inserted ${syncedCount} applied jobs.`)
            await onRefresh()
        } catch (syncError) {
            console.error(syncError)
            onError("Could not sync applied jobs.")
        } finally {
            setIsSyncing(false)
        }
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
                            <span className="ml-2 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-extrabold text-blue-300">
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
                </div>
            </div>

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
                            <col className="w-[26%]" />
                            <col className="w-[30%]" />
                            <col className="w-[8%]" />
                            <col className="w-[10%]" />
                            <col className="w-[8%]" />
                            <col className="w-[10%]" />
                            <col className="w-[8%]" />
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
                                            Time
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
                                                <span className="text-sm text-gray-500"></span>
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
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        {formatTimeAgo(job.appliedAt)}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="border-b border-gray-700/70 px-4 py-5">
                                            <p className="text-sm font-extrabold tabular-nums text-gray-100">
                                                {formatTimeBR(job.appliedAt)}
                                            </p>
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
        </section>
    )
}
