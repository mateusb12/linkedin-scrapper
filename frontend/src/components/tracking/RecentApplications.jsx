import React, { useState, useMemo, useEffect, memo } from "react";
import {
  ChevronRight,
  Search,
  RefreshCw,
  Database,
  DownloadCloud,
} from "lucide-react";

import {
  fetchAppliedJobs,
  syncAppliedIncremental,
  syncAppliedBackfillStream,
} from "../../services/myJobsService";

const StatusBadge = memo(({ status }) => (
  <span className="px-2 py-1 rounded-full text-xs font-medium border bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
    {status || "Waiting"}
  </span>
));

const formatDateBR = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const RecentApplications = ({ onSelectJob }) => {
  const [jobs, setJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [streamStatus, setStreamStatus] = useState(null);
  const [cutoffMonth, setCutoffMonth] = useState("2025-12");

  const loadJobs = async () => {
    try {
      const { jobs } = await fetchAppliedJobs();
      setJobs(jobs);
    } catch (err) {
      console.error("Failed to load jobs:", err);
      setJobs([]);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleReloadFromSQL = async () => {
    await loadJobs();
  };

  const handleIncrementalSync = async () => {
    setIsSyncing(true);
    await syncAppliedIncremental();
    await loadJobs();
    setIsSyncing(false);
  };

  const handleBackfill = () => {
    setIsSyncing(true);
    setStreamStatus("Starting backfill...");

    syncAppliedBackfillStream({
      from: cutoffMonth,

      onProgress: (data) => {
        setStreamStatus(
          `#${data.processed} - ${data.timestamp} - ${data.title}`,
        );
      },

      onFinish: async (data) => {
        setStreamStatus(`Finished. Inserted ${data.inserted} jobs.`);
        await loadJobs();
        setIsSyncing(false);
      },

      onError: () => {
        setStreamStatus("Error during backfill.");
        setIsSyncing(false);
      },
    });
  };

  const filteredJobs = useMemo(() => {
    if (!searchTerm.trim()) return jobs;
    const term = searchTerm.toLowerCase();

    return jobs.filter(
      (j) =>
        j.title?.toLowerCase().includes(term) ||
        j.company?.toLowerCase().includes(term) ||
        j.location?.toLowerCase().includes(term),
    );
  }, [jobs, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-xl font-bold text-white">Recent Applications</h2>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleReloadFromSQL}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              <DownloadCloud size={16} />
              Pull SQL
            </button>

            <button
              onClick={handleIncrementalSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw size={16} />
              Force Fetch
            </button>

            <div className="flex items-center gap-2 bg-gray-900 border border-gray-600 rounded-lg px-2 py-1">
              <input
                type="month"
                value={cutoffMonth}
                onChange={(e) => setCutoffMonth(e.target.value)}
                className="bg-transparent text-white text-sm outline-none"
              />
              <button
                onClick={handleBackfill}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-md transition disabled:opacity-50"
              >
                <Database size={16} />
                Backfill
              </button>
            </div>
          </div>
        </div>

        {streamStatus && (
          <div className="text-sm text-blue-400 font-mono bg-gray-900 p-3 rounded border border-gray-700">
            {streamStatus}
          </div>
        )}

        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search applications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">Application</th>
              <th className="px-6 py-4">Applied</th>
              <th className="px-6 py-4">Posted</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-700">
            {filteredJobs.map((job) => {
              const appliedDate = job.appliedAt
                ? new Date(job.appliedAt)
                : null;

              const postedDate = job.postedAt ? new Date(job.postedAt) : null;

              const now = new Date();
              const delayDays = postedDate
                ? Math.floor((now - postedDate) / (1000 * 60 * 60 * 24))
                : null;

              return (
                <tr
                  key={job.urn}
                  onClick={() => onSelectJob && onSelectJob(job)}
                  className="cursor-pointer hover:bg-gray-700/40 transition"
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-200">{job.title}</div>
                    <div className="text-sm text-gray-400">{job.company}</div>
                  </td>

                  <td className="px-6 py-4">
                    {appliedDate ? (
                      <>
                        <div className="text-gray-200 font-medium">
                          {formatDateBR(appliedDate)}
                        </div>
                        <div className="text-sm font-mono text-blue-300 mt-1">
                          {appliedDate.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </div>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {postedDate ? (
                      <>
                        <div className="text-gray-300 font-medium">
                          {formatDateBR(postedDate)}
                        </div>
                        {delayDays !== null && (
                          <div className="mt-1">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                                delayDays <= 3
                                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                                  : delayDays <= 14
                                    ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                    : "bg-red-500/10 text-red-400 border-red-500/20"
                              }`}
                            >
                              {delayDays}d
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <StatusBadge status={job.application_status} />
                  </td>

                  <td className="px-6 py-4 text-right">
                    <ChevronRight size={16} className="text-gray-500" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredJobs.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No applications found.
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentApplications;
