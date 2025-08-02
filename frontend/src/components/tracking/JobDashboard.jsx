// frontend/src/components/JobDashboard.jsx
import React, { useState, useEffect } from 'react';
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
import {fetchAppliedJobs} from "../../services/jobService.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement
);

// 1. ✨ Define theme colors based on your userProfile.jsx palette
const themeColors = {
    textPrimary: '#e5e7eb',      // from text-gray-200
    textSecondary: '#9ca3af',    // from text-gray-400
    amber: '#d97706',           // from action.success (amber-600)
    purple: '#7e22ce',          // from action.markdown (purple-700)
    emerald: '#10b981',         // from border.focus (emerald-500)
};

// 2. ✨ Update data processing to use the new theme colors
const processChartData = (jobs) => {
    // Process for Applications per Day (Bar Chart)
    const appsPerDay = jobs.reduce((acc, job) => {
        const date = new Date(job.appliedAt).toLocaleDateString('en-CA');
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {});

    const sortedDates = Object.keys(appsPerDay).sort((a, b) => new Date(a) - new Date(b));
    const applicationsCount = sortedDates.map(date => appsPerDay[date]);

    // Process for Applications by Source (Doughnut Chart)
    const appsBySource = jobs.reduce((acc, job) => {
        acc[job.source] = (acc[job.source] || 0) + 1;
        return acc;
    }, {});

    const sourceLabels = Object.keys(appsBySource);
    const sourceData = Object.values(appsBySource);

    // Assign colors dynamically based on source name
    const doughnutColors = sourceLabels.map(label => {
        if (label.toLowerCase() === 'linkedin') return themeColors.purple;
        if (label.toLowerCase() === 'huntr') return themeColors.emerald;
        return themeColors.textSecondary; // Fallback
    });

    return {
        barData: {
            labels: sortedDates,
            datasets: [{
                label: 'Applications per Day',
                data: applicationsCount,
                backgroundColor: 'rgba(217, 119, 6, 0.6)', // amber with opacity
                borderColor: themeColors.amber,
                borderWidth: 1,
            }],
        },
        doughnutData: {
            labels: sourceLabels,
            datasets: [{
                data: sourceData,
                backgroundColor: doughnutColors.map(c => `${c}B3`), // Add alpha for background
                borderColor: doughnutColors,
                borderWidth: 1,
            }],
        },
    };
};

// 3. ✨ Update the main component with new options and styling
export const JobDashboard = () => {
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- CHART OPTIONS ---
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: themeColors.textPrimary, // Legend text color
                    font: { size: 14 }
                }
            },
        },
        scales: { // Only applies to Bar chart, ignored by Doughnut
            y: {
                beginAtZero: true,
                ticks: { color: themeColors.textSecondary },
                grid: { color: 'rgba(156, 163, 175, 0.2)' } // Grid line color
            },
            x: {
                ticks: { color: themeColors.textSecondary },
                grid: { color: 'rgba(156, 163, 175, 0.1)' } // Grid line color
            }
        }
    };

    useEffect(() => {
        const loadJobs = async () => {
            try {
                setLoading(true);
                const jobs = await fetchAppliedJobs();
                if (jobs && jobs.length > 0) {
                    setChartData(processChartData(jobs));
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadJobs();
    }, []);

    if (loading) return <div className="text-gray-300 p-8">Loading dashboard... ⏳</div>;
    if (error) return <div className="text-red-500 p-8">Error: {error} 😞</div>;
    if (!chartData) return <div className="text-gray-400 p-8">No application data found.</div>;

    return (
        // Use consistent styling from your palette
        <div className="p-6 bg-gray-900 text-gray-200">
            <h2 className="text-3xl font-bold text-white mb-6">Job Application Dashboard</h2>
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
                        <Doughnut data={chartData.doughnutData} options={{...chartOptions, scales: {}}} />
                    </div>
                </div>
            </div>
        </div>
    );
};