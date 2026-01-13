import React, { useState, useMemo } from "react";
import {
  Bookmark,
  Search,
  MapPin,
  ExternalLink,
  Trash2,
  Building,
} from "lucide-react";

const MOCK_SAVED_JOBS = [
  {
    company: {
      name: "CloudWalk, Inc.",
      urn: "urn:li:fsd_company:3523168",
    },
    entity_urn:
      "urn:li:fsd_entityResultViewModel:(urn:li:fsd_jobPosting:4350877096,SEARCH_MY_ITEMS_JOB_SEEKER,DEFAULT)",
    insights: ["Posted 1w ago"],
    job_posting_urn: "urn:li:fsd_jobPosting:4350877096",
    location: "São Paulo, SP (Remote)",
    navigation_url:
      "https://www.linkedin.com/jobs/view/4350877096/?refId=7ca78e02-e003-4a63-9a87-b1eee208bd37&trackingId=x%2FcIBIB9ST%2BJNoMIiSuouw%3D%3D&trk=flagship3_job_home_savedjobs",
    title: "Engineer – (Python/TypeScript)",
  },
  {
    company: {
      name: "UDS Technology",
      urn: "urn:li:fsd_company:10346853",
    },
    entity_urn:
      "urn:li:fsd_entityResultViewModel:(urn:li:fsd_jobPosting:4352003373,SEARCH_MY_ITEMS_JOB_SEEKER,DEFAULT)",
    insights: ["Actively reviewing applicants", "Posted 4d ago • Easy Apply"],
    job_posting_urn: "urn:li:fsd_jobPosting:4352003373",
    location: "Brazil (Remote)",
    navigation_url:
      "https://www.linkedin.com/jobs/view/4352003373/?refId=7ca78e02-e003-4a63-9a87-b1eee208bd37&trackingId=%2FtSBarfdR3Sf5Z3%2Bu7ttsw%3D%3D&trk=flagship3_job_home_savedjobs",
    title: "Desenvolvedor full stack (DevOps)",
  },
];

const SavedJobs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [jobs, setJobs] = useState(MOCK_SAVED_JOBS);

  const filteredJobs = useMemo(() => {
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.company.name.toLowerCase().includes(searchTerm.toLowerCase()),
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
      <div className="p-6 border-b border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-gray-800 to-emerald-900/10">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Bookmark className="text-emerald-500" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Saved / Applied</h3>
            <p className="text-xs text-gray-400">
              Imported from LinkedIn "My Items"
            </p>
          </div>
          <span className="ml-2 text-xs font-mono text-emerald-300 bg-emerald-900/30 px-2 py-1 rounded border border-emerald-800/50">
            Count: {jobs.length}
          </span>
        </div>

        {}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
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
              <th className="px-6 py-4">Role & Company</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Status / Insight</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredJobs.length > 0 ? (
              filteredJobs.map((job) => (
                <tr
                  key={job.job_posting_urn}
                  className="group hover:bg-emerald-900/5 transition-colors"
                >
                  <td className="px-6 py-4">
                    {}
                    <div className="font-bold text-gray-200">
                      {job.title.trim()}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <Building size={12} />
                      {job.company.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <MapPin size={14} className="text-gray-500" />
                      {job.location}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      {}
                      {job.insights && job.insights.length > 0 ? (
                        job.insights.map((insight, idx) => (
                          <span
                            key={idx}
                            className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap ${getInsightStyle(insight)}`}
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
                        title="Remove"
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
                    <span>No jobs found matching your search.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SavedJobs;
