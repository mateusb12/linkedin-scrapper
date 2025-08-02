import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';
import { fetchAppliedJobs } from '../../services/jobService.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// Theme colors
const themeColors = {
    textPrimary: '#e5e7eb',
    textSecondary: '#9ca3af',
    amber: '#d97706',
    purple: '#7e22ce',
    emerald: '#10b981',
};

// Format date like "1/ago/2025"
const formatPtDate = (isoDateStr) => {
    // Force local date interpretation from yyyy-mm-dd (avoid timezone shift)
    const [year, month, day] = isoDateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // this is local time now
    const dayNum = date.getDate();
    const monthStr = date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toLowerCase();
    const yearNum = date.getFullYear();
    return `${dayNum}/${monthStr}/${yearNum}`;
};

// Chart data processor
const processChartData = (jobs) => {
    // Count applications per raw date
    const appsPerDayRaw = jobs.reduce((acc, job) => {
        const rawDate = new Date(job.appliedAt);
        const dateKey = rawDate.toISOString().split('T')[0]; // yyyy-mm-dd
        acc[dateKey] = (acc[dateKey] || 0) + 1;
        return acc;
    }, {});

    const sortedDateKeys = Object.keys(appsPerDayRaw).sort((a, b) => new Date(a) - new Date(b));
    const formattedLabels = sortedDateKeys.map(key => formatPtDate(key));
    const applicationsCount = sortedDateKeys.map(key => appsPerDayRaw[key]);

    // Count applications by source
    const appsBySource = jobs.reduce((acc, job) => {
        acc[job.source] = (acc[job.source] || 0) + 1;
        return acc;
    }, {});

    const sourceLabels = Object.keys(appsBySource);
    const sourceData = Object.values(appsBySource);

    const doughnutColors = sourceLabels.map(label => {
        if (label.toLowerCase() === 'linkedin') return themeColors.purple;
        if (label.toLowerCase() === 'huntr') return themeColors.emerald;
        return themeColors.textSecondary;
    });

    return {
        barData: {
            labels: formattedLabels,
            datasets: [{
                label: 'Applications per Day',
                data: applicationsCount,
                backgroundColor: 'rgba(217, 119, 6, 0.6)',
                borderColor: themeColors.amber,
                borderWidth: 1,
            }],
        },
        doughnutData: {
            labels: sourceLabels,
            datasets: [{
                data: sourceData,
                backgroundColor: doughnutColors.map(c => `${c}B3`),
                borderColor: doughnutColors,
                borderWidth: 1,
            }],
        },
    };
};

// Main dashboard component
export const JobDashboard = () => {
    const {
        data: jobs,
        isLoading,
        isError,
        error,
        refetch,
        isFetching
    } = useQuery({
        queryKey: ['appliedJobs'],
        queryFn: fetchAppliedJobs,
        staleTime: 1000 * 60 * 5,
    });

    const chartData = jobs ? processChartData(jobs) : null;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: themeColors.textPrimary,
                    font: { size: 14 },
                },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: { color: themeColors.textSecondary },
                grid: { color: 'rgba(156, 163, 175, 0.2)' },
            },
            x: {
                ticks: { color: themeColors.textSecondary },
                grid: { color: 'rgba(156, 163, 175, 0.1)' },
            },
        },
    };

    if (isLoading) return <div className="text-gray-300 p-8">Loading dashboard... ⏳</div>;
    if (isError) return <div className="text-red-500 p-8">Error: {error.message} 😞</div>;
    if (!chartData) return <div className="text-gray-400 p-8">No application data found.</div>;

    return (
        <div className="p-6 bg-gray-900 text-gray-200">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-white">Job Application Dashboard</h2>
                <button
                    onClick={() => refetch()}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded shadow transition"
                >
                    {isFetching ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Bar Chart Section */}
                <div className="lg:col-span-3 bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-semibold text-white mb-4">Applications per Day</h3>
                    <div className="relative h-80">
                        <Bar data={chartData.barData} options={chartOptions} />
                    </div>
                </div>

                {/* Doughnut Chart Section */}
                <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-semibold text-white mb-4">Applications by Source</h3>
                    <div className="relative h-80">
                        <Doughnut data={chartData.doughnutData} options={{ ...chartOptions, scales: {} }} />
                    </div>
                </div>
            </div>
        </div>
    );
};
