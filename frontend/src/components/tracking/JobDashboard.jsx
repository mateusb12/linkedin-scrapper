import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Database, RefreshCcw, Settings, Target, Calendar as CalendarIcon } from 'lucide-react';
import { fetchAppliedJobs } from '../../services/jobService.js';

// --- FEATURE IMPORTS ---
import StreakCalendar from './StreakCalendar';
import RecentApplications from './RecentApplications';
import PerformanceStats from './PerformanceStats';
import { BackfillModal, ScraperSettings, JobDetailsPanel } from './DashboardModals';

// Register Chart components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const GOAL_PER_DAY = 10;
const themeColors = { linkedin: '#8b5cf6', huntr: '#10b981', sql: '#3b82f6', textPrimary: '#f3f4f6', textSecondary: '#9ca3af' };

// --- DATA PROCESSING LOGIC ---
const processCurrentFormData = (jobs) => {
    const allDailyCounts = {};
    const getLocalYMD = (d) => {
        const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0');
        return `${y}-${m}-${day}`;
    };

    jobs.forEach(job => {
        if (!job.appliedAt) return;
        const k = getLocalYMD(new Date(job.appliedAt));
        allDailyCounts[k] = (allDailyCounts[k] || 0) + 1;
    });

    const last7Days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        last7Days.push(getLocalYMD(d));
    }

    const dataValues = last7Days.map(k => allDailyCounts[k] || 0);
    const todayCount = allDailyCounts[last7Days[last7Days.length - 1]] || 0;

    let streak = 0;
    const checkDate = new Date();
    for (let i = 0; i < 365; i++) {
        const k = getLocalYMD(checkDate);
        const count = allDailyCounts[k] || 0;
        const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6;
        if (i === 0 && count < GOAL_PER_DAY) { checkDate.setDate(checkDate.getDate() - 1); continue; }
        if (count >= GOAL_PER_DAY) streak++;
        else if (!isWeekend) break;
        checkDate.setDate(checkDate.getDate() - 1);
    }

    return {
        labels: last7Days.map(d => {
            const [y, m, day] = d.split('-').map(Number);
            return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        }),
        data: dataValues,
        todayCount, streak, allDailyCounts
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
    const [page, setPage] = useState(1);
    const [historyPeriod, setHistoryPeriod] = useState('daily');

    // 1. Fetch Data
    const {
        data: allJobsData,
        isLoading: isLoadingStats,
        refetch: refetchStats
    } = useQuery({
        queryKey: ['allJobs'],
        queryFn: () => fetchAppliedJobs({}),
        staleTime: 60000
    });

    const {
        data: paginatedData,
        isLoading: isLoadingTable,
        refetch: refetchTable,
        isFetching: isFetchingTable
    } = useQuery({
        queryKey: ['appliedJobs', page],
        queryFn: () => fetchAppliedJobs({ page, limit: 10 }),
        keepPreviousData: true
    });

    // 2. Process Data (MUST BE DONE BEFORE CONDITIONAL RETURNS)
    const jobs = Array.isArray(allJobsData) ? allJobsData : [];

    const currentStats = useMemo(() => processCurrentFormData(jobs), [jobs]);
    const historyStats = useMemo(() => processHistoryData(jobs, historyPeriod), [jobs, historyPeriod]);

    // 3. Conditional Loading State
    const isLoading = isLoadingStats || isLoadingTable;
    const handleRefresh = () => { refetchStats(); refetchTable(); };

    // Skeleton / Loading View
    if (isLoading && !allJobsData) {
        return (
            <div className="p-6 bg-gray-900 min-h-screen text-white animate-pulse">
                <div className="h-8 w-64 bg-gray-800 rounded mb-8"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="h-32 bg-gray-800 rounded-xl"></div>
                    <div className="h-32 bg-gray-800 rounded-xl"></div>
                    <div className="h-32 bg-gray-800 rounded-xl"></div>
                </div>
                <div className="h-96 bg-gray-800 rounded-xl"></div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-900 text-gray-200 min-h-screen">
            {/* Header & Settings-wise actions */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-gray-800 pb-6">
                <div><h2 className="text-3xl font-bold text-white mb-1">Job Application Dashboard</h2><p className="text-gray-400 text-sm">Track metrics and goals.</p></div>
                <div className="flex gap-3">
                    <button onClick={() => setIsBackfillOpen(true)} className="px-4 py-2 bg-indigo-900/40 text-indigo-300 border border-indigo-500/30 rounded-lg text-sm flex gap-2 items-center hover:bg-indigo-900/60"><Database size={16}/> Fix Descriptions</button>
                    <button onClick={handleRefresh} disabled={isFetchingTable} className="px-4 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-sm flex gap-2 items-center hover:bg-gray-700"><RefreshCcw size={16} className={isFetchingTable ? 'animate-spin' : ''}/> Sync Data</button>
                    <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="px-4 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-sm flex gap-2 items-center hover:bg-gray-700"><Settings size={16}/> Settings</button>
                </div>
            </div>

            {/* Modals */}
            {isSettingsOpen && <ScraperSettings onClose={() => setIsSettingsOpen(false)} onSaveSuccess={handleRefresh} />}
            {isBackfillOpen && <BackfillModal onClose={() => setIsBackfillOpen(false)} />}
            {selectedJob && <JobDetailsPanel job={selectedJob} onClose={() => setSelectedJob(null)} />}

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-800 p-1 rounded-xl w-fit mb-4 border border-gray-800">
                <button onClick={() => setActiveTab('current')} className={`px-6 py-2 rounded-lg text-sm font-medium flex gap-2 ${activeTab === 'current' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}><Target size={16} /> Current Form</button>
                <button onClick={() => setActiveTab('past')} className={`px-6 py-2 rounded-lg text-sm font-medium flex gap-2 ${activeTab === 'past' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}><CalendarIcon size={16} /> Past Form</button>
            </div>

            {/* Feature: Current Form vs Past Form */}
            <div className="min-h-[400px]">
                {activeTab === 'current' ? (
                    <div className="space-y-8">
                        {/* Feature: Performance-wise */}
                        <PerformanceStats stats={currentStats} />
                        {/* Feature: Streak Calendar */}
                        <StreakCalendar dailyCounts={currentStats.allDailyCounts} />
                    </div>
                ) : (
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
            </div>

            {/* Feature: Recent Applications */}
            <RecentApplications
                jobs={paginatedData?.data || []}
                onSelectJob={setSelectedJob}
                pagination={paginatedData ? { page: paginatedData.page, totalPages: paginatedData.total_pages, total: paginatedData.total, onPageChange: setPage } : null}
            />
        </div>
    );
};