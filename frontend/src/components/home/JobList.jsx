import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  Code,
  Briefcase,
  MapPin,
  Clock,
  Users,
  Zap,
  Building,
  ChevronRight,
  CheckCircle,
  Target,
  BookOpen,
  Globe,
  XCircle,
  Filter,
  X,
  CheckSquare,
} from "lucide-react";

const mockData = [
  {
    applicants: 5,
    company: {
      name: "Innovatech Solutions",
      logo_url: "https://placehold.co/64x64/7c3aed/ffffff?text=IS",
    },
    job_url: "https://example.com/job/1",
    location: "San Francisco, CA (On-site)",
    posted_on: new Date(
      new Date().setDate(new Date().getDate() - 1),
    ).toISOString(),
    title: "Senior Frontend Developer",
    urn: "urn:li:fsd_jobPosting:1",
    workplace_type: "On-site",
    employment_type: "Full-time",
    skills: '["React", "TypeScript", "Next.js", "GraphQL"]',
    easy_apply: true,
    language: "English",
    has_applied: true,
    applied_on: new Date().toISOString(),
  },
  {
    applicants: 12,
    company: {
      name: "Auramind.ai",
      logo_url:
        "https://media.licdn.com/dms/image/v2/D4D0BAQEEnATeFu7uAw/company-logo_200_200/company-logo_200_200/0/1721777167872/auramind_ai_logo?e=1756944000&v=beta&t=d5_ogfQhy_swysPpWBOhvX6ce55VcsoQJZ_7Bz69UVg",
    },
    job_url: "https://www.linkedin.com/jobs/view/4257609291/",
    location: "Goiânia, Goiás, Brazil (Remote)",
    posted_on: new Date(
      new Date().setDate(new Date().getDate() - 2),
    ).toISOString(),
    title: "Backend Developer - Python - Pleno",
    urn: "urn:li:fsd_jobPosting:4257609291",
    workplace_type: "Remote",
    employment_type: "Full-time",
    skills: '["Python", "Django", "Flask", "RESTful APIs"]',
    easy_apply: true,
    language: "Portuguese",
    has_applied: false,
  },
  {
    applicants: 3,
    company: {
      name: "WEX",
      logo_url:
        "https://media.licdn.com/dms/image/v2/D560BAQFhAT_f2S08EQ/company-logo_200_200/company-logo_200_200/0/1699284516534/wexinc_logo?e=1756944000&v=beta&t=NtZa7aSPem2JOsxFBPYXN28p70MHEoYBoGvVu-fdaQw",
    },
    job_url:
      "https://careers.wexinc.com/us/en/job/WEXWEXUSR17144EXTERNALENUS/Mid-Python-Developer?utm_source=linkedin&utm_medium=phenom-feeds",
    location: "São Paulo, Brazil (Hybrid)",
    posted_on: new Date(
      new Date().setDate(new Date().getDate() - 8),
    ).toISOString(),
    title: "Mid Python Developer",
    urn: "urn:li:fsd_jobPosting:4161846248",
    workplace_type: "Hybrid",
    employment_type: "Full-time",
    skills: null,
    easy_apply: false,
    language: "English",
    has_applied: false,
  },
  {
    applicants: 25,
    company: {
      name: "DataDriven Inc.",
      logo_url: "https://placehold.co/64x64/db2777/ffffff?text=DD",
    },
    job_url: "https://example.com/job/2",
    location: "New York, NY (Remote)",
    posted_on: new Date(
      new Date().setDate(new Date().getDate() - 15),
    ).toISOString(),
    title: "Data Scientist",
    urn: "urn:li:fsd_jobPosting:2",
    workplace_type: "Remote",
    employment_type: "Contract",
    skills: '["Python", "Pandas", "Scikit-learn", "TensorFlow"]',
    easy_apply: false,
    language: "English",
    has_applied: true,
    applied_on: new Date().toISOString(),
  },
  {
    applicants: 0,
    company: {
      name: "MJV Technology & Innovation",
      logo_url:
        "https://media.licdn.com/dms/image/v2/D4D0BAQGlEIHzx81JxQ/company-logo_200_200/B4DZd_pzPSGkAM-/0/1750193354321/mjv_tech_and_innovation_logo?e=1756944000&v=beta&t=xR0LnBf7cjDPrMdJHVK3ij8oYNuFSuOmwBYOZXlY67A",
    },
    job_url: "https://mjvcarreiras.gupy.io/jobs/9231998",
    location: "Brazil (Remote)",
    posted_on: new Date(
      new Date().setDate(new Date().getDate() - 40),
    ).toISOString(),
    title: "Pessoa Desenvolvedora Python/Golang",
    urn: "urn:li:fsd_jobPosting:4237482675",
    workplace_type: "Remote",
    employment_type: "Full-time",
    skills: '["Python", "Go", "SQL", "Docker", "Kubernetes"]',
    easy_apply: false,
    language: "Portuguese",
    has_applied: false,
  },
  {
    applicants: 8,
    company: {
      name: "CyberGuardians",
      logo_url: "https://placehold.co/64x64/16a34a/ffffff?text=CG",
    },
    job_url: "https://example.com/job/3",
    location: "London, UK (Hybrid)",
    posted_on: new Date(
      new Date().setDate(new Date().getDate() - 5),
    ).toISOString(),
    title: "Cybersecurity Analyst",
    urn: "urn:li:fsd_jobPosting:3",
    workplace_type: "Hybrid",
    employment_type: "Full-time",
    skills: '["SIEM", "Penetration Testing", "Firewalls"]',
    easy_apply: true,
    language: "English",
    has_applied: false,
  },
  {
    applicants: 1,
    company: {
      name: "Creative Minds Agency",
      logo_url: "https://placehold.co/64x64/f97316/ffffff?text=CM",
    },
    job_url: "https://example.com/job/4",
    location: "Remote",
    posted_on: new Date().toISOString(),
    title: "UX/UI Designer Intern",
    urn: "urn:li:fsd_jobPosting:4",
    workplace_type: "Remote",
    employment_type: "Internship",
    skills: '["Figma", "Adobe XD", "User Research"]',
    easy_apply: false,
    language: "English",
    has_applied: false,
  },
];

const JobListItem = ({ job, onSelect, isSelected }) => {
  const baseClasses =
    "p-4 border-l-4 cursor-pointer transition-colors duration-200 relative";
  const selectedClasses = "bg-sky-100 dark:bg-sky-900/30 border-sky-500";
  const unselectedClasses =
    "border-transparent hover:bg-gray-100 dark:hover:bg-gray-800";

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div
      onClick={() => onSelect(job)}
      className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}
    >
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 truncate pr-6">
          {job.title || "Untitled Job"}
        </h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          {job.has_applied && (
            <CheckCircle size={16} className="text-green-500" title="Applied" />
          )}
          {job.easy_apply && (
            <Zap size={16} className="text-yellow-500" title="Easy Apply" />
          )}
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {job.company?.name || "Unknown Company"}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
        {job.location || "Location not specified"}
      </p>
      <p className="text-xs text-gray-400 mt-1 italic">
        Posted on {formatDate(job.posted_on)}
      </p>
    </div>
  );
};

const JobDetailView = ({ job }) => {
  if (!job) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <p>Select a job to see the details</p>
      </div>
    );
  }

  const parseJsonArray = (field) => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === "string") {
      try {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const buildLinkedInJobUrl = (urn) => {
    if (!urn) return null;
    const jobId = urn.split(":").pop();
    return `https://www.linkedin.com/jobs/view/${jobId}/`;
  };

  const formatExperience = (experience) => {
    if (!experience) return null;

    const { min, max } = experience;

    if (min && max) return `${min}–${max} years experience`;
    if (min) return `${min}+ years experience`;
    if (max) return `Up to ${max} years experience`;

    return null;
  };

  const skills = parseJsonArray(job.skills || job.keywords);
  const responsibilities = parseJsonArray(job.responsibilities);
  const requirements = parseJsonArray(job.requirements || job.qualifications);

  const Placeholder = ({ text = "None specified" }) => (
    <div className="flex items-center text-gray-500 dark:text-gray-400 italic">
      <XCircle size={16} className="mr-2 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto">
      <div className="flex items-start mb-6">
        <img
          src={job.company?.logo_url}
          alt={`${job.company?.name} logo`}
          className="w-16 h-16 rounded-lg mr-6 object-contain border border-gray-200 dark:border-gray-700"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = `https://placehold.co/64x64/e2e8f0/4a5568?text=${job.company?.name?.charAt(0) || "?"}`;
          }}
        />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {job.title || "Untitled Job"}
          </h2>
          <p className="text-lg text-gray-700 dark:text-gray-300">
            {job.company?.name || "Unknown Company"}
          </p>
          {job.has_applied && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 text-sm font-medium rounded-full">
              <CheckCircle size={14} /> Applied on {formatDate(job.applied_on)}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <a
          href={buildLinkedInJobUrl(job.urn) || job.job_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`px-6 py-2 text-white font-semibold rounded-lg shadow-md transition-all duration-200 ${
            job.has_applied
              ? "bg-gray-500 hover:bg-gray-600"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {job.has_applied ? "View Application" : "Apply Now"}
        </a>
        {job.easy_apply && (
          <span className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 font-semibold rounded-lg">
            <Zap size={16} /> Easy Apply
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-8 text-sm">
        {}
        {job.job_type && (
          <div className="flex items-center text-indigo-900 dark:text-indigo-100 bg-indigo-100 dark:bg-indigo-900/40 p-3 rounded-lg border-l-4 border-indigo-500 dark:border-indigo-400 shadow-sm">
            <Briefcase
              size={18}
              className="mr-3 text-indigo-600 dark:text-indigo-300 flex-shrink-0"
            />
            <span className="font-semibold text-sm">{job.job_type}</span>
          </div>
        )}

        {}
        {Array.isArray(job.programming_languages) &&
          job.programming_languages.length > 0 && (
            <div className="flex items-center bg-violet-100 dark:bg-violet-900/40 p-3 rounded-lg border-l-4 border-violet-500 dark:border-violet-400 shadow-sm flex-wrap gap-2 text-violet-900 dark:text-violet-100">
              <Code
                size={18}
                className="mr-3 text-violet-700 dark:text-violet-300 flex-shrink-0"
              />
              {job.programming_languages.map((lang, index) => (
                <span
                  key={index}
                  className="bg-violet-200 dark:bg-violet-700 text-violet-900 dark:text-violet-100 px-2 py-0.5 rounded-full text-xs font-bold"
                >
                  {lang}
                </span>
              ))}
            </div>
          )}
        <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
          <MapPin size={18} className="mr-3 text-gray-500 flex-shrink-0" />{" "}
          <span className="truncate">{job.location || "Not specified"}</span>
        </div>
        <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
          <Briefcase size={18} className="mr-3 text-gray-500 flex-shrink-0" />{" "}
          <span className="truncate">
            {job.employment_type || "Not specified"}
          </span>
        </div>
        <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
          <Clock size={18} className="mr-3 text-gray-500 flex-shrink-0" />{" "}
          <span className="truncate">Posted: {formatDate(job.posted_on)}</span>
        </div>
        <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
          <Building size={18} className="mr-3 text-gray-500 flex-shrink-0" />{" "}
          <span className="truncate">
            {job.workplace_type || "Not specified"}
          </span>
        </div>
        <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
          <Globe size={18} className="mr-3 text-gray-500 flex-shrink-0" />{" "}
          <span className="truncate">{job.language || "Not specified"}</span>
        </div>
        <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
          <Users size={18} className="mr-3 text-gray-500 flex-shrink-0" />
          <span>
            {job.applicants > 0
              ? `${job.applicants} applicant${job.applicants > 1 ? "s" : ""}`
              : "Be the first to apply!"}
          </span>
        </div>
        {job.experience && (
          <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
            <Target size={18} className="mr-3 text-gray-500 flex-shrink-0" />
            <span>{formatExperience(job.experience)}</span>
          </div>
        )}
      </div>

      {job.description_snippet && (
        <div className="mb-8 p-4 bg-gray-100 dark:bg-gray-800/60 rounded-lg border-l-4 border-sky-500">
          <p className="text-gray-700 dark:text-gray-300 italic">
            {job.description_snippet}
          </p>
        </div>
      )}

      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-semibold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 flex items-center">
            <ChevronRight size={20} className="mr-2" /> Skills
          </h3>
          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, index) => (
                <span
                  key={index}
                  className="bg-sky-100 text-sky-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-sky-900 dark:text-sky-300"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <Placeholder />
          )}
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 flex items-center">
            <Target size={20} className="mr-2" /> Key Responsibilities
          </h3>
          {responsibilities.length > 0 ? (
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              {responsibilities.map((item, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle
                    size={16}
                    className="text-green-500 mr-3 mt-1 flex-shrink-0"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Placeholder />
          )}
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 flex items-center">
            <BookOpen size={20} className="mr-2" /> Qualifications
          </h3>
          {requirements.length > 0 ? (
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              {requirements.map((item, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle
                    size={16}
                    className="text-green-500 mr-3 mt-1 flex-shrink-0"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Placeholder />
          )}
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
            About the job
          </h3>
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-300">
            <p style={{ whiteSpace: "pre-wrap" }}>
              {job.description_full || "No full description available."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const FilterSelect = ({ label, value, onChange, children }) => (
  <div className="relative">
    <select
      value={value}
      onChange={onChange}
      className="w-full appearance-none p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
    >
      {children}
    </select>
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
      <svg
        className="fill-current h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
      >
        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
      </svg>
    </div>
  </div>
);

const MultiSelectFilter = ({
  options,
  selectedOptions,
  onChange,
  placeholder = "Select skills...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref]);

  const handleSelect = (option) => {
    const newSelectedOptions = selectedOptions.includes(option)
      ? selectedOptions.filter((item) => item !== option)
      : [...selectedOptions, option];
    onChange(newSelectedOptions);
  };

  const removeOption = (option) => {
    onChange(selectedOptions.filter((item) => item !== option));
  };

  return (
    <div className="relative col-span-1 md:col-span-2" ref={ref}>
      <div
        className="w-full flex flex-wrap gap-1 items-center p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 min-h-[42px] cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOptions.length > 0 ? (
          selectedOptions.map((option) => (
            <span
              key={option}
              className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300"
            >
              {option}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeOption(option);
                }}
                className="text-blue-500 hover:text-blue-700 focus:outline-none"
                aria-label={`Remove ${option}`}
              >
                <X size={12} />
              </button>
            </span>
          ))
        ) : (
          <span className="text-gray-500 dark:text-gray-400 px-1">
            {placeholder}
          </span>
        )}
      </div>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg">
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedOptions.includes(option)}
                onChange={() => handleSelect(option)}
                className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="ml-3 text-gray-900 dark:text-gray-100">
                {option}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const MainJobListing = () => {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [workplaceType, setWorkplaceType] = useState("All");
  const [datePosted, setDatePosted] = useState("All");
  const [applicationType, setApplicationType] = useState("All");
  const [appliedFilter, setAppliedFilter] = useState("All");
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [sortBy, setSortBy] = useState("relevance");

  const [isDragging, setIsDragging] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(35);
  const containerRef = useRef(null);
  const MIN_WIDTH = 25;
  const MAX_WIDTH = 75;

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await fetch("http://localhost:5000/jobs/all");
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setJobs(data);
        if (data.length > 0) setSelectedJob(data[0]);
      } catch (error) {
        console.error("Failed to fetch jobs from API, using mock data.", error);
        setJobs(mockData);
        if (mockData.length > 0) setSelectedJob(mockData[0]);
      }
    };

    fetchJobs();
  }, []);

  const uniqueSkills = useMemo(() => {
    const allSkills = new Set();
    jobs.forEach((job) => {
      let skillsArray = [];
      const skillsData = job.skills || job.keywords;
      if (skillsData) {
        try {
          const parsed = JSON.parse(skillsData);
          if (Array.isArray(parsed)) skillsArray = parsed;
        } catch (e) {
          if (typeof skillsData === "string" && skillsData.includes(",")) {
            skillsArray = skillsData.split(",").map((s) => s.trim());
          } else if (typeof skillsData === "string") {
            skillsArray = [skillsData];
          }
        }
      }
      skillsArray.forEach((skill) => {
        if (typeof skill === "string" && skill.trim()) {
          allSkills.add(skill.trim());
        }
      });
    });
    return Array.from(allSkills).sort();
  }, [jobs]);

  useEffect(() => {
    let processedJobs = [...jobs];

    if (searchTerm) {
      const normalize = (s) => (s || "").toLowerCase().trim();
      const normalizedFilter = normalize(searchTerm);
      processedJobs = processedJobs.filter((job) => {
        const title = normalize(job.title);
        const company = normalize(job.company?.name);
        return (
          title.includes(normalizedFilter) || company.includes(normalizedFilter)
        );
      });
    }

    if (workplaceType !== "All") {
      processedJobs = processedJobs.filter(
        (job) => job.workplace_type === workplaceType,
      );
    }

    if (datePosted !== "All") {
      const cutoffDate = new Date();
      const daysToSubtract = parseInt(datePosted, 10);
      cutoffDate.setDate(cutoffDate.getDate() - daysToSubtract);

      processedJobs = processedJobs.filter((job) => {
        if (!job.posted_on) return false;
        const postedDate = new Date(job.posted_on);
        return postedDate >= cutoffDate;
      });
    }

    if (applicationType !== "All") {
      const isEasyApply = applicationType === "easy_apply";
      processedJobs = processedJobs.filter(
        (job) => job.easy_apply === isEasyApply,
      );
    }

    if (appliedFilter === "Applied") {
      processedJobs = processedJobs.filter(
        (job) =>
          job.has_applied === true ||
          (job.applied_on && job.applied_on !== null),
      );
    } else if (appliedFilter === "Not Applied") {
      processedJobs = processedJobs.filter(
        (job) => !job.has_applied && !job.applied_on,
      );
    }

    if (selectedSkills.length > 0) {
      processedJobs = processedJobs.filter((job) => {
        const skillsData = job.skills || job.keywords;
        if (!skillsData) return false;

        let jobSkills = [];
        if (typeof skillsData === "string") {
          try {
            const parsed = JSON.parse(skillsData);
            if (Array.isArray(parsed)) jobSkills = parsed.map((s) => s.trim());
          } catch (e) {
            if (skillsData.includes(",")) {
              jobSkills = skillsData.split(",").map((s) => s.trim());
            } else {
              jobSkills = [skillsData];
            }
          }
        } else if (Array.isArray(skillsData)) {
          jobSkills = skillsData.map((s) => s.trim());
        }
        return selectedSkills.every((selectedSkill) =>
          jobSkills.includes(selectedSkill),
        );
      });
    }

    if (sortBy === "date") {
      processedJobs.sort(
        (a, b) => new Date(b.posted_on) - new Date(a.posted_on),
      );
    } else if (sortBy === "applied_date") {
      processedJobs.sort((a, b) => {
        const dateA = a.applied_on ? new Date(a.applied_on) : new Date(0);
        const dateB = b.applied_on ? new Date(b.applied_on) : new Date(0);

        return dateB - dateA;
      });
    }

    setFilteredJobs(processedJobs);

    if (
      selectedJob &&
      !processedJobs.some((job) => job.urn === selectedJob.urn)
    ) {
      setSelectedJob(processedJobs.length > 0 ? processedJobs[0] : null);
    } else if (!selectedJob && processedJobs.length > 0) {
      setSelectedJob(processedJobs[0]);
    }
  }, [
    searchTerm,
    workplaceType,
    datePosted,
    applicationType,
    appliedFilter,
    selectedSkills,
    sortBy,
    jobs,
    selectedJob,
  ]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidthPx = e.clientX - containerRect.left;
      const newWidthPercent = (newWidthPx / containerRect.width) * 100;
      const clampedWidth = Math.max(
        MIN_WIDTH,
        Math.min(newWidthPercent, MAX_WIDTH),
      );
      setLeftPanelWidth(clampedWidth);
    },
    [isDragging, MIN_WIDTH, MAX_WIDTH],
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <div
        ref={containerRef}
        className="flex h-screen"
        style={{ userSelect: isDragging ? "none" : "auto" }}
      >
        {}
        <div
          className="flex flex-col flex-shrink-0"
          style={{ width: `${leftPanelWidth}%` }}
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
            {}
            <input
              type="text"
              placeholder="Search by title or company..."
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              onChange={(e) => setSearchTerm(e.target.value)}
              value={searchTerm}
            />

            {}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FilterSelect
                value={workplaceType}
                onChange={(e) => setWorkplaceType(e.target.value)}
              >
                <option value="All">All Workplaces</option>
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="On-site">On-site</option>
              </FilterSelect>
              <FilterSelect
                value={datePosted}
                onChange={(e) => setDatePosted(e.target.value)}
              >
                <option value="All">Any Time</option>
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
              </FilterSelect>
              <FilterSelect
                value={applicationType}
                onChange={(e) => setApplicationType(e.target.value)}
              >
                <option value="All">All Application Types</option>
                <option value="easy_apply">Easy Apply</option>
                <option value="company_website">Company Website</option>
              </FilterSelect>
              <FilterSelect
                value={appliedFilter}
                onChange={(e) => setAppliedFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Applied">Applied</option>
                <option value="Not Applied">Not Applied</option>
              </FilterSelect>
              <FilterSelect
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="relevance">Sort by: Relevance</option>
                <option value="date">Sort by: Date Posted</option>
                <option value="applied_date">Sort by: Applied Date</option> {}
              </FilterSelect>
              <MultiSelectFilter
                options={uniqueSkills}
                selectedOptions={selectedSkills}
                onChange={setSelectedSkills}
                placeholder="Filter by skills..."
              />
            </div>

            {}
            <p className="text-sm text-gray-500 dark:text-gray-400 pl-1">
              {filteredJobs.length} results
            </p>
          </div>

          {}
          <div className="flex-grow overflow-y-auto">
            {filteredJobs.length > 0 ? (
              filteredJobs.map((job) => (
                <JobListItem
                  key={job.urn}
                  job={job}
                  onSelect={setSelectedJob}
                  isSelected={selectedJob?.urn === job.urn}
                />
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Filter size={48} className="mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold">No jobs found</h3>
                <p>Try adjusting your search or filter criteria.</p>
              </div>
            )}
          </div>
        </div>

        {}
        <div
          className="w-2 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200"
          onMouseDown={handleMouseDown}
        />

        {}
        <main className="flex-grow bg-white dark:bg-gray-800/50">
          <JobDetailView job={selectedJob} />
        </main>
      </div>
    </div>
  );
};

export default MainJobListing;
