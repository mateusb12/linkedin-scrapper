const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

const LIVE_JOBS_ENDPOINT = `${API_BASE_URL}/search-jobs/live`;

const SOURCE_LABELS = {
  JOBS_CREATE: "Direct post",
  JOBS_PREMIUM_OFFLINE: "LinkedIn feed",
};

const TITLE_HINTS = [
  { match: "python", label: "Python" },
  { match: "react", label: "React" },
  { match: "django", label: "Django" },
  { match: "fastapi", label: "FastAPI" },
  { match: "flask", label: "Flask" },
  { match: "node", label: "Node.js" },
  { match: "nest", label: "NestJS" },
  { match: "typescript", label: "TypeScript" },
  { match: "javascript", label: "JavaScript" },
  { match: "full stack", label: "Full Stack" },
  { match: "fullstack", label: "Full Stack" },
  { match: "back-end", label: "Backend" },
  { match: "backend", label: "Backend" },
  { match: "front-end", label: "Frontend" },
  { match: "frontend", label: "Frontend" },
  { match: "senior", label: "Senior" },
  { match: "pleno", label: "Pleno" },
  { match: "junior", label: "Junior" },
  { match: "remote", label: "Remote" },
];

function inferWorkplaceType(locationText = "", workRemoteAllowed = false) {
  const value = String(locationText).toLowerCase();

  if (workRemoteAllowed || value.includes("remote")) return "Remote";
  if (value.includes("hybrid")) return "Hybrid";
  if (
    value.includes("on-site") ||
    value.includes("onsite") ||
    value.includes("presencial")
  ) {
    return "On-site";
  }

  return "Not specified";
}

function inferKeywords(title = "", description = "") {
  const value = `${title} ${description}`.toLowerCase();

  return Array.from(
    new Set(
      TITLE_HINTS.filter((hint) => value.includes(hint.match)).map(
        (hint) => hint.label,
      ),
    ),
  );
}

function normalizeSourceLabel(sourceKey = "") {
  if (!sourceKey) return "Unknown source";

  return (
    SOURCE_LABELS[sourceKey] ||
    sourceKey
      .split("_")
      .join(" ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function extractJobId(apiData) {
  if (apiData?.job_id != null) return String(apiData.job_id);
  if (apiData?.id != null) return String(apiData.id);

  const urns = [
    apiData?.job_posting_urn,
    apiData?.normalized_job_posting_urn,
    apiData?.tracking_urn,
    apiData?.card_entity_urn,
    apiData?.search_card_urn,
  ].filter(Boolean);

  for (const urn of urns) {
    const match = String(urn).match(/(\d{6,})/);
    if (match) return match[1];
  }

  return null;
}

function toNumberOrNull(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildUrl(baseUrl, params = {}) {
  const url = new URL(baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(`Expected JSON response, got: ${text || "empty response"}`);
  }

  return response.json();
}

class GraphqlJobModel {
  id;
  job_id;
  title;
  company;
  company_name;
  company_logo_url;
  company_page_url;
  company_url;
  company_urn;
  location;
  location_text;
  workplace_type;
  verified;
  reposted;
  reposted_job;
  source_key;
  source_label;
  job_url;
  description_snippet;
  description_full;
  keywords;
  applicants;
  applicants_total;
  applicants_last_24h;
  applicants_velocity_24h;
  posted_at;
  expire_at;
  created_at;
  work_remote_allowed;
  applied;
  applied_at;
  application_closed;
  premium_title;
  premium_description;
  seniority_distribution;
  education_distribution;
  verification_action_target;
  verification_badge_system_image;
  raw;

  constructor(cleanData) {
    Object.assign(this, cleanData);
  }

  static fromAPI(apiData) {
    if (!apiData) return null;

    const jobId = extractJobId(apiData);

    if (!jobId) {
      console.warn("GraphqlJobModel: job skipped due to missing ID", apiData);
      return null;
    }

    const title = (
      apiData.title ||
      apiData.title_raw_from_job_posting ||
      ""
    ).trim();
    const descriptionFull = apiData.description_full || null;
    const descriptionSnippet =
      apiData.description_snippet ||
      (descriptionFull ? String(descriptionFull).slice(0, 280) : null);

    const companyName =
      apiData.company_name || apiData.company || "Unknown company";
    const companyLogoUrl =
      apiData.company_logo_url || apiData.company_logo || "";
    const companyPageUrl = apiData.company_page_url || "";
    const companyUrl = apiData.company_url || "";
    const locationText =
      apiData.location_text || apiData.location || "Not specified";
    const sourceKey = apiData.source_key || apiData.content_source || "";

    const verified =
      apiData.verified ??
      Boolean(
        apiData.verification_urn ||
        apiData.verification_action_target ||
        apiData.verification_badge_system_image ||
        apiData.has_verification_record,
      );

    const cleanData = {
      id: jobId,
      job_id: jobId,

      title: title || "Untitled job",

      company: {
        name: companyName,
        logo_url: companyLogoUrl,
        page_url: companyPageUrl,
        url: companyUrl,
        urn: apiData.company_urn || null,
      },

      company_name: companyName,
      company_logo_url: companyLogoUrl,
      company_page_url: companyPageUrl,
      company_url: companyUrl,
      company_urn: apiData.company_urn || null,

      location: locationText,
      location_text: locationText,
      workplace_type: inferWorkplaceType(
        locationText,
        apiData.work_remote_allowed,
      ),

      verified: Boolean(verified),
      reposted: Boolean(apiData.reposted_job),
      reposted_job: Boolean(apiData.reposted_job),

      source_key: sourceKey,
      source_label: normalizeSourceLabel(sourceKey),

      job_url:
        apiData.job_url || `https://www.linkedin.com/jobs/view/${jobId}/`,

      description_snippet: descriptionSnippet,
      description_full: descriptionFull,

      keywords: inferKeywords(
        title,
        descriptionSnippet || descriptionFull || "",
      ),

      applicants: toNumberOrNull(
        apiData.applicants ?? apiData.applicants_total,
      ),
      applicants_total: toNumberOrNull(
        apiData.applicants_total ?? apiData.applicants,
      ),
      applicants_last_24h: toNumberOrNull(apiData.applicants_last_24h),
      applicants_velocity_24h: toNumberOrNull(apiData.applicants_velocity_24h),

      posted_at: apiData.posted_at || null,
      expire_at: apiData.expire_at || null,
      created_at: apiData.created_at || null,

      work_remote_allowed: Boolean(apiData.work_remote_allowed),
      applied: Boolean(apiData.applied),
      applied_at: apiData.applied_at || null,
      application_closed: apiData.application_closed ?? null,

      premium_title: apiData.premium_title || null,
      premium_description: apiData.premium_description || null,

      seniority_distribution: Array.isArray(apiData.seniority_distribution)
        ? apiData.seniority_distribution
        : [],

      education_distribution: Array.isArray(apiData.education_distribution)
        ? apiData.education_distribution
        : [],

      verification_action_target: apiData.verification_action_target || null,
      verification_badge_system_image:
        apiData.verification_badge_system_image || null,

      raw: apiData,
    };

    return new GraphqlJobModel(cleanData);
  }
}

class GraphqlJobsResponseModel {
  status;
  jobs;
  audit;
  meta;

  constructor(cleanData) {
    Object.assign(this, cleanData);
  }

  static fromAPI(apiData) {
    if (!apiData) {
      return new GraphqlJobsResponseModel({
        status: "error",
        jobs: [],
        audit: null,
        meta: null,
      });
    }

    const payloadRoot = apiData.data || apiData;
    const rawJobs = Array.isArray(payloadRoot?.jobs)
      ? payloadRoot.jobs
      : Array.isArray(apiData)
        ? apiData
        : [];

    const jobs = rawJobs
      .map((job) => GraphqlJobModel.fromAPI(job))
      .filter((job) => job !== null);

    return new GraphqlJobsResponseModel({
      status: apiData.status || "success",
      jobs,
      audit: payloadRoot?.audit || null,
      meta: payloadRoot?.meta || null,
    });
  }
}

async function fetchGraphqlJobsResponse(params = {}) {
  const url = buildUrl(LIVE_JOBS_ENDPOINT, {
    page: 1,
    count: 10,
    ...params,
  });

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Failed to fetch jobs (${response.status} ${response.statusText})${
        errorText ? ` - ${errorText}` : ""
      }`,
    );
  }

  const json = await parseJsonResponse(response);
  return GraphqlJobsResponseModel.fromAPI(json);
}

export async function getGraphqlJobs(params = {}) {
  const result = await fetchGraphqlJobsResponse(params);
  return result.jobs;
}

export async function getGraphqlJobsWithMeta(params = {}) {
  return fetchGraphqlJobsResponse(params);
}

export async function getGraphqlJobById(jobId, params = {}) {
  const jobs = await getGraphqlJobs({
    count: 100,
    page: 1,
    ...params,
  });

  return jobs.find((job) => String(job.job_id) === String(jobId)) ?? null;
}
