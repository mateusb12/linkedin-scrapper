import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, Coffee } from 'lucide-react';

const GOAL_PER_DAY = 10;

const StreakCalendar = ({ dailyCounts }) => {
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const [currentMonth, setCurrentMonth] = useState(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));

    const daysInMonth = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 0)).getUTCDate();
    const startDayOffset = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1)).getUTCDay();

    const calendarDays = [];
    for (let i = 0; i < startDayOffset; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push(new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), i)));
    }

    const changeMonth = (offset) => {
        const newMonth = new Date(currentMonth);
        newMonth.setUTCMonth(newMonth.getUTCMonth() + offset);
        setCurrentMonth(newMonth);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl mt-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <CalendarIcon className="text-amber-400" size={20} />
                    Streak Calendar
                </h3>
                <div className="flex items-center gap-4">
                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-700 rounded"><ChevronLeft size={20}/></button>
                    <span className="text-sm font-bold w-32 text-center">
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-700 rounded"><ChevronRight size={20}/></button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-center text-xs text-gray-500 font-bold uppercase">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((date, idx) => {
                    if (!date) return <div key={idx} className="h-12 w-full"></div>;

                    const dateKey = date.toISOString().split('T')[0];
                    const count = dailyCounts[dateKey] || 0;

                    const isGoalMet = count >= GOAL_PER_DAY;
                    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
                    const isFuture = date > todayUTC;

                    let baseClass = "h-12 w-full rounded-lg flex flex-col items-center justify-center border transition-all relative group";
                    let content = null;
                    let numberColor = "text-gray-600";

                    if (isFuture) {
                        baseClass += " border-gray-800 bg-gray-900/30 opacity-40";
                    }
                    else if (isGoalMet) {
                        baseClass += " bg-gradient-to-br from-amber-400 to-amber-600 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)] transform hover:scale-105 z-10";
                        content = <Check className="text-white drop-shadow-md" size={24} strokeWidth={4} />;
                        numberColor = "text-amber-900";
                    }
                    else if (count > 0) {
                        numberColor = "text-blue-200";
                        if (count >= 7) {
                            baseClass += " bg-blue-600/60 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]";
                        } else if (count >= 4) {
                            baseClass += " bg-blue-800/60 border-blue-600";
                        } else {
                            baseClass += " bg-blue-900/40 border-blue-800";
                        }
                    }
                    else if (isWeekend) {
                        baseClass += " bg-gray-800 border-gray-700 opacity-60";
                        content = <Coffee className="text-gray-600" size={18} />;
                    }
                    else {
                        baseClass += " bg-gray-900 border-gray-800 hover:border-gray-700";
                    }

                    return (
                        <div key={idx} className={baseClass}>
                            <span className={`absolute top-1 left-1.5 text-[10px] font-bold ${numberColor}`}>
                                {date.getUTCDate()}
                            </span>
                            {content}
                            <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 bg-gray-900 text-xs px-2 py-1 rounded border border-gray-700 whitespace-nowrap z-20 pointer-events-none transition-opacity shadow-lg">
                                <span className="font-bold text-white">{count}</span> <span className="text-gray-400">Applications</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-wrap gap-4 justify-center mt-6 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-gray-900 border border-gray-800"></div> 0
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-900/50 border border-blue-800"></div> 1-3
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-800/60 border border-blue-600"></div> 4-6
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-600/60 border border-blue-500"></div> 7-9
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-amber-500 border border-amber-400"></div> 10+
                </div>
            </div>
        </div>
    );
};

export default StreakCalendar;