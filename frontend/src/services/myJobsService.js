import { API_BASE, handleResponse } from "./config";

export const formatDateBR = (isoString) => {
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

export const formatTimeBR = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const calculateJobAge = (postedIso) => {
  if (!postedIso) return null;
  const posted = new Date(postedIso);
  const now = new Date();
  const diffTime = Math.abs(now - posted);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

class AppliedJobModel {
  constructor(raw) {
    if (!raw) throw new Error("AppliedJobModel: empty object");

    this.urn = raw.urn || raw.job_id;
    this.id = this.urn;

    this.title = raw.title || "Sem Título";

    if (raw.company && typeof raw.company === "object") {
      this.company = raw.company.name || "Unknown";
    } else {
      this.company = raw.company || "Unknown";
    }

    this.location = raw.location || "";
    this.jobUrl = raw.job_url || "";
    this.workRemoteAllowed = Boolean(raw.work_remote_allowed);
    this.employmentStatus =
      raw.employment_status?.replace("urn:li:fs_employmentStatus:", "") ||
      "Unknown";

    this.appliedAt = raw.applied_on || raw.applied_at || null;

    this.postedAt =
      raw.posted_on || raw.listed_at || raw.original_listed_at || null;

    this.expireAt = raw.expire_at || null;

    this.applicationStatus = raw.application_status || "Waiting";
    this.jobState = raw.job_state || "LISTED";
    this.applicationClosed = Boolean(raw.application_closed);

    this.applicants = raw.applicants || 0;
    this.applicantsVelocity = raw.applicants_velocity || 0;
    this.competitionLevel = raw.competition_level || null;
  }

  static fromApiArray(rawJobs) {
    if (!Array.isArray(rawJobs)) return [];
    return rawJobs.map((job) => new AppliedJobModel(job));
  }
}

export const fetchAppliedJobs = async () => {
  const response = await fetch(`${API_BASE}/job-tracker/applied`);
  const json = await handleResponse(response, "Failed to fetch applied jobs");
  if (!json?.data?.jobs) return { count: 0, jobs: [] };
  return {
    count: json.data.count,
    jobs: AppliedJobModel.fromApiArray(json.data.jobs),
  };
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
  if (!from) throw new Error("Parameter 'from' is required");
  const url = `${API_BASE}/job-tracker/sync-applied-backfill-stream?from=${from}`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "progress") onProgress && onProgress(data);
      if (data.type === "finished") {
        onFinish && onFinish(data);
        eventSource.close();
      }
      if (data.type === "error") {
        onError && onError(data);
        eventSource.close();
      }
    } catch (err) {
      console.error(err);
    }
  };
  eventSource.onerror = (err) => {
    onError && onError(err);
    eventSource.close();
  };
  return () => eventSource.close();
};
