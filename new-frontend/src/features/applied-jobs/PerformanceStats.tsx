import type {ReactNode} from "react"
import type {ChartData, ChartOptions} from "chart.js"
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
} from "chart.js"
import {Shield, ShieldAlert, ShieldCheck} from "lucide-react"
import {Chart} from "react-chartjs-2"

import calendarIcon from "../../assets/UI/calendar.png"
import fireIcon from "../../assets/UI/fire.png"
import targetIcon from "../../assets/UI/target.png"

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
)

const GOAL_PER_DAY = 5

const themeColors = {
    textSecondary: "#9ca3af",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#ef4444",
    protection: "#3b82f6",
}

export type PerformanceStatsData = {
    todayCount: number
    streak: number
    labels: string[]
    realData: number[]
    bonusData: number[]
}

type StatCardProps = {
    title: string
    value: number
    suffix?: string
    subtext?: string
    iconSrc: string
    colorClass: string
    children?: ReactNode
}

function StatCard({
                      title,
                      value,
                      suffix,
                      subtext,
                      iconSrc,
                      colorClass,
                      children,
                  }: StatCardProps) {
    const pillClass =
        `${colorClass.replace("text-", "bg-").replace("400", "400/10")} ${colorClass}`

    return (
        <div
            className="flex items-center gap-5 rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-lg transition-transform duration-300 hover:-translate-y-1 hover:border-gray-600 hover:shadow-xl">
            <div className="h-16 w-16 flex-shrink-0 drop-shadow-md">
                <img
                    src={iconSrc}
                    alt={title}
                    className="h-full w-full object-contain"
                />
            </div>

            <div className="flex flex-col justify-center">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {title}
                </p>

                <div className="mb-1.5 flex items-baseline">
                    <span className="text-3xl font-extrabold tracking-tight text-white">
                        {value}
                    </span>

                    {suffix && (
                        <span className="ml-1.5 text-sm font-medium text-gray-500">
                            {suffix}
                        </span>
                    )}
                </div>

                {children
                    ? children
                    : subtext && (
                    <div
                        className={`w-fit rounded px-2 py-0.5 text-[10px] font-bold ${pillClass}`}
                    >
                        {subtext}
                    </div>
                )}
            </div>
        </div>
    )
}

type PerformanceStatsProps = {
    stats: PerformanceStatsData
}

export default function PerformanceStats({stats}: PerformanceStatsProps) {
    const todayBonus = stats.bonusData[stats.bonusData.length - 1] ?? 0
    const todayReal = stats.realData[stats.realData.length - 1] ?? 0

    const generatedForTomorrow =
        todayReal > GOAL_PER_DAY && todayBonus === 0
            ? Math.min(todayReal - GOAL_PER_DAY, GOAL_PER_DAY)
            : 0

    function getMotivation() {
        const remaining = GOAL_PER_DAY - stats.todayCount

        if (remaining <= 0) return "Goal Crushed!"
        if (remaining <= 3) return "Almost There"

        return "Keep Pushing"
    }

    const chartData: ChartData<"bar" | "line", number[], string> = {
        labels: stats.labels,
        datasets: [
            {
                type: "line",
                label: "Goal",
                data: stats.labels.map(() => GOAL_PER_DAY),
                borderColor: themeColors.textSecondary,
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
                order: 0,
            },
            {
                type: "bar",
                label: "Protection Credits",
                data: stats.bonusData,
                backgroundColor: themeColors.protection,
                borderRadius: 4,
                stack: "Stack 0",
                order: 1,
            },
            {
                type: "bar",
                label: "Real Applications",
                data: stats.realData,
                backgroundColor: stats.realData.map((value, index) => {
                    const total = value + (stats.bonusData[index] ?? 0)

                    if (total >= GOAL_PER_DAY) return themeColors.success
                    if (total >= GOAL_PER_DAY / 2) return themeColors.warning

                    return themeColors.danger
                }),
                borderRadius: 4,
                stack: "Stack 0",
                order: 2,
            },
        ],
    }

    const options: ChartOptions<"bar" | "line"> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: "index",
            intersect: false,
        },
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: themeColors.textSecondary,
                },
            },
            tooltip: {
                backgroundColor: "#111827",
                titleColor: "#f3f4f6",
                bodyColor: "#d1d5db",
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: context => {
                        if (context.dataset.type === "line") {
                            return ` Goal: ${context.raw}`
                        }

                        return ` ${context.dataset.label}: ${context.raw}`
                    },
                    footer: tooltipItems => {
                        const total = tooltipItems.reduce((sum, item) => {
                            if (item.dataset.type !== "bar") return sum

                            return sum + Number(item.raw ?? 0)
                        }, 0)

                        return ` Total: ${total}`
                    },
                },
            },
        },
        scales: {
            y: {
                stacked: true,
                beginAtZero: true,
                grid: {
                    color: "rgba(75, 85, 99, 0.2)",
                },
                ticks: {
                    color: themeColors.textSecondary,
                },
            },
            x: {
                stacked: true,
                grid: {
                    display: false,
                },
                ticks: {
                    color: themeColors.textSecondary,
                },
            },
        },
    }

    return (
        <>
            <div
                className="grid grid-cols-1 gap-6 gap-y-10 pt-4 duration-500 animate-in fade-in slide-in-from-bottom-4 md:grid-cols-3">
                <StatCard
                    title="Today's Progress"
                    value={stats.todayCount}
                    suffix={`/ ${GOAL_PER_DAY}`}
                    iconSrc={targetIcon}
                    colorClass={
                        stats.todayCount >= GOAL_PER_DAY
                            ? "text-green-400"
                            : "text-amber-400"
                    }
                >
                    <div className="flex flex-col gap-1">
                        {todayBonus > 0 && (
                            <div
                                className="w-fit rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                                {todayReal} Real + {todayBonus} Bonus
                            </div>
                        )}

                        <div
                            className={`w-fit rounded px-2 py-0.5 text-[10px] font-bold ${
                                stats.todayCount >= GOAL_PER_DAY
                                    ? "bg-green-400/10 text-green-400"
                                    : "bg-amber-400/10 text-amber-400"
                            }`}
                        >
                            {getMotivation()}
                        </div>
                    </div>
                </StatCard>

                <StatCard
                    title="Current Streak"
                    value={stats.streak}
                    suffix={stats.streak === 1 ? "Day" : "Days"}
                    subtext="Weekends Excluded"
                    iconSrc={fireIcon}
                    colorClass="text-blue-400"
                />

                <StatCard
                    title="Weekly Total"
                    value={stats.realData.reduce((sum, value) => sum + value, 0)}
                    subtext="Last 7 Days (Real)"
                    iconSrc={calendarIcon}
                    colorClass="text-purple-400"
                />
            </div>

            <div
                className="mt-6 rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-xl delay-75 duration-500 animate-in fade-in slide-in-from-bottom-4">
                <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white">
                            Daily Performance
                        </h3>

                        <div className="mt-2 flex items-center gap-4">
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="h-3 w-3 rounded bg-green-500"/>
                                Real Apps
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="h-3 w-3 rounded bg-blue-500"/>
                                Protection
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end">
                        {todayBonus > 0 ? (
                            <div
                                className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-400">
                                <ShieldCheck size={16}/>
                                <span>Protection Active (+{todayBonus})</span>
                            </div>
                        ) : generatedForTomorrow > 0 ? (
                            <div
                                className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-sm font-medium text-green-400">
                                <Shield size={16}/>
                                <span>Building Shield (+{generatedForTomorrow})</span>
                            </div>
                        ) : todayReal > GOAL_PER_DAY && todayBonus > 0 ? (
                            <div
                                className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-700/50 px-3 py-1.5 text-sm font-medium text-gray-400"
                                title="Cannot build shield while using one"
                            >
                                <ShieldAlert size={16}/>
                                <span>Shield Cooldown</span>
                            </div>
                        ) : (
                            <span
                                className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-xs text-gray-500">
                                Goal: {GOAL_PER_DAY}/day
                            </span>
                        )}
                    </div>
                </div>

                <div className="h-80 w-full">
                    <Chart type="bar" data={chartData} options={options}/>
                </div>
            </div>
        </>
    )
}