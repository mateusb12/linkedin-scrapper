const HARDCODED_GRAPHQL_JOBS = [
  {
    job_id: "4382263720",
    title: "Python Developer | Remote",
    company_name: "Crossing Hurdles",
    location_text: "Brazil (Remote)",
    company_page_url: "https://www.linkedin.com/company/crossinghurdles/life",
    company_logo_url:
      "https://media.licdn.com/dms/image/v2/D560BAQEGLWHBZmzzcA/company-logo_400_400/B56ZYzlx2LHEAg-/0/1744622264274/crossinghurdles_logo?e=1774483200&v=beta&t=W5hoPfrdbt8rLxZZhVzuNDMplCK72Wuk7hsrf3JbiBU",
    reposted_job: true,
    verified: true,
    source_key: "JOBS_PREMIUM_OFFLINE",
    description_snippet: null,
  },
  {
    job_id: "4383367339",
    title: "Desenvolvedor Full Stack Python E React",
    company_name: "Bravi",
    location_text: "Florianópolis, Santa Catarina, Brazil (Remote)",
    company_page_url: "https://www.linkedin.com/company/bravidoes/life",
    company_logo_url:
      "https://media.licdn.com/dms/image/v2/D4D0BAQFHu-vX8N8ZUg/company-logo_400_400/company-logo_400_400/0/1731351913783/bravidoes_logo?e=1774483200&v=beta&t=cUvOgXnVsxNq1nLUwft5rLHJI9TK6CzpE-u-I3g1uww",
    reposted_job: false,
    verified: true,
    source_key: "JOBS_CREATE",
    description_snippet: null,
  },
  {
    job_id: "4383315635",
    title: "Software Engineer (Python) - Remote",
    company_name: "Taskify AI",
    location_text: "Latin America (Remote)",
    company_page_url: "https://www.linkedin.com/company/taskify-jobs/life",
    company_logo_url:
      "https://media.licdn.com/dms/image/v2/D560BAQHwYYsCzKBKLQ/company-logo_400_400/B56Zr35RPuLwAc-/0/1765095577069?e=1774483200&v=beta&t=2WxaBKdp7EKZdZQYHGnIclsMwC-1mp19r3Kitoo1RME",
    reposted_job: false,
    verified: true,
    source_key: "JOBS_PREMIUM_OFFLINE",
    description_snippet: null,
  },
  {
    job_id: "4380640814",
    title: "Back-end Python (Django)",
    company_name: "Magnet SPA",
    location_text: "Latin America (Remote)",
    company_page_url: "https://www.linkedin.com/company/magnet-spa/life",
    company_logo_url:
      "https://media.licdn.com/dms/image/v2/C4D0BAQF4IIyJ84_t6g/company-logo_400_400/company-logo_400_400/0/1630527772616/magnet_spa_logo?e=1774483200&v=beta&t=YHP7sxg1qAxq4wlebdFA6rSDukF9UQ1tVFg4AfZwBo0",
    reposted_job: false,
    verified: true,
    source_key: "JOBS_CREATE",
    description_snippet: null,
  },
  {
    job_id: "4380805185",
    title: "Desenvolvedor - Remoto",
    company_name: "Getronics",
    location_text: "Brazil (Remote)",
    company_page_url: "https://www.linkedin.com/company/getronics/life",
    company_logo_url:
      "https://media.licdn.com/dms/image/v2/D4D0BAQHhM2cdBhTEYg/company-logo_400_400/B4DZXHlgC7G4Ac-/0/1742810251831/getronics_logo?e=1774483200&v=beta&t=kkwz6ardIonyVy8WYfwX_1HPG4KDiVanjxwgcRHfOak",
    reposted_job: false,
    verified: true,
    source_key: "JOBS_PREMIUM_OFFLINE",
    description_snippet: null,
  },
  {
    job_id: "4380628567",
    title: "Desenvolvedor(a) back-end Python Pleno",
    company_name: "Makasí",
    location_text: "Brazil (Remote)",
    company_page_url: "https://www.linkedin.com/company/makas%C3%AD/life",
    company_logo_url:
      "https://media.licdn.com/dms/image/v2/C4D0BAQHiblnLmTYcWg/company-logo_400_400/company-logo_400_400/0/1677847546053/makas_logo?e=1774483200&v=beta&t=kQYndvg7hhwrP3_MPVLlGfsm8kpoSJ0PYFc7yn8cLm8",
    reposted_job: false,
    verified: true,
    source_key: "JOBS_CREATE",
    description_snippet: null,
  },
  {
    job_id: "4379970543",
    title: "Desenvolvedor Python Senior",
    company_name: "Jaya Tech",
    location_text: "Brazil (Remote)",
    company_page_url: "https://www.linkedin.com/company/jaya-apps/life",
    company_logo_url:
      "https://media.licdn.com/dms/image/v2/D4D0BAQFT0YYRZkSHkQ/company-logo_400_400/B4DZi_PL_dGQAY-/0/1755555086723/jaya_apps_logo?e=1774483200&v=beta&t=VsP9HZ_HkYRFLJP2DZorReDzxYSeOmlLfxwM2R0bgUo",
    reposted_job: false,
    verified: true,
    source_key: "JOBS_PREMIUM_OFFLINE",
    description_snippet: null,
  },
];

const SOURCE_LABELS = {
  JOBS_CREATE: "Direct post",
  JOBS_PREMIUM_OFFLINE: "LinkedIn feed",
};

const TITLE_HINTS = [
  { match: "python", label: "Python" },
  { match: "react", label: "React" },
  { match: "django", label: "Django" },
  { match: "full stack", label: "Full Stack" },
  { match: "fullstack", label: "Full Stack" },
  { match: "back-end", label: "Backend" },
  { match: "backend", label: "Backend" },
  { match: "senior", label: "Senior" },
  { match: "pleno", label: "Pleno" },
  { match: "remote", label: "Remote" },
];

function inferWorkplaceType(locationText = "") {
  const value = locationText.toLowerCase();

  if (value.includes("remote")) return "Remote";
  if (value.includes("hybrid")) return "Hybrid";
  if (value.includes("on-site") || value.includes("onsite")) return "On-site";

  return "Not specified";
}

function inferKeywords(title = "") {
  const value = title.toLowerCase();

  return Array.from(
    new Set(
      TITLE_HINTS.filter((hint) => value.includes(hint.match)).map(
        (hint) => hint.label,
      ),
    ),
  );
}

function normalizeSourceLabel(sourceKey = "") {
  return (
    SOURCE_LABELS[sourceKey] ||
    sourceKey
      .split("_")
      .join(" ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function normalizeJob(job) {
  const cleanTitle = (job.title || "").trim();

  return {
    id: job.job_id,
    job_id: job.job_id,
    title: cleanTitle || "Untitled job",
    company: {
      name: job.company_name || "Unknown company",
      logo_url: job.company_logo_url || "",
      page_url: job.company_page_url || "",
    },
    location: job.location_text || "Not specified",
    workplace_type: inferWorkplaceType(job.location_text),
    verified: Boolean(job.verified),
    reposted: Boolean(job.reposted_job),
    source_key: job.source_key,
    source_label: normalizeSourceLabel(job.source_key),
    job_url: `https://www.linkedin.com/jobs/view/${job.job_id}/`,
    description_snippet: job.description_snippet || null,
    keywords: inferKeywords(cleanTitle),
  };
}

const NORMALIZED_JOBS = HARDCODED_GRAPHQL_JOBS.map(normalizeJob);

export async function getGraphqlJobs() {
  return Promise.resolve(NORMALIZED_JOBS);
}

export async function getGraphqlJobById(jobId) {
  return Promise.resolve(
    NORMALIZED_JOBS.find((job) => job.job_id === String(jobId)) ?? null,
  );
}
