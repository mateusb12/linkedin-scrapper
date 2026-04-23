import { API_BASE, handleResponse } from "./config";

const getAppliedTimestamp = (job) =>
  job?.appliedAt ||
  job?.applied_at_brt ||
  job?.applied_on ||
  job?.applied_at ||
  null;

const getCompanyName = (company) => {
  if (!company) return "Unknown Company";
  if (typeof company === "string") return company;
  return company.name || "Unknown Company";
};

const normalizeAppliedJob = (job) => {
  if (!job || typeof job !== "object") return job;

  const appliedAt = getAppliedTimestamp(job);
  const jobUrl = job.jobUrl || job.job_url || job.url || null;

  return {
    ...job,
    id: job.id || job.urn || job.job_id,
    appliedAt,
    applied_at_brt: job.applied_at_brt || null,
    applied_on: job.applied_on || null,
    source:
      job.source ||
      (String(jobUrl || "")
        .toLowerCase()
        .includes("linkedin")
        ? "LinkedIn"
        : "SQL"),
    url: job.url || jobUrl,
    jobUrl,
    companyName: job.companyName || getCompanyName(job.company),
    description: job.description || job.description_full || "",
    postedAt:
      job.postedAt ||
      job.posted_at ||
      job.posted_on ||
      job.listed_at ||
      job.posted_date_text ||
      null,
    applicationStatus:
      job.applicationStatus || job.application_status || "Waiting",
    applicantsVelocity:
      job.applicantsVelocity ||
      job.applicants_velocity ||
      job.applicants_velocity_24h ||
      0,
    lastEmail: job.lastEmail || job.last_email || null,
  };
};

const getAppliedJobsFromResponse = (payload) => {
  if (Array.isArray(payload?.data?.jobs)) return payload.data.jobs;
  if (Array.isArray(payload?.jobs)) return payload.jobs;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
};

const normalizeAppliedJobsResponse = (payload, { page, limit } = {}) => {
  const jobs = getAppliedJobsFromResponse(payload).map(normalizeAppliedJob);
  const total =
    payload?.data?.count ?? payload?.count ?? payload?.total ?? jobs.length;

  if (page || limit) {
    const pageNumber = page || payload?.page || 1;
    const pageSize = limit || payload?.limit || jobs.length || 10;
    const hasServerPage = Array.isArray(payload?.data) || payload?.page;
    const pageJobs = hasServerPage
      ? jobs
      : jobs.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

    return {
      ...payload,
      data: pageJobs,
      jobs: pageJobs,
      total,
      page: pageNumber,
      limit: pageSize,
      total_pages:
        payload?.total_pages || Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  if (Array.isArray(payload)) return jobs;

  return {
    ...payload,
    data:
      payload?.data && !Array.isArray(payload.data)
        ? {
            ...payload.data,
            count: total,
            jobs,
          }
        : jobs,
    count: total,
    jobs,
  };
};

const emptyInsights = {
  overview: {
    active: 0,
    closed: 0,
    paused: 0,
    total: 0,
    unknown: 0,
  },
  competition: {
    low: 0,
    medium: 0,
    high: 0,
    avg_applicants: 0,
    high_comp_refusal_rate: 0,
  },
  competition_raw: [],
  unavailable: true,
};

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
  let url = `${API_BASE}/services/applied`;

  const params = [];
  if (page) params.push(`page=${page}`);
  if (limit) params.push(`limit=${limit || 10}`);
  if (startDate) params.push(`start_date=${startDate}`);
  if (skipSync) params.push(`skip_sync=true`);

  if (params.length > 0) {
    url += `?${params.join("&")}`;
  }

  const response = await fetch(url);
  const payload = await handleResponse(
    response,
    "Failed to fetch applied jobs",
  );
  return normalizeAppliedJobsResponse(payload, { page, limit });
};

export const fetchJobFailures = async ({ page = 1, limit = 10 }) => {
  const response = await fetch(
    `${API_BASE}/emails/?folder=Job fails&page=${page}&limit=${limit}`,
  );
  return handleResponse(response, "Failed to fetch job failures");
};

export const syncApplicationStatus = async () => {
  try {
    const response = await fetch(`${API_BASE}/services/sync-status`, {
      method: "POST",
    });

    if (response.status === 404 || response.status === 405) {
      console.info(
        "Application status sync endpoint is unavailable; skipping.",
      );
      return { skipped: true, unavailable: true };
    }

    return handleResponse(response, "Failed to sync application status");
  } catch (error) {
    console.info("Application status sync could not run; skipping.", error);
    return { skipped: true, unavailable: true, error };
  }
};

export const fetchDashboardInsights = async (timeRange = "all_time") => {
  try {
    const response = await fetch(
      `${API_BASE}/services/insights?time_range=${timeRange}`,
    );

    if (response.status === 404) {
      console.info(
        "Dashboard insights endpoint is unavailable; using empty insights.",
      );
      return emptyInsights;
    }

    return handleResponse(response, "Failed to fetch dashboard insights");
  } catch (error) {
    console.info(
      "Dashboard insights could not be loaded; using empty insights.",
      error,
    );
    return { ...emptyInsights, error };
  }
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

export const fetchProfileExperiences = async ({
  urn = "urn:li:fsd_profile:ACoAAD016UkBWKGUUWKD7WdA2pTCzevPYoF-xnE",
  vanity = "mateus-bessa-m",
  locale = "en-US",
} = {}) => {
  const params = new URLSearchParams({
    urn,
    vanity,
    locale,
  });

  const response = await fetch(
    `${API_BASE}/services/profile/experiences?${params.toString()}`,
  );

  return handleResponse(response, "Failed to fetch profile experiences");
};

const hasNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const hasNonEmptyArray = (value) =>
  Array.isArray(value) &&
  value.some((item) => typeof item === "string" && item.trim().length > 0);

export const isJobScoreable = (job) => {
  if (!job || typeof job !== "object") return false;

  return (
    hasNonEmptyString(job.description_full) ||
    hasNonEmptyString(job.description_snippet) ||
    hasNonEmptyString(job.premium_title) ||
    hasNonEmptyString(job.premium_description) ||
    hasNonEmptyArray(job.qualifications) ||
    hasNonEmptyArray(job.responsibilities) ||
    hasNonEmptyArray(job.programming_languages) ||
    hasNonEmptyArray(job.keywords)
  );
};

export const scoreJobsBatch = async (jobs) => {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return new Map();
  }

  const scoreableJobs = jobs.filter(isJobScoreable);
  const skippedCount = jobs.length - scoreableJobs.length;

  if (skippedCount > 0) {
    console.debug(
      `Skipped ${skippedCount} job${skippedCount === 1 ? "" : "s"} without descriptive fields from AI scoring.`,
    );
  }

  if (scoreableJobs.length === 0) {
    return new Map();
  }

  const payload = {
    items: scoreableJobs.map((job) => ({
      id: job.id,
      title: job.title,
      description_full: job.description_full || job.description_snippet || "",
      description_snippet: job.description_snippet || "",
      keywords: Array.isArray(job.keywords) ? job.keywords : [],
      qualifications: Array.isArray(job.qualifications)
        ? job.qualifications
        : [],
      responsibilities: Array.isArray(job.responsibilities)
        ? job.responsibilities
        : [],
      programming_languages: Array.isArray(job.programming_languages)
        ? job.programming_languages
        : [],
      premium_title: job.premium_title || "",
      premium_description: job.premium_description || "",
    })),
  };

  let json;

  try {
    const response = await fetch(`${API_BASE}/job-scoring/rank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    json = await handleResponse(response, "Failed to batch score jobs");
  } catch (error) {
    console.warn(
      "Failed to score jobs. Rendering fetched jobs without AI scores.",
      {
        error,
        scoreableCount: scoreableJobs.length,
        skippedCount,
      },
    );
    return new Map();
  }

  const items = Array.isArray(json?.items)
    ? json.items
    : Array.isArray(json?.data?.items)
      ? json.data.items
      : Array.isArray(json?.data)
        ? json.data
        : [];

  const map = new Map();

  items.forEach((item) => {
    const normalizedItem =
      item &&
      typeof item === "object" &&
      item.data &&
      typeof item.data === "object"
        ? { ...item.data, ...item }
        : item;
    const key =
      normalizedItem.external_id ?? normalizedItem.id ?? normalizedItem.urn;

    if (key != null) {
      map.set(String(key), normalizedItem);
    }
  });

  return map;
};
