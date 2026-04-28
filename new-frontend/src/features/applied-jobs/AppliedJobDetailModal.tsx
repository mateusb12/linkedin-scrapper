import {useEffect, useMemo} from "react"
import {
    Briefcase,
    CalendarDays,
    CheckCircle2,
    Clock,
    Code2,
    Mail,
    MapPin,
    Send,
    Users,
    X,
    XCircle,
} from "lucide-react"

import {
    type AppliedJob,
    type ApplicationStatus,
    formatDateBR,
    formatTimeAgo,
    formatTimeBR,
} from "./appliedJobsService.ts"

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

function getLevel(job: AppliedJob): string | null {
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

function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(value)
}

type AppliedJobDetailModalProps = {
    job: AppliedJob | null
    onClose: () => void
}

export default function AppliedJobDetailModal({
    job,
    onClose,
}: AppliedJobDetailModalProps) {
    const stack = useMemo(() => (job ? extractTechStack(job.description) : []), [job])
    const level = useMemo(() => (job ? getLevel(job) : null), [job])

    useEffect(() => {
        if (!job) return undefined

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose()
            }
        }

        document.addEventListener("keydown", handleKeyDown)

        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [job, onClose])

    if (!job) return null

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <button
                type="button"
                aria-label="Close job details"
                className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <aside
                role="dialog"
                aria-modal="true"
                aria-labelledby="applied-job-detail-title"
                className="relative flex h-full w-full max-w-2xl flex-col border-l border-gray-700 bg-gray-900 shadow-2xl"
            >
                <header className="border-b border-gray-800 bg-gray-900 p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h2
                                id="applied-job-detail-title"
                                className="text-2xl font-black leading-tight text-white"
                            >
                                {job.title}
                            </h2>

                            <p className="mt-2 flex items-center gap-2 text-base font-bold text-blue-300">
                                <Briefcase size={18} className="shrink-0"/>
                                {job.company}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
                            aria-label="Close job details"
                        >
                            <X size={22}/>
                        </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold ${getStatusClass(
                                job.applicationStatus,
                            )}`}
                        >
                            {getStatusIcon(job.applicationStatus)}
                            {job.applicationStatus}
                        </span>

                        {level && (
                            <span
                                className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-extrabold ${getLevelClass(
                                    level,
                                )}`}
                            >
                                {level}
                            </span>
                        )}

                        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-bold text-gray-300">
                            <MapPin size={14}/>
                            {job.location}
                        </span>

                        {job.workRemoteAllowed && (
                            <span className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-extrabold text-blue-300">
                                Remote
                            </span>
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                    <div className="space-y-6">
                        <section>
                            <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-500">
                                <Code2 size={16} className="text-blue-400"/>
                                Tech Stack
                            </h3>

                            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
                                {stack.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {stack.map(tech => (
                                            <span
                                                key={tech}
                                                className={`rounded-md border px-2.5 py-1 text-xs font-extrabold ${
                                                    TECH_BADGE_CLASS[tech] ??
                                                    "border-gray-600 bg-gray-900/70 text-gray-200"
                                                }`}
                                            >
                                                {tech}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm font-medium text-gray-500">
                                        No stack detected in this description.
                                    </p>
                                )}
                            </div>
                        </section>

                        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
                                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                    Applied
                                </p>
                                <p className="text-sm font-extrabold text-gray-100">
                                    {formatDateBR(job.appliedAt)}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    {formatTimeBR(job.appliedAt)} · {formatTimeAgo(job.appliedAt)}
                                </p>
                            </div>

                            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
                                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                    Applicants
                                </p>
                                <p className="flex items-center gap-2 text-lg font-black text-gray-100">
                                    <Users size={17} className="text-blue-400"/>
                                    {formatNumber(job.applicants)}
                                </p>
                                <p className="mt-1 text-xs font-medium text-gray-500">
                                    +{job.applicantsVelocity}/day velocity
                                </p>
                            </div>

                            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
                                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                    Posted
                                </p>
                                {job.postedAt ? (
                                    <>
                                        <p className="flex items-center gap-2 text-sm font-extrabold text-gray-100">
                                            <CalendarDays size={16} className="text-blue-400"/>
                                            {formatDateBR(job.postedAt)}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {formatTimeAgo(job.postedAt)}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm font-semibold text-gray-500">Unknown</p>
                                )}
                            </div>
                        </section>

                        {job.lastEmail && (
                            <section>
                                <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-300">
                                    <Mail size={16}/>
                                    Recruiter Email
                                </h3>

                                <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4">
                                    <p className="text-sm font-bold text-purple-200">
                                        {job.lastEmail.subject}
                                    </p>
                                    <p className="mt-2 text-xs font-medium text-purple-300/80">
                                        Received {formatDateBR(job.lastEmail.receivedAt)} at{" "}
                                        {formatTimeBR(job.lastEmail.receivedAt)}
                                    </p>
                                </div>
                            </section>
                        )}

                        <section>
                            <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-500">
                                Description
                            </h3>

                            <div className="whitespace-pre-wrap rounded-xl border border-gray-800 bg-gray-950/40 p-4 text-sm font-medium leading-6 text-gray-300">
                                {job.description || "No description provided."}
                            </div>
                        </section>
                    </div>
                </div>

                <footer className="border-t border-gray-800 bg-gray-900 p-4">
                    <p className="truncate text-[10px] font-mono text-gray-500">
                        ID: {job.urn}
                    </p>
                </footer>
            </aside>
        </div>
    )
}
