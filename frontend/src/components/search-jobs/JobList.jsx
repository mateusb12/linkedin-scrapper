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
const POSITIVE_KEYWORDS_CACHE_KEY = "positive_keywords_v1";

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

  const [progressData, setProgressData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [cacheTimestamp, setCacheTimestamp] = useState(null);
  const [loadedFromCache, setLoadedFromCache] = useState(false);

  const [negativeKeywords, setNegativeKeywords] = useState([]);
  const [newNegativeKeyword, setNewNegativeKeyword] = useState("");

  const [positiveKeywords, setPositiveKeywords] = useState([]);
  const [newPositiveKeyword, setNewPositiveKeyword] = useState("");

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

  useEffect(() => {
    setNegativeKeywords(readNegativeKeywordsCache());
    setPositiveKeywords(readPositiveKeywordsCache());
  }, []);

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

  const handleConfirmFetch = async (count) => {
    await loadJobs({ forceRefresh: true, count });
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

      if (negativeKeywords.length > 0) {
        isNegativeMatch = negativeKeywords.some((keyword) =>
          matchesKeyword(haystack, keyword),
        );
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
    positiveKeywords,
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
    (maxApplicantsLimit !== Number.MAX_SAFE_INTEGER ? 1 : 0);

  const positiveFiltersCount = positiveKeywords.length > 0 ? 1 : 0;

  return (
    <JobListingView
      jobsState={{
        filteredJobs,
        negativeMatchCount,
        selectedJobId,
        selectedJob,
        loading,
        progressData,
        errorMessage,
        cacheTimestamp,
        loadedFromCache,
      }}
      filtersState={{
        searchTerm,
        workplaceType,
        verificationFilter,
        repostedFilter,
        sourceFilter,
        sortBy,
        negativeKeywords,
        newNegativeKeyword,
        positiveKeywords,
        newPositiveKeyword,
        maxApplicantsLimit,
        negativeFiltersCount,
        positiveFiltersCount,
      }}
      filterOptions={{
        workplaceOptions,
        sourceOptions,
        maxPossibleApplicants,
      }}
      actions={{
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
        setNewPositiveKeyword,
        addPositiveKeyword: handleAddPositiveKeyword,
        removePositiveKeyword: handleRemovePositiveKeyword,
        onApplicantsLimitChange: handleApplicantsLimitChange,
      }}
    />
  );
};

export default MainJobListing;
