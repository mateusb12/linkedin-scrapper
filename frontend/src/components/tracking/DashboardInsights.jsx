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
import { TrendingUp, Users, AlertTriangle, CheckCircle } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const StatCard = ({ title, value, subtext, icon: Icon, color }) => (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex items-center gap-4">
        <div className={`p-3 rounded-lg bg-${color}-900/20 text-${color}-400`}>
            <Icon size={24} />
        </div>
        <div>
            <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">{title}</p>
            <h3 className="text-2xl font-bold text-white">{value}</h3>
            {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
    </div>
);

const DashboardInsights = ({ insights }) => {
    if (!insights) return <div className="text-gray-400 p-10">Loading insights...</div>;

    const { overview, competition } = insights;

    // --- CHART DATA CONFIG ---

    // 1. Status Doughnut (Waiting vs Refused)
    const statusData = {
        labels: ['Waiting', 'Refused'],
        datasets: [{
            data: [overview.waiting, overview.refused],
            backgroundColor: ['#eab308', '#ef4444'], // Yellow-500, Red-500
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    // 2. Competition Bar Chart
    const competitionData = {
        labels: ['Low (<50)', 'Medium (50-200)', 'High (>200)'],
        datasets: [{
            label: 'Applications',
            data: [competition.low, competition.medium, competition.high],
            backgroundColor: ['#10b981', '#3b82f6', '#f97316'], // Green, Blue, Orange
            borderRadius: 6,
        }]
    };

    const barOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1f2937',
                padding: 12,
                titleColor: '#f3f4f6',
                bodyColor: '#d1d5db'
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: '#374151' },
                ticks: { color: '#9ca3af' }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#9ca3af' }
            }
        }
    };

    return (
        <div className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Top Row: Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Applied"
                    value={overview.total}
                    icon={TrendingUp}
                    color="blue"
                />
                <StatCard
                    title="Refusal Rate"
                    value={`${overview.refusal_rate}%`}
                    subtext={`${overview.refused} rejections found`}
                    icon={AlertTriangle}
                    color="red"
                />
                <StatCard
                    title="Avg Applicants"
                    value={competition.avg_applicants}
                    subtext="Competition per job"
                    icon={Users}
                    color="orange"
                />
                <StatCard
                    title="Active Pipeline"
                    value={overview.waiting}
                    subtext="Waiting for response"
                    icon={CheckCircle}
                    color="yellow"
                />
            </div>

            {/* Middle Row: Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">

                {/* Status Distribution */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-4">Application Outcomes</h3>
                    <div className="flex-1 relative flex justify-center items-center">
                        <div className="w-64 h-64">
                            <Doughnut
                                data={statusData}
                                options={{
                                    cutout: '70%',
                                    plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af' } } }
                                }}
                            />
                        </div>
                        {/* Center Text Overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-6">
                            <span className="text-3xl font-bold text-white">{overview.total}</span>
                            <span className="text-xs text-gray-500 uppercase">Total</span>
                        </div>
                    </div>
                </div>

                {/* Competition Distribution */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-2">Competition Levels</h3>
                    <p className="text-sm text-gray-400 mb-6">Are you applying to overcrowded roles?</p>
                    <div className="flex-1">
                        <Bar data={competitionData} options={barOptions} />
                    </div>
                    <div className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                        <p className="text-xs text-gray-400">
                            <span className="text-orange-400 font-bold">Insight:</span> Your refusal rate on High Competition (>200 applicants) jobs is <span className="text-white font-bold">{competition.high_comp_refusal_rate}%</span>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardInsights;