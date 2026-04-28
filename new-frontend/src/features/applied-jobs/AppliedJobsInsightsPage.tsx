import {useCallback, useEffect, useMemo, useState} from "react"
import {Chart} from "react-google-charts"
import {
    Activity,
    BarChart3,
    CheckCircle2,
    GitMerge,
    Loader2,
    RefreshCw,
    Send,
    Users,
    type LucideIcon,
} from "lucide-react"

import {
    type AppliedJob,
    fetchAppliedJobs,
} from "./appliedJobsMockService.ts"

function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(value)
}

function getStatusCounts(jobs: AppliedJob[]) {
    return jobs.reduce(
        (counts, job) => {
            counts[job.applicationStatus] += 1

            return counts
        },
        {
            Waiting: 0,
            Applied: 0,
            Accepted: 0,
            Refused: 0,
        },
    )
}

function getAverageApplicants(jobs: AppliedJob[]) {
    if (jobs.length === 0) return 0

    const total = jobs.reduce((sum, job) => sum + job.applicants, 0)

    return Math.round(total / jobs.length)
}

type StatCardProps = {
    label: string
    value: string | number
    helper: string
    icon: LucideIcon
    tone: string
}

function StatCard({label, value, helper, icon: Icon, tone}: StatCardProps) {
    return (
        <section className={`rounded-xl border bg-gray-800 p-5 shadow-xl ${tone}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-black uppercase tracking-wider text-gray-500">
                        {label}
                    </p>
                    <p className="mt-2 text-3xl font-black text-white">{value}</p>
                </div>

                <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                    <Icon size={21}/>
                </div>
            </div>

            <p className="mt-4 text-xs font-semibold text-gray-500">{helper}</p>
        </section>
    )
}

type ApplicationFlowSankeyProps = {
    jobs: AppliedJob[]
}

function ApplicationFlowSankey({jobs}: ApplicationFlowSankeyProps) {
    const counts = useMemo(() => getStatusCounts(jobs), [jobs])
    const total = jobs.length
    const activePipeline = counts.Waiting + counts.Applied
    const finished = counts.Accepted + counts.Refused

    const sankeyData = [
        ["From", "To", "Weight"],
        [
            `Total Applications (${total})`,
            `Active Pipeline (${activePipeline})`,
            activePipeline > 0 ? activePipeline : 0.001,
        ],
        [
            `Total Applications (${total})`,
            `Finished Outcomes (${finished})`,
            finished > 0 ? finished : 0.001,
        ],
        [
            `Active Pipeline (${activePipeline})`,
            `Waiting (${counts.Waiting})`,
            counts.Waiting > 0 ? counts.Waiting : 0.001,
        ],
        [
            `Active Pipeline (${activePipeline})`,
            `Applied (${counts.Applied})`,
            counts.Applied > 0 ? counts.Applied : 0.001,
        ],
        [
            `Finished Outcomes (${finished})`,
            `Accepted (${counts.Accepted})`,
            counts.Accepted > 0 ? counts.Accepted : 0.001,
        ],
        [
            `Finished Outcomes (${finished})`,
            `Refused (${counts.Refused})`,
            counts.Refused > 0 ? counts.Refused : 0.001,
        ],
    ]

    const filteredSankeyData = [
        sankeyData[0],
        ...sankeyData.slice(1).filter(row => Number(row[2]) > 0.002),
    ]

    const sankeyOptions = {
        sankey: {
            node: {
                colors: [
                    "#3b82f6",
                    "#8b5cf6",
                    "#64748b",
                    "#f59e0b",
                    "#38bdf8",
                    "#22c55e",
                    "#ef4444",
                ],
                label: {
                    fontName: "Inter",
                    fontSize: 13,
                    color: "#e5e7eb",
                    bold: false,
                },
                nodePadding: 30,
                width: 6,
            },
            link: {
                colorMode: "gradient",
                colors: [
                    "#3b82f6",
                    "#8b5cf6",
                    "#64748b",
                    "#f59e0b",
                    "#38bdf8",
                    "#22c55e",
                    "#ef4444",
                ],
            },
        },
        backgroundColor: "transparent",
        tooltip: {isHtml: true, textStyle: {color: "#000000"}},
    }

    return (
        <section className="rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-black text-white">
                        <GitMerge size={20} className="text-blue-400"/>
                        Application Flow
                    </h2>
                    <p className="mt-1 text-sm font-medium text-gray-500">
                        Sankey built from mocked applied jobs status.
                    </p>
                </div>

                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-extrabold text-blue-300">
                    {total} total
                </span>
            </div>

            <div className="min-h-[400px] rounded-xl border border-gray-700 bg-gray-950/40 p-4">
                <Chart
                    chartType="Sankey"
                    width="100%"
                    height="380px"
                    data={filteredSankeyData}
                    options={sankeyOptions}
                />
            </div>
        </section>
    )
}

function StatusBreakdown({jobs}: ApplicationFlowSankeyProps) {
    const counts = useMemo(() => getStatusCounts(jobs), [jobs])
    const total = Math.max(jobs.length, 1)
    const rows = [
        {label: "Waiting", value: counts.Waiting, color: "bg-amber-400"},
        {label: "Applied", value: counts.Applied, color: "bg-sky-400"},
        {label: "Accepted", value: counts.Accepted, color: "bg-green-400"},
        {label: "Refused", value: counts.Refused, color: "bg-red-400"},
    ]

    return (
        <section className="rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-xl">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
                <BarChart3 size={19} className="text-blue-400"/>
                Status Breakdown
            </h2>

            <div className="space-y-4">
                {rows.map(row => {
                    const percentage = Math.round((row.value / total) * 100)

                    return (
                        <div key={row.label}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                                <span className="font-bold text-gray-300">{row.label}</span>
                                <span className="font-mono text-xs text-gray-500">
                                    {row.value} · {percentage}%
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-gray-900">
                                <div
                                    className={`h-full rounded-full ${row.color}`}
                                    style={{width: `${percentage}%`}}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}

export default function AppliedJobsInsightsPage() {
    const [jobs, setJobs] = useState<AppliedJob[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const counts = useMemo(() => getStatusCounts(jobs), [jobs])
    const activePipeline = counts.Waiting + counts.Applied
    const avgApplicants = useMemo(() => getAverageApplicants(jobs), [jobs])

    const loadJobs = useCallback(async function loadJobs() {
        try {
            setError(null)
            setIsLoading(true)

            const result = await fetchAppliedJobs()
            setJobs(result.jobs)
        } catch (loadError) {
            console.error(loadError)
            setError("Could not load applied jobs insights.")
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

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <section className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="m-0 flex items-center gap-3 text-4xl font-black tracking-tight text-white">
                            <Activity className="text-blue-400" size={30}/>
                            Insights
                        </h1>

                        <p className="m-0 mt-3 max-w-2xl text-sm font-medium leading-6 text-gray-400">
                            Mocked application flow analytics based on the same applied jobs data.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => void loadJobs()}
                        disabled={isLoading}
                        className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-200 transition hover:border-gray-500 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""}/>
                        Refresh
                    </button>
                </div>
            </section>

            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/40">
                    <div className="flex items-center gap-3 text-sm font-bold text-gray-300">
                        <Loader2 className="animate-spin text-blue-400" size={20}/>
                        Loading mocked insights...
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            label="Applications"
                            value={jobs.length}
                            helper="Loaded from applied jobs mock service"
                            icon={Users}
                            tone="border-blue-500/20 text-blue-300"
                        />
                        <StatCard
                            label="Active Pipeline"
                            value={activePipeline}
                            helper="Waiting and applied applications"
                            icon={Send}
                            tone="border-purple-500/20 text-purple-300"
                        />
                        <StatCard
                            label="Accepted"
                            value={counts.Accepted}
                            helper="Positive outcomes in mock data"
                            icon={CheckCircle2}
                            tone="border-green-500/20 text-green-300"
                        />
                        <StatCard
                            label="Avg Applicants"
                            value={formatNumber(avgApplicants)}
                            helper="Average competitors per role"
                            icon={BarChart3}
                            tone="border-amber-500/20 text-amber-300"
                        />
                    </div>

                    <ApplicationFlowSankey jobs={jobs}/>

                    <StatusBreakdown jobs={jobs}/>
                </>
            )}
        </div>
    )
}
