import React, { useState, useMemo, useEffect } from "react";
import {
  ChevronRight,
  Search,
  RefreshCw,
  Database,
  DownloadCloud,
  Users,
  Globe,
  Clock,
  Briefcase,
  Zap,
  CalendarDays,
  MapPin,
  Ban,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import {
  fetchAppliedJobs,
  syncAppliedIncremental,
  syncAppliedBackfillStream,
  formatDateBR,
  formatTimeBR,
  calculateJobAge,
} from "../../services/myJobsService";

const JobAgeBadge = ({ postedAt }) => {
  if (!postedAt) return <span className="text-gray-600 text-xs">-</span>;

  const days = calculateJobAge(postedAt);
  let colorClass = "text-gray-400";
  let bgClass = "bg-gray-800";

  if (days <= 3) {
    colorClass = "text-green-400";
    bgClass = "bg-green-500/10 border-green-500/20";
  } else if (days <= 14) {
    colorClass = "text-blue-400";
    bgClass = "bg-blue-500/10 border-blue-500/20";
  } else if (days > 30) {
    colorClass = "text-red-400";
    bgClass = "bg-red-500/10 border-red-500/20";
  }

  return (
    <div
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border ${bgClass} ${colorClass}`}
    >
      <CalendarDays size={10} />
      {days === 0 ? "Today" : `${days}d ago`}
    </div>
  );
};

const CompetitionRichBadge = ({ level, applicants, velocity }) => {
  let levelColor = "bg-gray-700 text-gray-400";
  if (level === "HIGH")
    levelColor = "bg-red-900/40 text-red-400 border-red-500/30";
  if (level === "MEDIUM")
    levelColor = "bg-yellow-900/40 text-yellow-400 border-yellow-500/30";
  if (level === "LOW")
    levelColor = "bg-green-900/40 text-green-400 border-green-500/30";

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-gray-200 font-bold text-sm">
          <Users size={14} className="text-gray-500" />
          {applicants > 0 ? applicants : "0"}
        </div>
        {velocity > 0 && (
          <div className="flex items-center gap-0.5 text-[10px] font-bold text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded-full animate-pulse">
            <Zap size={10} fill="currentColor" />+{velocity}
          </div>
        )}
      </div>

      {level && (
        <span
          className={`text-[9px] uppercase tracking-wider font-bold text-center px-1 py-0.5 rounded border ${levelColor}`}
        >
          {level} competitive
        </span>
      )}
    </div>
  );
};

const StatusRichBadge = ({ state, closed }) => {
  if (closed) {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
        <Ban size={12} /> CLOSED
      </span>
    );
  }
  if (state === "SUSPENDED") {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20">
        <AlertTriangle size={12} /> PAUSED
      </span>
    );
  }
  if (state === "LISTED") {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
        <CheckCircle2 size={12} /> ACTIVE
      </span>
    );
  }
  return <span className="text-gray-500 text-xs">{state}</span>;
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
    try {
      await syncAppliedIncremental();
      await loadJobs();
    } catch (error) {
      console.error(error);
    }
    setIsSyncing(false);
  };

  const handleBackfill = () => {
    setIsSyncing(true);
    setStreamStatus("Starting...");
    syncAppliedBackfillStream({
      from: cutoffMonth,
      onProgress: (data) =>
        setStreamStatus(
          `#${data.processed} | ${data.title?.substring(0, 20)}...`,
        ),
      onFinish: async (data) => {
        setStreamStatus(`Done: +${data.inserted} jobs`);
        await loadJobs();
        setIsSyncing(false);
        setTimeout(() => setStreamStatus(null), 4000);
      },
      onError: () => {
        setStreamStatus("Error!");
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
        j.company?.toLowerCase().includes(term),
    );
  }, [jobs, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow-lg">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="text-blue-500" size={24} />
            Application Arsenal
            <span className="text-xs font-mono bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
              {jobs.length} ROWS
            </span>
          </h2>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReloadFromSQL}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition"
              title="Refresh SQL"
            >
              <DownloadCloud size={18} />
            </button>
            <button
              onClick={handleIncrementalSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition"
            >
              <RefreshCw
                size={16}
                className={isSyncing ? "animate-spin" : ""}
              />
              {isSyncing ? "SYNCING..." : "SYNC LATEST"}
            </button>

            <div className="h-8 w-px bg-gray-600 mx-2 hidden md:block"></div>

            <div className="flex items-center bg-gray-900 border border-gray-600 rounded-lg p-1">
              <input
                type="month"
                value={cutoffMonth}
                onChange={(e) => setCutoffMonth(e.target.value)}
                className="bg-transparent text-gray-300 text-xs outline-none w-24 px-2 font-mono"
              />
              <button
                onClick={handleBackfill}
                disabled={isSyncing}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase rounded transition"
              >
                Backfill
              </button>
            </div>
          </div>
        </div>

        {streamStatus && (
          <div className="mb-4 text-xs font-mono text-cyan-300 bg-cyan-950/50 border border-cyan-800 p-2 rounded flex items-center gap-2">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
            {streamStatus}
          </div>
        )}

        <div className="relative">
          <input
            type="text"
            placeholder="Search arsenal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded-lg pl-10 pr-4 py-3 focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <Search size={16} className="absolute left-3 top-3.5 text-gray-500" />
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-900 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 border-b border-gray-700 min-w-[280px]">
                  Job Identity
                </th>
                <th className="px-5 py-3 border-b border-gray-700 min-w-[140px]">
                  Applied At
                </th>
                <th className="px-5 py-3 border-b border-gray-700 min-w-[140px]">
                  Listed Timeline
                </th>
                <th className="px-5 py-3 border-b border-gray-700 w-32">
                  Competition
                </th>
                <th className="px-5 py-3 border-b border-gray-700 w-32 text-center">
                  Status
                </th>
                <th className="px-5 py-3 border-b border-gray-700 w-10"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-700/50">
              {filteredJobs.map((job) => (
                <tr
                  key={job.urn}
                  onClick={() => onSelectJob && onSelectJob(job)}
                  className="group cursor-pointer hover:bg-gray-700/40 transition-colors duration-150"
                >
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="font-bold text-gray-100 text-base leading-tight group-hover:text-blue-400 transition-colors">
                        {job.title}
                      </div>
                      <div className="flex items-center flex-wrap gap-2 text-xs">
                        <span className="text-gray-300 font-medium flex items-center gap-1">
                          <Briefcase size={10} className="text-gray-500" />
                          {job.company}
                        </span>

                        {job.location && (
                          <span className="flex items-center gap-0.5 text-gray-500">
                            <MapPin size={10} /> {job.location.split(",")[0]}
                          </span>
                        )}

                        {job.workRemoteAllowed && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                            <Globe size={10} /> REMOTE
                          </span>
                        )}

                        {job.employmentStatus &&
                          job.employmentStatus !== "Unknown" && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-700 text-gray-300 border border-gray-600 capitalize">
                              {job.employmentStatus
                                .toLowerCase()
                                .replace("_", " ")}
                            </span>
                          )}
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 text-gray-200 font-bold text-sm">
                        {formatDateBR(job.appliedAt)}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-mono text-blue-300 mt-1">
                        <Clock size={10} />
                        {formatTimeBR(job.appliedAt)}
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1.5 items-start">
                      {job.postedAt ? (
                        <>
                          <span className="text-gray-400 text-xs">
                            {formatDateBR(job.postedAt)}
                          </span>
                          <JobAgeBadge postedAt={job.postedAt} />
                        </>
                      ) : (
                        <span className="text-gray-600 text-xs italic">
                          Unknown Date
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <CompetitionRichBadge
                      level={job.competitionLevel}
                      applicants={job.applicants}
                      velocity={job.applicantsVelocity}
                    />
                  </td>

                  <td className="px-5 py-4 text-center">
                    <StatusRichBadge
                      state={job.jobState}
                      closed={job.applicationClosed}
                    />
                  </td>

                  <td className="px-5 py-4 text-right">
                    <ChevronRight
                      size={18}
                      className="text-gray-600 group-hover:text-white transition-transform"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredJobs.length === 0 && (
          <div className="p-16 text-center">
            <p className="text-gray-500 text-lg">Arsenal empty.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentApplications;
