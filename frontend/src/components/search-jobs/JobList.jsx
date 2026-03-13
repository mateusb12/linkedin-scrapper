import React, { useCallback, useEffect, useMemo, useState } from "react";
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
} from "./joblistUtils.js";

import JobListingView from "./JobListingView.jsx";

const APPLICANTS_LIMIT_CACHE_KEY = "negative_applicants_limit_v1";

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MainJobListing = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isFetchModalOpen, setIsFetchModalOpen] = useState(false);
  const [fetchCount, setFetchCount] = useState(10);

  const [progressData, setProgressData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [cacheTimestamp, setCacheTimestamp] = useState(null);
  const [loadedFromCache, setLoadedFromCache] = useState(false);

  const [negativeKeywords, setNegativeKeywords] = useState([]);
  const [newNegativeKeyword, setNewNegativeKeyword] = useState("");
  const [maxApplicantsLimit, setMaxApplicantsLimit] = useState(() => {
    try {
      const cached = localStorage.getItem(APPLICANTS_LIMIT_CACHE_KEY);
      return cached ? Number(cached) : Number.MAX_SAFE_INTEGER;
    } catch {
      return Number.MAX_SAFE_INTEGER;
    }
  });
  const [isNegativeFilterOpen, setIsNegativeFilterOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [workplaceType, setWorkplaceType] = useState("All");
  const [verificationFilter, setVerificationFilter] = useState("All");
  const [repostedFilter, setRepostedFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [sortBy, setSortBy] = useState("relevance");

  useEffect(() => {
    setNegativeKeywords(readNegativeKeywordsCache());
  }, []);

  const handleAddNegativeKeyword = (e) => {
    e.preventDefault();
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
    const updated = negativeKeywords.filter((k) => k !== keyword);
    setNegativeKeywords(updated);
    writeNegativeKeywordsCache(updated);
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
        const data = await streamGraphqlJobs({ count }, (progressUpdate) => {
          setProgressData(progressUpdate);
        });

        const cachedAt = writeJobsCache(data);

        applyJobs(data);
        setCacheTimestamp(cachedAt);
        setLoadedFromCache(false);
      } catch (error) {
        console.error("Failed to load GraphQL jobs:", error);

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
    [applyJobs],
  );

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleRefreshCacheClick = () => {
    setIsFetchModalOpen(true);
  };

  const handleConfirmFetch = async (count) => {
    await loadJobs({ forceRefresh: true, count });

    setIsFetchModalOpen(false);
    setProgressData(null);
  };

  const handleClearCache = () => {
    clearJobsCache();
    setCacheTimestamp(null);
    setLoadedFromCache(false);
    setErrorMessage("");
  };

  const maxPossibleApplicants = useMemo(() => {
    if (!jobs || jobs.length === 0) return 100;
    const max = Math.max(...jobs.map((job) => job.applicants_total || 0));
    return max > 0 ? max : 100;
  }, [jobs]);

  const handleApplicantsLimitChange = (e) => {
    const val = Number(e.target.value);
    const newValue =
      val >= maxPossibleApplicants ? Number.MAX_SAFE_INTEGER : val;
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

  const filteredJobs = useMemo(() => {
    let result = jobs.map((job) => {
      let isNegativeMatch = false;

      if (negativeKeywords.length > 0) {
        const haystack = [
          job.title,
          job.company.name,
          job.description_snippet,
          job.description_full,
          ...(job.keywords || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        isNegativeMatch = negativeKeywords.some((kw) => {
          const escapedKw = escapeRegExp(kw.toLowerCase());
          const regex = new RegExp(
            `(?<![\\w+#-])${escapedKw}(?![\\w+#-])`,
            "i",
          );
          return regex.test(haystack);
        });
      }

      if (!isNegativeMatch && maxApplicantsLimit !== Number.MAX_SAFE_INTEGER) {
        if ((job.applicants_total || 0) > maxApplicantsLimit) {
          isNegativeMatch = true;
        }
      }

      return { ...job, isNegativeMatch };
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

      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      } else if (sortBy === "company") {
        return a.company.name.localeCompare(b.company.name);
      } else if (sortBy === "applicants") {
        return (a.applicants_total || 0) - (b.applicants_total || 0);
      } else if (sortBy === "recent") {
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

  const activeFiltersCount =
    (negativeKeywords.length > 0 ? 1 : 0) +
    (maxApplicantsLimit !== Number.MAX_SAFE_INTEGER ? 1 : 0);

  return (
    <JobListingView
      filteredJobs={filteredJobs}
      negativeMatchCount={negativeMatchCount}
      selectedJobId={selectedJobId}
      selectedJob={selectedJob}
      onSelectJob={setSelectedJobId}
      loading={loading}
      progressData={progressData}
      errorMessage={errorMessage}
      cacheTimestamp={cacheTimestamp}
      loadedFromCache={loadedFromCache}
      onRefreshCacheClick={handleRefreshCacheClick}
      onClearCache={handleClearCache}
      isFetchModalOpen={isFetchModalOpen}
      setIsFetchModalOpen={setIsFetchModalOpen}
      fetchCount={fetchCount}
      setFetchCount={setFetchCount}
      onConfirmFetch={handleConfirmFetch}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      workplaceType={workplaceType}
      setWorkplaceType={setWorkplaceType}
      workplaceOptions={workplaceOptions}
      verificationFilter={verificationFilter}
      setVerificationFilter={setVerificationFilter}
      repostedFilter={repostedFilter}
      setRepostedFilter={setRepostedFilter}
      sourceFilter={sourceFilter}
      setSourceFilter={setSourceFilter}
      sourceOptions={sourceOptions}
      sortBy={sortBy}
      setSortBy={setSortBy}
      isNegativeFilterOpen={isNegativeFilterOpen}
      setIsNegativeFilterOpen={setIsNegativeFilterOpen}
      newNegativeKeyword={newNegativeKeyword}
      setNewNegativeKeyword={setNewNegativeKeyword}
      handleAddNegativeKeyword={handleAddNegativeKeyword}
      negativeKeywords={negativeKeywords}
      handleRemoveNegativeKeyword={handleRemoveNegativeKeyword}
      maxApplicantsLimit={maxApplicantsLimit}
      maxPossibleApplicants={maxPossibleApplicants}
      handleApplicantsLimitChange={handleApplicantsLimitChange}
      activeFiltersCount={activeFiltersCount}
    />
  );
};

export default MainJobListing;
