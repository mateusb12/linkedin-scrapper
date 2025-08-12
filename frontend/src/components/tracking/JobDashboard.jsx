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
import { RefreshCcw, Settings, Lock, Unlock } from 'lucide-react';
import { fetchAppliedJobs } from '../../services/jobService.js';
import { getLinkedinCookie, updateLinkedinCookie } from '../../services/fetchLinkedinService.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// --- START: Skeleton Components ---
// These components are used as placeholders while data is loading or refreshing.
// They use TailwindCSS's `animate-pulse` for a smooth loading effect.

const DashboardHeaderSkeleton = () => (
    <div className="mb-6 animate-pulse">
        <div className="h-9 bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="flex items-center gap-4">
            <div className="h-10 bg-gray-700 rounded-lg w-40"></div>
            <div className="h-10 w-10 bg-gray-700 rounded-lg"></div>
            <div className="h-10 w-10 bg-gray-700 rounded-lg"></div>
        </div>
    </div>
);

const ChartSkeleton = () => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg animate-pulse">
        <div className="flex justify-between items-center mb-4">
            <div className="h-6 bg-gray-700 rounded w-1/3"></div>
            <div className="h-9 bg-gray-700 rounded w-24"></div>
        </div>
        <div className="h-80 bg-gray-700 rounded-lg"></div>
    </div>
);

const TableSkeleton = ({ rows = 5 }) => (
    <div className="mt-6 bg-gray-800 p-6 rounded-lg shadow-lg animate-pulse">
        <div className="h-7 bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700/50">
                <tr>
                    <th scope="col" className="px-6 py-3"><div className="h-4 bg-gray-600 rounded w-3/4"></div></th>
                    <th scope="col" className="px-6 py-3"><div className="h-4 bg-gray-600 rounded w-1/2"></div></th>
                    <th scope="col" className="px-6 py-3"><div className="h-4 bg-gray-600 rounded w-5/6"></div></th>
                    <th scope="col" className="px-6 py-3"><div className="h-4 bg-gray-600 rounded w-2/3"></div></th>
                </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                {Array.from({ length: rows }).map((_, index) => (
                    <tr key={index}>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-700 rounded"></div></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-700 rounded w-1/2"></div></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-700 rounded w-5/6"></div></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-700 rounded w-2/3"></div></td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    </div>
);
// --- END: Skeleton Components ---

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

// Format date and time for the table
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

// Helper to filter jobs by a date range
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{formatPtDateTime(job.appliedAt)}</td>
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

// --- COOKIE SETTINGS COMPONENT ---
const CookieSettings = ({ onClose, onSaveSuccess }) => {
    const [cookieData, setCookieData] = React.useState('');
    const [isLocked, setIsLocked] = React.useState(true);
    const [isLoading, setIsLoading] = React.useState(true);
    const [statusMessage, setStatusMessage] = React.useState('');

    const identifier = 'LinkedIn_Saved_Jobs_Scraper';

    React.useEffect(() => {
        const fetchCookie = async () => {
            setIsLoading(true);
            setStatusMessage('Fetching cookie...');
            try {
                const currentCookie = await getLinkedinCookie(identifier);
                setCookieData(currentCookie || '');
                setStatusMessage('Cookie loaded successfully. Unlock to edit.');
            } catch (error) {
                const errorMessage = error.response?.data?.error || error.message;
                setStatusMessage(`Error fetching cookie: ${errorMessage}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCookie();
    }, []);

    const handleSave = async () => {
        setStatusMessage('Saving...');
        try {
            const response = await updateLinkedinCookie(identifier, cookieData);
            setStatusMessage(`✅ ${response.message}`);
            setIsLocked(true);
            onSaveSuccess();
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.message;
            setStatusMessage(`❌ Save failed: ${errorMessage}`);
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mt-6 mb-6 transition-all duration-300">
            <h3 className="text-xl font-semibold text-white">LinkedIn Scraper Configuration</h3>
            <h2><i>Network Filter</i></h2>
            <h2 className="mb-4 text-red-500">SEARCH_MY_ITEMS_JOB_SEEKER</h2>
            <div className="mb-4">
                <label htmlFor="cookie-data" className="block text-sm font-medium text-gray-300 mb-2">
                    li_at Cookie
                </label>
                <div className="relative">
                    <textarea
                        id="cookie-data"
                        value={isLoading ? 'Loading...' : cookieData}
                        onChange={(e) => setCookieData(e.target.value)}
                        readOnly={isLocked}
                        className={`w-full p-2.5 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors duration-200 ${isLocked ? 'cursor-not-allowed bg-gray-600/50' : 'bg-gray-700'}`}
                        rows="4"
                        placeholder="Paste your LinkedIn 'li_at' cookie value here..."
                    />
                    <button
                        onClick={() => setIsLocked(!isLocked)}
                        className="absolute top-2.5 right-2.5 p-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-white transition-colors"
                        title={isLocked ? 'Unlock to Edit' : 'Lock Field'}
                    >
                        {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                    </button>
                </div>
                {statusMessage && (
                    <p className="mt-2 text-sm text-gray-400">{statusMessage}</p>
                )}
            </div>
            <div className="flex justify-end gap-4">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg shadow transition-colors"
                >
                    Close
                </button>
                <button
                    onClick={handleSave}
                    disabled={isLocked || isLoading}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow transition-colors disabled:bg-amber-800 disabled:cursor-not-allowed"
                >
                    Save & Refresh Data
                </button>
            </div>
        </div>
    );
};


// --- REFACTORED Main Dashboard Component ---
export const JobDashboard = () => {
    const [timePeriod, setTimePeriod] = React.useState('daily');
    const [dateRange, setDateRange] = React.useState('all');
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

    const { data: jobs, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['appliedJobs'],
        queryFn: fetchAppliedJobs,
        staleTime: 5 * 60 * 1000,
        retry: false
    });

    const filteredJobs = filterJobsByDateRange(jobs, dateRange);
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

    // --- START: Skeleton Loading State ---
    // On initial load (`isLoading`), show a full-page skeleton.
    if (isLoading) {
        return (
            <div className="p-6 bg-gray-900 text-gray-200">
                <DashboardHeaderSkeleton />
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3">
                        <ChartSkeleton />
                    </div>
                    <div className="lg:col-span-2">
                        <ChartSkeleton />
                    </div>
                </div>
                <TableSkeleton />
            </div>
        );
    }
    // --- END: Skeleton Loading State ---

    if (isError) return <div className="text-red-500 p-8">Error: {error.message} 😞</div>;

    // A fallback for the case where there's no error but also no data.
    if (!jobs) return <div className="text-gray-400 p-8">No application data found.</div>;

    return (
        <div className="p-6 bg-gray-900 text-gray-200">
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-4">Job Application Dashboard</h2>
                <div className="flex items-center gap-4">
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
                        className="h-10 w-10 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow transition disabled:bg-amber-800 disabled:cursor-not-allowed flex items-center justify-center"
                        title="Refresh data"
                    >
                        <RefreshCcw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="h-10 w-10 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow transition flex items-center justify-center"
                        title="Open settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {isSettingsOpen && <CookieSettings onClose={() => setIsSettingsOpen(false)} onSaveSuccess={refetch} />}

            {/* --- START: Content with Fetching Skeletons --- */}
            {/* When refetching (`isFetching`), show skeletons for charts and table. */}
            {isFetching ? (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-3"><ChartSkeleton /></div>
                        <div className="lg:col-span-2"><ChartSkeleton /></div>
                    </div>
                    <TableSkeleton />
                </>
            ) : (
                <>
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

                    {/* Data Table Section */}
                    <JobsTable jobs={filteredJobs} />
                </>
            )}
            {/* --- END: Content with Fetching Skeletons --- */}
        </div>
    );
};