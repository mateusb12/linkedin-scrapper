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
  Cpu,
  Code2,
} from "lucide-react";

import {
  fetchAppliedJobs,
  syncAppliedIncremental,
  syncAppliedBackfillStream,
  formatDateBR,
  formatTimeBR,
  calculateJobAge,
} from "../../services/myJobsService";

import {
  extractExperienceFromDescription,
  extractSeniorityFromDescription,
  extractFoundations,
  extractSpecifics,
  getTechBadgeStyle,
  getExperienceStyle,
  getSeniorityStyle,
  getTechIcon,
} from "./utils/jobUtils";

const pillBase =
  "inline-flex items-center gap-1 px-3 py-1 rounded-md border text-sm font-mono leading-none w-fit";

const TechStackCell = ({ description }) => {
  const foundations = extractFoundations(description);
  const specifics = extractSpecifics(description);

  const allTech = Array.from(new Set([...foundations, ...specifics]));

  if (allTech.length === 0)
    return <span className="text-gray-500 text-sm">-</span>;

  const displayTech = allTech.slice(0, 3);
  const remaining = allTech.length - 3;

  return (
    <div className="flex flex-wrap gap-2 max-w-[220px]">
      {displayTech.map((tech, idx) => {
        const icon = getTechIcon(tech);
        const style = getTechBadgeStyle(idx, tech);

        return (
          <span
            key={tech}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${style}`}
          >
            {icon && (
              <img src={icon} alt="" className="w-3.5 h-3.5 object-contain" />
            )}
            {tech}
          </span>
        );
      })}
      {remaining > 0 && (
        <span
          className="text-xs text-gray-400 bg-gray-800 border border-gray-700 px-2 py-1 rounded cursor-help font-medium"
          title={allTech.slice(3).join(", ")}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
};

const RequirementsAnalysisCell = ({ description }) => {
  const exp = extractExperienceFromDescription(description);
  const seniority = extractSeniorityFromDescription(description);

  if (!exp && !seniority)
    return <span className="text-gray-500 text-sm">-</span>;

  return (
    <div className="flex flex-col gap-2 items-start">
      {seniority && (
        <span
          className={`text-xs px-2.5 py-1 rounded border font-bold uppercase tracking-wide ${getSeniorityStyle(seniority)}`}
        >
          {seniority}
        </span>
      )}

      {exp && (
        <span
          className={`text-xs px-2.5 py-1 rounded border font-medium flex items-center gap-1.5 ${getExperienceStyle(exp)}`}
        >
          <Clock size={12} />
          {exp.min}+ Anos
        </span>
      )}
    </div>
  );
};

const JobAgeBadge = ({ postedAt }) => {
  if (!postedAt) return <span className="text-gray-500 text-sm">-</span>;

  const days = calculateJobAge(postedAt);
  let colorClass = "text-gray-400 bg-gray-800 border-gray-700";

  if (days <= 3) {
    colorClass = "text-green-400 bg-green-900/20 border-green-500/30";
  } else if (days <= 14) {
    colorClass = "text-blue-400 bg-blue-900/20 border-blue-500/30";
  } else if (days > 30) {
    colorClass = "text-red-400 bg-red-900/20 border-red-500/30";
  }

  return (
    <div className={`${pillBase} ${colorClass}`}>
      <CalendarDays size={12} />
      {days === 0 ? "Hoje" : `${days}d`}
    </div>
  );
};

const CompetitionRichBadge = ({ level, applicants, velocity }) => {
  let levelColor = "bg-gray-800 text-gray-500 border-gray-700";

  if (level === "HIGH")
    levelColor = "bg-red-900/30 text-red-300 border-red-500/30";
  if (level === "MEDIUM")
    levelColor = "bg-yellow-900/30 text-yellow-300 border-yellow-500/30";
  if (level === "LOW")
    levelColor = "bg-green-900/30 text-green-300 border-green-500/30";

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-gray-200 font-bold text-sm">
          <Users size={14} className="text-gray-500" />
          {applicants > 0 ? applicants : "0"}
        </div>
        {velocity > 0 && (
          <div
            className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full"
            title="Applicants in last 24h"
          >
            <Zap size={10} fill="currentColor" />
            {velocity}/d
          </div>
        )}
      </div>

      {level && (
        <span
          className={`text-[10px] uppercase tracking-wider font-bold text-center px-2 py-1 rounded border ${levelColor}`}
        >
          {level}
        </span>
      )}
    </div>
  );
};

const StatusRichBadge = ({ state, closed }) => {
  if (closed) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-900/20 px-3 py-1.5 rounded-full border border-red-900/30">
        <Ban size={12} /> CLOSED
      </span>
    );
  }
  if (state === "SUSPENDED") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-orange-400 bg-orange-900/20 px-3 py-1.5 rounded-full border border-orange-900/30">
        <AlertTriangle size={12} /> PAUSED
      </span>
    );
  }
  if (state === "LISTED") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-900/20 px-3 py-1.5 rounded-full border border-green-900/30">
        <CheckCircle2 size={12} /> ACTIVE
      </span>
    );
  }
  return (
    <span className="text-gray-400 text-xs font-medium px-2">{state}</span>
  );
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
    try {
      await syncAppliedIncremental();
      await loadJobs();
    } catch (error) {
      console.error("Sync failed", error);
    }
    setIsSyncing(false);
  };

  const handleBackfill = () => {
    setIsSyncing(true);
    setStreamStatus("Starting backfill...");

    syncAppliedBackfillStream({
      from: cutoffMonth,
      onProgress: (data) => {
        setStreamStatus(
          `#${data.processed} | ${data.title?.substring(0, 20)}...`,
        );
      },
      onFinish: async (data) => {
        setStreamStatus(`Done: +${data.inserted} jobs`);
        await loadJobs();
        setIsSyncing(false);
        setTimeout(() => setStreamStatus(null), 4000);
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
    <div className="space-y-6 pb-10">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Database className="text-blue-500" size={28} />
            Application Arsenal
            <span className="text-sm font-mono bg-blue-900/40 text-blue-300 px-3 py-1 rounded-full border border-blue-500/30">
              {jobs.length} VAGAS
            </span>
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleReloadFromSQL}
              className="p-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition border border-slate-600"
              title="Refresh from SQL"
            >
              <DownloadCloud size={20} />
            </button>

            <button
              onClick={handleIncrementalSync}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition shadow-md shadow-blue-900/20 ${
                isSyncing ? "opacity-70 cursor-wait" : ""
              }`}
            >
              <RefreshCw
                size={18}
                className={isSyncing ? "animate-spin" : ""}
              />
              {isSyncing ? "SYNCING..." : "SYNC LATEST"}
            </button>

            <div className="h-10 w-px bg-slate-600 mx-1 hidden md:block"></div>

            <div className="flex items-center bg-slate-900 border border-slate-600 rounded-lg p-1.5">
              <input
                type="month"
                value={cutoffMonth}
                onChange={(e) => setCutoffMonth(e.target.value)}
                className="bg-transparent text-slate-300 text-sm outline-none w-32 px-2 font-mono"
              />
              <button
                onClick={handleBackfill}
                disabled={isSyncing}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase rounded transition ml-2"
              >
                Backfill
              </button>
            </div>
          </div>
        </div>

        {streamStatus && (
          <div className="mb-4 text-sm font-mono text-cyan-300 bg-cyan-950/50 border border-cyan-800 p-3 rounded-lg flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse"></div>
            {streamStatus}
          </div>
        )}

        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search arsenal by title, company or stack..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-700 text-slate-100 text-base rounded-xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder-slate-500"
          />
          <Search
            size={20}
            className="absolute left-4 top-4.5 text-slate-500"
          />
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900 text-slate-400 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 border-b border-slate-700 min-w-[280px]">
                  Job Identity
                </th>

                <th className="px-6 py-4 border-b border-slate-700 w-64 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Cpu size={14} /> Tech Stack
                  </div>
                </th>
                <th className="px-6 py-4 border-b border-slate-700 w-40 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Code2 size={14} /> Level
                  </div>
                </th>

                <th className="px-6 py-4 border-b border-slate-700 w-48">
                  Applied Info
                </th>
                <th className="px-6 py-4 border-b border-slate-700 w-36">
                  Market
                </th>
                <th className="px-6 py-4 border-b border-slate-700 w-32 text-center">
                  Status
                </th>
                <th className="px-6 py-4 border-b border-slate-700 w-12"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-700/60">
              {filteredJobs.map((job) => (
                <tr
                  key={job.urn}
                  onClick={() => onSelectJob && onSelectJob(job)}
                  className="group cursor-pointer hover:bg-slate-700/50 transition-colors duration-200"
                >
                  <td className="px-6 py-5 align-top">
                    <div className="flex flex-col gap-1.5">
                      <div
                        className="font-bold text-white text-lg leading-tight group-hover:text-blue-400 transition-colors"
                        title={job.title}
                      >
                        {job.title}
                      </div>
                      <div className="flex items-center gap-2 text-slate-300 text-sm font-medium mb-1">
                        <Briefcase size={14} className="text-slate-500" />
                        {job.company}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {job.location && (
                          <span
                            className="flex items-center gap-1 text-slate-400 text-xs bg-slate-900/50 px-2 py-1 rounded"
                            title={job.location}
                          >
                            <MapPin size={12} /> {job.location.split(",")[0]}
                          </span>
                        )}

                        {job.workRemoteAllowed && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20 font-bold uppercase tracking-wide">
                            <Globe size={10} /> REMOTE
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-5 align-top">
                    <div className="flex justify-center">
                      <TechStackCell description={job.description} />
                    </div>
                  </td>

                  <td className="px-6 py-5 align-top">
                    <div className="flex justify-center">
                      <RequirementsAnalysisCell description={job.description} />
                    </div>
                  </td>

                  <td className="px-6 py-5 align-top">
                    <div className="flex flex-col gap-1">
                      <div className="text-slate-200 text-sm font-bold">
                        {formatDateBR(job.appliedAt)}
                      </div>
                      <div
                        className={`${pillBase} bg-cyan-900/20 border-cyan-700 text-cyan-300`}
                      >
                        <Clock size={13} className="text-cyan-400" />
                        {formatTimeBR(job.appliedAt)}
                      </div>

                      {job.postedAt && (
                        <div className="mt-2">
                          <JobAgeBadge postedAt={job.postedAt} />
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-5 align-top">
                    <CompetitionRichBadge
                      level={job.competitionLevel}
                      applicants={job.applicants}
                      velocity={job.applicantsVelocity}
                    />
                  </td>

                  <td className="px-6 py-5 align-top text-center">
                    <StatusRichBadge
                      state={job.jobState}
                      closed={job.applicationClosed}
                    />
                  </td>

                  <td className="px-6 py-5 align-middle text-right">
                    <ChevronRight
                      size={20}
                      className="text-slate-600 group-hover:text-white transition-all group-hover:translate-x-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredJobs.length === 0 && (
          <div className="p-20 text-center text-slate-500 bg-slate-800/50">
            <Database size={64} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Nenhuma vaga encontrada.</p>
            <p className="text-sm">Tente ajustar seus filtros de busca.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentApplications;
