import React, { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import {
  Bookmark,
  Search,
  MapPin,
  ExternalLink,
  Trash2,
  Building,
  RefreshCw,
  Archive,
  Briefcase,
  Layers,
  Copy,
  CheckCircle2,
  Hash,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import {
  fetchLinkedinJobsRaw,
  LINKEDIN_CARD_TYPE,
} from "../../services/jobService";
import {cleanJobDescription, extractExperienceFromDescription, getExperienceStyle} from "./utils/jobUtils.js";

const SavedJobs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedJobUrn, setExpandedJobUrn] = useState(null);
  const [activeTab, setActiveTab] = useState(LINKEDIN_CARD_TYPE.SAVED);
  const [exportCount, setExportCount] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const TABS = [
    { id: LINKEDIN_CARD_TYPE.SAVED, label: "Saved", icon: Bookmark },
    { id: LINKEDIN_CARD_TYPE.APPLIED, label: "Applied", icon: Briefcase },
    { id: LINKEDIN_CARD_TYPE.IN_PROGRESS, label: "In Progress", icon: Layers },
    { id: LINKEDIN_CARD_TYPE.ARCHIVED, label: "Archived", icon: Archive },
  ];

  const loadJobs = async () => {
    setIsLoading(true);
    setError(null);
    setExpandedJobUrn(null);
    try {
      const response = await fetchLinkedinJobsRaw({
        cardType: activeTab,
        start: 0,
        debug: false,
      });

      if (response && response.jobs) {
        setJobs(response.jobs);
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.error("Failed to load LinkedIn jobs:", err);
      setError("Failed to fetch jobs from LinkedIn.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [activeTab]);

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];

    return jobs
      .map((job) => {
        const experienceData = extractExperienceFromDescription(
          job.description,
        );
        return { ...job, experienceData };
      })
      .filter(
        (j) =>
          (j.title &&
            j.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (j.company &&
            j.company.name &&
            j.company.name.toLowerCase().includes(searchTerm.toLowerCase())),
      );
  }, [jobs, searchTerm]);

  const jobsToExport = useMemo(() => {
    if (!jobs || jobs.length === 0) return [];
    const count = parseInt(exportCount, 10);
    if (!count || isNaN(count) || count <= 0) return [];
    return jobs.slice(0, count);
  }, [jobs, exportCount]);

  const handleCopyJobs = () => {
    if (jobsToExport.length === 0) return;
    const dataStr = JSON.stringify(jobsToExport, null, 2);
    navigator.clipboard.writeText(dataStr).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleRemove = (urn) => {
    setJobs(jobs.filter((job) => job.job_posting_urn !== urn));
  };

  const toggleDescription = (urn) => {
    setExpandedJobUrn(expandedJobUrn === urn ? null : urn);
  };

  const getInsightStyle = (text) => {
    if (!text) return "text-gray-400 bg-gray-800";
    const t = text.toLowerCase();
    if (t.includes("reviewing"))
      return "text-purple-300 bg-purple-900/20 border-purple-800/50";
    if (t.includes("viewed"))
      return "text-blue-300 bg-blue-900/20 border-blue-800/50";
    if (t.includes("applied"))
      return "text-emerald-300 bg-emerald-900/20 border-emerald-800/50";
    if (t.includes("posted"))
      return "text-indigo-300 bg-indigo-900/20 border-indigo-800/50";
    if (t.includes("no longer"))
      return "text-red-300 bg-red-900/20 border-red-800/50";
    return "text-gray-300 bg-gray-700/50 border-gray-600";
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {}
        <div className="p-6 border-b border-gray-700 flex flex-col gap-6 bg-gradient-to-r from-gray-800 to-emerald-900/10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Bookmark className="text-emerald-500" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">My Items</h3>
                <p className="text-xs text-gray-400">
                  Live data from LinkedIn "My Jobs"
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <input
                  type="text"
                  placeholder="Search loaded jobs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
                <div className="absolute left-3 top-2.5 text-gray-500">
                  <Search size={14} />
                </div>
              </div>
              <button
                onClick={loadJobs}
                disabled={isLoading}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  size={18}
                  className={isLoading ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 border border-transparent"
                  }`}
                >
                  <Icon size={14} /> {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Role & Company</th>
                <th className="px-6 py-4">Experience</th> {}
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Status / Insight</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw
                        className="animate-spin text-emerald-500"
                        size={32}
                      />
                      <span className="text-gray-400 text-sm">
                        Fetching from LinkedIn...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-red-400">
                    {error}
                  </td>
                </tr>
              ) : filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <React.Fragment key={job.job_posting_urn}>
                    <tr
                      className={`group transition-colors ${
                        expandedJobUrn === job.job_posting_urn
                          ? "bg-gray-800"
                          : "hover:bg-emerald-900/5"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() =>
                              toggleDescription(job.job_posting_urn)
                            }
                            className="mt-1 text-gray-500 hover:text-emerald-400 transition-colors focus:outline-none"
                          >
                            {expandedJobUrn === job.job_posting_urn ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                          <div>
                            <div
                              className="font-bold text-gray-200 cursor-pointer hover:text-emerald-400"
                              onClick={() =>
                                toggleDescription(job.job_posting_urn)
                              }
                            >
                              {job.title ? job.title.trim() : "Unknown Title"}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Building size={12} />{" "}
                              {job.company
                                ? job.company.name
                                : "Unknown Company"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {}
                      <td className="px-6 py-4">
                        {job.experienceData ? (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${getExperienceStyle(job.experienceData)}`}
                          >
                            {job.experienceData.text}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs italic opacity-50 flex items-center gap-1">
                            <Clock size={12} /> N/A
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                          <MapPin size={14} className="text-gray-500" />{" "}
                          {job.location || "Remote / Unspecified"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          {job.insights && job.insights.length > 0 ? (
                            job.insights.map((insight, idx) => (
                              <span
                                key={idx}
                                className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap ${getInsightStyle(
                                  insight,
                                )}`}
                              >
                                {insight.trim()}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-600 text-xs italic">
                              No updates
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={job.navigation_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-white hover:bg-gray-700 p-2 rounded-lg transition-colors"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button
                            onClick={() => handleRemove(job.job_posting_urn)}
                            className="text-gray-400 hover:text-red-400 hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {}
                    {expandedJobUrn === job.job_posting_urn && (
                      <tr className="bg-gray-900/30 border-b border-gray-700/50 animate-in fade-in zoom-in-95 duration-200">
                        <td colSpan="5" className="px-6 py-4">
                          <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 shadow-inner">
                            <h4 className="text-xs font-bold text-emerald-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                              <Briefcase size={12} /> Job Description
                            </h4>
                            <div className="text-gray-300 text-sm leading-relaxed max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                              <ReactMarkdown
                                components={{
                                  strong: ({ node, ...props }) => (
                                    <span
                                      className="font-bold text-white"
                                      {...props}
                                    />
                                  ),
                                  ul: ({ node, ...props }) => (
                                    <ul
                                      className="list-disc pl-5 space-y-1 my-2"
                                      {...props}
                                    />
                                  ),
                                  li: ({ node, ...props }) => (
                                    <li className="pl-1" {...props} />
                                  ),
                                  p: ({ node, ...props }) => (
                                    <p className="mb-2 last:mb-0" {...props} />
                                  ),
                                  h1: ({ node, ...props }) => (
                                    <h1
                                      className="text-lg font-bold text-emerald-400 mt-4 mb-2"
                                      {...props}
                                    />
                                  ),
                                  h2: ({ node, ...props }) => (
                                    <h2
                                      className="text-base font-bold text-emerald-400 mt-3 mb-2"
                                      {...props}
                                    />
                                  ),
                                  h3: ({ node, ...props }) => (
                                    <h3
                                      className="text-sm font-bold text-emerald-400 mt-2 mb-1"
                                      {...props}
                                    />
                                  ),
                                }}
                              >
                                {cleanJobDescription(job.description)}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Bookmark size={32} className="opacity-20" />
                      <span>No jobs found in this category.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {}
        <div className="px-6 py-3 bg-gray-900/50 border-t border-gray-700 flex justify-between items-center text-xs text-gray-500">
          <span>Showing {filteredJobs.length} items</span>
        </div>
      </div>

      {}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex flex-col">
            <label className="text-xs text-gray-400 font-bold uppercase mb-1 ml-1 flex items-center gap-1">
              <Hash size={12} /> Copy First N Items
            </label>
            <input
              type="number"
              min="1"
              max={jobs.length}
              placeholder={`Max: ${jobs.length}`}
              value={exportCount}
              onChange={(e) => setExportCount(e.target.value)}
              className="bg-gray-900 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-emerald-500 w-32"
            />
          </div>
          <div className="flex flex-col justify-end h-full pt-5">
            <span className="text-sm font-medium text-gray-300 bg-gray-900 px-3 py-2 rounded-lg border border-gray-700 min-w-[100px] text-center">
              Count:{" "}
              <span className="text-emerald-400 font-bold">
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
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-500/20"
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

export default SavedJobs;
