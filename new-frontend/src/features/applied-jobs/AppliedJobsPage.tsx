import StreakCalendar, {type DailyStatsMap} from "./StreakCalendar.tsx";
import PerformanceStats, {type PerformanceStatsData} from "./PerformanceStats.tsx";
import RecentApplications from "./RecentApplications.tsx";

function toDateKey(date: Date) {
    return date.toISOString().split("T")[0]
}

function daysAgo(amount: number) {
    const date = new Date()
    date.setDate(date.getDate() - amount)
    return toDateKey(date)
}

const performanceStats = {
    todayCount: 13,
    streak: 6,
    labels: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"],
    realData: [12, 0, 11, 8, 10, 14, 13],
    bonusData: [0, 0, 0, 2, 0, 0, 0],
} satisfies PerformanceStatsData

const dailyStats = {
    [daysAgo(6)]: {
        real: 12,
        bonus: 0,
        effective: 12,
    },
    [daysAgo(5)]: {
        real: 0,
        bonus: 0,
        effective: 0,
    },
    [daysAgo(4)]: {
        real: 11,
        bonus: 0,
        effective: 11,
    },
    [daysAgo(3)]: {
        real: 8,
        bonus: 2,
        effective: 10,
    },
    [daysAgo(2)]: {
        real: 10,
        bonus: 0,
        effective: 10,
    },
    [daysAgo(1)]: {
        real: 14,
        bonus: 0,
        effective: 14,
    },
    [daysAgo(0)]: {
        real: 13,
        bonus: 0,
        effective: 13,
    },
} satisfies DailyStatsMap

export default function AppliedJobsPage() {
    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <section
                className="rounded-xl border border-slate-200/90 bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700/90 dark:bg-[#172033]/90">
                <h1 className="m-0 text-4xl font-black tracking-tight text-[#172033] dark:text-slate-50">
                    Applied Jobs
                </h1>

                <p className="m-0 mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                    Hardcoded tracking dashboard for application progress.
                </p>
            </section>

            <PerformanceStats stats={performanceStats}/>
            <StreakCalendar dailyStats={dailyStats}/>
            <RecentApplications/>
        </div>
    )
}