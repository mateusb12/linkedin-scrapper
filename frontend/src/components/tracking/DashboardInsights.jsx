import React from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    Title
} from 'chart.js';
import { Users, AlertTriangle, CheckCircle, Calendar, Filter, ArrowUpRight, Activity, PieChart, BarChart3 } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// --- Styled Stat Card (Kept mostly the same, just slight padding tweaks) ---
const StatCard = ({ title, value, subtext, icon: Icon, color, trend }) => {
    const colorClasses = {
        blue: 'bg-blue-500/10 text-blue-400',
        red: 'bg-red-500/10 text-red-400',
        orange: 'bg-orange-500/10 text-orange-400',
        yellow: 'bg-yellow-500/10 text-yellow-400',
        purple: 'bg-purple-500/10 text-purple-400',
    };

    return (
        <div className="relative group overflow-hidden bg-gray-800/60 backdrop-blur-sm p-5 rounded-2xl border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:shadow-lg hover:shadow-gray-900/40">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">{title}</p>
                    <h3 className="text-3xl font-extrabold text-white tracking-tight">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${colorClasses[color] || 'bg-gray-700 text-gray-300'} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                    <Icon size={22} />
                </div>
            </div>
            {subtext && (
                <div className="mt-4 flex items-center gap-2">
                    {trend && <span className="flex items-center text-xs font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded"><ArrowUpRight size={12} className="mr-1"/>{trend}</span>}
                    <p className="text-xs font-medium text-gray-500">{subtext}</p>
                </div>
            )}
        </div>
    );
};

const DashboardInsights = ({ insights, timeRange, onTimeRangeChange }) => {
    const safeInsights = insights || {
        overview: { total: 0, refused: 0, waiting: 0, refusal_rate: 0 },
        competition: { low: 0, medium: 0, high: 0, avg_applicants: 0, high_comp_refusal_rate: 0 }
    };

    const { overview, competition } = safeInsights;

    // --- Chart Data & Options ---

    // Donut Data
    const statusData = {
        labels: ['Waiting', 'Refused'],
        datasets: [{
            data: [overview.waiting, overview.refused],
            backgroundColor: ['#fbbf24', '#f87171'], // Amber-400, Red-400
            borderWidth: 0, // Cleaner look without borders
            hoverOffset: 4
        }]
    };

    // Bar Data
    const competitionData = {
        labels: ['Low (<50)', 'Medium (50-200)', 'High (>200)'],
        datasets: [{
            label: 'Applications',
            data: [competition.low, competition.medium, competition.high],
            backgroundColor: ['#34d399', '#60a5fa', '#f472b6'], // Emerald, Blue, Pink
            borderRadius: 6,
            barThickness: 50, // FIX: Prevents the "Wall" effect
        }]
    };

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }, // We build custom legends for better control
            tooltip: {
                backgroundColor: '#111827',
                titleColor: '#f3f4f6',
                bodyColor: '#d1d5db',
                padding: 12,
                cornerRadius: 8,
                displayColors: true,
                borderWidth: 1,
                borderColor: '#374151'
            }
        }
    };

    const barOptions = {
        ...commonOptions,
        scales: {
            y: {
                beginAtZero: true,
                grid: { display: false }, // Cleaner look
                ticks: { color: '#6b7280', font: { size: 10 } },
                border: { display: false }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#9ca3af', font: { size: 11 } },
                border: { display: false }
            }
        }
    };

    return (
        <div className="space-y-6 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* --- Header / Filters --- */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white leading-none">Performance Analytics</h3>
                        <p className="text-xs text-gray-400 mt-1">Metrics overview for <span className="text-purple-400 font-medium capitalize">{timeRange.replace(/_/g, ' ')}</span></p>
                    </div>
                </div>

                <div className="mt-4 sm:mt-0 flex items-center gap-3 bg-gray-900 p-1 rounded-xl border border-gray-700/50 shadow-inner">
                    <div className="pl-3 text-gray-500"><Filter size={14} /></div>
                    <select
                        value={timeRange}
                        onChange={(e) => onTimeRangeChange(e.target.value)}
                        className="bg-gray-900 border-none text-gray-300 text-sm focus:ring-0 cursor-pointer py-1.5 pr-8 pl-2 font-medium hover:text-white transition-colors rounded-r-xl outline-none"
                    >
                        <option value="current_week">Current Week</option>
                        <option value="last_2_weeks">Last 2 Weeks</option>
                        <option value="last_month">Last Month</option>
                        <option value="all_time">All Time</option>
                    </select>
                </div>
            </div>

            {/* --- Key Metrics Grid --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard title="Total Applied" value={overview.total} icon={Calendar} color="blue" subtext="applications sent" />
                <StatCard title="Refusal Rate" value={`${overview.refusal_rate}%`} icon={AlertTriangle} color="red" subtext={`${overview.refused} rejections recorded`} />
                <StatCard title="Avg Applicants" value={competition.avg_applicants} icon={Users} color="orange" subtext="candidates per role" />
                <StatCard title="Active Pipeline" value={overview.waiting} icon={CheckCircle} color="yellow" subtext="awaiting response" />
            </div>

            {/* --- Charts Section --- */}
            {/* FIX: Reduced height to h-80 (20rem) for tighter UI */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-80">

                {/* 1. Status Donut (Layout: Chart Left, Legend Right) */}
                <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-700/50 flex flex-col shadow-lg">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4 h-8">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gray-700/50 rounded-md text-gray-400"><PieChart size={14}/></div>
                            <h4 className="font-bold text-white text-sm">Outcomes Distribution</h4>
                        </div>
                        <div className="text-xs text-gray-500 font-mono bg-gray-900/50 px-2 py-1 rounded border border-gray-700/30">
                            Total: {overview.total}
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-between gap-4 min-h-0">
                        {/* Chart Area */}
                        <div className="relative w-1/2 h-full flex justify-center items-center">
                            <Doughnut data={statusData} options={{ ...commonOptions, cutout: '70%' }} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-2xl font-black text-white">{overview.refusal_rate}%</span>
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Refusal</span>
                            </div>
                        </div>

                        {/* Custom Legend Area (Right Side) */}
                        <div className="w-1/2 flex flex-col justify-center space-y-4 pr-4">
                            <div className="flex items-start justify-between group">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]"></span>
                                    <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Waiting</span>
                                </div>
                                <span className="text-sm font-bold text-white">{overview.waiting}</span>
                            </div>
                            <div className="w-full h-px bg-gray-700/50"></div>
                            <div className="flex items-start justify-between group">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.3)]"></span>
                                    <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Refused</span>
                                </div>
                                <span className="text-sm font-bold text-white">{overview.refused}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Competition Bar */}
                <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-700/50 flex flex-col shadow-lg">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4 h-8">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gray-700/50 rounded-md text-gray-400"><BarChart3 size={14}/></div>
                            <h4 className="font-bold text-white text-sm">Competition Levels</h4>
                        </div>
                        {competition.high_comp_refusal_rate > 0 && (
                            <div className="flex items-center gap-2 text-xs font-mono bg-pink-500/10 text-pink-400 px-2 py-1 rounded border border-pink-500/20">
                                <span className="uppercase font-bold tracking-wider">High Comp Refusal:</span>
                                <span className="font-bold">{competition.high_comp_refusal_rate}%</span>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 w-full min-h-0 flex items-end pb-2">
                        <Bar data={competitionData} options={barOptions} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardInsights;