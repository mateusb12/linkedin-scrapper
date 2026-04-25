import {useEffect, useMemo, useState} from "react"
import {
    AlertTriangle,
    Ban,
    Briefcase,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    Clock,
    Code2,
    Cpu,
    Database,
    Globe,
    Layers,
    MapPin,
    RefreshCw,
    Search,
    Users,
    Zap,
} from "lucide-react"

import {
    calculateJobAge,
    fetchAppliedJobs,
    formatDateBR,
    formatTimeAgo,
    formatTimeBR,
    syncAppliedBackfillStream,
    syncAppliedSmart,
} from "./appliedJobsMockService"
import type {AppliedJob} from "./appliedJobsMockService"

const pillBase =
    "inline-flex items-center gap-1 px-3 py-1 rounded-md border text-sm font-mono leading-none w-fit"

type RecentApplicationsProps = {
    onSelectJob?: (job: AppliedJob) => void
}

type ExperienceRequirement = {
    min: number
}

function extractExperienceFromDescription(description: string) {
    const match = description.match(/(\d+)\+?\s*(?:anos|years|year)/i)

    if (!match) return null

    return {
        min: Number(match[1]),
    } satisfies ExperienceRequirement
}

function extractSeniorityFromDescription(description: string) {
    const normalized = description.toLowerCase()

    if (normalized.includes("senior") || normalized.includes("sênior")) {
        return "SÊNIOR"
    }

    if (normalized.includes("pleno") || normalized.includes("mid")) {
        return "PLENO"
    }

    if (normalized.includes("junior") || normalized.includes("júnior")) {
        return "JÚNIOR"
    }

    return null
}

function extractTechStack(description: string) {
    const techs = [
        "Python",
        "FastAPI",
        "Django",
        "React",
        "React Native",
        "JavaScript",
        "TypeScript",
        "Node.js",
        "SQL",
        "PostgreSQL",
        "MongoDB",
        "Docker",
        "AWS",
    ]

    return techs.filter(tech =>
        description.toLowerCase().includes(tech.toLowerCase()),
    )
}

function getTechBadgeStyle(tech: string) {
    const normalized = tech.toLowerCase()

    if (normalized.includes("python")) {
        return "bg-red-500/10 text-red-300 border-red-500/30"
    }

    if (normalized.includes("fastapi") || normalized.includes("django")) {
        return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
    }

    if (normalized.includes("javascript")) {
        return "bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
    }

    if (normalized.includes("typescript") || normalized.includes("react")) {
        return "bg-blue-500/10 text-blue-300 border-blue-500/30"
    }

    if (
        normalized.includes("sql") ||
        normalized.includes("postgres") ||
        normalized.includes("mongo")
    ) {
        return "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
    }

    if (normalized.includes("docker") || normalized.includes("aws")) {
        return "bg-purple-500/10 text-purple-300 border-purple-500/30"
    }

    return "bg-slate-500/10 text-slate-300 border-slate-500/30"
}

function getTechIconText(tech: string) {
    const normalized = tech.toLowerCase()

    if (normalized.includes("python")) return "🐍"
    if (normalized.includes("javascript")) return "JS"
    if (normalized.includes("typescript")) return "TS"
    if (normalized.includes("fastapi")) return "⚡"
    if (normalized.includes("django")) return "dj"
    if (normalized.includes("react")) return "⚛"
    if (normalized.includes("sql") || normalized.includes("postgres")) return "DB"
    if (normalized.includes("mongo")) return "MDB"
    if (normalized.includes("docker")) return "🐳"
    if (normalized.includes("aws")) return "☁"

    return "</>"
}

function getSeniorityStyle(seniority: string) {
    if (seniority === "SÊNIOR") {
        return "text-purple-300 bg-purple-500/10 border-purple-500/40"
    }

    if (seniority === "PLENO") {
        return "text-blue-300 bg-blue-500/10 border-blue-500/40"
    }

    return "text-green-300 bg-green-500/10 border-green-500/40"
}

function getExperienceStyle(exp: ExperienceRequirement) {
    if (exp.min >= 5) {
        return "text-orange-300 bg-orange-500/10 border-orange-500/40"
    }

    if (exp.min >= 3) {
        return "text-blue-300 bg-blue-500/10 border-blue-500/40"
    }

    return "text-green-300 bg-green-500/10 border-green-500/40"
}

function getCompetitionStyle(applicants: number) {
    if (applicants >= 1000) {
        return "text-orange-300 bg-orange-500/10 border-orange-500/50"
    }

    if (applicants >= 300) {
        return "text-yellow-300 bg-yellow-500/10 border-yellow-500/40"
    }

    if (applicants <= 50) {
        return "text-emerald-300 bg-emerald-500/10 border-emerald-500/40"
    }

    return "text-blue-300 bg-blue-500/10 border-blue-500/40"
}

function TechStackCell({description}: { description: string }) {
    const allTech = extractTechStack(description)

    if (allTech.length === 0) {
        return <span className="text-sm text-gray-500">-</span>
    }

    const displayTech = allTech.slice(0, 3)
    const remaining = allTech.length - 3

    return (
        <div className="flex max-w-[220px] flex-wrap gap-2">
            {displayTech.map(tech => (
                <span
                    key={tech}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${getTechBadgeStyle(
                        tech,
                    )}`}
                >
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-sm text-[9px] font-black">
                        {getTechIconText(tech)}
                    </span>
                    {tech}
                </span>
            ))}

            {remaining > 0 && (
                <span
                    className="cursor-help rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs font-medium text-gray-400"
                    title={allTech.slice(3).join(", ")}
                >
                    +{remaining}
                </span>
            )}
        </div>
    )
}

function RequirementsAnalysisCell({description}: { description: string }) {
    const exp = extractExperienceFromDescription(description)
    const seniority = extractSeniorityFromDescription(description)

    if (!exp && !seniority) {
        return <span className="text-sm text-gray-500">-</span>
    }

    return (
        <div className="flex flex-col items-start gap-2">
            {seniority && (
                <span
                    className={`rounded border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${getSeniorityStyle(
                        seniority,
                    )}`}
                >
                    {seniority}
                </span>
            )}

            {exp && (
                <span
                    className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium ${getExperienceStyle(
                        exp,
                    )}`}
                >
                    <Clock size={12}/>
                    {exp.min}+ Years
                </span>
            )}
        </div>
    )
}

function JobAgeBadge({postedAt}: { postedAt?: string }) {
    if (!postedAt) {
        return <span className="text-sm text-gray-500">-</span>
    }

    const days = calculateJobAge(postedAt)

    let colorClass = "text-gray-400 bg-gray-800 border-gray-700"

    if (days <= 3) {
        colorClass = "text-green-400 bg-green-900/20 border-green-500/30"
    } else if (days <= 14) {
        colorClass = "text-blue-400 bg-blue-900/20 border-blue-500/30"
    } else if (days > 30) {
        colorClass = "text-red-400 bg-red-900/20 border-red-500/30"
    }

    return (
        <div className={`${pillBase} ${colorClass}`}>
            <CalendarDays size={12}/>
            {days === 0 ? "Today" : `${days}d`}
        </div>
    )
}

function CompetitionRichBadge({
                                  applicants,
                                  velocity,
                              }: {
    applicants: number
    velocity: number
}) {
    return (
        <div className="flex w-full flex-col gap-1.5">
            <div className="flex items-center gap-2">
                <Users size={14} className="text-slate-500"/>
                <span
                    className={`rounded-full border px-2 py-1 text-xs font-bold ${getCompetitionStyle(
                        applicants,
                    )}`}
                >
                    {applicants}
                </span>
            </div>

            {velocity > 0 && (
                <div
                    className="flex w-fit items-center gap-1 rounded-full bg-green-900/30 px-2 py-0.5 text-[10px] font-bold text-green-400"
                    title="Applicants in last 24h"
                >
                    <Zap size={10} fill="currentColor"/>
                    {velocity}/d
                </div>
            )}
        </div>
    )
}

function ApplicationStatusBadge({status}: { status: AppliedJob["applicationStatus"] }) {
    const base =
        "inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition"

    if (status === "Refused") {
        return (
            <span
                className={`${base} border-red-500/30 bg-red-500/10 text-red-400 shadow-[0_0_6px_rgba(239,68,68,0.2)]`}
            >
                <Ban size={12}/> REFUSED
            </span>
        )
    }

    if (status === "Accepted") {
        return (
            <span
                className={`${base} border-green-500/30 bg-green-500/10 text-green-400 shadow-[0_0_6px_rgba(34,197,94,0.2)]`}
            >
                <CheckCircle2 size={12}/> ACCEPTED
            </span>
        )
    }

    if (status === "Waiting") {
        return (
            <span
                className={`${base} border-yellow-500/30 bg-yellow-500/10 text-yellow-400 shadow-[0_0_6px_rgba(234,179,8,0.2)]`}
            >
                <Clock size={12}/> WAITING
            </span>
        )
    }

    if (status === "Applied") {
        return (
            <span
                className={`${base} border-blue-500/30 bg-blue-500/10 text-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.2)]`}
            >
                <Briefcase size={12}/> APPLIED
            </span>
        )
    }

    return (
        <span className={`${base} border-gray-700 bg-gray-800 text-gray-400`}>
            {status}
        </span>
    )
}

export default function RecentApplications({
                                               onSelectJob,
                                           }: RecentApplicationsProps) {
    const [jobs, setJobs] = useState<AppliedJob[]>([])
    const [searchTerm, setSearchTerm] = useState("")

    const [isLoadingLocal, setIsLoadingLocal] = useState(false)
    const [isSmartSyncing, setIsSmartSyncing] = useState(false)
    const [isBackfilling, setIsBackfilling] = useState(false)

    const [streamStatus, setStreamStatus] = useState<string | null>(null)
    const [cutoffMonth, setCutoffMonth] = useState("2025-12")

    async function loadJobs() {
        setIsLoadingLocal(true)

        try {
            const result = await fetchAppliedJobs()
            setJobs(result.jobs)
        } catch (error) {
            console.error("Failed to load mocked applied jobs:", error)
            setJobs([])
        } finally {
            setIsLoadingLocal(false)
        }
    }

    useEffect(() => {
        void loadJobs()
    }, [])

    async function handleReloadLocal() {
        await loadJobs()
    }

    async function handleSmartSync() {
        setIsSmartSyncing(true)

        try {
            const result = await syncAppliedSmart()

            if (result.syncedCount > 0) {
                setStreamStatus(`Smart Sync: ${result.syncedCount} new mocked job added.`)
                window.setTimeout(() => setStreamStatus(null), 4000)
            } else {
                setStreamStatus("Smart Sync: everything already mocked.")
                window.setTimeout(() => setStreamStatus(null), 2500)
            }

            await loadJobs()
        } catch (error) {
            console.error("Mocked smart sync failed:", error)
            setStreamStatus("Smart Sync failed.")
        } finally {
            setIsSmartSyncing(false)
        }
    }

    function handleBackfill() {
        setIsBackfilling(true)
        setStreamStatus("Starting mocked deep sync...")

        syncAppliedBackfillStream({
            from: cutoffMonth,

            onProgress: data => {
                const company = data.company.slice(0, 20)
                const title = data.title.slice(0, 30)

                const diff = data.diff
                const diffParts: string[] = []

                if (diff?.applicants) {
                    const delta = diff.applicants.delta
                    const sign = delta > 0 ? "+" : ""

                    diffParts.push(
                        `${sign}${delta} applicants (${diff.applicants.from}→${diff.applicants.to})`,
                    )
                }

                if (diff?.jobState) {
                    diffParts.push(`state: ${diff.jobState.from}→${diff.jobState.to}`)
                }

                if (diff?.applicationClosed) {
                    diffParts.push(
                        `closed: ${String(diff.applicationClosed.from)}→${String(
                            diff.applicationClosed.to,
                        )}`,
                    )
                }

                const diffText = diffParts.length > 0 ? diffParts.join(" | ") : "no updates"

                setStreamStatus(`#${data.processed} ${company} · ${title} → ${diffText}`)
            },

            onFinish: data => {
                const reason = data.reason ? ` (${data.reason})` : ""

                setStreamStatus(`Finished${reason}: +${data.inserted} mocked job inserted.`)

                void loadJobs().finally(() => {
                    setIsBackfilling(false)
                    window.setTimeout(() => setStreamStatus(null), 4000)
                })
            },

            onError: error => {
                console.error("Mocked backfill error:", error)
                setStreamStatus("Mocked deep sync failed.")
                setIsBackfilling(false)
            },
        })
    }

    const filteredJobs = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()

        if (!term) return jobs

        return jobs.filter(job => {
            const searchableText = [
                job.title,
                job.company,
                job.location,
                job.description,
                job.applicationStatus,
            ]
                .join(" ")
                .toLowerCase()

            return searchableText.includes(term)
        })
    }, [jobs, searchTerm])

    return (
        <div className="space-y-6 pb-10">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
                <div className="mb-6 flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
                    <h2 className="flex items-center gap-3 text-2xl font-bold text-white">
                        <Database className="text-blue-500" size={28}/>
                        Application History
                        <span
                            className="rounded-full border border-blue-500/30 bg-blue-900/40 px-3 py-1 font-mono text-sm text-blue-300">
                            {jobs.length} JOBS
                        </span>
                    </h2>

                    <div
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-900/50 p-2">
                        <button
                            type="button"
                            onClick={handleReloadLocal}
                            disabled={isLoadingLocal}
                            className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-xs font-bold uppercase text-slate-200 transition hover:bg-slate-600 disabled:opacity-50"
                            title="Reload mocked local data"
                        >
                            <RefreshCw
                                size={16}
                                className={isLoadingLocal ? "animate-spin" : ""}
                            />
                            {isLoadingLocal ? "Loading..." : "Mock Local"}
                        </button>

                        <div className="mx-1 h-8 w-px bg-slate-700"/>

                        <button
                            type="button"
                            onClick={handleSmartSync}
                            disabled={isSmartSyncing || isBackfilling}
                            className={`flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-600 px-4 py-2 text-xs font-bold uppercase text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500 ${
                                isSmartSyncing ? "cursor-wait opacity-70" : ""
                            }`}
                            title="Mock quick sync"
                        >
                            <Zap
                                size={16}
                                className={
                                    isSmartSyncing
                                        ? "animate-pulse text-yellow-300"
                                        : "text-yellow-300"
                                }
                                fill="currentColor"
                            />
                            {isSmartSyncing ? "Syncing..." : "Mock Sync"}
                        </button>

                        <div className="mx-1 h-8 w-px bg-slate-700"/>

                        <div className="flex items-center gap-2">
                            <input
                                type="month"
                                value={cutoffMonth}
                                onChange={event => setCutoffMonth(event.target.value)}
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
                            />

                            <button
                                type="button"
                                onClick={handleBackfill}
                                disabled={isBackfilling || isSmartSyncing}
                                className={`flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-600 px-4 py-2 text-xs font-bold uppercase text-white shadow-lg shadow-purple-900/20 transition hover:bg-purple-500 ${
                                    isBackfilling ? "cursor-wait opacity-70" : ""
                                }`}
                                title="Mock deep sync"
                            >
                                {isBackfilling ? (
                                    <RefreshCw size={16} className="animate-spin"/>
                                ) : (
                                    <Layers size={16}/>
                                )}
                                {isBackfilling ? "Backfilling..." : "Mock Deep Sync"}
                            </button>
                        </div>
                    </div>
                </div>

                {streamStatus && (
                    <div
                        className="mb-4 flex items-center gap-3 rounded-lg border border-cyan-800 bg-cyan-950/50 p-3 font-mono text-sm text-cyan-300 animate-in fade-in slide-in-from-top-2">
                        <div
                            className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"/>
                        {streamStatus}
                    </div>
                )}

                <div className="relative w-full">
                    <input
                        type="text"
                        placeholder="Search applications by title, company, location or stack..."
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900/60 py-4 pl-12 pr-4 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />

                    <Search
                        size={20}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead className="bg-slate-900 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <tr>
                            <th className="min-w-[280px] border-b border-slate-700 px-6 py-4">
                                Job Identity
                            </th>

                            <th className="w-64 border-b border-slate-700 px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                    <Cpu size={14}/> Tech Stack
                                </div>
                            </th>

                            <th className="w-40 border-b border-slate-700 px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                    <Code2 size={14}/> Level
                                </div>
                            </th>

                            <th className="w-48 border-b border-slate-700 px-6 py-4">
                                Applied Date
                            </th>

                            <th className="w-36 border-b border-slate-700 px-6 py-4">
                                Competitors
                            </th>

                            <th className="w-32 border-b border-slate-700 px-6 py-4 text-center">
                                Status
                            </th>

                            <th className="w-12 border-b border-slate-700 px-6 py-4"/>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-700/60">
                        {filteredJobs.map(job => (
                            <tr
                                key={job.urn}
                                onClick={() => onSelectJob?.(job)}
                                className="group cursor-pointer transition-colors duration-200 hover:bg-slate-700/50"
                            >
                                <td className="px-6 py-5 align-top">
                                    <div className="flex flex-col gap-1.5">
                                        <div
                                            className="text-lg font-bold leading-tight text-white transition-colors group-hover:text-blue-400"
                                            title={job.title}
                                        >
                                            {job.title}
                                        </div>

                                        <div
                                            className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-300">
                                            <Briefcase
                                                size={14}
                                                className="text-slate-500"
                                            />
                                            {job.company}
                                        </div>

                                        {job.lastEmail && (
                                            <div
                                                className="flex w-fit items-center gap-2 whitespace-nowrap rounded-md border border-purple-500/20 bg-purple-900/20 px-2.5 py-1 text-xs text-purple-300"
                                                title={job.lastEmail.subject}
                                            >
                                                📩
                                                <span className="text-purple-300">
                                                        Reply
                                                    </span>
                                                <span className="text-purple-400">
                                                        {formatDateBR(
                                                            job.lastEmail.receivedAt,
                                                        )}
                                                    </span>
                                                <span className="font-mono text-[12px] text-purple-500">
                                                        {formatTimeAgo(
                                                            job.lastEmail.receivedAt,
                                                        )}
                                                    </span>
                                            </div>
                                        )}

                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                            {job.location && (
                                                <span
                                                    className="flex items-center gap-1 rounded bg-slate-900/50 px-2 py-1 text-xs text-slate-400"
                                                    title={job.location}
                                                >
                                                        <MapPin size={12}/>
                                                    {job.location.split(",")[0]}
                                                    </span>
                                            )}

                                            {job.workRemoteAllowed && (
                                                <span
                                                    className="flex items-center gap-1 rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-300">
                                                        <Globe size={10}/>
                                                        Remote
                                                    </span>
                                            )}
                                        </div>
                                    </div>
                                </td>

                                <td className="px-6 py-5 align-top">
                                    <div className="flex justify-center">
                                        <TechStackCell
                                            description={job.description}
                                        />
                                    </div>
                                </td>

                                <td className="px-6 py-5 align-top">
                                    <div className="flex justify-center">
                                        <RequirementsAnalysisCell
                                            description={job.description}
                                        />
                                    </div>
                                </td>

                                <td className="px-6 py-5 align-top">
                                    <div className="flex flex-col gap-1">
                                        <div className="text-sm font-bold text-slate-200">
                                            {formatDateBR(job.appliedAt)}
                                        </div>

                                        <div
                                            className={`${pillBase} border-cyan-700 bg-cyan-900/20 text-cyan-300`}
                                        >
                                            <Clock
                                                size={13}
                                                className="text-cyan-400"
                                            />
                                            {formatTimeBR(job.appliedAt)}
                                        </div>

                                        {job.postedAt && (
                                            <div className="mt-2">
                                                <JobAgeBadge
                                                    postedAt={job.postedAt}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </td>

                                <td className="px-6 py-5 align-top">
                                    <CompetitionRichBadge
                                        applicants={job.applicants}
                                        velocity={job.applicantsVelocity}
                                    />
                                </td>

                                <td className="px-6 py-5 text-center align-top">
                                    <ApplicationStatusBadge
                                        status={job.applicationStatus}
                                    />
                                </td>

                                <td className="px-6 py-5 text-right align-middle">
                                    <ChevronRight
                                        size={20}
                                        className="text-slate-600 transition-all group-hover:translate-x-1 group-hover:text-white"
                                    />
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {filteredJobs.length === 0 && (
                    <div className="bg-slate-800/50 p-20 text-center text-slate-500">
                        <AlertTriangle size={64} className="mx-auto mb-4 opacity-20"/>
                        <p className="text-lg font-medium">No jobs found.</p>
                        <p className="text-sm">Try changing the search term.</p>
                    </div>
                )}
            </div>
        </div>
    )
}