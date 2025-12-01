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
import { RefreshCcw, Settings, Lock, Unlock, ExternalLink, HelpCircle, Terminal } from 'lucide-react';
import { fetchAppliedJobs } from '../../services/jobService.js';
// --- CHANGED: Imported the new service function ---
import { updateScraperConfig } from '../../services/fetchLinkedinService.js';

// --- ADDED: Import the reusable CopyableCodeBlock ---
import { CopyableCodeBlock } from '../data-fetching/CopyableCodeBlock.jsx';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// --- START: Skeleton Components ---
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

// ... [Keep existing Date Helpers and Formatting functions exactly as they were] ...
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

// --- REDESIGNED SETTINGS COMPONENT: FULL CURL IMPORTER ---
const ScraperSettings = ({ onClose, onSaveSuccess }) => {
    const [curlData, setCurlData] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [statusMessage, setStatusMessage] = React.useState('');

    const handleSave = async () => {
        if (!curlData.trim()) return;
        setIsSaving(true);
        setStatusMessage('Parsing & Saving...');
        try {
            const response = await updateScraperConfig(curlData);
            setStatusMessage(`✅ Success! ${response.message || 'Updated.'}`);
            setTimeout(() => {
                onSaveSuccess();
                onClose();
            }, 1000);
        } catch (error) {
            setStatusMessage(`❌ Error: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mt-6 mb-6 border border-gray-700">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Terminal size={20} className="text-purple-400" />
                        Update LinkedIn Credentials
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">
                        Paste a fresh cURL command to refresh your session cookies and tokens.
                    </p>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
            </div>

            {/* --- INSTRUCTION STEPS --- */}
            <div className="bg-gray-900/50 p-4 rounded-lg mb-6 text-sm text-gray-300 space-y-3 border border-gray-700">
                <div className="flex items-start gap-3">
                    <div className="bg-purple-900/50 text-purple-300 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold border border-purple-700">1</div>
                    <p>
                        Go to <a href="https://www.linkedin.com/my-items/saved-jobs/?cardType=APPLIED" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center inline-flex gap-1">LinkedIn Applied Jobs <ExternalLink size={12} /></a>.
                    </p>
                </div>
                <div className="flex items-start gap-3">
                    <div className="bg-purple-900/50 text-purple-300 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold border border-purple-700">2</div>
                    <p>Open <b>Developer Tools</b> (F12) → <b>Network</b> tab.</p>
                </div>
                <div className="flex items-start gap-3">
                    <div className="bg-purple-900/50 text-purple-300 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold border border-purple-700">3</div>
                    <div>
                        <p className="mb-1">Filter for the request matching the keyword below:</p>
                        <CopyableCodeBlock text="SEARCH_MY_ITEMS_JOB_SEEKER" />
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <div className="bg-purple-900/50 text-purple-300 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold border border-purple-700">4</div>
                    <p>Right-click the request → <b>Copy</b> → <b>Copy as cURL (bash)</b>.</p>
                </div>
            </div>

            {/* --- INPUT AREA --- */}
            <div className="mb-4">
                <label htmlFor="curl-input" className="block text-sm font-medium text-gray-300 mb-2">
                    Paste cURL Command
                </label>
                <textarea
                    id="curl-input"
                    value={curlData}
                    onChange={(e) => setCurlData(e.target.value)}
                    className="w-full p-3 bg-gray-900 border border-gray-600 text-green-400 font-mono text-xs rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[120px]"
                    placeholder="curl 'https://www.linkedin.com/voyager/api/graphql?variables=...' -H 'csrf-token: ...' ..."
                />
                {statusMessage && (
                    <p className={`mt-2 text-sm ${statusMessage.startsWith('✅') ? 'text-green-400' : 'text-amber-400'}`}>
                        {statusMessage}
                    </p>
                )}
            </div>

            {/* --- ACTIONS --- */}
            <div className="flex justify-end gap-3">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving || !curlData}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSaving ? <RefreshCcw size={16} className="animate-spin" /> : null}
                    Save & Refresh
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

    // ... (Chart Options remain same as before) ...
    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { color: themeColors.textPrimary, font: { size: 14 } } },
        },
        scales: {
            y: { stacked: true, beginAtZero: true, ticks: { color: themeColors.textSecondary, stepSize: 1 }, grid: { color: 'rgba(156, 163, 175, 0.2)' } },
            x: { stacked: true, ticks: { color: themeColors.textSecondary }, grid: { color: 'rgba(156, 163, 175, 0.1)' } },
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

    if (isLoading) {
        return (
            <div className="p-6 bg-gray-900 text-gray-200">
                <DashboardHeaderSkeleton />
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3"><ChartSkeleton /></div>
                    <div className="lg:col-span-2"><ChartSkeleton /></div>
                </div>
                <TableSkeleton />
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-900 text-gray-200 min-h-screen">
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-4">Job Application Dashboard</h2>

                <div className="flex flex-wrap items-center gap-4">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 shadow-sm"
                        disabled={isError}
                    >
                        <option value="all">All Time</option>
                        <option value="this_week">This Week</option>
                        <option value="last_2_weeks">Last 2 Weeks</option>
                        <option value="last_month">Last Month</option>
                        <option value="last_6_months">Last 6 Months</option>
                        <option value="last_year">Last Year</option>
                    </select>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="h-10 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-lg transition-all disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                            title="Refresh data"
                        >
                            <RefreshCcw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                            {isFetching ? 'Syncing...' : 'Sync'}
                        </button>
                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className={`h-10 w-10 text-white rounded-lg shadow-lg transition-all flex items-center justify-center border ${isSettingsOpen ? 'bg-purple-900 border-purple-500 ring-2 ring-purple-500/50' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}
                            title="Update Credentials"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* --- CONFIGURATION PANEL (Replaced) --- */}
            {isSettingsOpen && (
                <ScraperSettings
                    onClose={() => setIsSettingsOpen(false)}
                    onSaveSuccess={refetch}
                />
            )}

            <div className="mt-6">
                {isError ? (
                    <div className="bg-gray-800 border border-red-900/50 p-12 rounded-xl shadow-lg text-center">
                        <div className="bg-red-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock size={32} className="text-red-500" />
                        </div>
                        <h3 className="text-2xl text-white font-bold mb-2">Session Expired</h3>
                        <p className="text-gray-400 max-w-md mx-auto mb-6">
                            Your LinkedIn credentials have expired or are invalid. Please update your session to continue fetching data.
                        </p>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-lg transition-all flex items-center gap-2 mx-auto"
                        >
                            <Settings size={18} />
                            Update Credentials
                        </button>
                    </div>
                ) : isFetching && !jobs ? (
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
                            <div className="lg:col-span-3 bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                        {barChartTitle}
                                    </h3>
                                    <select
                                        value={timePeriod}
                                        onChange={(e) => setTimePeriod(e.target.value)}
                                        className="bg-gray-900 border border-gray-600 text-white text-xs rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2"
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

                            <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                                <h3 className="text-lg font-semibold text-white mb-6">Applications by Source</h3>
                                <div className="relative h-80 flex justify-center">
                                    {chartData && <Doughnut data={chartData.doughnutData} options={doughnutChartOptions} />}
                                </div>
                            </div>
                        </div>

                        <JobsTable jobs={filteredJobs} />
                    </>
                )}
            </div>
        </div>
    );
};