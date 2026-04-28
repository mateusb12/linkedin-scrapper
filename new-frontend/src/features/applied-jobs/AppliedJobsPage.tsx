import {useCallback, useEffect, useMemo, useState} from "react"

import StreakCalendar, {type DailyStatsMap} from "./StreakCalendar.tsx"
import PerformanceStats, {type PerformanceStatsData} from "./PerformanceStats.tsx"
import RecentApplications from "./RecentApplications.tsx"
import {
    type AppliedJob,
    fetchAppliedJobs,
} from "./appliedJobsService.ts"

function toDateKey(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")

    return `${year}-${month}-${day}`
}

function startOfDay(date: Date) {
    const copy = new Date(date)
    copy.setHours(0, 0, 0, 0)

    return copy
}

function addDays(date: Date, amount: number) {
    const copy = new Date(date)
    copy.setDate(copy.getDate() + amount)

    return copy
}

function isWeekend(date: Date) {
    const day = date.getDay()

    return day === 0 || day === 6
}

function getAppliedDate(job: AppliedJob) {
    const date = new Date(job.appliedAt)

    return Number.isNaN(date.getTime()) ? null : date
}

function buildDailyStats(jobs: AppliedJob[]) {
    return jobs.reduce<DailyStatsMap>((stats, job) => {
        const appliedDate = getAppliedDate(job)
        if (!appliedDate) return stats

        const key = toDateKey(appliedDate)
        const current = stats[key] ?? {
            real: 0,
            bonus: 0,
            effective: 0,
        }

        stats[key] = {
            ...current,
            real: current.real + 1,
            effective: current.effective + 1,
        }

        return stats
    }, {})
}

function buildPerformanceStats(dailyStats: DailyStatsMap): PerformanceStatsData {
    const today = startOfDay(new Date())
    const days = Array.from({length: 7}, (_, index) => addDays(today, index - 6))
    const todayKey = toDateKey(today)

    let streak = 0

    for (let cursor = today; ; cursor = addDays(cursor, -1)) {
        if (isWeekend(cursor)) continue

        const count = dailyStats[toDateKey(cursor)]?.effective ?? 0
        if (count === 0) break

        streak += 1
    }

    return {
        todayCount: dailyStats[todayKey]?.real ?? 0,
        streak,
        labels: days.map(day =>
            day.toLocaleDateString("en-US", {
                weekday: "short",
            }),
        ),
        realData: days.map(day => dailyStats[toDateKey(day)]?.real ?? 0),
        bonusData: days.map(day => dailyStats[toDateKey(day)]?.bonus ?? 0),
    }
}

export default function AppliedJobsPage() {
    const [jobs, setJobs] = useState<AppliedJob[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const dailyStats = useMemo(() => buildDailyStats(jobs), [jobs])
    const performanceStats = useMemo(
        () => buildPerformanceStats(dailyStats),
        [dailyStats],
    )

    const loadJobs = useCallback(async function loadJobs() {
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
    }, [])

    useEffect(() => {
        void loadJobs()
    }, [loadJobs])

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <section
                className="rounded-xl border border-slate-200/90 bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700/90 dark:bg-[#172033]/90">
                <h1 className="m-0 text-4xl font-black tracking-tight text-[#172033] dark:text-slate-50">
                    Applied Jobs
                </h1>

                <p className="m-0 mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                    Real tracking dashboard for application progress.
                </p>
            </section>

            <PerformanceStats stats={performanceStats}/>
            <StreakCalendar dailyStats={dailyStats}/>
            <RecentApplications
                jobs={jobs}
                isLoading={isLoading}
                error={error}
                onRefresh={loadJobs}
                onError={setError}
            />
        </div>
    )
}
