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

export const useJobDashboard = () => {
  const [page, setPage] = useState(1);
  const [failPage, setFailPage] = useState(1);
  const [historyPeriod, setHistoryPeriod] = useState("daily");
  const [insightsTimeRange, setInsightsTimeRange] = useState("all_time");
  const [isSyncing, setIsSyncing] = useState(false);

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
  });

  const jobs = Array.isArray(allJobsData) ? allJobsData : [];

  const currentStats = useMemo(() => processCurrentFormData(jobs), [jobs]);

  const historyStats = useMemo(
    () => processHistoryData(jobs, historyPeriod),
    [jobs, historyPeriod],
  );

  useEffect(() => {
    const initSync = async () => {
      try {
        console.log("🔄 Auto-syncing application statuses...");
        await syncApplicationStatus();
        refetchTable();
      } catch (err) {
        console.error("Auto-sync failed:", err);
      }
    };
    initSync();
  }, [refetchTable]);

  const handleCrossCheck = async () => {
    setIsSyncing(true);
    try {
      console.log("🔀 Triggering SQL Cross-Check...");
      await reconcileJobStatuses();
      await Promise.all([refetchStats(), refetchTable(), refetchFailures()]);
    } catch (error) {
      console.error("Cross-check failed", error);
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
