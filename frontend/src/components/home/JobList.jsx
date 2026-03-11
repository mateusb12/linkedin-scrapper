import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Search,
  MapPin,
  Building2,
  ShieldCheck,
  Repeat2,
  ExternalLink,
  Briefcase,
  Database,
  Filter,
  XCircle,
  ChevronRight,
  Code2,
} from "lucide-react";

import { getGraphqlJobs } from "../../services/graphqlJobsService.js";

const badgeTones = {
  blue: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
  green: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  violet: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  slate: "bg-slate-700/60 text-slate-300 border border-slate-600",
};

const normalizeText = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const buildUniqueOptions = (items, getValue, getLabel = (value) => value) => {
  const map = new Map();

  items.forEach((item) => {
    const value = getValue(item);

    if (value === undefined || value === null || String(value).trim() === "") {
      return;
    }

    map.set(value, getLabel(value, item));
  });

  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
};

const placeholderLogo = (companyName = "?") =>
  `https://placehold.co/80x80/0f172a/e2e8f0?text=${encodeURIComponent(
    companyName.charAt(0).toUpperCase() || "?",
  )}`;

const Badge = ({ tone = "slate", children }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeTones[tone]}`}
  >
    {children}
  </span>
);

const FilterSelect = ({ value, onChange, children }) => (
  <div className="relative">
    <select
      value={value}
      onChange={onChange}
      className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
    >
      {children}
    </select>

    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
      <svg
        className="h-4 w-4 fill-current"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
      >
        <path d="M5.516 7.548 10 12.032l4.484-4.484 1.032 1.032L10 14.096 4.484 8.58z" />
      </svg>
    </div>
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="flex h-full flex-col items-center justify-center px-8 text-center text-slate-400">
    <Filter size={42} className="mb-4 text-slate-500" />
    <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
    <p className="mt-2 max-w-md text-sm">{description}</p>
  </div>
);

const InfoCard = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/70 px-4 py-3">
    <Icon size={18} className="shrink-0 text-slate-400" />
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="truncate text-sm text-slate-200">
        {value || "Not specified"}
      </p>
    </div>
  </div>
);

const Placeholder = ({ text = "None specified." }) => (
  <div className="flex items-center text-sm italic text-slate-400">
    <XCircle size={16} className="mr-2 shrink-0" />
    <span>{text}</span>
  </div>
);

const JobListItem = ({ job, isSelected, onSelect }) => {
  const selectedClasses = isSelected
    ? "border-sky-400 bg-sky-950/50"
    : "border-transparent hover:bg-slate-800/40";

  return (
    <button
      type="button"
      onClick={() => onSelect(job.id)}
      className={`w-full border-l-4 p-4 text-left transition-colors ${selectedClasses}`}
    >
      <div className="flex gap-3">
        <img
          src={job.company.logo_url}
          alt={`${job.company.name} logo`}
          className="h-12 w-12 rounded-lg border border-slate-700 bg-slate-900 object-contain"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = placeholderLogo(job.company.name);
          }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold text-slate-100">
              {job.title}
            </h3>

            <div className="flex shrink-0 items-center gap-1">
              {job.verified && (
                <ShieldCheck size={16} className="text-emerald-400" />
              )}
              {job.reposted && <Repeat2 size={16} className="text-amber-400" />}
            </div>
          </div>

          <p className="mt-1 text-sm text-slate-300">{job.company.name}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{job.location}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="blue">{job.workplace_type}</Badge>
            <Badge tone="green">{job.source_label}</Badge>
            {job.keywords.slice(0, 2).map((keyword) => (
              <Badge key={keyword} tone="violet">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
};

const JobDetailView = ({ job }) => {
  if (!job) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Select a job to see the details
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-7 md:px-8">
      <div className="mb-8 flex items-start gap-5">
        <img
          src={job.company.logo_url}
          alt={`${job.company.name} logo`}
          className="h-16 w-16 rounded-xl border border-slate-700 bg-slate-900 object-contain"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = placeholderLogo(job.company.name);
          }}
        />

        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-bold leading-tight text-white">
            {job.title}
          </h2>

          <p className="mt-1 text-xl text-slate-300">{job.company.name}</p>
          <p className="mt-1 text-xs text-slate-500">Job ID: {job.job_id}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {job.verified && <Badge tone="green">Verified</Badge>}
            {job.reposted && <Badge tone="amber">Reposted</Badge>}
            <Badge tone="blue">{job.workplace_type}</Badge>
            <Badge tone="violet">{job.source_label}</Badge>
          </div>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <a
          href={job.job_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
        >
          <ExternalLink size={16} />
          Open Job
        </a>

        {job.company.page_url && (
          <a
            href={job.company.page_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 font-semibold text-slate-100 transition hover:bg-slate-700"
          >
            <Building2 size={16} />
            Company Page
          </a>
        )}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoCard icon={MapPin} label="Location" value={job.location} />
        <InfoCard
          icon={Briefcase}
          label="Workplace Type"
          value={job.workplace_type}
        />
        <InfoCard
          icon={ShieldCheck}
          label="Verification"
          value={job.verified ? "Verified" : "Not verified"}
        />
        <InfoCard icon={Database} label="Source" value={job.source_label} />
      </div>

      <div className="space-y-8">
        <section>
          <h3 className="mb-4 flex items-center border-b border-slate-800 pb-2 text-xl font-semibold text-slate-100">
            <Code2 size={18} className="mr-2" />
            Tech Hints
          </h3>

          {job.keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {job.keywords.map((keyword) => (
                <Badge key={keyword} tone="violet">
                  {keyword}
                </Badge>
              ))}
            </div>
          ) : (
            <Placeholder text="No useful stack hints were extracted from the title." />
          )}
        </section>

        <section>
          <h3 className="mb-4 flex items-center border-b border-slate-800 pb-2 text-xl font-semibold text-slate-100">
            <ChevronRight size={18} className="mr-2" />
            About This Listing
          </h3>

          {job.description_snippet ? (
            <div className="rounded-xl border border-slate-800 bg-slate-800/60 p-4 text-sm leading-7 text-slate-300">
              {job.description_snippet}
            </div>
          ) : (
            <Placeholder text="This GraphQL dataset only has card-level data right now, so there is no description snippet yet." />
          )}
        </section>
      </div>
    </div>
  );
};

const MainJobListing = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [workplaceType, setWorkplaceType] = useState("All");
  const [verificationFilter, setVerificationFilter] = useState("All");
  const [repostedFilter, setRepostedFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [sortBy, setSortBy] = useState("relevance");

  const [isDragging, setIsDragging] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(37);

  const containerRef = useRef(null);
  const MIN_WIDTH = 28;
  const MAX_WIDTH = 65;

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const data = await getGraphqlJobs();
        setJobs(data);
        if (data.length > 0) setSelectedJobId(data[0].id);
      } catch (error) {
        console.error("Failed to load hardcoded GraphQL jobs:", error);
      } finally {
        setLoading(false);
      }
    };

    loadJobs();
  }, []);

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
    let result = [...jobs];

    if (searchTerm.trim()) {
      const query = normalizeText(searchTerm);

      result = result.filter((job) => {
        const haystack = [
          job.title,
          job.company.name,
          job.location,
          job.workplace_type,
          job.source_label,
          ...(job.keywords || []),
        ]
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

    if (sortBy === "title") {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "company") {
      result.sort((a, b) => a.company.name.localeCompare(b.company.name));
    }

    return result;
  }, [
    jobs,
    searchTerm,
    workplaceType,
    verificationFilter,
    repostedFilter,
    sourceFilter,
    sortBy,
  ]);

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

  const handleMouseDown = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleMouseMove = useCallback(
    (event) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidthPx = event.clientX - containerRect.left;
      const newWidthPercent = (newWidthPx / containerRect.width) * 100;
      const clampedWidth = Math.max(
        MIN_WIDTH,
        Math.min(newWidthPercent, MAX_WIDTH),
      );

      setLeftPanelWidth(clampedWidth);
    },
    [isDragging],
  );

  useEffect(() => {
    if (!isDragging) return;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="h-screen bg-[#081120] font-sans text-slate-100">
      <div
        ref={containerRef}
        className="flex h-full"
        style={{ userSelect: isDragging ? "none" : "auto" }}
      >
        <aside
          className="flex shrink-0 flex-col border-r border-slate-800 bg-[#0b1526]"
          style={{ width: `${leftPanelWidth}%` }}
        >
          <div className="space-y-4 border-b border-slate-800 p-4">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by title, company or stack..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FilterSelect
                value={workplaceType}
                onChange={(event) => setWorkplaceType(event.target.value)}
              >
                <option value="All">All Workplaces</option>
                {workplaceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                value={verificationFilter}
                onChange={(event) => setVerificationFilter(event.target.value)}
              >
                <option value="All">All Verification</option>
                <option value="Verified">Verified</option>
                <option value="Unverified">Unverified</option>
              </FilterSelect>

              <FilterSelect
                value={repostedFilter}
                onChange={(event) => setRepostedFilter(event.target.value)}
              >
                <option value="All">All Listings</option>
                <option value="Reposted">Reposted</option>
                <option value="Original">Original</option>
              </FilterSelect>

              <FilterSelect
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option value="All">All Sources</option>
                {sourceOptions.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="relevance">Sort by: Relevance</option>
                <option value="title">Sort by: Title</option>
                <option value="company">Sort by: Company</option>
              </FilterSelect>
            </div>

            <p className="pl-1 text-sm text-slate-400">
              {loading ? "Loading..." : `${filteredJobs.length} results`}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-sm text-slate-400">Loading jobs...</div>
            ) : filteredJobs.length > 0 ? (
              filteredJobs.map((job) => (
                <JobListItem
                  key={job.id}
                  job={job}
                  isSelected={selectedJobId === job.id}
                  onSelect={setSelectedJobId}
                />
              ))
            ) : (
              <EmptyState
                title="No jobs found"
                description="Try changing the search term or one of the filters."
              />
            )}
          </div>
        </aside>

        <div
          className="w-2 cursor-col-resize bg-slate-800 transition hover:bg-sky-500"
          onMouseDown={handleMouseDown}
        />

        <main className="flex-1 bg-[#0d1728]">
          <JobDetailView job={selectedJob} />
        </main>
      </div>
    </div>
  );
};

export default MainJobListing;
