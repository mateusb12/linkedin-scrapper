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

// Format date like "1 ago 2025"
const formatPtDate = (isoDateStr) => {
    // Force local date interpretation from yyyy-mm-dd (avoid timezone shift)
    const [year, month, day] = isoDateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // this is local time now
    const dayNum = date.getDate();
    const monthStr = date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toLowerCase();
    const yearNum = date.getFullYear();
    return `${dayNum} ${monthStr} ${yearNum}`;
};

// Chart data processor
// Chart data processor
const processChartData = (jobs) => {
    // Count total applications by source (for Doughnut chart AND to get unique sources)
    const appsBySource = jobs.reduce((acc, job) => {
        acc[job.source] = (acc[job.source] || 0) + 1;
        return acc;
    }, {});

    const sourceLabels = Object.keys(appsBySource); // All unique sources: ['LinkedIn', 'Huntr', 'SQL', etc.]

    // Count applications per day, broken down by source
    const appsPerDayBySource = jobs.reduce((acc, job) => {
        const dateKey = new Date(job.appliedAt).toISOString().split('T')[0]; // yyyy-mm-dd
        if (!acc[dateKey]) {
            acc[dateKey] = {};
        }
        // Ensure all sources have a key for every date to avoid undefined issues
        sourceLabels.forEach(source => {
            if (!acc[dateKey][source]) {
                acc[dateKey][source] = 0;
            }
        });
        acc[dateKey][job.source]++;
        return acc;
    }, {});

    const sortedDateKeys = Object.keys(appsPerDayBySource).sort((a, b) => new Date(a) - new Date(b));
    const formattedLabels = sortedDateKeys.map(key => formatPtDate(key));

    // --- DYNAMIC BAR CHART DATASET CREATION ---
    // Define colors for each source
    const sourceBarColors = {
        'LinkedIn': 'rgba(126, 34, 206, 0.75)', // purple-700
        'Huntr': 'rgba(16, 185, 129, 0.75)',    // emerald-500
        'SQL': 'rgba(156, 163, 175, 0.75)',    // gray-400 for SQL, or any other color
    };
    const defaultBarColor = 'rgba(107, 114, 128, 0.75)'; // gray-500 as fallback

    // Map over the unique source labels to create a dataset for each one
    const barDatasets = sourceLabels.map(source => ({
        label: source,
        data: sortedDateKeys.map(date => appsPerDayBySource[date][source] || 0),
        backgroundColor: sourceBarColors[source] || defaultBarColor,
        borderRadius: 5,
    }));
    // --- END OF DYNAMIC CREATION ---

    // Doughnut chart data (remains the same)
    const sourceData = Object.values(appsBySource);
    const doughnutColors = sourceLabels.map(label => {
        if (label.toLowerCase() === 'linkedin') return themeColors.purple;
        if (label.toLowerCase() === 'huntr') return themeColors.emerald;
        if (label.toLowerCase() === 'sql') return themeColors.textSecondary; // Added SQL color
        return themeColors.textSecondary;
    });

    return {
        barData: {
            labels: formattedLabels,
            datasets: barDatasets, // Use the dynamically created datasets
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

    // === MODIFIED FOR STACKED BAR CHART ===
    // Options specific to the bar chart to enable stacking
    const barChartOptions = {
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
                stacked: true, // Enable stacking on the Y-axis
                beginAtZero: true,
                ticks: { color: themeColors.textSecondary },
                grid: { color: 'rgba(156, 163, 175, 0.2)' },
            },
            x: {
                stacked: true, // Enable stacking on the X-axis
                ticks: { color: themeColors.textSecondary },
                grid: { color: 'rgba(156, 163, 175, 0.1)' },
            },
        },
    };

    // Options for the doughnut chart (no scales needed)
    const doughnutChartOptions = {
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
    };
    // === END MODIFICATION ===


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
                        {/* Use the new bar chart options */}
                        <Bar data={chartData.barData} options={barChartOptions} />
                    </div>
                </div>

                {/* Doughnut Chart Section */}
                <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-semibold text-white mb-4">Applications by Source</h3>
                    <div className="relative h-80">
                         {/* Use the new doughnut chart options */}
                        <Doughnut data={chartData.doughnutData} options={doughnutChartOptions} />
                    </div>
                </div>
            </div>
        </div>
    );
};