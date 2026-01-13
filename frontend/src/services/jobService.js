import { API_BASE, handleResponse } from "./config";

export const fetchAllJobs = async () => {
  const response = await fetch(`${API_BASE}/jobs/all`);
  return handleResponse(response, "Failed to fetch all jobs");
};

export const markJobAsApplied = async (jobUrn) => {
  const response = await fetch(`${API_BASE}/jobs/${jobUrn}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applied_on: new Date().toISOString() }),
  });
  return handleResponse(response, "Failed to mark job as applied");
};

export const markJobAsDisabled = async (jobUrn) => {
  const response = await fetch(`${API_BASE}/jobs/${jobUrn}/disable`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disabled: true }),
  });
  return handleResponse(response, "Failed to mark job as disabled");
};

export const getMatchScore = async (jobDescription, resumeText) => {
  const payload = {
    job_description: jobDescription,
    resume: resumeText,
  };
  console.log("🔼 Sending match score request:", {
    job_description: jobDescription,
    resume: resumeText,
  });
  const response = await fetch(`${API_BASE}/jobs/match-score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(response, "Failed to fetch match score");
};

export const fetchHuntrAppliedJobs = async () => {
  const response = await fetch(`${API_BASE}/services/huntr`);
  return handleResponse(response, "Failed to fetch Huntr applied jobs");
};

export const fetchLinkedinAppliedJobs = async () => {
  const response = await fetch(`${API_BASE}/services/linkedin`);
  return handleResponse(response, "Failed to fetch LinkedIn applied jobs");
};

export const syncEmails = async (label = "Job fails") => {
  const response = await fetch(`${API_BASE}/emails/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  return handleResponse(response, "Failed to sync emails");
};

export const fetchAppliedJobs = async ({
  page,
  limit,
  startDate,
  skipSync,
} = {}) => {
  let url = `${API_BASE}/services/applied-jobs`;

  const params = [];
  if (page) params.push(`page=${page}`);
  if (limit) params.push(`limit=${limit || 10}`);
  if (startDate) params.push(`start_date=${startDate}`);
  if (skipSync) params.push(`skip_sync=true`);

  if (params.length > 0) {
    url += `?${params.join("&")}`;
  }

  const response = await fetch(url);
  return handleResponse(response, "Failed to fetch applied jobs");
};

export const fetchJobFailures = async ({ page = 1, limit = 10 }) => {
  const response = await fetch(
    `${API_BASE}/emails/?folder=Job fails&page=${page}&limit=${limit}`,
  );
  return handleResponse(response, "Failed to fetch job failures");
};

export const syncApplicationStatus = async () => {
  const response = await fetch(`${API_BASE}/services/sync-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return handleResponse(response, "Failed to sync application status");
};

export const fetchDashboardInsights = async (timeRange = "all_time") => {
  const response = await fetch(
    `${API_BASE}/services/insights?time_range=${timeRange}`,
  );
  return handleResponse(response, "Failed to fetch dashboard insights");
};

export const reconcileJobStatuses = async () => {
  const response = await fetch(`${API_BASE}/services/reconcile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return handleResponse(response, "Failed to reconcile job statuses");
};

export const LINKEDIN_CARD_TYPE = Object.freeze({
  APPLIED: "applied",
  SAVED: "saved",
  IN_PROGRESS: "in_progress",
  ARCHIVED: "archived",
});

export const fetchLinkedinJobsRaw = async ({
  cardType = LINKEDIN_CARD_TYPE.APPLIED,
  start = 0,
  debug = false,
} = {}) => {
  const params = new URLSearchParams({
    card_type: cardType,
    start: String(start),
  });

  if (debug) {
    params.append("debug", "true");
  }

  const response = await fetch(
    `${API_BASE}/services/linkedin-applied-jobs/raw?${params.toString()}`,
  );

  return handleResponse(response, "Failed to fetch LinkedIn raw jobs");
};
