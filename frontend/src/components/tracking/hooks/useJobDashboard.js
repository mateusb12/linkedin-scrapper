import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAppliedJobs,
  fetchJobFailures,
  syncEmails,
  syncApplicationStatus,
  fetchDashboardInsights,
  reconcileJobStatuses,
} from "../../../services/jobService.js";
import {
  processCurrentFormData,
  processHistoryData,
} from "../utils/dashboardUtils.js";
import { useToast } from "../../toast/Toast.jsx";

export const useJobDashboard = () => {
  const [page, setPage] = useState(1);
  const [failPage, setFailPage] = useState(1);
  const [historyPeriod, setHistoryPeriod] = useState("daily");
  const [insightsTimeRange, setInsightsTimeRange] = useState("all_time");
  const [isSyncing, setIsSyncing] = useState(false);
  const toast = useToast();

  const {
    data: allJobsData,
    isLoading: isLoadingStats,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["allJobs"],
    queryFn: () => fetchAppliedJobs({}),
    staleTime: 60000,
  });

  const {
    data: paginatedData,
    isLoading: isLoadingTable,
    refetch: refetchTable,
    isFetching: isFetchingTable,
  } = useQuery({
    queryKey: ["appliedJobs", page],
    queryFn: () => fetchAppliedJobs({ page, limit: 10 }),
    keepPreviousData: true,
  });

  const {
    data: failureData,
    isLoading: isLoadingFailures,
    refetch: refetchFailures,
  } = useQuery({
    queryKey: ["jobFailures", failPage],
    queryFn: () => fetchJobFailures({ page: failPage, limit: 10 }),
    keepPreviousData: true,
  });

  const {
    data: insightsData,
    isLoading: isLoadingInsights,
    refetch: refetchInsights,
  } = useQuery({
    queryKey: ["dashboardInsights", insightsTimeRange],
    queryFn: () => fetchDashboardInsights(insightsTimeRange),
    refetchOnWindowFocus: true,
    retry: false,
  });

  const jobs = useMemo(() => {
    if (!allJobsData) return [];

    if (Array.isArray(allJobsData?.data?.jobs)) {
      return allJobsData.data.jobs;
    }

    if (Array.isArray(allJobsData?.jobs)) {
      return allJobsData.jobs;
    }

    if (Array.isArray(allJobsData?.data)) {
      return allJobsData.data;
    }

    if (Array.isArray(allJobsData)) {
      return allJobsData;
    }

    console.warn("Unknown applied jobs API format:", allJobsData);
    return [];
  }, [allJobsData]);

  const currentStats = useMemo(() => {
    return processCurrentFormData(jobs);
  }, [jobs]);

  const historyStats = useMemo(
    () => processHistoryData(jobs, historyPeriod),
    [jobs, historyPeriod],
  );

  useEffect(() => {
    const initSync = async () => {
      try {
        const result = await syncApplicationStatus();
        if (!result?.skipped) {
          await refetchStats();
        }
        refetchTable();
      } catch (err) {
        console.info(
          "Auto-sync skipped or failed without blocking dashboard.",
          err,
        );
      }
    };
    initSync();
  }, [refetchStats, refetchTable]);

  const handleCrossCheck = async () => {
    setIsSyncing(true);
    try {
      console.log("🔀 Triggering SQL Cross-Check...");
      await reconcileJobStatuses();
      await Promise.all([refetchStats(), refetchTable(), refetchFailures()]);
    } catch (error) {
      console.error("Cross-check failed", error);
      toast.error(error?.response?.data?.error || "Cross-check failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const refreshData = async (activeTab) => {
    setIsSyncing(true);
    try {
      if (activeTab === "rejections") {
        await syncEmails("Job fails");
        await refetchFailures();
      } else if (activeTab === "insights") {
        await refetchInsights();
      } else {
        await Promise.all([refetchStats(), refetchTable()]);
      }
    } catch (error) {
      console.error("Sync failed", error);

      const message =
        error?.response?.data?.error || error?.message || "Failed to sync data";

      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    stats: {
      current: currentStats,
      history: historyStats,
      allRaw: jobs,
    },
    tables: {
      jobs: paginatedData,
      failures: failureData,
      insights: insightsData,
    },
    loading: {
      stats: isLoadingStats,
      table: isLoadingTable,
      tableFetching: isFetchingTable,
      failures: isLoadingFailures,
      insights: isLoadingInsights,
      syncing: isSyncing,
    },
    controls: {
      page,
      setPage,
      failPage,
      setFailPage,
      historyPeriod,
      setHistoryPeriod,
      insightsTimeRange,
      setInsightsTimeRange,
    },
    actions: {
      crossCheck: handleCrossCheck,
      refresh: refreshData,
    },
  };
};
