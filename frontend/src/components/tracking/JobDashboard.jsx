import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import axios from 'axios';
import targetIcon from '../../assets/ui_icons/target.png';
import fireIcon from '../../assets/ui_icons/fire.png';
import calendarIcon from '../../assets/ui_icons/calendar.png';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
} from 'chart.js';
import {
    RefreshCcw,
    Settings,
    Lock,
    Terminal,
    Upload,
    FileJson,
    Target,
    Calendar as CalendarIcon, // Renamed to avoid conflict
    Check,
    Coffee,
    X,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { fetchAppliedJobs } from '../../services/jobService.js';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
);

// --- THEME & CONSTANTS ---
const GOAL_PER_DAY = 10;

const themeColors = {
    textPrimary: '#f3f4f6',
    textSecondary: '#9ca3af',
    background: '#1f2937',
    cardBg: '#111827',
    linkedin: '#8b5cf6',
    huntr: '#10b981',
    sql: '#3b82f6',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    neutral: '#6b7280',
};

// --- SKELETON COMPONENTS ---
const DashboardSkeleton = () => (
    <div className="p-6 bg-gray-900 min-h-screen animate-pulse">
        <div className="h-10 bg-gray-800 rounded w-1/3 mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-8 mt-8">
            <div className="h-32 bg-gray-800 rounded-lg"></div>
            <div className="h-32 bg-gray-800 rounded-lg"></div>
            <div className="h-32 bg-gray-800 rounded-lg"></div>
        </div>
        <div className="h-96 bg-gray-800 rounded-lg"></div>
    </div>
);

// --- HELPER FUNCTIONS ---
const getStartOfToday = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const getLast7DaysKeys = () => {
    const keys = [];
    const today = getStartOfToday();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setUTCDate(today.getUTCDate() - i);
        keys.push(d.toISOString().split('T')[0]);
    }
    return keys;
};

// --- DATA PROCESSING ---
const processHistoryData = (jobs, timePeriod) => {
    if (!jobs?.length) return { barData: null, doughnutData: null };

    const appsBySource = {};
    const appsPerPeriod = {};

    jobs.forEach(job => {
        const source = job.source || 'Unknown';
        appsBySource[source] = (appsBySource[source] || 0) + 1;

        const date = new Date(job.appliedAt);
        let key;

        if (timePeriod === 'monthly') {
            key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        } else if (timePeriod === 'weekly') {
            const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
            const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
            key = `${d.getUTCFullYear()}-W${weekNo}`;
        } else {
            key = date.toISOString().split('T')[0];
        }

        if (!appsPerPeriod[key]) appsPerPeriod[key] = {};
        appsPerPeriod[key][source] = (appsPerPeriod[key][source] || 0) + 1;
    });

    const sources = Object.keys(appsBySource);
    const doughnutColors = sources.map(s => {
        const lower = s.toLowerCase();
        if (lower.includes('linkedin')) return themeColors.linkedin;
        if (lower.includes('huntr')) return themeColors.huntr;
        return themeColors.sql;
    });

    const doughnutData = {
        labels: sources,
        datasets: [{
            data: Object.values(appsBySource),
            backgroundColor: doughnutColors,
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    const sortedKeys = Object.keys(appsPerPeriod).sort();
    const datasets = sources.map((source, index) => {
        let color = themeColors.sql;
        if (source.toLowerCase().includes('linkedin')) color = themeColors.linkedin;
        if (source.toLowerCase().includes('huntr')) color = themeColors.huntr;

        return {
            label: source,
            data: sortedKeys.map(k => appsPerPeriod[k][source] || 0),
            backgroundColor: color,
            stack: 'stack1',
        };
    });

    return {
        doughnutData,
        barData: { labels: sortedKeys, datasets }
    };
};

const processCurrentFormData = (jobs) => {
    // 1. Create a map of ALL dates with applications
    const allDailyCounts = {};
    jobs.forEach(job => {
        const k = new Date(job.appliedAt).toISOString().split('T')[0];
        allDailyCounts[k] = (allDailyCounts[k] || 0) + 1;
    });

    // 2. Prepare Last 7 Days for the chart
    const last7Days = getLast7DaysKeys();
    const dataValues = last7Days.map(k => allDailyCounts[k] || 0);
    const todayKey = last7Days[last7Days.length - 1];
    const todayCount = allDailyCounts[todayKey] || 0;

    // 3. Smart Streak Logic (Ignores Weekends)
    let streak = 0;
    const checkDate = getStartOfToday();

    // Safety break loop limit (e.g. 365 days)
    for (let i = 0; i < 365; i++) {
        const dateKey = checkDate.toISOString().split('T')[0];
        const count = allDailyCounts[dateKey] || 0;
        const dayOfWeek = checkDate.getUTCDay(); // 0 = Sun, 6 = Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (i === 0 && count < GOAL_PER_DAY) {
            // If checking TODAY and we haven't met goal yet,
            // don't break streak, just move to yesterday.
            checkDate.setUTCDate(checkDate.getUTCDate() - 1);
            continue;
        }

        if (count >= GOAL_PER_DAY) {
            // Met goal -> Add to streak
            streak++;
        } else if (isWeekend) {
            // Didn't meet goal, BUT it's weekend -> Maintain streak (don't add, don't break)
        } else {
            // Didn't meet goal and it's a weekday -> Streak broken
            break;
        }

        // Move one day back
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }

    return {
        labels: last7Days.map(d => {
            const date = new Date(d);
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        }),
        data: dataValues,
        todayCount,
        streak,
        allDailyCounts // Return this for the calendar
    };
};

// --- COMPONENTS ---

const StatCard = ({ title, value, suffix, subtext, iconSrc, colorClass }) => {
    const pillClass = colorClass.replace('text-', 'bg-').replace('400', '400/10') + ' ' + colorClass;

    return (
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 shadow-lg flex items-center gap-5 transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-gray-600">
            <div className="w-16 h-16 flex-shrink-0 drop-shadow-md">
                <img src={iconSrc} alt={title} className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col justify-center">
                <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-1">{title}</p>
                <div className="flex items-baseline mb-1.5">
                    <span className="text-3xl font-extrabold text-white tracking-tight">{value}</span>
                    {suffix && <span className="text-sm font-medium text-gray-500 ml-1.5">{suffix}</span>}
                </div>
                {subtext && (
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded w-fit ${pillClass}`}>
                        {subtext}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- NEW COMPONENT: STREAK CALENDAR ---
const StreakCalendar = ({ dailyCounts }) => {
    const today = new Date();
    // Ensure we work with UTC dates to match data processing
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const [currentMonth, setCurrentMonth] = useState(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));

    const daysInMonth = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 0)).getUTCDate();
    const startDayOffset = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1)).getUTCDay();

    // Generate Calendar Grid
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

            {/* Day Labels */}
            <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-center text-xs text-gray-500 font-bold uppercase">{d}</div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((date, idx) => {
                    if (!date) return <div key={idx} className="h-12 w-full"></div>;

                    const dateKey = date.toISOString().split('T')[0];
                    const count = dailyCounts[dateKey] || 0;

                    const isGoalMet = count >= GOAL_PER_DAY;
                    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
                    const isFuture = date > todayUTC;

                    // --- STYLE LOGIC ---
                    let baseClass = "h-12 w-full rounded-lg flex flex-col items-center justify-center border transition-all relative group";
                    let content = null;
                    let numberColor = "text-gray-600"; // default number color

                    if (isFuture) {
                        // FUTURE
                        baseClass += " border-gray-800 bg-gray-900/30 opacity-40";
                    }
                    else if (isGoalMet) {
                        // 🏆 GOAL MET (GOLD)
                        baseClass += " bg-gradient-to-br from-amber-400 to-amber-600 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)] transform hover:scale-105 z-10";
                        content = <Check className="text-white drop-shadow-md" size={24} strokeWidth={4} />;
                        numberColor = "text-amber-900";
                    }
                    else if (count > 0) {
                        // 📈 IN PROGRESS (BLUE SCALE)
                        // This overrides weekend "Rest" if you actually did work
                        numberColor = "text-blue-200";

                        if (count >= 7) {
                            // High Progress (7-9)
                            baseClass += " bg-blue-600/60 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]";
                        } else if (count >= 4) {
                            // Medium Progress (4-6)
                            baseClass += " bg-blue-800/60 border-blue-600";
                        } else {
                            // Low Progress (1-3)
                            baseClass += " bg-blue-900/40 border-blue-800";
                        }
                    }
                    else if (isWeekend) {
                        // ☕ REST DAY (Weekend + 0 Apps)
                        baseClass += " bg-gray-800 border-gray-700 opacity-60";
                        content = <Coffee className="text-gray-600" size={18} />;
                    }
                    else {
                        // ❌ MISSED (Weekday + 0 Apps)
                        baseClass += " bg-gray-900 border-gray-800 hover:border-gray-700";
                    }

                    return (
                        <div key={idx} className={baseClass}>
                            {/* Day Number */}
                            <span className={`absolute top-1 left-1.5 text-[10px] font-bold ${numberColor}`}>
                                {date.getUTCDate()}
                            </span>

                            {/* Icon (Check or Coffee) */}
                            {content}

                            {/* Tooltip */}
                            <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 bg-gray-900 text-xs px-2 py-1 rounded border border-gray-700 whitespace-nowrap z-20 pointer-events-none transition-opacity shadow-lg">
                                <span className="font-bold text-white">{count}</span> <span className="text-gray-400">Applications</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
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

const CurrentFormTab = ({ jobs }) => {
    const stats = useMemo(() => processCurrentFormData(jobs || []), [jobs]);

    const chartData = {
        labels: stats.labels,
        datasets: [
            {
                type: 'line',
                label: 'Goal',
                data: stats.labels.map(() => GOAL_PER_DAY),
                borderColor: themeColors.textSecondary,
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
                order: 0
            },
            {
                type: 'bar',
                label: 'Applications',
                data: stats.data,
                backgroundColor: stats.data.map(val =>
                    val >= GOAL_PER_DAY ? themeColors.success :
                        val >= (GOAL_PER_DAY / 2) ? themeColors.warning : themeColors.danger
                ),
                borderRadius: 6,
                order: 1
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, labels: { color: themeColors.textSecondary } },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: (ctx) => {
                        if (ctx.dataset.type === 'line') return `Goal: ${ctx.raw}`;
                        return `Applied: ${ctx.raw}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(75, 85, 99, 0.2)' },
                ticks: { color: themeColors.textSecondary }
            },
            x: {
                grid: { display: false },
                ticks: { color: themeColors.textSecondary }
            }
        }
    };

    const getMotivation = () => {
        const remaining = GOAL_PER_DAY - stats.todayCount;
        if (remaining <= 0) return "Goal Crushed!";
        if (remaining <= 3) return "Almost There";
        return "Keep Pushing";
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 gap-y-10 pt-4">
                <StatCard
                    title="Today's Progress"
                    value={stats.todayCount}
                    suffix={`/ ${GOAL_PER_DAY}`}
                    subtext={getMotivation()}
                    iconSrc={targetIcon}
                    colorClass={stats.todayCount >= GOAL_PER_DAY ? "text-green-400" : "text-amber-400"}
                />
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
                    value={stats.data.reduce((a, b) => a + b, 0)}
                    subtext="Last 7 Days"
                    iconSrc={calendarIcon}
                    colorClass="text-purple-400"
                />
            </div>

            {/* Main Chart */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl mt-4">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Daily Performance</h3>
                    <span className="text-xs text-gray-400 px-3 py-1 bg-gray-900 rounded-full border border-gray-700">
                        Goal: {GOAL_PER_DAY}/day
                    </span>
                </div>
                <div className="h-80 w-full">
                    <Bar data={chartData} options={options} />
                </div>
            </div>

            {/* Streak Calendar - Added at bottom of current form */}
            <StreakCalendar dailyCounts={stats.allDailyCounts} />
        </div>
    );
};

const PastFormTab = ({ jobs }) => {
    const [timePeriod, setTimePeriod] = useState('daily');
    const { barData, doughnutData } = useMemo(() => processHistoryData(jobs, timePeriod), [jobs, timePeriod]);

    if (!barData) return <div className="text-gray-400 p-10 text-center">No data available</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-6">
            <div className="lg:col-span-2 bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Application History</h3>
                    <div className="bg-gray-900 rounded-lg p-1 flex space-x-1">
                        {['daily', 'weekly', 'monthly'].map(t => (
                            <button
                                key={t}
                                onClick={() => setTimePeriod(t)}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${
                                    timePeriod === t
                                        ? 'bg-blue-600 text-white shadow'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="h-80">
                    <Bar
                        data={barData}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                x: { stacked: true, grid: { display: false }, ticks: { color: themeColors.textSecondary } },
                                y: { stacked: true, grid: { color: 'rgba(75, 85, 99, 0.2)' }, ticks: { color: themeColors.textSecondary } }
                            },
                            plugins: { legend: { labels: { color: themeColors.textPrimary } } }
                        }}
                    />
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl flex flex-col">
                <h3 className="text-xl font-bold text-white mb-6">Source Distribution</h3>
                <div className="flex-grow flex items-center justify-center relative">
                    <div className="w-full h-64">
                        <Doughnut
                            data={doughnutData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                cutout: '70%',
                                plugins: { legend: { position: 'bottom', labels: { color: themeColors.textPrimary } } }
                            }}
                        />
                    </div>
                    {/* Center Text */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-white">{jobs.length}</p>
                            <p className="text-xs text-gray-400">Total Apps</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- SETTINGS COMPONENT ---
const ScraperSettings = ({ onClose, onSaveSuccess }) => {
    const [statusMessage, setStatusMessage] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const fileInputRef = React.useRef(null);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setStatusMessage('Reading file...');
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target.result;
            try {
                const liAtMatch = content.match(/li_at=([^;"]+)/);
                const jsessionMatch = content.match(/JSESSIONID=?[\\"]*ajax:([0-9]+)/);
                if (liAtMatch && jsessionMatch) {
                    await saveCredentials(`li_at=${liAtMatch[1]}; JSESSIONID="ajax:${jsessionMatch[1]}"`, `ajax:${jsessionMatch[1]}`);
                } else {
                    setStatusMessage('❌ Error: Could not find li_at or JSESSIONID in file.');
                }
            } catch (err) { setStatusMessage('❌ Parsing Error: ' + err.message); }
        };
        reader.readAsText(file);
    };

    const saveCredentials = async (cookies, csrfToken) => {
        setIsSaving(true);
        try {
            await axios.put('http://localhost:5000/services/cookies', { identifier: 'LinkedIn_Saved_Jobs_Scraper', cookies, csrfToken });
            setStatusMessage('✅ Credentials Updated! Syncing jobs...');
            onSaveSuccess();
            setTimeout(onClose, 1500);
        } catch (error) {
            setStatusMessage(`❌ API Error: ${error.response?.data?.error || error.message}`);
        } finally { setIsSaving(false); }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 border border-gray-700 animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Terminal size={20} className="text-blue-400" />
                        Update LinkedIn Credentials
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">Upload <code>linkedin.har</code> to refresh session.</p>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 bg-gray-900/50 flex flex-col items-center">
                <FileJson size={48} className="text-gray-500 mb-4" />
                <input type="file" accept=".har,.json" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} disabled={isSaving} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center gap-2">
                    {isSaving ? <RefreshCcw size={18} className="animate-spin" /> : <Upload size={18} />}
                    Upload .HAR File
                </button>
                {statusMessage && <div className="mt-4 text-sm text-gray-300">{statusMessage}</div>}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
export const JobDashboard = () => {
    const [activeTab, setActiveTab] = useState('current'); // 'current' | 'past'
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const { data: jobs, isLoading, isError, refetch, isFetching } = useQuery({
        queryKey: ['appliedJobs'],
        queryFn: fetchAppliedJobs,
        staleTime: 0,
        retry: false
    });

    if (isLoading) return <DashboardSkeleton />;

    return (
        <div className="p-6 bg-gray-900 text-gray-200 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-gray-800 pb-6">
                <div className="mb-4 md:mb-0">
                    <h2 className="text-3xl font-bold text-white mb-1 tracking-tight">Job Application Dashboard</h2>
                    <p className="text-gray-400 text-sm">Track metrics, monitor goals, and analyze history.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="h-9 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg border border-gray-700 transition-all flex items-center gap-2 text-sm font-medium"
                    >
                        <RefreshCcw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                        {isFetching ? 'Syncing...' : 'Sync Data'}
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={`h-9 px-4 rounded-lg border flex items-center gap-2 text-sm font-medium transition-all ${
                            isSettingsOpen ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`}
                    >
                        <Settings size={16} />
                        Settings
                    </button>
                </div>
            </div>

            {isSettingsOpen && <ScraperSettings onClose={() => setIsSettingsOpen(false)} onSaveSuccess={refetch} />}

            {isError ? (
                <div className="bg-red-900/10 border border-red-900/50 p-8 rounded-xl text-center max-w-lg mx-auto mt-10">
                    <Lock className="mx-auto text-red-500 w-12 h-12 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Access Required</h3>
                    <p className="text-gray-400 mb-6">Your LinkedIn session has expired. Please update your credentials to view data.</p>
                    <button onClick={() => setIsSettingsOpen(true)} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">
                        Update Credentials
                    </button>
                </div>
            ) : (
                <>
                    {/* Tabs */}
                    <div className="flex space-x-1 bg-gray-800 p-1 rounded-xl w-fit mb-4 border border-gray-800">
                        <button
                            onClick={() => setActiveTab('current')}
                            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                activeTab === 'current'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                        >
                            <Target size={16} />
                            Current Form
                        </button>
                        <button
                            onClick={() => setActiveTab('past')}
                            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                activeTab === 'past'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                        >
                            <CalendarIcon size={16} />
                            Past Form
                        </button>
                    </div>

                    {/* Content */}
                    <div className="min-h-[400px]">
                        {activeTab === 'current' ? (
                            <CurrentFormTab jobs={jobs} />
                        ) : (
                            <PastFormTab jobs={jobs} />
                        )}
                    </div>
                </>
            )}
        </div>
    );
};