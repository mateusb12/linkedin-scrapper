import {useState} from "react"
import {
    Calendar as CalendarIcon,
    Check,
    ChevronLeft,
    ChevronRight,
    Coffee,
    Shield,
    ShieldCheck,
} from "lucide-react"

const GOAL_PER_DAY = 5

export type DailyStats = {
    real: number
    bonus: number
    effective: number
}

export type DailyStatsMap = Record<string, DailyStats>

type StreakCalendarProps = {
    dailyStats?: DailyStatsMap
}

export default function StreakCalendar({
                                           dailyStats = {},
                                       }: StreakCalendarProps) {
    const today = new Date()

    const todayUTC = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    )

    const [currentMonth, setCurrentMonth] = useState(
        new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
    )

    const daysInMonth = new Date(
        Date.UTC(
            currentMonth.getUTCFullYear(),
            currentMonth.getUTCMonth() + 1,
            0,
        ),
    ).getUTCDate()

    const startDayOffset = new Date(
        Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1),
    ).getUTCDay()

    const calendarDays: Array<Date | null> = []

    for (let index = 0; index < startDayOffset; index += 1) {
        calendarDays.push(null)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        calendarDays.push(
            new Date(
                Date.UTC(
                    currentMonth.getUTCFullYear(),
                    currentMonth.getUTCMonth(),
                    day,
                ),
            ),
        )
    }

    function changeMonth(offset: number) {
        const newMonth = new Date(currentMonth)
        newMonth.setUTCMonth(newMonth.getUTCMonth() + offset)
        setCurrentMonth(newMonth)
    }

    return (
        <div className="mt-6 rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                    <CalendarIcon className="text-amber-400" size={20}/>
                    Streak Calendar
                </h3>

                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                        className="rounded p-1 text-gray-300 hover:bg-gray-700"
                    >
                        <ChevronLeft size={20}/>
                    </button>

                    <span className="w-32 text-center text-sm font-bold text-gray-100">
                        {currentMonth.toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                            timeZone: "UTC",
                        })}
                    </span>

                    <button
                        type="button"
                        onClick={() => changeMonth(1)}
                        className="rounded p-1 text-gray-300 hover:bg-gray-700"
                    >
                        <ChevronRight size={20}/>
                    </button>
                </div>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                    <div
                        key={day}
                        className="text-center text-xs font-bold uppercase text-gray-500"
                    >
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((date, index) => {
                    if (!date) {
                        return <div key={index} className="h-12 w-full"/>
                    }

                    const dateKey = date.toISOString().split("T")[0]
                    const stats = dailyStats[dateKey] ?? {
                        real: 0,
                        bonus: 0,
                        effective: 0,
                    }

                    const count = stats.effective
                    const isGoalMet = count >= GOAL_PER_DAY
                    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6
                    const isFuture = date > todayUTC

                    let baseClass =
                        "group relative flex h-12 w-full flex-col items-center justify-center rounded-lg border transition-all"

                    let content = null
                    let numberColor = "text-gray-600"

                    if (isFuture) {
                        baseClass += " border-gray-800 bg-gray-900/30 opacity-40"
                    } else if (isGoalMet) {
                        baseClass +=
                            " z-10 transform border-amber-400 bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:scale-105"
                        numberColor = "text-amber-900"

                        content =
                            stats.bonus > 0 ? (
                                <ShieldCheck
                                    className="text-white drop-shadow-md"
                                    size={24}
                                    strokeWidth={2.5}
                                />
                            ) : (
                                <Check
                                    className="text-white drop-shadow-md"
                                    size={24}
                                    strokeWidth={4}
                                />
                            )
                    } else if (stats.bonus > 0) {
                        baseClass += " border-dashed border-blue-500/50 bg-blue-900/40"
                        content = (
                            <Shield className="text-blue-400 opacity-80" size={18}/>
                        )
                        numberColor = "text-blue-400"
                    } else if (count > 0) {
                        numberColor = "text-blue-200"

                        if (count >= 7) {
                            baseClass += " border-blue-500 bg-blue-600/60"
                        } else if (count >= 4) {
                            baseClass += " border-blue-600 bg-blue-800/60"
                        } else {
                            baseClass += " border-blue-800 bg-blue-900/40"
                        }
                    } else if (isWeekend) {
                        baseClass += " border-gray-700 bg-gray-800 opacity-60"
                        content = <Coffee className="text-gray-600" size={18}/>
                    } else {
                        baseClass += " border-gray-800 bg-gray-900 hover:border-gray-700"
                    }

                    return (
                        <div key={index} className={baseClass}>
                            <span
                                className={`absolute left-1.5 top-1 text-[10px] font-bold ${numberColor}`}
                            >
                                {date.getUTCDate()}
                            </span>

                            {content}

                            <div
                                className="pointer-events-none absolute bottom-full z-20 mb-2 whitespace-nowrap rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                <div className="mb-0.5 font-bold text-white">
                                    {count} / {GOAL_PER_DAY}
                                </div>

                                {stats.bonus > 0 && (
                                    <div className="text-[10px] text-blue-300">
                                        ({stats.real} Real + {stats.bonus} Shield)
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                    <div
                        className="flex h-3 w-3 items-center justify-center rounded-sm bg-gradient-to-br from-amber-400 to-amber-600">
                        <Check size={10} className="text-white" strokeWidth={4}/>
                    </div>
                    Goal Met
                </div>

                <div className="flex items-center gap-2">
                    <div
                        className="flex h-3 w-3 items-center justify-center rounded-sm bg-gradient-to-br from-amber-400 to-amber-600">
                        <ShieldCheck size={10} className="text-white"/>
                    </div>
                    Streak Saved
                </div>

                <div className="flex items-center gap-2">
                    <div
                        className="flex h-3 w-3 items-center justify-center rounded-sm border border-dashed border-blue-800 bg-blue-900/40">
                        <Shield size={10} className="text-blue-400"/>
                    </div>
                    Shield Building
                </div>
            </div>
        </div>
    )
}