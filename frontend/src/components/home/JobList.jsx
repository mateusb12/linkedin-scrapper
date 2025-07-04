import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Briefcase, MapPin, Clock, Users, Zap } from 'lucide-react';

// Mock data representing job listings. In a real app, this would come from an API.
const mockData = [
    {
        "applicants": 0,
        "company": {
            "logo_url": "https://media.licdn.com/dms/image/v2/D4D0BAQGlEIHzx81JxQ/company-logo_200_200/B4DZd_pzPSGkAM-/0/1750193354321/mjv_tech_and_innovation_logo?e=1756944000&v=beta&t=xR0LnBf7cjDPrMdJHVK3ij8oYNuFSuOmwBYOZXlY67A",
            "name": "MJV Technology & Innovation",
            "url": "https://www.linkedin.com/company/mjv-tech-and-innovation/life",
            "urn": "urn:li:fsd_company:83580"
        },
        "company_urn": "urn:li:fsd_company:83580",
        "description_full": "Descrição da vaga\n\nSer MJVer 🤝 é estar em um dos melhores lugares para trabalhar...\n[TRUNCATED HERE FOR BREVITY — you’ll get full JSON in download]",
        "description_snippet": "4 school alumni work here",
        "easy_apply": false,
        "employment_type": "Full-time",
        "job_url": "https://mjvcarreiras.gupy.io/jobs/9231998",
        "location": "Brazil (Remote)",
        "posted_on": "May 30, 2025",
        "title": "Pessoa Desenvolvedora Python/Golang\nTrabalho Remoto\nEfetivo",
        "urn": "urn:li:fsd_jobPosting:4237482675",
        "workplace_type": "Remote"
    },
    {
        "applicants": 12,
        "company": {
            "logo_url": "https://media.licdn.com/dms/image/v2/D4D0BAQEEnATeFu7uAw/company-logo_200_200/company-logo_200_200/0/1721777167872/auramind_ai_logo?e=1756944000&v=beta&t=d5_ogfQhy_swysPpWBOhvX6ce55VcsoQJZ_7Bz69UVg",
            "name": "Auramind.ai",
            "url": "https://www.linkedin.com/company/auramind-ai/life",
            "urn": "urn:li:fsd_company:103623376"
        },
        "company_urn": "urn:li:fsd_company:103623376",
        "description_full": "Procuramos um(a) desenvolvedor(a) Python PLENO que vai além do óbvio...",
        "description_snippet": "Company review time is typically 1 week",
        "easy_apply": true,
        "employment_type": "Full-time",
        "job_url": "https://www.linkedin.com/jobs/view/4257609291/",
        "location": "Goiânia, Goiás, Brazil (Remote)",
        "posted_on": "Jul 2, 2025",
        "title": "Backend Developer - Python - Pleno",
        "urn": "urn:li:fsd_jobPosting:4257609291",
        "workplace_type": "Remote"
    },
    {
        "applicants": 3,
        "company": {
            "logo_url": "https://media.licdn.com/dms/image/v2/D560BAQFhAT_f2S08EQ/company-logo_200_200/company-logo_200_200/0/1699284516534/wexinc_logo?e=1756944000&v=beta&t=NtZa7aSPem2JOsxFBPYXN28p70MHEoYBoGvVu-fdaQw",
            "name": "WEX",
            "url": "https://www.linkedin.com/company/wexinc/life",
            "urn": "urn:li:fsd_company:11637"
        },
        "company_urn": "urn:li:fsd_company:11637",
        "description_full": "About The Team/Role\n\nWe are the Core Information Delivery team, supporting core reporting frameworks...",
        "description_snippet": "2 company alumni work here",
        "easy_apply": false,
        "employment_type": "Full-time",
        "job_url": "https://careers.wexinc.com/us/en/job/WEXWEXUSR17144EXTERNALENUS/Mid-Python-Developer?utm_source=linkedin&utm_medium=phenom-feeds",
        "location": "São Paulo, Brazil (Remote)",
        "posted_on": "Feb 22, 2025",
        "title": "Mid Python Developer",
        "urn": "urn:li:fsd_jobPosting:4161846248",
        "workplace_type": "Remote"
    }
]


/**
 * A compact card for the job list on the left.
 * @param {object} props - The component props.
 * @param {object} props.job - The job data.
 * @param {function} props.onSelect - Function to call when the card is clicked.
 * @param {boolean} props.isSelected - Whether this card is the currently selected one.
 */
const JobListItem = ({ job, onSelect, isSelected }) => {
    const baseClasses = "p-4 border-l-4 cursor-pointer transition-colors duration-200";
    const selectedClasses = "bg-sky-100 dark:bg-sky-900/30 border-sky-500";
    const unselectedClasses = "border-transparent hover:bg-gray-100 dark:hover:bg-gray-800";

    return (
        <div
            onClick={() => onSelect(job)}
            className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}
        >
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 truncate">{job.title}</h3>
                {job.easy_apply && <Zap size={16} className="text-yellow-500 flex-shrink-0 ml-2" title="Easy Apply" />}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{job.company.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{job.location}</p>
        </div>
    );
};

/**
 * A detailed view of a single job.
 * @param {object} props - The component props.
 * @param {object|null} props.job - The job to display.
 */
const JobDetailView = ({ job }) => {
    if (!job) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <p>Select a job to see the details</p>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto">
            <div className="flex items-start mb-6">
                <img
                    src={job.company.logo_url}
                    alt={`${job.company.name} logo`}
                    className="w-16 h-16 rounded-lg mr-6 object-contain border border-gray-200 dark:border-gray-700"
                    onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/64x64/e2e8f0/4a5568?text=${job.company.name.charAt(0)}`; }}
                />
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{job.title}</h2>
                    <p className="text-lg text-gray-700 dark:text-gray-300">{job.company.name}</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mb-6">
                <a
                    href={job.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all duration-200 text-center"
                >
                    Apply Now
                </a>
                {job.easy_apply && (
                    <span className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 font-semibold rounded-lg">
                        <Zap size={16} /> Easy Apply
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 text-sm">
                <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                    <MapPin size={18} className="mr-3 text-gray-500 flex-shrink-0" /> <span className="truncate">{job.location}</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                    <Briefcase size={18} className="mr-3 text-gray-500 flex-shrink-0" /> <span className="truncate">{job.employment_type}</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                    <Clock size={18} className="mr-3 text-gray-500 flex-shrink-0" /> <span className="truncate">Posted: {job.posted_on}</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg col-span-1 sm:col-span-2 lg:col-span-3">
                    <Users size={18} className="mr-3 text-gray-500 flex-shrink-0" />
                    <span>
                        {job.applicants > 0
                            ? `${job.applicants} applicant${job.applicants > 1 ? 's' : ''}`
                            : 'Be the first to apply!'}
                    </span>
                </div>
            </div>

            {job.description_snippet && (
                <div className="mb-8 p-4 bg-gray-100 dark:bg-gray-800/60 rounded-lg border-l-4 border-sky-500">
                    <p className="text-gray-700 dark:text-gray-300 italic">
                        {job.description_snippet}
                    </p>
                </div>
            )}

            <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-300">
                <h3 className="text-xl font-semibold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">About the job</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{job.description_full}</p>
            </div>
        </div>
    );
};


/**
 * The main component for the job listings page.
 */
const MainJobListing = () => {
    const [jobs, setJobs] = useState([]);
    const [filteredJobs, setFilteredJobs] = useState([]);
    const [filter, setFilter] = useState('');
    const [selectedJob, setSelectedJob] = useState(null);

    // State for resizable column
    const [isDragging, setIsDragging] = useState(false);
    const [leftPanelWidth, setLeftPanelWidth] = useState(35); // Initial width in percentage
    const containerRef = useRef(null);
    const MIN_WIDTH = 20; // Minimum width in percentage
    const MAX_WIDTH = 80; // Maximum width in percentage

    // Effect to load initial data from API with mock data as fallback
    useEffect(() => {
        const fetchJobs = async () => {
            try {
                // Try to fetch from a local API endpoint if available
                const response = await fetch('http://localhost:5000/jobs/all');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                console.log("Successfully fetched jobs from API.");
                setJobs(data);
                if (data.length > 0) setSelectedJob(data[0]);
            } catch (error) {
                // Fallback to mock data if the API fails
                console.error("Failed to fetch jobs from API, using mock data.", error);
                // I updated the mock data to include some non-zero applicant counts for demonstration
                const updatedMockData = mockData.map((job, index) => ({
                    ...job,
                    applicants: index === 1 ? 12 : index === 2 ? 3 : 0,
                }));
                setJobs(updatedMockData);
                if (updatedMockData.length > 0) setSelectedJob(updatedMockData[0]);
            }
        };

        fetchJobs();
    }, []); // Empty dependency array means this effect runs once on component mount

    // Effect to handle filtering logic
    useEffect(() => {
        const newFilteredJobs = jobs.filter(job =>
            job.title.toLowerCase().includes(filter.toLowerCase()) ||
            job.company.name.toLowerCase().includes(filter.toLowerCase())
        );
        setFilteredJobs(newFilteredJobs);

        if (selectedJob && !newFilteredJobs.some(job => job.urn === selectedJob.urn)) {
            setSelectedJob(newFilteredJobs.length > 0 ? newFilteredJobs[0] : null);
        } else if (!selectedJob && newFilteredJobs.length > 0) {
            setSelectedJob(newFilteredJobs[0]);
        }

    }, [filter, jobs, selectedJob]);


    // Handlers for resizing
    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidthPx = e.clientX - containerRect.left;
        const newWidthPercent = (newWidthPx / containerRect.width) * 100;

        const clampedWidth = Math.max(MIN_WIDTH, Math.min(newWidthPercent, MAX_WIDTH));
        setLeftPanelWidth(clampedWidth);
    }, [isDragging, MIN_WIDTH, MAX_WIDTH]);

    // Effect to add and remove global event listeners for resizing
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);


    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            <div
                ref={containerRef}
                className="flex h-screen"
                style={{ userSelect: isDragging ? 'none' : 'auto' }}
            >
                {/* Left Column: Job List */}
                <div
                    className="flex flex-col flex-shrink-0"
                    style={{ width: `${leftPanelWidth}%` }}
                >
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <input
                            type="text"
                            placeholder="Filter by title or company..."
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            onChange={(e) => setFilter(e.target.value)}
                            value={filter}
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 pl-1">{filteredJobs.length} results</p>
                    </div>
                    <div className="flex-grow overflow-y-auto">
                        {filteredJobs.length > 0 ? (
                            filteredJobs.map(job => (
                                <JobListItem
                                    key={job.urn}
                                    job={job}
                                    onSelect={setSelectedJob}
                                    isSelected={selectedJob?.urn === job.urn}
                                />
                            ))
                        ) : (
                            <p className="p-4 text-center text-gray-500">No jobs found.</p>
                        )}
                    </div>
                </div>

                {/* Resizer Handle */}
                <div
                    className="w-2 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200"
                    onMouseDown={handleMouseDown}
                />

                {/* Right Column: Job Details */}
                <main className="flex-grow">
                    <JobDetailView job={selectedJob} />
                </main>
            </div>
        </div>
    );
};

export default MainJobListing;