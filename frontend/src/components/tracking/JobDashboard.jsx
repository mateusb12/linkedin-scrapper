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
    Calendar,
    TrendingUp,
    Award
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

    // Vibrant Palette
    linkedin: '#8b5cf6', // Violet 500
    huntr: '#10b981',    // Emerald 500
    sql: '#3b82f6',      // Blue 500 (No more gray!)

    // Status Colors
    success: '#22c55e',  // Green 500
    warning: '#f59e0b',  // Amber 500
    danger: '#ef4444',   // Red 500
    neutral: '#6b7280',  // Gray 500
};

// --- SKELETON COMPONENTS ---
const DashboardSkeleton = () => (
    <div className="p-6 bg-gray-900 min-h-screen animate-pulse">
        <div className="h-10 bg-gray-800 rounded w-1/3 mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
        // Source Counts
        const source = job.source || 'Unknown';
        appsBySource[source] = (appsBySource[source] || 0) + 1;

        // Timeline Counts
        const date = new Date(job.appliedAt);
        let key;

        if (timePeriod === 'monthly') {
            key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        } else if (timePeriod === 'weekly') {
            // Simple weekly grouping key (approx)
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

    // Prepare Doughnut Data
    const sources = Object.keys(appsBySource);
    const doughnutColors = sources.map(s => {
        const lower = s.toLowerCase();
        if (lower.includes('linkedin')) return themeColors.linkedin;
        if (lower.includes('huntr')) return themeColors.huntr;
        return themeColors.sql; // Default to vibrant blue
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

    // Prepare Bar Data
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
        barData: {
            labels: sortedKeys,
            datasets
        }
    };
};

const processCurrentFormData = (jobs) => {
    const last7Days = getLast7DaysKeys(); // Array of YYYY-MM-DD
    const dailyCounts = {};

    // Init with 0
    last7Days.forEach(k => dailyCounts[k] = 0);

    // Count jobs
    jobs.forEach(job => {
        const k = new Date(job.appliedAt).toISOString().split('T')[0];
        if (dailyCounts[k] !== undefined) {
            dailyCounts[k]++;
        }
    });

    const dataValues = last7Days.map(k => dailyCounts[k]);
    const todayKey = last7Days[last7Days.length - 1];
    const todayCount = dailyCounts[todayKey];

    // Calculate Streak (consecutive days >= GOAL_PER_DAY counting backwards)
    let streak = 0;
    for (let i = last7Days.length - 1; i >= 0; i--) {
        // If today is incomplete, don't break streak yet unless it's yesterday that failed
        if (i === last7Days.length - 1 && dailyCounts[last7Days[i]] < GOAL_PER_DAY) continue;

        if (dailyCounts[last7Days[i]] >= GOAL_PER_DAY) {
            streak++;
        } else {
            break;
        }
    }

    return {
        labels: last7Days.map(d => {
            const date = new Date(d);
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        }),
        data: dataValues,
        todayCount,
        streak
    };
};

// --- SUB-COMPONENTS ---

const StatCard = ({ title, value, subtext, icon: Icon, iconSrc, colorClass }) => (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex items-center justify-between">
        <div>
            <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
            {subtext && <p className={`text-xs ${colorClass}`}>{subtext}</p>}
        </div>

        {/* ICON */}
        <div className="w-16 h-16 rounded-full bg-gray-900/70 flex items-center justify-center overflow-hidden">
            {iconSrc ? (
                <img
                    src={iconSrc}
                    alt={`${title} icon`}
                    className="w-full h-full object-cover"  // 🔥 fills the circle
                />
            ) : Icon ? (
                <Icon size={28} className={colorClass} />
            ) : null}
        </div>
    </div>
);

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
        if (remaining <= 0) return "You crushed it today! Great job.";
        if (remaining <= 3) return "Almost there! Just a final push.";
        return "Let's get to work! Consistency is key.";
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Today's Progress"
                    value={`${stats.todayCount} / ${GOAL_PER_DAY}`}
                    subtext={getMotivation()}
                    iconSrc={targetIcon}                       // ⬅️ custom target icon
                    colorClass={stats.todayCount >= GOAL_PER_DAY ? "text-green-400" : "text-amber-400"}
                />
                <StatCard
                    title="Current Streak"
                    value={`${stats.streak} Days`}
                    subtext="Consecutive days hitting goal"
                    iconSrc={fireIcon}                         // ⬅️ custom fire icon
                    colorClass="text-blue-400"
                />
                <StatCard
                    title="Weekly Total"
                    value={stats.data.reduce((a, b) => a + b, 0)}
                    subtext="Last 7 days"
                    iconSrc={calendarIcon}                     // ⬅️ custom calendar icon
                    colorClass="text-purple-400"
                />
            </div>

            {/* Main Chart */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Daily Performance (Last 7 Days)</h3>
                    <span className="text-xs text-gray-400 px-3 py-1 bg-gray-900 rounded-full border border-gray-700">
                        Goal: {GOAL_PER_DAY} apps/day
                    </span>
                </div>
                <div className="h-80 w-full">
                    <Bar data={chartData} options={options} />
                </div>
            </div>
        </div>
    );
};

const PastFormTab = ({ jobs }) => {
    const [timePeriod, setTimePeriod] = useState('daily');
    const { barData, doughnutData } = useMemo(() => processHistoryData(jobs, timePeriod), [jobs, timePeriod]);

    if (!barData) return <div className="text-gray-400 p-10 text-center">No data available</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
    // (Kept exactly the same as your provided code, just wrapped for brevity)
    // ... Assume existing implementation of ScraperSettings
    // For the sake of the file length limit, I will include the core logic again below
    // in the full file output.

    // --- RE-IMPLEMENTING SETTINGS LOGIC BRIEFLY FOR COMPLETENESS ---
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
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-gray-800 pb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Job Application Dashboard</h2>
                    <p className="text-gray-400">Track metrics, monitor goals, and analyze history.</p>
                </div>
                <div className="flex items-center gap-3 mt-4 md:mt-0">
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="h-10 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-700 transition-all flex items-center gap-2 text-sm font-medium"
                    >
                        <RefreshCcw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                        {isFetching ? 'Syncing...' : 'Sync Data'}
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={`h-10 px-4 rounded-lg border flex items-center gap-2 text-sm font-medium transition-all ${
                            isSettingsOpen ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
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
                    <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-xl w-fit mb-8 border border-gray-800">
                        <button
                            onClick={() => setActiveTab('current')}
                            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                activeTab === 'current'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
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
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                        >
                            <Calendar size={16} />
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