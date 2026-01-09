import React, { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Building2,
  Calendar,
  Users,
  Briefcase,
  Search,
  AlertCircle,
  Eye,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { formatCustomDate } from "../../utils/dateUtils";

const StatusBadge = ({ status }) => {
  const normalizedStatus = (status || "Waiting").toLowerCase();

  const styles = {
    waiting: {
      css: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      icon: null,
    },
    refused: {
      css: "bg-red-500/10 text-red-500 border-red-500/20",
      icon: null,
    },
    interview: {
      css: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      icon: null,
    },
    accepted: {
      css: "bg-green-500/10 text-green-500 border-green-500/20",
      icon: null,
    },
    "actively reviewing": {
      css: "bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]",
      icon: <Eye size={12} className="mr-1 inline-block" />,
    },
    "actively reviewing applicants": {
      css: "bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]",
      icon: <Eye size={12} className="mr-1 inline-block" />,
    },
    "no longer accepting": {
      css: "bg-gray-700/50 text-gray-400 border-gray-600/50",
      icon: <AlertCircle size={12} className="mr-1 inline-block" />,
    },
    "no longer accepting applications": {
      css: "bg-gray-700/50 text-gray-400 border-gray-600/50",
      icon: <AlertCircle size={12} className="mr-1 inline-block" />,
    },
  };

  const config = styles[normalizedStatus] || styles["waiting"];
  const displayLabel =
    status && status.length > 20 ? status.substring(0, 18) + "..." : status;

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center w-fit ${config.css}`}
    >
      {config.icon}
      {displayLabel || "Waiting"}
    </span>
  );
};

const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
  const getPageNumbers = () => {
    const pages = [];
    pages.push(1);
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) pages.push("...");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("...");
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700 bg-gray-800">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 hover:text-white transition-colors"
      >
        <ChevronLeft size={20} />
      </button>
      {getPageNumbers().map((page, idx) => (
        <button
          key={idx}
          onClick={() => (typeof page === "number" ? onPageChange(page) : null)}
          disabled={typeof page !== "number"}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            page === currentPage
              ? "bg-blue-600 text-white shadow-md"
              : typeof page === "number"
                ? "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                : "text-gray-500 cursor-default"
          }`}
        >
          {page}
        </button>
      ))}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 hover:text-white transition-colors"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
};

const RecentApplications = ({ jobs, allJobs, onSelectJob, pagination }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const [copyStartDate, setCopyStartDate] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter(
      (j) =>
        (j.title && j.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (j.company &&
          j.company.toLowerCase().includes(searchTerm.toLowerCase())),
    );
  }, [jobs, searchTerm]);

  const jobsToExport = useMemo(() => {
    const sourceData = allJobs && allJobs.length > 0 ? allJobs : jobs;

    if (!copyStartDate || !sourceData) return [];

    const startDate = new Date(copyStartDate);
    startDate.setHours(0, 0, 0, 0);

    return sourceData.filter((job) => {
      if (!job.appliedAt) return false;

      const jobDate = new Date(job.appliedAt);

      const jobDateMidnight = new Date(jobDate);
      jobDateMidnight.setHours(0, 0, 0, 0);

      return jobDateMidnight >= startDate;
    });
  }, [allJobs, jobs, copyStartDate]);

  const handleCopyJobs = () => {
    if (jobsToExport.length === 0) return;

    const dataStr = JSON.stringify(jobsToExport, null, 2);
    navigator.clipboard.writeText(dataStr).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {}
        <div className="p-6 border-b border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-800">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              Recent Applications
            </h3>
            {pagination && (
              <span className="text-xs font-mono text-blue-300 bg-blue-900/30 px-2 py-1 rounded border border-blue-800/50">
                Total: {pagination.total}
              </span>
            )}
          </div>
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            <div className="absolute left-3 top-2.5 text-gray-500">
              <Search size={14} />
            </div>
          </div>
        </div>

        {}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Applied</th>
                <th className="px-6 py-4">Applicants</th>
                <th className="px-6 py-4">App Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job) => {
                  const hasApplicants =
                    job.applicants !== null &&
                    job.applicants !== undefined &&
                    job.applicants > 0;

                  return (
                    <tr
                      key={job.urn}
                      onClick={() => onSelectJob(job)}
                      className="group hover:bg-gray-700/30 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-200 flex items-center gap-2">
                          <Building2 size={14} className="text-blue-400" />
                          {job.company}
                        </div>
                        <div className="text-xs text-gray-500 uppercase mt-1 pl-6">
                          {job.source || "Linkedin"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-300 font-medium group-hover:text-blue-400 transition-colors">
                        <div className="flex items-center gap-2">
                          <Briefcase size={14} className="text-purple-400" />
                          {job.title}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-green-400" />
                          {formatCustomDate(job.appliedAt)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1 pl-6">
                          {new Date(job.appliedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-400 font-mono text-sm">
                          <Users
                            size={14}
                            className={
                              hasApplicants ? "text-gray-400" : "text-gray-600"
                            }
                          />
                          {hasApplicants
                            ? job.applicants.toLocaleString()
                            : "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={job.application_status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-gray-500 hover:text-white p-2 rounded-full hover:bg-gray-600 transition-colors">
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">
                    No applications found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <PaginationControls
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={pagination.onPageChange}
          />
        )}
      </div>

      {}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex flex-col">
            <label className="text-xs text-gray-400 font-bold uppercase mb-1 ml-1">
              Copy Data From
            </label>
            <input
              type="date"
              value={copyStartDate}
              onChange={(e) => setCopyStartDate(e.target.value)}
              className="bg-gray-900 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col justify-end h-full pt-5">
            <span className="text-sm font-medium text-gray-300 bg-gray-900 px-3 py-2 rounded-lg border border-gray-700 min-w-[100px] text-center">
              {}
              Count:{" "}
              <span className="text-blue-400 font-bold">
                {jobsToExport.length}
              </span>
            </span>
          </div>
        </div>

        <button
          onClick={handleCopyJobs}
          disabled={jobsToExport.length === 0}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all duration-200 ${
            isCopied
              ? "bg-green-600 text-white"
              : jobsToExport.length === 0
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/20"
          }`}
        >
          {isCopied ? (
            <>
              <CheckCircle2 size={18} /> Copied!
            </>
          ) : (
            <>
              <Copy size={18} /> Copy{" "}
              {jobsToExport.length > 0 ? `(${jobsToExport.length})` : ""} JSON
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default RecentApplications;
