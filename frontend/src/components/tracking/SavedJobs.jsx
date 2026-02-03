import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Database,
  User,
  Code2,
  Calendar,
  Users,
  Trophy,
  Check,
} from "lucide-react";
import {
  fetchLinkedinJobsRaw,
  LINKEDIN_CARD_TYPE,
} from "../../services/jobService";
import {
  cleanJobDescription,
  extractExperienceFromDescription,
  getExperienceStyle,
  extractSeniorityFromDescription,
  extractJobTypeFromDescription,
  getSeniorityStyle,
  getTypeStyle,
  extractFoundations,
  extractSpecifics,
  getTechBadgeStyle,
  getCompetitionStyle,
  getPostedStyle,
  getTechIcon,
} from "./utils/jobUtils.js";
import { formatCustomDate } from "../../utils/dateUtils.js";

const USE_ICONS = true;

const SCORES_STORAGE_KEY = "linkedin_job_scores";

const ScoreInput = ({ initialScore, onSave }) => {
  const [value, setValue] = useState(initialScore || 0);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setValue(initialScore || 0);
    setIsDirty(false);
  }, [initialScore]);

  const handleChange = (e) => {
    const val = e.target.value;
    if (val === "") {
      setValue("");
      setIsDirty(true);
      return;
    }
    if (!/^\d*$/.test(val)) return;
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setValue(num);
      setIsDirty(num !== (initialScore || 0));
    }
  };

  const handleSave = () => {
    const finalValue = value === "" ? 0 : parseInt(value, 10);
    onSave(finalValue);
    setIsDirty(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSave();
  };

  const getScoreColor = (score) => {
    const s = parseInt(score, 10) || 0;
    if (s >= 80) return "text-emerald-400 border-emerald-500/50";
    if (s >= 50) return "text-yellow-400 border-yellow-500/50";
    if (s > 0) return "text-red-400 border-red-500/50";
    return "text-gray-500 border-gray-700";
  };

  return (
    <div className="flex items-center gap-1">
      <div className="relative w-12">
        <Trophy
          size={10}
          className="absolute left-1.5 top-2 text-gray-600 pointer-events-none"
        />
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => isDirty && handleSave()}
          className={`w-full bg-gray-900 border text-center text-xs font-bold rounded py-1 pl-3 pr-1 outline-none transition-colors focus:ring-1 focus:ring-emerald-500/50 ${getScoreColor(value)}`}
        />
      </div>
      <button
        onClick={handleSave}
        disabled={!isDirty}
        className={`p-1 rounded transition-all duration-200 ${
          isDirty
            ? "bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-110 shadow-lg shadow-emerald-900/50 cursor-pointer"
            : "bg-gray-800 text-gray-600 cursor-default opacity-50"
        }`}
        title="Confirm Score"
      >
        <Check size={12} strokeWidth={3} />
      </button>
    </div>
  );
};

const CopyFirstNItems = ({
  items,
  label = "Copy First N Items",
  stringify = (data) => JSON.stringify(data, null, 2),
}) => {
  const max = Array.isArray(items) ? items.length : 0;
  const [count, setCount] = useState(max);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    setCount(max);
  }, [max]);

  const itemsToExport = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0 || count <= 0) return [];
    return items.slice(0, Math.min(count, items.length));
  }, [items, count]);

  const handleCopy = useCallback(() => {
    if (itemsToExport.length === 0) return;
    const payload = stringify(itemsToExport);
    navigator.clipboard.writeText(payload).then(() => {
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2000);
    });
  }, [itemsToExport, stringify]);

  const handleSliderChange = (e) => setCount(Number(e.target.value));
  const handleInputChange = (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) val = 0;
    if (val > max) val = max;
    if (val < 0) val = 0;
    setCount(val);
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col lg:flex-row justify-between items-center gap-6 shadow-lg">
      <div className="flex flex-col w-full lg:w-2/3 gap-2">
        <div className="flex justify-between items-end mb-1">
          <label className="text-xs text-emerald-500 font-bold uppercase flex items-center gap-2">
            <Hash size={14} /> {label}
          </label>
          <span className="text-xs text-gray-400">
            Total Available: <span className="text-white font-mono">{max}</span>
          </span>
        </div>
        <div className="flex items-center gap-4 bg-gray-900/50 p-3 rounded-lg border border-gray-700">
          <span className="text-xs font-mono text-gray-500">1</span>
          <input
            type="range"
            min="1"
            max={max || 1}
            value={count}
            onChange={handleSliderChange}
            disabled={max === 0}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
          />
          <span className="text-xs font-mono text-gray-500">{max}</span>
          <div className="relative min-w-[60px]">
            <input
              type="number"
              min="1"
              max={max}
              value={count}
              onChange={handleInputChange}
              className="w-full bg-gray-800 border border-gray-600 text-emerald-400 font-bold text-center text-sm rounded px-1 py-1 outline-none focus:border-emerald-500 appearance-none"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end w-full lg:w-auto h-full pt-2 lg:pt-0">
        <button
          onClick={handleCopy}
          disabled={itemsToExport.length === 0}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all duration-200 w-full lg:w-auto ${
            isCopied
              ? "bg-green-600 text-white scale-105"
              : itemsToExport.length === 0
                ? "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
                : "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg hover:shadow-emerald-500/20 active:scale-95"
          }`}
        >
          {isCopied ? (
            <>
              <CheckCircle2 size={20} /> Copied!
            </>
          ) : (
            <>
              <Copy size={20} /> Copy JSON ({itemsToExport.length})
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const SavedJobs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedJobUrn, setExpandedJobUrn] = useState(null);
  const [activeTab, setActiveTab] = useState(LINKEDIN_CARD_TYPE.SAVED);
  const [isCachedData, setIsCachedData] = useState(false);

  const [scores, setScores] = useState(() => {
    try {
      const savedScores = localStorage.getItem(SCORES_STORAGE_KEY);
      return savedScores ? JSON.parse(savedScores) : {};
    } catch (e) {
      console.error("Failed to parse scores", e);
      return {};
    }
  });

  const TABS = [
    { id: LINKEDIN_CARD_TYPE.SAVED, label: "Saved", icon: Bookmark },
    { id: LINKEDIN_CARD_TYPE.APPLIED, label: "Applied", icon: Briefcase },
    { id: LINKEDIN_CARD_TYPE.IN_PROGRESS, label: "In Progress", icon: Layers },
    { id: LINKEDIN_CARD_TYPE.ARCHIVED, label: "Archived", icon: Archive },
  ];

  const getCacheKey = (tabId) => `linkedin_jobs_cache_${tabId}`;

  const loadJobs = async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    setExpandedJobUrn(null);
    const cacheKey = getCacheKey(activeTab);

    try {
      if (!forceRefresh) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          try {
            const parsedJobs = JSON.parse(cachedData);
            if (Array.isArray(parsedJobs)) {
              setJobs(parsedJobs);
              setIsCachedData(true);
              setIsLoading(false);
              return;
            }
          } catch (parseError) {
            console.warn("Invalid cache data, fetching fresh...");
          }
        }
      }

      const response = await fetchLinkedinJobsRaw({
        cardType: activeTab,
        start: 0,
        debug: false,
      });

      if (response && response.jobs) {
        setJobs(response.jobs);
        setIsCachedData(false);
        localStorage.setItem(cacheKey, JSON.stringify(response.jobs));
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
    loadJobs(false);
  }, [activeTab]);

  const handleScoreSave = (urn, newValue) => {
    const newScores = { ...scores, [urn]: newValue };
    setScores(newScores);
    localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(newScores));
  };

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];

    return jobs
      .map((job) => {
        const urn = job.urn || job.entity_urn;
        const companyName = job.company_name;

        const experienceData = extractExperienceFromDescription(
          job.description,
        );
        const fullTextContext = `${job.title} ${job.description}`;
        const seniority = extractSeniorityFromDescription(fullTextContext);
        const jobType = extractJobTypeFromDescription(fullTextContext);
        const foundations = extractFoundations(job.description);
        const specifics = extractSpecifics(job.description);
        const score = scores[urn] || 0;

        return {
          ...job,
          urn,
          company: { name: companyName },
          postedAt: job.posted_date_text,
          experienceData,
          seniority,
          jobType,
          foundations,
          specifics,
          score,
        };
      })
      .filter((j) => {
        const name = j.company?.name || "";
        return (
          j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [jobs, searchTerm, scores]);

  const handleRemove = (urn) => {
    const updatedJobs = jobs.filter((job) => job.urn !== urn);
    setJobs(updatedJobs);
    localStorage.setItem(getCacheKey(activeTab), JSON.stringify(updatedJobs));
  };

  const toggleDescription = (urn) => {
    setExpandedJobUrn(expandedJobUrn === urn ? null : urn);
  };

  const handleClearCache = () => {
    const cacheKey = getCacheKey(activeTab);
    localStorage.removeItem(cacheKey);
    setJobs([]);
    setIsCachedData(false);
    setExpandedJobUrn(null);
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
        <div className="p-6 border-b border-gray-700 flex flex-col gap-6 bg-gradient-to-r from-gray-800 to-emerald-900/10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Bookmark className="text-emerald-500" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  My Items
                  {isCachedData && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 border border-gray-600 font-normal flex items-center gap-1">
                      <Database size={10} /> Cached
                    </span>
                  )}
                </h3>
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
                onClick={() => loadJobs(true)}
                disabled={isLoading}
                title="Force refresh"
                className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition"
              >
                <RefreshCw
                  size={18}
                  className={isLoading ? "animate-spin" : ""}
                />
              </button>
              <button
                onClick={handleClearCache}
                title="Clear Cache"
                className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition"
              >
                <Trash2 size={18} />
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

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase font-bold tracking-wider">
              <tr>
                {}
                <th className="px-6 py-4">Score</th>
                <th className="px-6 py-4">Role & Company</th>
                <th className="px-6 py-4">Foundations</th>
                <th className="px-6 py-4">Specifics</th>
                <th className="px-6 py-4">Seniority</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Experience</th>
                <th className="px-6 py-4">Posted</th>
                <th className="px-6 py-4">Applicants</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Status / Insight</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan="12" className="p-12 text-center">
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
                  <td colSpan="12" className="p-12 text-center text-red-400">
                    {error}
                  </td>
                </tr>
              ) : filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <React.Fragment key={job.urn}>
                    <tr
                      className={`group transition-colors ${
                        expandedJobUrn === job.urn
                          ? "bg-gray-800"
                          : "hover:bg-emerald-900/5"
                      }`}
                    >
                      {}
                      <td className="px-6 py-4">
                        <ScoreInput
                          initialScore={job.score}
                          onSave={(val) => handleScoreSave(job.urn, val)}
                        />
                      </td>

                      <td className="px-6 py-4 min-w-[200px]">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleDescription(job.urn)}
                            className="mt-1 text-gray-500 hover:text-emerald-400 transition-colors focus:outline-none"
                          >
                            {expandedJobUrn === job.urn ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                          <div>
                            <div
                              className="font-bold text-gray-200 cursor-pointer hover:text-emerald-400"
                              onClick={() => toggleDescription(job.urn)}
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

                      <td className="px-6 py-4 max-w-[200px]">
                        <div className="flex flex-wrap items-center gap-2">
                          {job.foundations && job.foundations.length > 0 ? (
                            job.foundations.map((tech, index) => {
                              const iconSrc = getTechIcon(tech);

                              if (USE_ICONS && iconSrc) {
                                return (
                                  <div
                                    key={tech}
                                    className="relative group/icon"
                                  >
                                    <img
                                      src={iconSrc}
                                      alt={tech}
                                      className="w-9 h-9 object-contain hover:scale-125 transition-transform duration-200 cursor-help filter drop-shadow-sm"
                                    />
                                    {}
                                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-gray-700">
                                      {tech}
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <span
                                  key={tech}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border shadow-sm ${getTechBadgeStyle(index, tech)}`}
                                >
                                  {tech}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-gray-700 text-xs">-</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 max-w-[250px]">
                        <div className="flex flex-wrap gap-1.5">
                          {job.specifics && job.specifics.length > 0 ? (
                            job.specifics.map((tech, index) => (
                              <span
                                key={tech}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium border shadow-sm ${getTechBadgeStyle(index + 5, tech)}`}
                              >
                                {tech}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-700 text-xs">-</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {job.seniority ? (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${getSeniorityStyle(job.seniority)}`}
                          >
                            {job.seniority}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs italic opacity-50 flex items-center gap-1">
                            <User size={12} /> -
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {job.jobType ? (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${getTypeStyle(job.jobType)}`}
                          >
                            {job.jobType}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs italic opacity-50 flex items-center gap-1">
                            <Code2 size={12} /> -
                          </span>
                        )}
                      </td>

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
                        <div className="flex items-center gap-2 text-gray-300 text-sm whitespace-nowrap">
                          <Calendar size={14} className="text-gray-500" />
                          {job.postedAt ? (
                            <span className="capitalize">
                              {formatCustomDate(job.postedAt)}
                            </span>
                          ) : (
                            <span className="text-gray-600 italic">N/A</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-300 text-sm">
                          <Users size={14} className="text-gray-500" />
                          {job.applicants !== undefined &&
                          job.applicants !== null ? (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-bold border ${getCompetitionStyle(job.applicants)}`}
                            >
                              {job.applicants}
                            </span>
                          ) : (
                            <span className="text-gray-600 italic">-</span>
                          )}
                        </div>
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
                                className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap ${
                                  insight.toLowerCase().includes("posted")
                                    ? getPostedStyle(insight)
                                    : getInsightStyle(insight)
                                }`}
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
                            onClick={() => handleRemove(job.urn)}
                            className="text-gray-400 hover:text-red-400 hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedJobUrn === job.urn && (
                      <tr className="bg-gray-900/30 border-b border-gray-700/50 animate-in fade-in zoom-in-95 duration-200">
                        <td colSpan="12" className="px-6 py-4">
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
                  <td colSpan="12" className="p-8 text-center text-gray-500">
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
        </div>
      </div>

      {}
      <CopyFirstNItems items={jobs} />
    </div>
  );
};

export default SavedJobs;
