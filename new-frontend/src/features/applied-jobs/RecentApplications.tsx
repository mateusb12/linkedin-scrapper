import {useEffect, useMemo, useState} from "react"
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
    Send,
    Users,
    XCircle,
} from "lucide-react"

import {
    type AppliedJob,
    type ApplicationStatus,
    fetchAppliedJobs,
    formatDateBR,
    formatTimeAgo,
    formatTimeBR,
    syncAppliedSmart,
} from "./appliedJobsMockService.ts"

const TECH_KEYWORDS: Array<{ label: string; regex: RegExp }> = [
    {label: "Python", regex: /\bpython\b/i},
    {label: "FastAPI", regex: /\bfastapi\b/i},
    {label: "Django", regex: /\bdjango\b/i},
    {label: "React Native", regex: /\breact native\b/i},
    {label: "React", regex: /\breact\b/i},
    {label: "TypeScript", regex: /\btypescript\b/i},
    {label: "JavaScript", regex: /\bjavascript\b/i},
    {label: "Node.js", regex: /\bnode\.?js\b/i},
    {label: "PostgreSQL", regex: /\bpostgresql\b/i},
    {label: "MongoDB", regex: /\bmongodb\b/i},
    {label: "SQL", regex: /\bsql\b/i},
    {label: "Docker", regex: /\bdocker\b/i},
    {label: "REST APIs", regex: /\brest api|\brest apis\b/i},
]

const TECH_BADGE_CLASS: Record<string, string> = {
    Python: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    FastAPI: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    Django: "border-green-500/30 bg-green-500/10 text-green-300",
    React: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    "React Native": "border-sky-500/30 bg-sky-500/10 text-sky-300",
    TypeScript: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    JavaScript: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    "Node.js": "border-lime-500/30 bg-lime-500/10 text-lime-300",
    PostgreSQL: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
    MongoDB: "border-emerald-600/30 bg-emerald-600/10 text-emerald-200",
    SQL: "border-slate-500/30 bg-slate-500/10 text-slate-300",
    Docker: "border-blue-600/30 bg-blue-600/10 text-blue-200",
    "REST APIs": "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
}

function extractTechStack(description: string) {
    return TECH_KEYWORDS
        .filter(tech => tech.regex.test(description))
        .map(tech => tech.label)
}

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
        return (
            <span className="text-sm font-semibold text-gray-500">
                —
            </span>
        )
    }

    return (
        <div className="flex max-w-[260px] flex-wrap gap-1.5">
            {visibleStack.map(tech => (
                <span
                    key={tech}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-extrabold ${
                        TECH_BADGE_CLASS[tech] ??
                        "border-gray-600 bg-gray-900/70 text-gray-200"
                    }`}
                >
                    {tech}
                </span>
            ))}

            {hiddenCount > 0 && (
                <span
                    className="rounded-md border border-gray-600 bg-gray-700 px-2 py-0.5 text-[11px] font-extrabold text-gray-300">
                    +{hiddenCount}
                </span>
            )}
        </div>
    )
}

type ApplicationMobileCardProps = {
    job: AppliedJob
}

function ApplicationMobileCard({job}: ApplicationMobileCardProps) {
    const stack = extractTechStack(job.description)
    const level = extractLevel(job)

    return (
        <article className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 shadow-lg">
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

                {job.lastEmail && (
                    <div className="rounded-lg border border-gray-700 bg-gray-950/60 p-3">
                        <p className="flex items-start gap-1.5 text-[11px] font-bold text-gray-300">
                            <Mail size={13} className="mt-0.5 shrink-0"/>
                            <span className="break-words whitespace-normal">
                                {job.lastEmail.subject}
                            </span>
                        </p>

                        <p className="mt-1 text-[10px] text-gray-500">
                            Received {formatTimeAgo(job.lastEmail.receivedAt)}
                        </p>
                    </div>
                )}
            </div>
        </article>
    )
}

export default function RecentApplications() {
    const [jobs, setJobs] = useState<AppliedJob[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSyncing, setIsSyncing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const totalApplicants = useMemo(
        () => jobs.reduce((sum, job) => sum + job.applicants, 0),
        [jobs],
    )

    async function loadJobs() {
        try {
            setError(null)
            setIsLoading(true)

            const result = await fetchAppliedJobs()
            setJobs(result.jobs)
        } catch (loadError) {
            console.error(loadError)
            setError("Could not load applied jobs.")
        } finally {
            setIsLoading(false)
        }
    }

    async function handleSmartSync() {
        try {
            setError(null)
            setIsSyncing(true)

            await syncAppliedSmart()
            await loadJobs()
        } catch (syncError) {
            console.error(syncError)
            setError("Could not sync applied jobs.")
        } finally {
            setIsSyncing(false)
        }
    }

    useEffect(() => {
        void loadJobs()
    }, [])

    return (
        <section className="mt-6 rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-xl">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-2xl font-bold text-white">
                        <Briefcase className="text-blue-400" size={22}/>
                        Recent Applications
                    </h3>

                    <p className="mt-2 text-sm font-medium text-gray-400">
                        {jobs.length} mocked applications · {formatNumber(totalApplicants)} total competitors
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => void loadJobs()}
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
                        Loading mocked applications...
                    </div>
                </div>
            ) : (
                <>
                    <div className="space-y-4 lg:hidden">
                        {jobs.map(job => (
                            <ApplicationMobileCard key={job.urn} job={job}/>
                        ))}
                    </div>

                    <div className="hidden lg:block">
                        <table className="w-full table-fixed border-separate border-spacing-0">
                            <thead>
                            <tr className="text-left">
                                <th className="w-[32%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                    Job Identity
                                </th>
                                <th className="w-[25%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                    Tech Stack
                                </th>
                                <th className="w-[8%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                    Level
                                </th>
                                <th className="w-[10%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                    Applied Date
                                </th>
                                <th className="w-[9%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                    Time
                                </th>
                                <th className="w-[9%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                    Competitors
                                </th>
                                <th className="w-[8%] border-b border-gray-700 px-4 py-4 text-xs font-black uppercase tracking-wider text-gray-500">
                                    Status
                                </th>
                            </tr>
                            </thead>

                            <tbody>
                            {jobs.map(job => {
                                const stack = extractTechStack(job.description)
                                const level = extractLevel(job)

                                return (
                                    <tr
                                        key={job.urn}
                                        className="align-top transition hover:bg-gray-700/20"
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

                                            <p className="mt-2 text-xs font-medium text-gray-500">
                                                +{job.applicantsVelocity}/day velocity
                                            </p>
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

                                                {job.lastEmail && (
                                                    <div
                                                        className="mt-3 rounded-lg border border-gray-700 bg-gray-950/50 p-2.5">
                                                        <p className="flex items-start gap-1.5 text-xs font-bold leading-5 text-gray-300">
                                                            <Mail
                                                                size={13}
                                                                className="mt-0.5 shrink-0"
                                                            />
                                                            <span className="break-words whitespace-normal">
                                                                {job.lastEmail.subject}
                                                            </span>
                                                        </p>

                                                        <p className="mt-1 text-[10px] text-gray-500">
                                                            {formatTimeAgo(job.lastEmail.receivedAt)}
                                                        </p>
                                                    </div>
                                                )}
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
        </section>
    )
}