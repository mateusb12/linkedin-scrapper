import { API_BASE, handleResponse } from "./config";

class AppliedJobModel {
  constructor(raw) {
    if (!raw) {
      throw new Error("AppliedJobModel: empty object");
    }

    const id = raw.job_id || raw.urn;
    if (!id) {
      throw new Error("AppliedJobModel: missing id (job_id or urn)");
    }

    if (!raw.title) {
      throw new Error(`AppliedJobModel(${id}): missing title`);
    }

    if (!raw.company) {
      throw new Error(`AppliedJobModel(${id}): missing company`);
    }

    this.id = id;
    this.title = raw.title;

    this.company =
      typeof raw.company === "object" ? raw.company.name : raw.company;

    this.location = raw.location || "";
    this.jobUrl = raw.job_url || "";

    this.appliedAt = raw.applied_on || raw.applied_at || null;
    this.postedAt =
      raw.posted_on || raw.originally_listed_at || raw.listed_at || null;

    this.isReposted = Boolean(raw.is_reposted);
    this.applyMethod = raw.application_status || raw.apply_method || "UNKNOWN";
  }

  static fromApiArray(rawJobs) {
    if (!Array.isArray(rawJobs)) {
      throw new Error("AppliedJobModel: expected array from API");
    }

    return rawJobs.map((job) => new AppliedJobModel(job));
  }
}

export const fetchAppliedJobs = async () => {
  const response = await fetch(`${API_BASE}/job-tracker/applied`);
  const json = await handleResponse(response, "Failed to fetch applied jobs");

  if (!json || json.status !== "success") {
    throw new Error("Invalid API response format (status)");
  }

  if (!json.data || !Array.isArray(json.data.jobs)) {
    throw new Error("Invalid API response format (data.jobs missing)");
  }

  const jobs = AppliedJobModel.fromApiArray(json.data.jobs);

  return {
    count: json.data.count,
    jobs,
  };
};

export const fetchSavedJobsRaw = async () => {
  const response = await fetch(`${API_BASE}/job-tracker/saved`);
  return handleResponse(response, "Failed to fetch saved jobs");
};

export const syncAppliedIncremental = async () => {
  const response = await fetch(`${API_BASE}/job-tracker/sync-applied`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  return handleResponse(response, "Failed to sync applied jobs");
};

export const syncAppliedBackfillStream = ({
  from,
  onProgress,
  onFinish,
  onError,
}) => {
  if (!from) {
    throw new Error("Parameter 'from' is required (format YYYY-MM)");
  }

  const url = `${API_BASE}/job-tracker/sync-applied-backfill-stream?from=${from}`;

  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "progress") {
        onProgress && onProgress(data);
      }

      if (data.type === "finished") {
        onFinish && onFinish(data);
        eventSource.close();
      }

      if (data.type === "error") {
        onError && onError(data);
        eventSource.close();
      }
    } catch (err) {
      console.error("Stream parse error:", err);
    }
  };

  eventSource.onerror = (err) => {
    console.error("SSE error:", err);
    onError && onError(err);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
};

export const formatAppliedTimestamp = (isoString) => {
  if (!isoString) return "-";

  const date = new Date(isoString);

  const day = String(date.getDate()).padStart(2, "0");
  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

export const calculateJobAgeInDays = (postedIso) => {
  if (!postedIso) return null;

  const posted = new Date(postedIso);
  const now = new Date();

  const diffMs = now.getTime() - posted.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};
