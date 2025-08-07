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
    if (!isoDateStr) return 'N/A';
    const date = new Date(isoDateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    const dayNum = date.getUTCDate();
    const month = date.getUTCMonth();
    const yearNum = date.getUTCFullYear();
    const monthDate = new Date(Date.UTC(yearNum, month, 1));
    const monthStr = monthDate.toLocaleString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '').toLowerCase();
    return `${dayNum} ${monthStr} ${yearNum}`;
};

// START OF CHANGES
// NEW: Format date and time for the table
const formatPtDateTime = (isoDateStr) => {
    if (!isoDateStr) return 'N/A';
    const date = new Date(isoDateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';

    const day = String(date.getUTCDate()).padStart(2, '0');
    const year = date.getUTCFullYear();

    const monthDate = new Date(Date.UTC(year, date.getUTCMonth(), 1));
    const month = monthDate.toLocaleString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '').toLowerCase();

    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
};
// END OF CHANGES


// --- DATE HELPERS ---
const toYYYYMMDD = (date) => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getWeekStartDate = (date) => {
    const d = new Date(date);
    const dayOfWeek = d.getUTCDay();
    const diff = d.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
    return weekStart;
};

const getMonthStartDate = (date) => {
    const d = new Date(date);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

// NEW: Helper to filter jobs by a date range
const filterJobsByDateRange = (jobs, range) => {
    if (!jobs || range === 'all') {
        return jobs;
    }

    const now = new Date();
    // Use UTC for all date calculations to be consistent with other helpers
    const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    let startDateUtc;

    switch (range) {
        case 'this_week':
            startDateUtc = getWeekStartDate(nowUtc);
            break;
        case 'last_2_weeks':
            startDateUtc = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() - 14));
            break;
        case 'last_month':
             startDateUtc = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() - 1, nowUtc.getUTCDate()));
            break;
        case 'last_6_months':
            startDateUtc = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() - 6, nowUtc.getUTCDate()));
            break;
        case 'last_year':
            startDateUtc = new Date(Date.UTC(nowUtc.getUTCFullYear() - 1, nowUtc.getUTCMonth(), nowUtc.getUTCDate()));
            break;
        default:
            return jobs;
    }

    return jobs.filter(job => {
        const appliedDate = new Date(job.appliedAt);
        return appliedDate >= startDateUtc;
    });
};
// --- END DATE HELPERS ---


// Chart data processor
const processChartData = (jobs, timePeriod = 'daily') => {
    if (!jobs || jobs.length === 0) {
        return {
            barData: { labels: [], datasets: [] },
            doughnutData: { labels: [], datasets: [{ data: [] }] }
        };
    }

    const appsBySource = jobs.reduce((acc, job) => {
        acc[job.source] = (acc[job.source] || 0) + 1;
        return acc;
    }, {});

    const sourceLabels = Object.keys(appsBySource);

    const appsPerPeriodBySource = jobs.reduce((acc, job) => {
        const appliedDate = new Date(job.appliedAt);
        let periodKey;

        if (timePeriod === 'weekly') {
            periodKey = toYYYYMMDD(getWeekStartDate(appliedDate));
        } else if (timePeriod === 'monthly') {
            periodKey = toYYYYMMDD(getMonthStartDate(appliedDate));
        } else {
            periodKey = toYYYYMMDD(appliedDate);
        }

        if (!acc[periodKey]) {
            acc[periodKey] = {};
        }
        sourceLabels.forEach(source => {
            if (!acc[periodKey][source]) {
                acc[periodKey][source] = 0;
            }
        });
        acc[periodKey][job.source]++;
        return acc;
    }, {});

    const sortedPeriodKeys = Object.keys(appsPerPeriodBySource).sort((a, b) => new Date(a) - new Date(b));

    const formattedLabels = sortedPeriodKeys.map(key => {
        const [year, month, day] = key.split('-').map(Number);
        const utcDate = new Date(Date.UTC(year, month - 1, day));
        if (timePeriod === 'weekly') {
            const dayNum = utcDate.getUTCDate();
            const monthStr = utcDate.toLocaleString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
            return `Semana de ${dayNum} ${monthStr}`;
        }
        if (timePeriod === 'monthly') {
            const monthStr = utcDate.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
            return `${monthStr.charAt(0).toUpperCase() + monthStr.slice(1)} de ${year}`;
        }
        return formatPtDate(utcDate.toISOString());
    });

    const sourceBarColors = {
        'LinkedIn': 'rgba(126, 34, 206, 0.75)',
        'Huntr': 'rgba(16, 185, 129, 0.75)',
        'SQL': 'rgba(156, 163, 175, 0.75)',
    };
    const defaultBarColor = 'rgba(107, 114, 128, 0.75)';

    const barDatasets = sourceLabels.map(source => ({
        label: source,
        data: sortedPeriodKeys.map(date => appsPerPeriodBySource[date][source] || 0),
        backgroundColor: sourceBarColors[source] || defaultBarColor,
        borderRadius: 5,
    }));

    const sourceData = Object.values(appsBySource);
    const doughnutColors = sourceLabels.map(label => {
        if (label.toLowerCase() === 'linkedin') return themeColors.purple;
        if (label.toLowerCase() === 'huntr') return themeColors.emerald;
        if (label.toLowerCase() === 'sql') return themeColors.textSecondary;
        return themeColors.textSecondary;
    });

    return {
        barData: {
            labels: formattedLabels,
            datasets: barDatasets,
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

// --- COLLAPSIBLE TABLE COMPONENT ---
const JobsTable = ({ jobs }) => {
    const [isOpen, setIsOpen] = React.useState(true);

    if (!jobs || jobs.length === 0) {
        return (
            <div className="mt-6 bg-gray-800 p-6 rounded-lg shadow-lg text-center text-gray-400">
                No application data for the selected period.
            </div>
        );
    }

    return (
        <div className="mt-6 bg-gray-800 p-6 rounded-lg shadow-lg">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-xl font-semibold text-white mb-4 focus:outline-none"
            >
                <span>Raw Application Data ({jobs.length})</span>
                <svg
                    className={`w-6 h-6 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>

            {isOpen && (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Applied At</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Source</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Title</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Company</th>
                        </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {jobs.map((job) => (
                            <tr key={job.urn} className="hover:bg-gray-700/50">
                                {/* START OF CHANGES */}
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{formatPtDateTime(job.appliedAt)}</td>
                                {/* END OF CHANGES */}
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{job.source}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{job.title}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                    {job.company && typeof job.company === 'object' ? job.company.name : job.company}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};


// Main dashboard component
export const JobDashboard = () => {
    const [timePeriod, setTimePeriod] = React.useState('daily');
    const [dateRange, setDateRange] = React.useState('all'); // NEW state for the date range filter

    const { data: jobs, isLoading, isError, error, refetch, isFetching } = useQuery({
      queryKey: ['appliedJobs'],
      queryFn: fetchAppliedJobs,
      staleTime: 5 * 60 * 1000,
      retry: false
    });

    // NEW: Filter jobs based on the selected date range before processing
    const filteredJobs = filterJobsByDateRange(jobs, dateRange);

    // Use the filtered jobs for chart processing
    const chartData = (filteredJobs && Array.isArray(filteredJobs)) ? processChartData(filteredJobs, timePeriod) : null;

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { color: themeColors.textPrimary, font: { size: 14 } } },
        },
        scales: {
            y: {
                stacked: true,
                beginAtZero: true,
                ticks: { color: themeColors.textSecondary, stepSize: 1 },
                grid: { color: 'rgba(156, 163, 175, 0.2)' },
            },
            x: {
                stacked: true,
                ticks: { color: themeColors.textSecondary },
                grid: { color: 'rgba(156, 163, 175, 0.1)' },
            },
        },
    };

    const doughnutChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { color: themeColors.textPrimary, font: { size: 14 } } },
        },
    };

    const barChartTitle = `Applications per ${
        { daily: 'Day', weekly: 'Week', monthly: 'Month' }[timePeriod]
    }`;

    if (isLoading) return <div className="text-gray-300 p-8">Loading dashboard... ⏳</div>;
    if (isError) return <div className="text-red-500 p-8">Error: {error.message} 😞</div>;
    if (!jobs) return <div className="text-gray-400 p-8">No application data found.</div>;

    return (
        <div className="p-6 bg-gray-900 text-gray-200">
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-4">Job Application Dashboard</h2>
                <div className="flex items-center gap-4">
                    {/* Date Range Dropdown */}
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block p-2.5"
                    >
                        <option value="all">All Time</option>
                        <option value="this_week">This Week</option>
                        <option value="last_2_weeks">Last 2 Weeks</option>
                        <option value="last_month">Last Month</option>
                        <option value="last_6_months">Last 6 Months</option>
                        <option value="last_year">Last Year</option>
                    </select>
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded shadow transition disabled:bg-amber-800 disabled:cursor-not-allowed"
                    >
                        {isFetching ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Bar Chart Section */}
                <div className="lg:col-span-3 bg-gray-800 p-6 rounded-lg shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-white">{barChartTitle}</h3>
                        <select
                            value={timePeriod}
                            onChange={(e) => setTimePeriod(e.target.value)}
                            className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block p-2.5"
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                    <div className="relative h-80">
                        {chartData && <Bar data={chartData.barData} options={barChartOptions} />}
                    </div>
                </div>

                {/* Doughnut Chart Section */}
                <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-semibold text-white mb-4">Applications by Source</h3>
                    <div className="relative h-80">
                        {chartData && <Doughnut data={chartData.doughnutData} options={doughnutChartOptions} />}
                    </div>
                </div>
            </div>

            {/* Data Table Section - now uses filteredJobs */}
            <JobsTable jobs={filteredJobs} />
        </div>
    );
};