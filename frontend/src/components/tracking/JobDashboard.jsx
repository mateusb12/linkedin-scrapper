import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Database, RefreshCcw, GitMerge, Settings, Target, Calendar as CalendarIcon, Ban, DownloadCloud, PieChart } from 'lucide-react';
import { fetchAppliedJobs, fetchJobFailures, syncEmails, syncApplicationStatus, fetchDashboardInsights, reconcileJobStatuses } from '../../services/jobService.js';

// --- FEATURE IMPORTS ---
import StreakCalendar from './StreakCalendar';
import RecentApplications from './RecentApplications';
import JobFailures from './JobFailures';
import PerformanceStats from './PerformanceStats';
import DashboardInsights from './DashboardInsights';
import { BackfillModal, ScraperSettings, JobDetailsPanel } from './DashboardModals';

// Register Chart components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const GOAL_PER_DAY = 10;
const themeColors = { linkedin: '#8b5cf6', huntr: '#10b981', sql: '#3b82f6', textPrimary: '#f3f4f6', textSecondary: '#9ca3af' };

// --- HELPER: Process Data with "Offensive Protection" Logic (Full History + n+1 Chart) ---
const processCurrentFormData = (jobs) => {
    const allDailyCounts = {};
    const getLocalYMD = (d) => {
        const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // 1. Map raw DB counts and find the earliest date
    let minDate = new Date(); // Start with today
    jobs.forEach(job => {
        if (!job.appliedAt) return;
        const d = new Date(job.appliedAt);
        if (d < minDate) minDate = d;
        const k = getLocalYMD(d);
        allDailyCounts[k] = (allDailyCounts[k] || 0) + 1;
    });

    // Determine simulation range: Earliest Job -> Tomorrow (n+1)
    const startDate = new Date(minDate);
    startDate.setDate(startDate.getDate() - 1); // Buffer day
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1); // Include Tomorrow for the chart shift

    // 2. Chronological Simulation (The "Game Logic")
    const fullHistoryStats = {}; // Stores { real, bonus, effective } for every date
    let previousDayOverflow = 0;

    // Iterate day by day from start to end (covering entire history + tomorrow)
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const key = getLocalYMD(d);
        const realCount = allDailyCounts[key] || 0;

        // A. Apply Protection from yesterday
        const currentBonus = previousDayOverflow;
        const usedProtection = currentBonus > 0;
        const effectiveCount = realCount + currentBonus;

        // Store detailed stats for the Calendar & Chart lookup
        fullHistoryStats[key] = {
            real: realCount,
            bonus: currentBonus,
            effective: effectiveCount,
            isProtected: usedProtection
        };

        // B. Calculate Carryover for TOMORROW
        // Rule: Can only generate shield if you exceeded goal using REAL apps (Cooldown logic)
        // If you used protection today, you cannot generate new protection for tomorrow.
        if (realCount > GOAL_PER_DAY && !usedProtection) {
            previousDayOverflow = Math.min(realCount - GOAL_PER_DAY, GOAL_PER_DAY);
        } else {
            previousDayOverflow = 0;
        }
    }

    // 3. Extract Chart Data (Last 7 Days + Tomorrow)
    const last7DaysLabels = [];
    const realDataValues = [];
    const bonusDataValues = [];
    const today = new Date();

    // Loop from 6 days ago -> Tomorrow (i = -1)
    for (let i = 6; i >= -1; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = getLocalYMD(d);

        // Retrieve calculated stat from simulation
        const stat = fullHistoryStats[key] || { real: 0, bonus: 0 };

        last7DaysLabels.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
        realDataValues.push(stat.real);
        bonusDataValues.push(stat.bonus);
    }

    // 4. Capture "Today's" specific stats for the Stat Cards
    const todayKey = getLocalYMD(today);
    const todayStats = fullHistoryStats[todayKey] || { real: 0, bonus: 0, effective: 0 };

    // 5. Streak Calculation (Using Effective Counts from Simulation)
    let streak = 0;
    const checkDate = new Date();
    for (let i = 0; i < 365; i++) {
        const k = getLocalYMD(checkDate);
        const stat = fullHistoryStats[k] || { effective: 0 };
        const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6;

        // Use effective count!
        if (stat.effective >= GOAL_PER_DAY) streak++;
        else if (i === 0 && stat.effective < GOAL_PER_DAY) {
            // If today isn't done, don't break streak yet (standard logic)
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
        }
        else if (!isWeekend) break;

        checkDate.setDate(checkDate.getDate() - 1);
    }

    return {
        labels: last7DaysLabels, // Includes Tomorrow
        realData: realDataValues,
        bonusData: bonusDataValues,
        todayCount: todayStats.effective, // Used for Cards
        todayReal: todayStats.real,       // Used for Cards
        streak,
        dailyStats: fullHistoryStats, // Pass this enriched map to Calendar
        allDailyCounts // Raw counts (legacy backup)
    };
};

const processHistoryData = (jobs, timePeriod) => {
    if (!jobs?.length) return { barData: null, doughnutData: null };
    const appsBySource = {}; const appsPerPeriod = {};

    jobs.forEach(job => {
        const source = job.source || 'Unknown';
        appsBySource[source] = (appsBySource[source] || 0) + 1;
        const date = new Date(job.appliedAt);
        let key = date.toISOString().split('T')[0];

        if (timePeriod === 'monthly') key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        else if (timePeriod === 'weekly') {
            const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const weekNo = Math.ceil((((d - new Date(Date.UTC(d.getUTCFullYear(),0,1))) / 86400000) + 1)/7);
            key = `${d.getUTCFullYear()}-W${weekNo}`;
        }

        if (!appsPerPeriod[key]) appsPerPeriod[key] = {};
        appsPerPeriod[key][source] = (appsPerPeriod[key][source] || 0) + 1;
    });

    const sources = Object.keys(appsBySource);
    const colors = sources.map(s => {
        if (s.toLowerCase().includes('linkedin')) return themeColors.linkedin;
        if (s.toLowerCase().includes('huntr')) return themeColors.huntr;
        return themeColors.sql;
    });

    return {
        doughnutData: {
            labels: sources,
            datasets: [{ data: Object.values(appsBySource), backgroundColor: colors, borderWidth: 0 }]
        },
        barData: {
            labels: Object.keys(appsPerPeriod).sort(),
            datasets: sources.map((source, i) => ({
                label: source,
                data: Object.keys(appsPerPeriod).sort().map(k => appsPerPeriod[k][source] || 0),
                backgroundColor: colors[i],
                stack: 'stack1'
            }))
        }
    };
};

// --- MAIN COMPONENT ---
export const JobDashboard = () => {
    const [activeTab, setActiveTab] = useState('current');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isBackfillOpen, setIsBackfillOpen] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);
    const [selectedFailure, setSelectedFailure] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // --- STATES ---
    const [page, setPage] = useState(1);
    const [failPage, setFailPage] = useState(1);
    const [historyPeriod, setHistoryPeriod] = useState('daily');
    const [insightsTimeRange, setInsightsTimeRange] = useState('all_time');

    // 1. Fetch Stats & Applications (Local DB)
    const { data: allJobsData, isLoading: isLoadingStats, refetch: refetchStats } = useQuery({
        queryKey: ['allJobs'],
        queryFn: () => fetchAppliedJobs({}),
        staleTime: 60000
    });

    const { data: paginatedData, isLoading: isLoadingTable, refetch: refetchTable, isFetching: isFetchingTable } = useQuery({
        queryKey: ['appliedJobs', page],
        queryFn: () => fetchAppliedJobs({ page, limit: 10 }),
        keepPreviousData: true
    });

    // 2. Fetch Failures (Local DB)
    const { data: failureData, isLoading: isLoadingFailures, refetch: refetchFailures } = useQuery({
        queryKey: ['jobFailures', failPage],
        queryFn: () => fetchJobFailures({ page: failPage, limit: 10 }),
        keepPreviousData: true
    });

    // 3. Fetch Insights Data
    const { data: insightsData, isLoading: isLoadingInsights, refetch: refetchInsights } = useQuery({
        queryKey: ['dashboardInsights', insightsTimeRange],
        queryFn: () => fetchDashboardInsights(insightsTimeRange),
        refetchOnWindowFocus: true
    });

    // 4. Process Data
    const jobs = Array.isArray(allJobsData) ? allJobsData : [];
    const currentStats = useMemo(() => processCurrentFormData(jobs), [jobs]);
    const historyStats = useMemo(() => processHistoryData(jobs, historyPeriod), [jobs, historyPeriod]);

    // --- INITIALIZATION EFFECT ---
    React.useEffect(() => {
        const initSync = async () => {
            try {
                console.log("🔄 Auto-syncing application statuses...");
                await syncApplicationStatus();
                refetchTable();
            } catch (err) {
                console.error("Auto-sync failed:", err);
            }
        };
        initSync();
    }, []);

    const handleCrossCheck = async () => {
        setIsSyncing(true);
        try {
            console.log("🔀 Triggering SQL Cross-Check...");
            await reconcileJobStatuses(); // Pings the backend to run the SQL update

            // Refresh the UI to show the new "Refused" statuses
            await refetchStats();
            await refetchTable();
            await refetchFailures();
        } catch (error) {
            console.error("Cross-check failed", error);
        } finally {
            setIsSyncing(false);
        }
    };

    // --- SYNC HANDLER ---
    const handleSyncData = async () => {
        setIsSyncing(true);
        try {
            if(activeTab === 'rejections') {
                await syncEmails("Job fails");
                await refetchFailures();
            } else if (activeTab === 'insights') {
                await refetchInsights();
            } else {
                await refetchStats();
                await refetchTable();
            }
        } catch (error) {
            console.error("Sync failed", error);
        } finally {
            setIsSyncing(false);
        }
    };

    if (isLoadingStats && !allJobsData) {
        return <div className="p-6 bg-gray-900 min-h-screen text-white animate-pulse">Loading Dashboard...</div>;
    }

    return (
        <div className="p-6 bg-gray-900 text-gray-200 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-gray-800 pb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-1">Job Application Dashboard</h2>
                    <p className="text-gray-400 text-sm">Track metrics, goals, and outcomes.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleCrossCheck}
                        disabled={isSyncing}
                        className="px-4 py-2 bg-orange-900/40 text-orange-300 border border-orange-500/30 rounded-lg text-sm flex gap-2 items-center hover:bg-orange-900/60 disabled:opacity-50"
                        title="Force update Job Status based on Rejection Emails"
                    >
                        <GitMerge size={16}/> Cross-Check
                    </button>
                    <button onClick={() => setIsBackfillOpen(true)} className="px-4 py-2 bg-indigo-900/40 text-indigo-300 border border-indigo-500/30 rounded-lg text-sm flex gap-2 items-center hover:bg-indigo-900/60">
                        <Database size={16}/> Fix Descriptions
                    </button>

                    <button
                        onClick={handleSyncData}
                        disabled={isSyncing || isFetchingTable}
                        className="px-4 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-sm flex gap-2 items-center hover:bg-gray-700 disabled:opacity-50"
                    >
                        {isSyncing ? (
                            <RefreshCcw size={16} className="animate-spin text-blue-400"/>
                        ) : activeTab === 'rejections' ? (
                            <DownloadCloud size={16} />
                        ) : (
                            <RefreshCcw size={16} />
                        )}
                        {isSyncing ? 'Syncing...' : (activeTab === 'rejections' ? 'Import Emails' : 'Refresh Data')}
                    </button>

                    <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="px-4 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-sm flex gap-2 items-center hover:bg-gray-700">
                        <Settings size={16}/> Settings
                    </button>
                </div>
            </div>

            {/* Modals */}
            {isSettingsOpen && <ScraperSettings onClose={() => setIsSettingsOpen(false)} onSaveSuccess={handleSyncData} />}
            {isBackfillOpen && <BackfillModal onClose={() => setIsBackfillOpen(false)} />}
            {selectedJob && <JobDetailsPanel job={selectedJob} onClose={() => setSelectedJob(null)} />}

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-800 p-1 rounded-xl w-fit mb-4 border border-gray-800 overflow-x-auto">
                <button onClick={() => setActiveTab('current')} className={`px-4 md:px-6 py-2 rounded-lg text-sm font-medium flex gap-2 ${activeTab === 'current' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    <Target size={16} /> <span className="hidden md:inline">Current Form</span>
                </button>
                <button onClick={() => setActiveTab('past')} className={`px-4 md:px-6 py-2 rounded-lg text-sm font-medium flex gap-2 ${activeTab === 'past' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    <CalendarIcon size={16} /> <span className="hidden md:inline">Past Form</span>
                </button>
                <button onClick={() => setActiveTab('insights')} className={`px-4 md:px-6 py-2 rounded-lg text-sm font-medium flex gap-2 ${activeTab === 'insights' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    <PieChart size={16} /> <span className="hidden md:inline">Insights</span>
                </button>
                <button onClick={() => setActiveTab('rejections')} className={`px-4 md:px-6 py-2 rounded-lg text-sm font-medium flex gap-2 ${activeTab === 'rejections' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    <Ban size={16} /> <span className="hidden md:inline">Rejections</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                {activeTab === 'current' && (
                    <div className="space-y-8 animate-in fade-in">
                        {/* Passes the enriched stats object */}
                        <PerformanceStats stats={currentStats} />
                        {/* Passes the Full History stats map to Calendar */}
                        <StreakCalendar dailyStats={currentStats.dailyStats} />
                        <RecentApplications
                            jobs={paginatedData?.data || []}
                            onSelectJob={setSelectedJob}
                            pagination={paginatedData ? { page: paginatedData.page, totalPages: paginatedData.total_pages, total: paginatedData.total, onPageChange: setPage } : null}
                        />
                    </div>
                )}

                {activeTab === 'past' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 animate-in fade-in">
                        <div className="lg:col-span-2 bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white">History</h3>
                                <div className="bg-gray-900 rounded p-1 flex space-x-1">
                                    {['daily', 'weekly', 'monthly'].map(t => (
                                        <button key={t} onClick={() => setHistoryPeriod(t)} className={`px-3 py-1 text-xs rounded ${historyPeriod === t ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>{t}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="h-80"><Bar data={historyStats.barData} options={{ maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: '#374151' } } } }} /></div>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
                            <h3 className="text-xl font-bold text-white mb-6">Sources</h3>
                            <div className="h-64"><Doughnut data={historyStats.doughnutData} options={{ maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom' } } }} /></div>
                        </div>
                    </div>
                )}

                {activeTab === 'insights' && (
                    <DashboardInsights
                        insights={insightsData}
                        timeRange={insightsTimeRange}
                        onTimeRangeChange={setInsightsTimeRange}
                    />
                )}

                {activeTab === 'rejections' && (
                    <div className="animate-in fade-in">
                        <JobFailures
                            emails={failureData?.data || []}
                            onSelectEmail={setSelectedFailure}
                            pagination={failureData ? { page: failureData.page, totalPages: failureData.total_pages, total: failureData.total, onPageChange: setFailPage } : null}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};