import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { streamGraphqlJobs } from "../../services/graphqlJobsService.js";
import {
  buildJobInsights,
  buildUniqueOptions,
  clearJobsCache,
  normalizeText,
  readJobsCache,
  writeJobsCache,
  readNegativeKeywordsCache,
  writeNegativeKeywordsCache,
  readNegativeCompaniesCache,
  writeNegativeCompaniesCache,
} from "./joblistUtils.jsx";

import JobListingSidebar from "./JobListingSidebar.jsx";
import JobListingJobDetails from "./JobListingJobDetails.jsx";
import { useToast } from "../toast/Toast.jsx";
import { scoreJobsBatch } from "../../services/jobService";

const APPLICANTS_LIMIT_CACHE_KEY = "negative_applicants_limit_v1";
const POSITIVE_KEYWORDS_CACHE_KEY = "positive_keywords_v1";
const MUST_HAVE_KEYWORDS_CACHE_KEY = "must_have_keywords_v1";

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readPositiveKeywordsCache = () => {
  try {
    const cached = localStorage.getItem(POSITIVE_KEYWORDS_CACHE_KEY);
    const parsed = cached ? JSON.parse(cached) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePositiveKeywordsCache = (keywords) => {
  try {
    localStorage.setItem(POSITIVE_KEYWORDS_CACHE_KEY, JSON.stringify(keywords));
  } catch (error) {
    console.error("Failed to write positive keywords cache:", error);
  }
};

const readMustHaveKeywordsCache = () => {
  try {
    const cached = localStorage.getItem(MUST_HAVE_KEYWORDS_CACHE_KEY);
    const parsed = cached ? JSON.parse(cached) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeMustHaveKeywordsCache = (keywords) => {
  try {
    localStorage.setItem(
      MUST_HAVE_KEYWORDS_CACHE_KEY,
      JSON.stringify(keywords),
    );
  } catch (error) {
    console.error("Failed to write must-have keywords cache:", error);
  }
};

const matchesKeyword = (haystack, keyword) => {
  const escapedKeyword = escapeRegExp(keyword.toLowerCase());
  const regex = new RegExp(`(?<![\\w+#-])${escapedKeyword}(?![\\w+#-])`, "i");

  return regex.test(haystack);
};

const buildKeywordHaystack = (job) => {
  return [
    job.title,
    job.company?.name,
    job.description_snippet,
    job.description_full,
    ...(job.keywords || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

const MainJobListing = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const [progressData, setProgressData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [cacheTimestamp, setCacheTimestamp] = useState(null);
  const [loadedFromCache, setLoadedFromCache] = useState(false);

  const [isFetchModalOpen, setIsFetchModalOpen] = useState(false);
  const [fetchCount, setFetchCount] = useState(10);

  const [negativeKeywords, setNegativeKeywords] = useState([]);
  const [newNegativeKeyword, setNewNegativeKeyword] = useState("");

  const [negativeCompanies, setNegativeCompanies] = useState([]);

  const [positiveKeywords, setPositiveKeywords] = useState([]);
  const [newPositiveKeyword, setNewPositiveKeyword] = useState("");

  const [mustHaveKeywords, setMustHaveKeywords] = useState([]);
  const [newMustHaveKeyword, setNewMustHaveKeyword] = useState("");

  const [maxApplicantsLimit, setMaxApplicantsLimit] = useState(() => {
    try {
      const cached = localStorage.getItem(APPLICANTS_LIMIT_CACHE_KEY);
      return cached ? Number(cached) : Number.MAX_SAFE_INTEGER;
    } catch {
      return Number.MAX_SAFE_INTEGER;
    }
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [workplaceType, setWorkplaceType] = useState("All");
  const [verificationFilter, setVerificationFilter] = useState("All");
  const [repostedFilter, setRepostedFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [sortBy, setSortBy] = useState("relevance");

  const [isDragging, setIsDragging] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(37);
  const containerRef = useRef(null);

  const MIN_WIDTH = 28;
  const MAX_WIDTH = 65;

  useEffect(() => {
    setNegativeKeywords(readNegativeKeywordsCache());
    setPositiveKeywords(readPositiveKeywordsCache());
    setMustHaveKeywords(readMustHaveKeywordsCache());
    setNegativeCompanies(readNegativeCompaniesCache());
  }, []);

  const handleMouseDown = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (event) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidthPx = event.clientX - containerRect.left;
      const newWidthPercent = (newWidthPx / containerRect.width) * 100;
      const clampedWidth = Math.max(
        MIN_WIDTH,
        Math.min(newWidthPercent, MAX_WIDTH),
      );

      setLeftPanelWidth(clampedWidth);
    },
    [isDragging],
  );

  useEffect(() => {
    if (!isDragging) return;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleAddNegativeKeyword = (event) => {
    event.preventDefault();

    if (!newNegativeKeyword.trim()) return;

    const normalized = newNegativeKeyword.trim().toLowerCase();

    if (!negativeKeywords.includes(normalized)) {
      const updated = [...negativeKeywords, normalized];
      setNegativeKeywords(updated);
      writeNegativeKeywordsCache(updated);
    }

    setNewNegativeKeyword("");
  };

  const handleRemoveNegativeKeyword = (keyword) => {
    const updated = negativeKeywords.filter((item) => item !== keyword);
    setNegativeKeywords(updated);
    writeNegativeKeywordsCache(updated);
  };

  const handleToggleNegativeCompany = (companyName) => {
    setNegativeCompanies((prev) => {
      const updated = prev.includes(companyName)
        ? prev.filter((c) => c !== companyName)
        : [...prev, companyName];
      writeNegativeCompaniesCache(updated);
      return updated;
    });
  };

  const handleAddPositiveKeyword = (event) => {
    event.preventDefault();

    if (!newPositiveKeyword.trim()) return;

    const normalized = newPositiveKeyword.trim().toLowerCase();

    if (!positiveKeywords.includes(normalized)) {
      const updated = [...positiveKeywords, normalized];
      setPositiveKeywords(updated);
      writePositiveKeywordsCache(updated);
    }

    setNewPositiveKeyword("");
  };

  const handleRemovePositiveKeyword = (keyword) => {
    const updated = positiveKeywords.filter((item) => item !== keyword);
    setPositiveKeywords(updated);
    writePositiveKeywordsCache(updated);
  };

  const handleAddMustHaveKeyword = (event) => {
    event.preventDefault();

    if (!newMustHaveKeyword.trim()) return;

    const normalized = newMustHaveKeyword.trim().toLowerCase();

    if (!mustHaveKeywords.includes(normalized)) {
      const updated = [...mustHaveKeywords, normalized];
      setMustHaveKeywords(updated);
      writeMustHaveKeywordsCache(updated);
    }

    setNewMustHaveKeyword("");
  };

  const handleRemoveMustHaveKeyword = (keyword) => {
    const updated = mustHaveKeywords.filter((item) => item !== keyword);
    setMustHaveKeywords(updated);
    writeMustHaveKeywordsCache(updated);
  };

  const applyJobs = useCallback((data) => {
    setJobs(Array.isArray(data) ? data : []);

    setSelectedJobId((currentSelectedId) => {
      if (
        Array.isArray(data) &&
        data.some((job) => job.id === currentSelectedId)
      ) {
        return currentSelectedId;
      }

      return data?.[0]?.id ?? null;
    });
  }, []);

  const loadJobs = useCallback(
    async ({ forceRefresh = false, count = 10 } = {}) => {
      setLoading(true);
      setErrorMessage("");
      setProgressData(null);

      if (!forceRefresh) {
        const cached = readJobsCache();

        if (cached?.jobs) {
          applyJobs(cached.jobs);
          setCacheTimestamp(cached.cachedAt || null);
          setLoadedFromCache(true);
          setLoading(false);
          return;
        }
      }

      try {
        const data = await streamGraphqlJobs(
          {
            count,
            blacklist: negativeCompanies,
          },
          (progressUpdate) => {
            setProgressData(progressUpdate);
          },
        );

        const scoreMap = await scoreJobsBatch(data);

        const enrichedJobs = data.map((job) => {
          const score = scoreMap.get(String(job.id));

          if (!score) return job;

          return {
            ...job,
            aiScore: score.total_score ?? 0,
            pythonScore: score.total_score ?? 0,
            pythonSignalScore: score.category_scores?.python_primary ?? 0,
            aiArchetype:
              score.archetype ||
              score.metadata?.archetype ||
              null,
            aiSignals: score.metadata?.archetype_signals || null,
            aiSuspicious: Boolean(score.suspicious),
            aiSuspiciousReasons: score.suspicious_reasons || [],
          };
        });

        const cachedAt = writeJobsCache(enrichedJobs);

        applyJobs(enrichedJobs);
        setCacheTimestamp(cachedAt);
        setLoadedFromCache(false);
      } catch (error) {
        console.error("Failed to load GraphQL jobs:", error);

        const message = error?.message || "Failed to load jobs from backend.";

        toast.error(message);

        const cached = readJobsCache();

        if (cached?.jobs) {
          applyJobs(cached.jobs);
          setCacheTimestamp(cached.cachedAt || null);
          setLoadedFromCache(true);
          setErrorMessage(
            "Backend fetch failed. Showing the latest cached jobs instead.",
          );
        } else {
          applyJobs([]);
          setErrorMessage(
            error?.message || "Failed to load jobs from backend.",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [applyJobs, toast, negativeCompanies],
  );

  useEffect(() => {
    const cached = readJobsCache();

    if (cached?.jobs) {
      applyJobs(cached.jobs);
      setCacheTimestamp(cached.cachedAt || null);
      setLoadedFromCache(true);
      setLoading(false);
      return;
    }

    applyJobs([]);
    setCacheTimestamp(null);
    setLoadedFromCache(false);
    setLoading(false);
  }, [applyJobs]);

  const handleConfirmFetch = async (count) => {
    await loadJobs({ forceRefresh: true, count });
    setProgressData(null);
    setIsFetchModalOpen(false);
  };

  const handleClearCache = () => {
    clearJobsCache();
    applyJobs([]);
    setCacheTimestamp(null);
    setLoadedFromCache(false);
    setErrorMessage("");
    setProgressData(null);
    setIsFetchModalOpen(true);
  };

  const maxPossibleApplicants = useMemo(() => {
    if (!jobs || jobs.length === 0) return 100;

    const max = Math.max(...jobs.map((job) => job.applicants_total || 0));
    return max > 0 ? max : 100;
  }, [jobs]);

  const handleApplicantsLimitChange = (event) => {
    const value = Number(event.target.value);
    const newValue =
      value >= maxPossibleApplicants ? Number.MAX_SAFE_INTEGER : value;

    setMaxApplicantsLimit(newValue);
    localStorage.setItem(APPLICANTS_LIMIT_CACHE_KEY, newValue.toString());
  };

  const workplaceOptions = useMemo(() => {
    return buildUniqueOptions(jobs, (job) => job.workplace_type);
  }, [jobs]);

  const sourceOptions = useMemo(() => {
    return buildUniqueOptions(
      jobs,
      (job) => job.source_key,
      (_, job) => job.source_label,
    );
  }, [jobs]);

  const companyOptions = useMemo(() => {
    return buildUniqueOptions(jobs, (job) => job.company?.name);
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    let result = jobs.map((job) => {
      const haystack = buildKeywordHaystack(job);

      const matchedPositiveKeywords =
        positiveKeywords.length > 0
          ? positiveKeywords.filter((keyword) =>
              matchesKeyword(haystack, keyword),
            )
          : [];

      let isNegativeMatch = false;
      let missingMustHaveKeywords = [];

      if (negativeKeywords.length > 0) {
        isNegativeMatch = negativeKeywords.some((keyword) =>
          matchesKeyword(haystack, keyword),
        );
      }

      if (!isNegativeMatch && negativeCompanies.length > 0) {
        if (negativeCompanies.includes(job.company?.name)) {
          isNegativeMatch = true;
        }
      }

      if (!isNegativeMatch && mustHaveKeywords.length > 0) {
        missingMustHaveKeywords = mustHaveKeywords.filter(
          (keyword) => !matchesKeyword(haystack, keyword),
        );
        if (missingMustHaveKeywords.length > 0) {
          isNegativeMatch = true;
        }
      }

      if (!isNegativeMatch && maxApplicantsLimit !== Number.MAX_SAFE_INTEGER) {
        if ((job.applicants_total || 0) > maxApplicantsLimit) {
          isNegativeMatch = true;
        }
      }

      return {
        ...job,
        isNegativeMatch,
        positiveScore: matchedPositiveKeywords.length,
        matchedPositiveKeywords,
        missingMustHaveKeywords,
      };
    });

    if (searchTerm.trim()) {
      const query = normalizeText(searchTerm);

      result = result.filter((job) => {
        const insights = buildJobInsights(job);

        const haystack = [
          job.title,
          job.company.name,
          job.location,
          job.workplace_type,
          job.source_label,
          ...(job.keywords || []),
          ...(insights.techStack || []),
          insights.seniority,
          insights.jobType,
          insights.experience?.text,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

        return normalizeText(haystack).includes(query);
      });
    }

    if (workplaceType !== "All") {
      result = result.filter((job) => job.workplace_type === workplaceType);
    }

    if (verificationFilter === "Verified") {
      result = result.filter((job) => job.verified);
    } else if (verificationFilter === "Unverified") {
      result = result.filter((job) => !job.verified);
    }

    if (repostedFilter === "Reposted") {
      result = result.filter((job) => job.reposted);
    } else if (repostedFilter === "Original") {
      result = result.filter((job) => !job.reposted);
    }

    if (sourceFilter !== "All") {
      result = result.filter((job) => job.source_key === sourceFilter);
    }

    result.sort((a, b) => {
      if (a.isNegativeMatch !== b.isNegativeMatch) {
        return a.isNegativeMatch ? 1 : -1;
      }

      if (sortBy === "relevance") {
        const scoreDiff = (b.positiveScore || 0) - (a.positiveScore || 0);

        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return (
          new Date(b.posted_at || 0).getTime() -
          new Date(a.posted_at || 0).getTime()
        );
      }

      if (sortBy === "keywordScore" || sortBy === "score") {
        const scoreDiff = (b.positiveScore || 0) - (a.positiveScore || 0);

        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return a.title.localeCompare(b.title);
      }

      if (sortBy === "pythonScore") {
        const scoreDiff = (b.pythonScore || 0) - (a.pythonScore || 0);

        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return a.title.localeCompare(b.title);
      }

      if (sortBy === "aiScore") {
        const scoreDiff = (b.aiScore || 0) - (a.aiScore || 0);

        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return a.title.localeCompare(b.title);
      }

      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }

      if (sortBy === "company") {
        return a.company.name.localeCompare(b.company.name);
      }

      if (sortBy === "applicants") {
        return (a.applicants_total || 0) - (b.applicants_total || 0);
      }

      if (sortBy === "recent") {
        return (
          new Date(b.posted_at || 0).getTime() -
          new Date(a.posted_at || 0).getTime()
        );
      }

      return 0;
    });

    return result;
  }, [
    jobs,
    searchTerm,
    workplaceType,
    verificationFilter,
    repostedFilter,
    sourceFilter,
    sortBy,
    negativeKeywords,
    negativeCompanies,
    positiveKeywords,
    mustHaveKeywords,
    maxApplicantsLimit,
  ]);

  const negativeMatchCount = useMemo(() => {
    return filteredJobs.filter((job) => job.isNegativeMatch).length;
  }, [filteredJobs]);

  useEffect(() => {
    if (!filteredJobs.length) {
      setSelectedJobId(null);
      return;
    }

    const stillExists = filteredJobs.some((job) => job.id === selectedJobId);

    if (!stillExists) {
      setSelectedJobId(filteredJobs[0].id);
    }
  }, [filteredJobs, selectedJobId]);

  const selectedJob =
    filteredJobs.find((job) => job.id === selectedJobId) || null;

  const negativeFiltersCount =
    (negativeKeywords.length > 0 ? 1 : 0) +
    (negativeCompanies.length > 0 ? 1 : 0) +
    (maxApplicantsLimit !== Number.MAX_SAFE_INTEGER ? 1 : 0);

  const positiveFiltersCount = positiveKeywords.length > 0 ? 1 : 0;
  const mustHaveFiltersCount = mustHaveKeywords.length > 0 ? 1 : 0;

  const jobsState = {
    filteredJobs,
    negativeMatchCount,
    selectedJobId,
    selectedJob,
    loading,
    progressData,
    errorMessage,
    cacheTimestamp,
    loadedFromCache,
  };

  const filtersState = {
    searchTerm,
    workplaceType,
    verificationFilter,
    repostedFilter,
    sourceFilter,
    sortBy,
    negativeKeywords,
    newNegativeKeyword,
    negativeCompanies,
    positiveKeywords,
    newPositiveKeyword,
    mustHaveKeywords,
    newMustHaveKeyword,
    maxApplicantsLimit,
    negativeFiltersCount,
    positiveFiltersCount,
    mustHaveFiltersCount,
  };

  const filterOptions = {
    workplaceOptions,
    sourceOptions,
    companyOptions,
    maxPossibleApplicants,
  };

  const actions = {
    onSelectJob: setSelectedJobId,
    onConfirmFetch: handleConfirmFetch,
    onClearCache: handleClearCache,
    setSearchTerm,
    setWorkplaceType,
    setVerificationFilter,
    setRepostedFilter,
    setSourceFilter,
    setSortBy,
    setNewNegativeKeyword,
    addNegativeKeyword: handleAddNegativeKeyword,
    removeNegativeKeyword: handleRemoveNegativeKeyword,
    toggleNegativeCompany: handleToggleNegativeCompany,
    setNewPositiveKeyword,
    addPositiveKeyword: handleAddPositiveKeyword,
    removePositiveKeyword: handleRemovePositiveKeyword,
    setNewMustHaveKeyword,
    addMustHaveKeyword: handleAddMustHaveKeyword,
    removeMustHaveKeyword: handleRemoveMustHaveKeyword,
    onApplicantsLimitChange: handleApplicantsLimitChange,
  };

  const fetchModalState = {
    isFetchModalOpen,
    fetchCount,
  };

  const fetchModalActions = {
    setIsFetchModalOpen,
    setFetchCount,
  };

  return (
    <div className="h-screen bg-[#081120] font-sans text-slate-100">
      <div
        ref={containerRef}
        className="flex h-full"
        style={{ userSelect: isDragging ? "none" : "auto" }}
      >
        <JobListingSidebar
          leftPanelWidth={leftPanelWidth}
          jobsState={jobsState}
          filtersState={filtersState}
          filterOptions={filterOptions}
          actions={actions}
          fetchModalState={fetchModalState}
          fetchModalActions={fetchModalActions}
        />

        <div
          className="w-2 cursor-col-resize bg-slate-800 transition hover:bg-sky-500"
          onMouseDown={handleMouseDown}
        />

        <main className="flex-1 bg-[#0d1728]">
          <JobListingJobDetails job={selectedJob} />
        </main>
      </div>
    </div>
  );
};

export default MainJobListing;
