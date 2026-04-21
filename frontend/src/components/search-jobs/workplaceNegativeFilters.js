export const WORKPLACE_TYPE_OPTIONS = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site / Presential" },
];

export const WORKPLACE_EXCLUSION_OPTIONS = WORKPLACE_TYPE_OPTIONS.filter(
  (option) => option.value !== "remote",
);

const WORKPLACE_FILTER_TERMS = {
  remote: "remote",
  remoto: "remote",
  remota: "remote",
  hybrid: "hybrid",
  hibrido: "hybrid",
  hibrida: "hybrid",
  onsite: "onsite",
  "on-site": "onsite",
  "on site": "onsite",
  "in-person": "onsite",
  "in person": "onsite",
  presential: "onsite",
  presencial: "onsite",
};

const WORKPLACE_LABELS = {
  remote: "remote",
  hybrid: "hybrid",
  "on-site": "onsite",
  onsite: "onsite",
};

const normalize = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeCanonicalWorkplaceType = (value) =>
  WORKPLACE_LABELS[normalize(value)] || null;

const fallbackWorkplaceType = (job = {}) => {
  if (
    job.work_remote_allowed === true ||
    job.raw?.work_remote_allowed === true
  ) {
    return "remote";
  }

  const locationText = normalize(
    job.location_text ||
      job.location ||
      job.raw?.location_text ||
      job.raw?.location,
  );

  if (locationText.includes("(remote)")) return "remote";
  if (locationText.includes("(hybrid)")) return "hybrid";
  if (locationText.includes("(on-site)") || locationText.includes("(onsite)")) {
    return "onsite";
  }

  return null;
};

export const getJobWorkplaceType = (job = {}) => {
  const canonicalType = normalizeCanonicalWorkplaceType(job.workplace_type);

  if (canonicalType) return canonicalType;

  return fallbackWorkplaceType(job);
};

export const normalizeWorkplaceFilterTerm = (value) =>
  WORKPLACE_FILTER_TERMS[normalize(value)] || null;
