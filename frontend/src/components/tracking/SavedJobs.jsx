import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import {
  fetchLinkedinJobsRaw,
  LINKEDIN_CARD_TYPE,
} from "../../services/jobService";

const SavedJobs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState(LINKEDIN_CARD_TYPE.SAVED);

  const TABS = [
    { id: LINKEDIN_CARD_TYPE.SAVED, label: "Saved", icon: Bookmark },
    { id: LINKEDIN_CARD_TYPE.APPLIED, label: "Applied", icon: Briefcase },
    { id: LINKEDIN_CARD_TYPE.IN_PROGRESS, label: "In Progress", icon: Layers },
    { id: LINKEDIN_CARD_TYPE.ARCHIVED, label: "Archived", icon: Archive },
  ];

  const loadJobs = async () => {
    setIsLoading(true);
    setError(null);
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
    return jobs.filter(
      (j) =>
        (j.title && j.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (j.company &&
          j.company.name &&
          j.company.name.toLowerCase().includes(searchTerm.toLowerCase())),
    );
  }, [jobs, searchTerm]);

  const handleRemove = (urn) => {
    setJobs(jobs.filter((job) => job.job_posting_urn !== urn));
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
            {}
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

            {}
            <button
              onClick={loadJobs}
              disabled={isLoading}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw
                size={18}
                className={isLoading ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        {}
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 border border-transparent"
                }`}
              >
                <Icon size={14} />
                {tab.label}
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
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Status / Insight</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan="4" className="p-12 text-center">
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
                <td colSpan="4" className="p-12 text-center text-red-400">
                  {error}
                </td>
              </tr>
            ) : filteredJobs.length > 0 ? (
              filteredJobs.map((job) => (
                <tr
                  key={job.job_posting_urn}
                  className="group hover:bg-emerald-900/5 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-200">
                      {job.title ? job.title.trim() : "Unknown Title"}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <Building size={12} />
                      {job.company ? job.company.name : "Unknown Company"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <MapPin size={14} className="text-gray-500" />
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
                        title="View on LinkedIn"
                      >
                        <ExternalLink size={16} />
                      </a>
                      <button
                        onClick={() => handleRemove(job.job_posting_urn)}
                        className="text-gray-400 hover:text-red-400 hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                        title="Dismiss from View"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="p-8 text-center text-gray-500">
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

      <div className="px-6 py-3 bg-gray-900/50 border-t border-gray-700 flex justify-between items-center text-xs text-gray-500">
        <span>Showing {filteredJobs.length} items</span>
        {jobs.length === 10 && <span>(LinkedIn pagination limit 10)</span>}
      </div>
    </div>
  );
};

export default SavedJobs;
