import React from 'react';
import { Chart } from "react-google-charts";
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
import { Users, AlertTriangle, CheckCircle, Calendar, Filter, ArrowUpRight, Activity, PieChart, BarChart3, Eye, Ban, GitMerge } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// --- Styled Stat Card ---
const StatCard = ({ title, value, subtext, icon: Icon, color, trend, iconColor }) => {
    const colorClasses = {
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        red: 'bg-red-500/10 text-red-400 border-red-500/20',
        orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        gray: 'bg-gray-700/50 text-gray-400 border-gray-600/50'
    };

    return (
        <div className={`relative group overflow-hidden bg-gray-800/60 backdrop-blur-sm p-5 rounded-2xl border ${colorClasses[color] || 'border-gray-700/50'} hover:border-opacity-100 transition-all duration-300 hover:shadow-lg hover:shadow-gray-900/40`}>
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">{title}</p>
                    <h3 className="text-3xl font-extrabold text-white tracking-tight">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl bg-gray-800 border border-gray-700 ${iconColor} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
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
        overview: { total: 0, refused: 0, waiting: 0, reviewing: 0, closed: 0 },
        competition: { low: 0, medium: 0, high: 0, avg_applicants: 0, high_comp_refusal_rate: 0 }
    };

    const { overview, competition } = safeInsights;

    // Calculate rates
    const activePipeline = overview.waiting + overview.reviewing;
    const deadEnds = overview.refused + overview.closed;
    const reviewRate = overview.total > 0 ? Math.round((overview.reviewing / overview.total) * 100) : 0;

    // --- Chart Data ---

    // 1. Enhanced Donut: Status Breakdown
    const statusData = {
        labels: ['Reviewing', 'Waiting', 'Closed', 'Refused'],
        datasets: [{
            data: [overview.reviewing, overview.waiting, overview.closed, overview.refused],
            backgroundColor: [
                '#a855f7', // Purple (Reviewing)
                '#fbbf24', // Amber (Waiting)
                '#4b5563', // Gray (Closed)
                '#f87171'  // Red (Refused)
            ],
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    // 2. Competition Bar
    const competitionData = {
        labels: ['Low (<50)', 'Medium (50-200)', 'High (>200)'],
        datasets: [{
            label: 'Applications',
            data: [competition.low, competition.medium, competition.high],
            backgroundColor: ['#34d399', '#60a5fa', '#f472b6'],
            borderRadius: 6,
            barThickness: 40,
        }]
    };

    // 3. Sankey Data Construction (Now with Embedded Numbers)

    // Create labels with numbers embedded (e.g. "Waiting (9)")
    const lblTotal = `Total Applications (${overview.total})`;
    const lblActive = `Active Pipeline (${activePipeline})`;
    const lblDead = `Dead Ends (${deadEnds})`;

    const lblWaiting = `Waiting (${overview.waiting})`;
    const lblReviewing = `Reviewing (${overview.reviewing})`;
    const lblClosed = `Closed (${overview.closed})`;
    const lblRefused = `Refused (${overview.refused})`;

    const sankeyData = [
        ["From", "To", "Weight"],
        // Level 1: Total -> Status Groups
        [lblTotal, lblActive, activePipeline > 0 ? activePipeline : 0.001],
        [lblTotal, lblDead, deadEnds > 0 ? deadEnds : 0.001],

        // Level 2: Active -> Specific States
        [lblActive, lblWaiting, overview.waiting > 0 ? overview.waiting : 0.001],
        [lblActive, lblReviewing, overview.reviewing > 0 ? overview.reviewing : 0.001],

        // Level 2: Dead -> Specific States
        [lblDead, lblClosed, overview.closed > 0 ? overview.closed : 0.001],
        [lblDead, lblRefused, overview.refused > 0 ? overview.refused : 0.001],
    ];

    // Filter out 0 weight links to prevent chart errors, but keep the header
    const filteredSankeyData = [sankeyData[0], ...sankeyData.slice(1).filter(row => row[2] > 0.002)];

    const sankeyOptions = {
        sankey: {
            node: {
                colors: [
                    "#3b82f6", // Total (Blue)
                    "#10b981", // Active (Emerald)
                    "#6b7280", // Dead (Gray)
                    "#fbbf24", // Waiting (Amber)
                    "#a855f7", // Reviewing (Purple)
                    "#374151", // Closed (Dark Gray)
                    "#ef4444"  // Refused (Red)
                ],
                label: {
                    fontName: 'Inter', // Cleaner font
                    fontSize: 13,
                    color: '#e5e7eb', // Light gray text for readability
                    bold: false
                },
                nodePadding: 30, // More space between nodes
                width: 6,
            },
            link: {
                colorMode: 'gradient',
                colors: [
                    "#3b82f6", // Blue
                    "#6b7280", // Gray
                    "#fbbf24", // Amber
                    "#a855f7", // Purple
                    "#374151", // Dark Gray
                    "#ef4444"  // Red
                ]
            }
        },
        backgroundColor: "transparent",
        tooltip: { isHtml: true, textStyle: { color: '#000000' } }
    };

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#111827',
                titleColor: '#f3f4f6',
                bodyColor: '#d1d5db',
                padding: 12,
                cornerRadius: 8,
                displayColors: true,
            }
        }
    };

    const barOptions = {
        ...commonOptions,
        scales: {
            y: { beginAtZero: true, display: false },
            x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } }
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
                        <h3 className="text-lg font-bold text-white leading-none">Insight Analytics</h3>
                        <p className="text-xs text-gray-400 mt-1">Deep dive into application states for <span className="text-purple-400 font-medium capitalize">{timeRange.replace(/_/g, ' ')}</span></p>
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
                <StatCard
                    title="Active Eyes"
                    value={overview.reviewing}
                    icon={Eye}
                    color="purple"
                    iconColor="text-purple-400"
                    subtext={`${reviewRate}% of total apps`}
                />
                <StatCard
                    title="Total Active"
                    value={activePipeline}
                    icon={CheckCircle}
                    color="yellow"
                    iconColor="text-yellow-400"
                    subtext="Waiting + Reviewing"
                />
                <StatCard
                    title="Dead Ends"
                    value={deadEnds}
                    icon={Ban}
                    color="gray"
                    iconColor="text-gray-400"
                    subtext="Closed or Refused"
                />
                <StatCard
                    title="Avg Applicants"
                    value={competition.avg_applicants}
                    icon={Users}
                    color="blue"
                    iconColor="text-blue-400"
                    subtext="Candidates per role"
                />
            </div>

            {/* --- Charts Section --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-80">

                {/* 1. Status Donut with Detailed Legend */}
                <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-700/50 flex flex-col shadow-lg">
                    <div className="flex justify-between items-center mb-4 h-8">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gray-700/50 rounded-md text-gray-400"><PieChart size={14}/></div>
                            <h4 className="font-bold text-white text-sm">Application Status</h4>
                        </div>
                        <div className="text-xs text-gray-500 font-mono bg-gray-900/50 px-2 py-1 rounded border border-gray-700/30">
                            Total: {overview.total}
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-between gap-2 min-h-0">
                        {/* Chart */}
                        <div className="relative w-1/2 h-full flex justify-center items-center">
                            <Doughnut data={statusData} options={{ ...commonOptions, cutout: '65%' }} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-2xl font-black text-purple-400">{overview.reviewing}</span>
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Reviewing</span>
                            </div>
                        </div>

                        {/* Custom Legend */}
                        <div className="w-1/2 flex flex-col justify-center space-y-3 pr-2 text-sm">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]"></span><span className="text-gray-300">Reviewing</span></div>
                                <span className="font-bold text-white">{overview.reviewing}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span><span className="text-gray-300">Waiting</span></div>
                                <span className="font-bold text-white">{overview.waiting}</span>
                            </div>
                            <div className="w-full h-px bg-gray-700/50 my-1"></div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-gray-600"></span><span className="text-gray-400">Closed</span></div>
                                <span className="font-bold text-gray-400">{overview.closed}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-400"></span><span className="text-gray-400">Refused</span></div>
                                <span className="font-bold text-gray-400">{overview.refused}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Competition Bar */}
                <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-700/50 flex flex-col shadow-lg">
                    <div className="flex justify-between items-center mb-4 h-8">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gray-700/50 rounded-md text-gray-400"><BarChart3 size={14}/></div>
                            <h4 className="font-bold text-white text-sm">Market Competition</h4>
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

            {/* --- 3. SANKEY DIAGRAM (NOW WITH NUMBERS) --- */}
            {overview.total > 0 && (
                <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-700/50 shadow-lg min-h-[400px] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gray-700/50 rounded-md text-gray-400"><GitMerge size={14}/></div>
                            <h4 className="font-bold text-white text-sm">Application Flow</h4>
                        </div>
                    </div>
                    <div className="flex-1 w-full h-full min-h-[350px]">
                        <Chart
                            chartType="Sankey"
                            width="100%"
                            height="100%"
                            data={filteredSankeyData}
                            options={sankeyOptions}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardInsights;