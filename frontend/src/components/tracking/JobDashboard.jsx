import React, { useState } from "react";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from "chart.js";
import {
  Database,
  RefreshCcw,
  GitMerge,
  Settings,
  Target,
  Calendar as CalendarIcon,
  Ban,
  DownloadCloud,
  PieChart,
} from "lucide-react";

import StreakCalendar from "./StreakCalendar";
import RecentApplications from "./RecentApplications";
import JobFailures from "./JobFailures";
import PerformanceStats from "./PerformanceStats";
import DashboardInsights from "./DashboardInsights";
import {
  BackfillModal,
  ScraperSettings,
  JobDetailsPanel,
} from "./DashboardModals";
import {useJobDashboard} from "./useJobDashboard.js";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
);

export const JobDashboard = () => {
  const [activeTab, setActiveTab] = useState("current");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBackfillOpen, setIsBackfillOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedFailure, setSelectedFailure] = useState(null);

  const { stats, tables, loading, controls, actions } = useJobDashboard();

  if (loading.stats && !stats.allRaw.length) {
    return (
      <div className="p-6 bg-gray-900 min-h-screen text-white animate-pulse">
        Loading Dashboard...
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 text-gray-200 min-h-screen">
      {}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-gray-800 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">
            Job Application Dashboard
          </h2>
          <p className="text-gray-400 text-sm">
            Track metrics, goals, and outcomes.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={actions.crossCheck}
            disabled={loading.syncing}
            className="px-4 py-2 bg-orange-900/40 text-orange-300 border border-orange-500/30 rounded-lg text-sm flex gap-2 items-center hover:bg-orange-900/60 disabled:opacity-50"
            title="Force update Job Status based on Rejection Emails"
          >
            <GitMerge size={16} /> Cross-Check
          </button>
          <button
            onClick={() => setIsBackfillOpen(true)}
            className="px-4 py-2 bg-indigo-900/40 text-indigo-300 border border-indigo-500/30 rounded-lg text-sm flex gap-2 items-center hover:bg-indigo-900/60"
          >
            <Database size={16} /> Fix Descriptions
          </button>

          <button
            onClick={() => actions.refresh(activeTab)}
            disabled={loading.syncing || loading.tableFetching}
            className="px-4 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-sm flex gap-2 items-center hover:bg-gray-700 disabled:opacity-50"
          >
            {loading.syncing ? (
              <RefreshCcw size={16} className="animate-spin text-blue-400" />
            ) : activeTab === "rejections" ? (
              <DownloadCloud size={16} />
            ) : (
              <RefreshCcw size={16} />
            )}
            {loading.syncing
              ? "Syncing..."
              : activeTab === "rejections"
                ? "Import Emails"
                : "Refresh Data"}
          </button>

          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="px-4 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-sm flex gap-2 items-center hover:bg-gray-700"
          >
            <Settings size={16} /> Settings
          </button>
        </div>
      </div>

      {}
      {isSettingsOpen && (
        <ScraperSettings
          onClose={() => setIsSettingsOpen(false)}
          onSaveSuccess={() => actions.refresh(activeTab)}
        />
      )}
      {isBackfillOpen && (
        <BackfillModal onClose={() => setIsBackfillOpen(false)} />
      )}
      {selectedJob && (
        <JobDetailsPanel
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}

      {}
      <div className="flex space-x-1 bg-gray-800 p-1 rounded-xl w-fit mb-4 border border-gray-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab("current")}
          className={`px-4 md:px-6 py-2 rounded-lg text-sm font-medium flex gap-2 ${activeTab === "current" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
        >
          <Target size={16} />{" "}
          <span className="hidden md:inline">Current Form</span>
        </button>
        <button
          onClick={() => setActiveTab("past")}
          className={`px-4 md:px-6 py-2 rounded-lg text-sm font-medium flex gap-2 ${activeTab === "past" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
        >
          <CalendarIcon size={16} />{" "}
          <span className="hidden md:inline">Past Form</span>
        </button>
        <button
          onClick={() => setActiveTab("insights")}
          className={`px-4 md:px-6 py-2 rounded-lg text-sm font-medium flex gap-2 ${activeTab === "insights" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}
        >
          <PieChart size={16} />{" "}
          <span className="hidden md:inline">Insights</span>
        </button>
        <button
          onClick={() => setActiveTab("rejections")}
          className={`px-4 md:px-6 py-2 rounded-lg text-sm font-medium flex gap-2 ${activeTab === "rejections" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"}`}
        >
          <Ban size={16} /> <span className="hidden md:inline">Rejections</span>
        </button>
      </div>

      {}
      <div className="min-h-[400px]">
        {activeTab === "current" && (
          <div className="space-y-8 animate-in fade-in">
            <PerformanceStats stats={stats.current} />
            <StreakCalendar dailyStats={stats.current.dailyStats} />
            <RecentApplications
              jobs={tables.jobs?.data || []}
              allJobs={stats.allRaw}
              onSelectJob={setSelectedJob}
              pagination={
                tables.jobs
                  ? {
                      page: tables.jobs.page,
                      totalPages: tables.jobs.total_pages,
                      total: tables.jobs.total,
                      onPageChange: controls.setPage,
                    }
                  : null
              }
            />
          </div>
        )}

        {activeTab === "past" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 animate-in fade-in">
            <div className="lg:col-span-2 bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">History</h3>
                <div className="bg-gray-900 rounded p-1 flex space-x-1">
                  {["daily", "weekly", "monthly"].map((t) => (
                    <button
                      key={t}
                      onClick={() => controls.setHistoryPeriod(t)}
                      className={`px-3 py-1 text-xs rounded ${controls.historyPeriod === t ? "bg-blue-600 text-white" : "text-gray-400"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-80">
                <Bar
                  data={stats.history.barData}
                  options={{
                    maintainAspectRatio: false,
                    scales: {
                      x: { stacked: true, grid: { display: false } },
                      y: { stacked: true, grid: { color: "#374151" } },
                    },
                  }}
                />
              </div>
            </div>
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-6">Sources</h3>
              <div className="h-64">
                <Doughnut
                  data={stats.history.doughnutData}
                  options={{
                    maintainAspectRatio: false,
                    cutout: "70%",
                    plugins: { legend: { position: "bottom" } },
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "insights" && (
          <DashboardInsights
            insights={tables.insights}
            rawJobs={stats.allRaw}
            timeRange={controls.insightsTimeRange}
            onTimeRangeChange={controls.setInsightsTimeRange}
          />
        )}

        {activeTab === "rejections" && (
          <div className="animate-in fade-in">
            <JobFailures
              emails={tables.failures?.data || []}
              onSelectEmail={setSelectedFailure}
              pagination={
                tables.failures
                  ? {
                      page: tables.failures.page,
                      totalPages: tables.failures.total_pages,
                      total: tables.failures.total,
                      onPageChange: controls.setFailPage,
                    }
                  : null
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};
