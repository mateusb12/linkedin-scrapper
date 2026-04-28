import {useCallback, useEffect, useMemo, useState} from "react"
import {Chart as GoogleChart} from "react-google-charts"
import {Chart as ReactChart, Doughnut} from "react-chartjs-2"
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    Tooltip,
} from "chart.js"
import {
    Activity,
    BarChart3,
    Calendar,
    CheckCircle2,
    Filter,
    GitMerge,
    Loader2,
    Minus,
    PieChart,
    Plus,
    RefreshCw,
    Send,
    Users,
    type LucideIcon,
} from "lucide-react"

import {
    type AppliedJob,
    fetchAppliedJobs,
} from "../applied-jobs/appliedJobsMockService.ts"

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

type TimeRange = "current_week" | "last_2_weeks" | "last_month" | "all_time" | "custom"

function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(value)
}

function getStartOfDay(date: Date) {
    const nextDate = new Date(date)
    nextDate.setHours(0, 0, 0, 0)

    return nextDate
}

function getStartOfCurrentWeek() {
    const today = getStartOfDay(new Date())
    const day = today.getDay()
    const diff = day === 0 ? 6 : day - 1
    today.setDate(today.getDate() - diff)

    return today
}

function getDaysAgo(days: number) {
    const date = getStartOfDay(new Date())
    date.setDate(date.getDate() - days)

    return date
}

function filterJobsByTimeRange(
    jobs: AppliedJob[],
    timeRange: TimeRange,
    customStartDate: string,
    customEndDate: string,
) {
    if (timeRange === "all_time") return jobs

    const endDate = getStartOfDay(new Date())
    endDate.setHours(23, 59, 59, 999)

    let startDate: Date | null = null

    if (timeRange === "current_week") {
        startDate = getStartOfCurrentWeek()
    }

    if (timeRange === "last_2_weeks") {
        startDate = getDaysAgo(14)
    }

    if (timeRange === "last_month") {
        startDate = getDaysAgo(30)
    }

    if (timeRange === "custom") {
        if (!customStartDate || !customEndDate) return jobs

        startDate = getStartOfDay(new Date(`${customStartDate}T00:00:00`))
        endDate.setTime(new Date(`${customEndDate}T23:59:59`).getTime())
    }

    if (!startDate) return jobs

    return jobs.filter(job => {
        const appliedAt = new Date(job.appliedAt)

        return appliedAt >= startDate && appliedAt <= endDate
    })
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

type BucketStepperProps = {
    value: number
    onChange: (value: number) => void
}

function BucketStepper({value, onChange}: BucketStepperProps) {
    const min = 2
    const max = 20

    return (
        <div className="flex items-center gap-2 rounded-lg border border-gray-700/50 bg-gray-900/80 p-1">
            <span className="pl-2 pr-1 text-[10px] font-black uppercase text-gray-500">
                Buckets
            </span>
            <div className="flex items-center rounded-md border border-gray-700 bg-gray-800">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(min, value - 1))}
                    disabled={value <= min}
                    className="rounded-l-md p-1.5 text-gray-400 transition hover:bg-gray-700 hover:text-white disabled:opacity-30"
                    aria-label="Decrease buckets"
                >
                    <Minus size={12}/>
                </button>
                <div className="w-7 text-center font-mono text-xs font-black text-purple-300">
                    {value}
                </div>
                <button
                    type="button"
                    onClick={() => onChange(Math.min(max, value + 1))}
                    disabled={value >= max}
                    className="rounded-r-md p-1.5 text-gray-400 transition hover:bg-gray-700 hover:text-white disabled:opacity-30"
                    aria-label="Increase buckets"
                >
                    <Plus size={12}/>
                </button>
            </div>
        </div>
    )
}

const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {display: false},
        tooltip: {
            backgroundColor: "#111827",
            titleColor: "#f3f4f6",
            bodyColor: "#d1d5db",
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
        },
    },
}

function ApplicationStatusChart({jobs}: ApplicationFlowSankeyProps) {
    const counts = useMemo(() => getStatusCounts(jobs), [jobs])
    const total = jobs.length
    const activeCount = counts.Waiting
    const statusData = {
        labels: ["Waiting", "Applied", "Accepted", "Refused"],
        datasets: [
            {
                data: [counts.Waiting, counts.Applied, counts.Accepted, counts.Refused],
                backgroundColor: ["#a855f7", "#60a5fa", "#22c55e", "#4b5563"],
                borderWidth: 0,
                hoverOffset: 4,
            },
        ],
    }

    const rows = [
        {label: "Waiting", value: counts.Waiting, color: "bg-purple-500"},
        {label: "Applied", value: counts.Applied, color: "bg-blue-400"},
        {label: "Accepted", value: counts.Accepted, color: "bg-green-400"},
        {label: "Refused", value: counts.Refused, color: "bg-gray-600"},
    ]

    return (
        <section className="flex min-h-80 flex-col rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-xl">
            <div className="mb-4 flex h-8 items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="rounded-md bg-gray-700/50 p-1.5 text-gray-400">
                        <PieChart size={14}/>
                    </div>
                    <h2 className="text-sm font-black text-white">Application Status</h2>
                </div>
                <div className="rounded border border-gray-700/30 bg-gray-900/50 px-2 py-1 font-mono text-xs text-gray-500">
                    Total: {total}
                </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-between gap-3">
                <div className="relative flex h-full w-1/2 items-center justify-center">
                    <Doughnut data={statusData} options={{...commonChartOptions, cutout: "65%"}}/>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-purple-400">
                            {activeCount}
                        </span>
                        <span className="text-[10px] font-black uppercase text-gray-500">
                            Waiting
                        </span>
                    </div>
                </div>

                <div className="flex w-1/2 flex-col justify-center space-y-3 pr-2 text-sm">
                    {rows.map(row => (
                        <div key={row.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`size-2.5 rounded-full ${row.color}`}/>
                                <span className="text-gray-300">{row.label}</span>
                            </div>
                            <span className="font-black text-white">{row.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function CompetitionDistributionChart({jobs}: ApplicationFlowSankeyProps) {
    const [bucketCount, setBucketCount] = useState(6)

    const competitionData = useMemo(() => {
        const validJobs = jobs.filter(job => Number.isFinite(job.applicants))

        if (validJobs.length === 0) return {labels: [], datasets: []}

        const values = validJobs.map(job => job.applicants).sort((a, b) => a - b)
        const p95Index = Math.min(Math.floor(values.length * 0.95), values.length - 1)
        const p95Value = values[p95Index]
        const minVal = 0
        const effectiveMax = p95Value > minVal ? p95Value : values[values.length - 1]
        const mainBucketCount = bucketCount - 1
        const range = effectiveMax - minVal
        const step = Math.max(1, Math.ceil(range / mainBucketCount))
        const buckets = Array.from({length: mainBucketCount}, (_, index) => ({
            label: `${minVal + index * step}-${minVal + (index + 1) * step}`,
            count: 0,
            refused: 0,
            isOverflow: false,
        }))

        buckets.push({
            label: `>${minVal + mainBucketCount * step}`,
            count: 0,
            refused: 0,
            isOverflow: true,
        })

        validJobs.forEach(job => {
            let index = Math.floor((job.applicants - minVal) / step)

            if (index >= mainBucketCount) index = buckets.length - 1
            if (index < 0) index = 0

            buckets[index].count += 1

            if (job.applicationStatus === "Refused") {
                buckets[index].refused += 1
            }
        })

        return {
            labels: buckets.map(bucket => bucket.label),
            datasets: [
                {
                    type: "bar" as const,
                    label: "Applications",
                    data: buckets.map(bucket => bucket.count),
                    backgroundColor: buckets.map((bucket, index) => {
                        if (bucket.isOverflow) return "#fbbf24"

                        return ["#34d399", "#60a5fa", "#818cf8", "#a78bfa", "#e879f9", "#f472b6"][
                            index % 6
                        ]
                    }),
                    borderRadius: 4,
                    barPercentage: 1,
                    categoryPercentage: 0.9,
                    yAxisID: "y",
                },
                {
                    type: "line" as const,
                    label: "Refused %",
                    data: buckets.map(bucket =>
                        bucket.count > 0 ? Math.round((bucket.refused / bucket.count) * 100) : 0,
                    ),
                    borderColor: "#ef4444",
                    backgroundColor: "#ef4444",
                    pointBackgroundColor: "#ef4444",
                    pointRadius: 3,
                    tension: 0.35,
                    yAxisID: "y1",
                },
            ],
        }
    }, [bucketCount, jobs])

    const mixedChartOptions = {
        ...commonChartOptions,
        scales: {
            y: {display: false},
            y1: {
                type: "linear" as const,
                display: true,
                position: "right" as const,
                min: 0,
                max: 100,
                grid: {drawOnChartArea: false, color: "#374151"},
                ticks: {
                    color: "#ef4444",
                    font: {size: 10},
                    callback: (value: string | number) => `${value}%`,
                },
                border: {display: false},
            },
            x: {
                grid: {display: false},
                ticks: {color: "#9ca3af", font: {size: 10}},
            },
        },
    }

    return (
        <section className="flex min-h-80 flex-col rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-xl">
            <div className="mb-4 flex h-8 items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="rounded-md bg-gray-700/50 p-1.5 text-gray-400">
                        <BarChart3 size={14}/>
                    </div>
                    <h2 className="text-sm font-black text-white">
                        Competition Distribution
                    </h2>
                </div>
                <BucketStepper value={bucketCount} onChange={setBucketCount}/>
            </div>

            <div className="flex min-h-0 flex-1 items-end pb-2">
                {competitionData.datasets.length > 0 ? (
                    <ReactChart type="bar" data={competitionData} options={mixedChartOptions}/>
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                        No applicant data available
                    </div>
                )}
            </div>
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
                <GoogleChart
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

export default function InsightsPage() {
    const [jobs, setJobs] = useState<AppliedJob[]>([])
    const [timeRange, setTimeRange] = useState<TimeRange>("all_time")
    const [customStartDate, setCustomStartDate] = useState("")
    const [customEndDate, setCustomEndDate] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const filteredJobs = useMemo(
        () => filterJobsByTimeRange(jobs, timeRange, customStartDate, customEndDate),
        [customEndDate, customStartDate, jobs, timeRange],
    )
    const counts = useMemo(() => getStatusCounts(filteredJobs), [filteredJobs])
    const activePipeline = counts.Waiting + counts.Applied
    const avgApplicants = useMemo(() => getAverageApplicants(filteredJobs), [filteredJobs])
    const timeRangeLabel =
        timeRange === "custom"
            ? "Custom Range"
            : timeRange.replace(/_/g, " ")

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
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <h1 className="m-0 flex items-center gap-3 text-4xl font-black tracking-tight text-white">
                            <Activity className="text-blue-400" size={30}/>
                            Insights
                        </h1>

                        <p className="m-0 mt-3 max-w-2xl text-sm font-medium leading-6 text-gray-400">
                            Mocked application flow analytics based on the same applied jobs data.
                            <span className="ml-1 font-bold capitalize text-purple-300">
                                {timeRangeLabel}
                            </span>
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {timeRange === "custom" && (
                            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-700/50 bg-gray-900 p-1">
                                <div className="flex items-center gap-2 px-2">
                                    <Calendar size={14} className="text-gray-500"/>
                                    <span className="text-xs font-bold text-gray-400">From:</span>
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={event => setCustomStartDate(event.target.value)}
                                        className="w-32 cursor-pointer border-none bg-transparent p-0 text-xs font-bold text-white outline-none [color-scheme:dark]"
                                    />
                                </div>

                                <div className="h-4 w-px bg-gray-700"/>

                                <div className="flex items-center gap-2 px-2">
                                    <span className="text-xs font-bold text-gray-400">To:</span>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={event => setCustomEndDate(event.target.value)}
                                        className="w-32 cursor-pointer border-none bg-transparent p-0 text-xs font-bold text-white outline-none [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2 rounded-xl border border-gray-700/50 bg-gray-900 p-1">
                            <div className="pl-3 text-gray-500">
                                <Filter size={14}/>
                            </div>
                            <select
                                value={timeRange}
                                onChange={event => setTimeRange(event.target.value as TimeRange)}
                                className="cursor-pointer rounded-r-xl border-none bg-gray-900 py-1.5 pl-2 pr-8 text-sm font-bold text-gray-300 outline-none transition hover:text-white"
                            >
                                <option value="current_week">Current Week</option>
                                <option value="last_2_weeks">Last 2 Weeks</option>
                                <option value="last_month">Last Month</option>
                                <option value="all_time">All Time</option>
                                <option value="custom">Custom Range</option>
                            </select>
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
                            value={filteredJobs.length}
                            helper={`${jobs.length} total mocked applications`}
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

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <ApplicationStatusChart jobs={filteredJobs}/>
                        <CompetitionDistributionChart jobs={filteredJobs}/>
                    </div>

                    <ApplicationFlowSankey jobs={filteredJobs}/>

                    <StatusBreakdown jobs={filteredJobs}/>
                </>
            )}
        </div>
    )
}
