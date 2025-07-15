import React, { useState, useEffect, useCallback } from 'react';
import { Target, CheckCircle, BarChart2, Briefcase, MapPin, Clock, Building, Users, ChevronRight, XCircle, Globe, Award, ClipboardList, ListChecks } from 'lucide-react';
import { findBestMatches, getSkillsArray, normalizeSkill } from './MatchLogic';

// Define the base URL for the API endpoint
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Mock job data as a fallback
const mockJobs = [
    { applicants: 5, company: { name: "Innovatech Solutions" }, job_url: "#", location: "San Francisco, CA", posted_on: new Date().toISOString(), title: "Senior Frontend Developer", urn: "1", workplace_type: "On-site", employment_type: "Full-time", responsibilities: ["Develop new user-facing features", "Build reusable code and libraries for future use"], qualifications: ["3+ years of experience with React", "Strong proficiency in JavaScript and TypeScript"], keywords: ["React", "TypeScript", "Next.js"], easy_apply: true },
    { applicants: 12, company: { name: "Auramind.ai" }, job_url: "#", location: "Goiânia, Brazil (Remote)", posted_on: new Date().toISOString(), title: "Backend Developer - Python", urn: "2", workplace_type: "Remote", employment_type: "Full-time", responsibilities: ["Design and implement RESTful APIs", "Maintain and improve database performance"], qualifications: ["Proven experience as a Python Developer", "Experience with Django or Flask frameworks"], keywords: ["Python", "Django", "back-end", "RESTful APIs"], easy_apply: true },
    { applicants: 3, company: { name: "WEX" }, job_url: "#", location: "São Paulo, Brazil (Hybrid)", posted_on: new Date().toISOString(), title: "Mid Python Developer", urn: "3", workplace_type: "Hybrid", employment_type: "Full-time", responsibilities: [], qualifications: ["Knowledge of SQL and database design"], keywords: ["Python", "SQL"], easy_apply: false }, // Incomplete
    { applicants: 25, company: { name: "DataDriven Inc." }, job_url: "#", location: "New York, NY (Remote)", posted_on: new Date().toISOString(), title: "Data Scientist", urn: "4", workplace_type: "Remote", employment_type: "Contract", responsibilities: ["Analyze large, complex data sets to identify trends"], qualifications: [], keywords: ["Python", "Pandas", "TensorFlow"], easy_apply: false }, // Incomplete
];


const getColorFromScore = (score) => {
    const capped = Math.min(score, 50);
    const hue = Math.round((capped / 50) * 120);
    return `hsl(${hue}, 80%, 50%)`;
};


const MatchedJobItem = ({ job, onSelect, isSelected }) => {
    const score = Math.round(job.matchScore || 0);
    const barColor = getColorFromScore(score);

    const baseClasses = "p-4 border-l-4 cursor-pointer transition-colors duration-200";
    const selectedClasses = "bg-sky-100 dark:bg-sky-900/30 border-sky-500";
    const unselectedClasses = "border-transparent hover:bg-gray-100 dark:hover:bg-gray-800";

    return (
        <div onClick={() => onSelect(job)} className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-100">{job.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{job.company?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{job.location}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 ml-4">
                    <div className={`font-bold text-lg ${score > 75 ? 'text-green-500' : score > 50 ? 'text-sky-500' : score > 25 ? 'text-yellow-500' : 'text-gray-500'}`}>{score}%</div>
                    <div className="text-xs text-gray-500">Match</div>
                </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                    className="h-1.5 rounded-full transition-all duration-200"
                    style={{
                        width: `${score}%`,
                        backgroundColor: barColor
                    }}
                />
            </div>
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

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    };

    const jobKeywords = getSkillsArray(job.keywords);

    const Placeholder = ({ text = "None specified" }) => (
        <div className="flex items-center text-gray-500 dark:text-gray-400 italic">
            <XCircle size={16} className="mr-2" />
            <span>{text}</span>
        </div>
    );

    const DetailSection = ({ title, icon, items }) => (
        <div>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700 flex items-center">{icon} {title}</h3>
            {items && items.length > 0 ? (
                <ul className="space-y-2 list-disc list-inside text-gray-800 dark:text-gray-300">
                    {items.map((item, index) => (
                        <li key={index}>{item}</li>
                    ))}
                </ul>
            ) : <Placeholder />}
        </div>
    );

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto">
            <div className="flex items-start mb-6">
                <img
                    src={job.company?.logo_url}
                    alt={`${job.company?.name} logo`}
                    className="w-16 h-16 rounded-lg mr-6 object-contain border border-gray-200 dark:border-gray-700"
                    onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/64x64/e2e8f0/4a5568?text=${job.company?.name?.charAt(0) || '?'}`; }}
                />
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{job.title}</h2>
                    <p className="text-lg text-gray-700 dark:text-gray-300">{job.company?.name}</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mb-6">
                <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all">
                    Apply Now
                </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-sm">
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-lg"><MapPin size={18} className="mr-3 text-gray-500"/>{job.location}</div>
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-lg"><Briefcase size={18} className="mr-3 text-gray-500"/>{job.employment_type}</div>
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-lg"><Clock size={18} className="mr-3 text-gray-500"/>Posted: {formatDate(job.posted_on)}</div>
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-lg"><Building size={18} className="mr-3 text-gray-500"/>{job.workplace_type}</div>
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-lg"><Globe size={18} className="mr-3 text-gray-500"/>{job.language || 'Not specified'}</div>
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-lg"><Users size={18} className="mr-3 text-gray-500"/>{job.applicants > 0 ? `${job.applicants} applicants` : 'Be the first!'}</div>
            </div>

            <div className="space-y-8">
                <div>
                    {/* ✨ FIXED: Renamed to Keywords */}
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700 flex items-center"><ChevronRight size={20} className="mr-2" /> Required Keywords</h3>
                    {jobKeywords.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {jobKeywords.map((keyword, index) => {
                                const isMatched = job.matchedSkillsSet?.has(keyword);
                                return (
                                    <span key={index} className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isMatched ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                                        {isMatched && <CheckCircle size={14} />}
                                        {keyword}
                                    </span>
                                );
                            })}
                        </div>
                    ) : <Placeholder text="No keywords specified" />}
                </div>

                {/* ✨ FIXED: Display Responsibilities */}
                <DetailSection title="Responsibilities" icon={<ClipboardList size={20} className="mr-2" />} items={job.responsibilities} />

                {/* ✨ FIXED: Display Qualifications */}
                <DetailSection title="Qualifications" icon={<ListChecks size={20} className="mr-2" />} items={job.qualifications} />

                <div>
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700">About the job</h3>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-300">
                        <p style={{ whiteSpace: 'pre-wrap' }}>{job.description_full || "No full description available."}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};


const Match = () => {
    const [resumes, setResumes] = useState([]);
    const [selectedResumeId, setSelectedResumeId] = useState('');
    const [selectedResume, setSelectedResume] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [matchedJobs, setMatchedJobs] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [status, setStatus] = useState('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [jobMetrics, setJobMetrics] = useState({ total: 0, complete: 0, incomplete: 0 });

    useEffect(() => {
        const fetchResumes = async () => {
            try {
                const response = await fetch(`${API_BASE}/jobs/`);
                if (!response.ok) throw new Error('Failed to fetch resumes');
                const data = await response.json();
                setResumes(data);
            } catch (error) {
                console.error(error);
                setErrorMessage('Could not load resumes.');
            }
        };
        fetchResumes();
    }, []);

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const response = await fetch(`${API_BASE}/jobs/all`);
                if (!response.ok) throw new Error('API request failed');
                const data = await response.json();
                setJobs(data);
            } catch (error) {
                console.warn("API fetch failed, using mock jobs.", error);
                setJobs(mockJobs);
            }
        };
        fetchJobs();
    }, []);

    useEffect(() => {
        if (jobs.length > 0) {
            let completeCount = 0;
            const totalCount = jobs.length;

            jobs.forEach(job => {
                const hasTitle = job.title && job.title.trim() !== '';
                const hasLocation = job.location && job.location.trim() !== '';
                const hasDescription = job.description_full && job.description_full.trim() !== '';

                if (hasTitle && hasLocation && hasDescription) {
                    completeCount++;
                }
            });

            setJobMetrics({
                total: totalCount,
                complete: completeCount,
                incomplete: totalCount - completeCount,
            });
        }
    }, [jobs]);

    const handleSelectResume = useCallback(async (id) => {
        setSelectedResumeId(id);
        if (!id) {
            setSelectedResume(null);
            setMatchedJobs([]);
            setSelectedJob(null);
            setStatus('idle');
            return;
        }

        setStatus('loading');
        try {
            const response = await fetch(`${API_BASE}/jobs/${id}`);
            if (!response.ok) throw new Error(`Failed to fetch resume ${id}`);
            const data = await response.json();
            setSelectedResume(data);
            setStatus('idle');
        } catch (error)
        {
            console.error(error);
            setErrorMessage(`Failed to load resume: ${error.message}`);
            setStatus('error');
        }
    }, []);

    const handleMatch = () => {
        if (!selectedResume || !selectedResume.hard_skills) {
            setErrorMessage('Please select a resume with skills to start matching.');
            setStatus('error');
            return;
        }

        setStatus('matching');
        setErrorMessage('');
        setMatchedJobs([]);
        setSelectedJob(null);

        setTimeout(() => {
            const sortedJobs = findBestMatches(jobs, selectedResume);

            setMatchedJobs(sortedJobs);
            setSelectedJob(sortedJobs.length > 0 ? sortedJobs[0] : null);
            setStatus('success');
        }, 500);
    };

    const StatusIndicator = () => {
        if (status === 'idle' && matchedJobs.length === 0) {
            return (
                <div className="p-8 text-center text-gray-500">
                    <Target size={48} className="mx-auto mb-4 text-gray-400" />
                    <h3 className="text-xl font-semibold">Ready to Match</h3>
                    <p>Select your resume and click "Find Best Matches".</p>
                </div>
            );
        }
        if (status === 'matching') {
            return (
                <div className="p-8 text-center text-gray-500">
                    <svg className="animate-spin mx-auto h-12 w-12 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4">Finding the best opportunities for you...</p>
                </div>
            );
        }
        if (status === 'success' && matchedJobs.length === 0) {
            return (
                <div className="p-8 text-center text-gray-500">
                    <h3 className="text-xl font-semibold">No Complete Jobs Found</h3>
                    <p>Try again after more jobs with full details are added.</p>
                </div>
            )
        }
        return null;
    };


    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            <div className="flex h-screen">
                <div className="flex flex-col flex-shrink-0 w-[35%] max-w-md border-r border-gray-200 dark:border-gray-700">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2"><Award size={24} className="text-sky-500" /> Job Matcher</h2>

                        <div>
                            <label htmlFor="resume-select" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                1. Select your resume
                            </label>
                            <select
                                id="resume-select"
                                value={selectedResumeId}
                                onChange={(e) => handleSelectResume(e.target.value)}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="">-- Load a resume --</option>
                                {resumes.map(resume => (
                                    <option key={resume.id} value={resume.id}>{resume.name}</option>
                                ))}
                            </select>
                        </div>

                        {jobMetrics.total > 0 && (
                            <div className="text-xs text-center text-gray-500 dark:text-gray-400 space-y-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                <p>Fetched <strong>{jobMetrics.total}</strong> jobs</p>
                                <p>
                                    <span className="text-green-600 dark:text-green-400">{jobMetrics.complete} full jobs</span>
                                    <span className="mx-1">({jobMetrics.incomplete} incomplete)</span>
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                2. Find your matches
                            </label>
                            <button
                                onClick={handleMatch}
                                disabled={!selectedResumeId || status === 'matching'}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 transition-all disabled:bg-gray-500 disabled:cursor-not-allowed"
                            >
                                <BarChart2 size={20} />
                                {status === 'matching' ? 'Analyzing...' : 'Find Best Matches'}
                            </button>
                        </div>
                        {errorMessage && <p className="text-sm text-red-500 dark:text-red-400 text-center">{errorMessage}</p>}
                    </div>

                    <div className="flex-grow overflow-y-auto">
                        <StatusIndicator />
                        {matchedJobs.length > 0 && (
                            matchedJobs.map(job => (
                                <MatchedJobItem
                                    key={job.urn}
                                    job={job}
                                    onSelect={setSelectedJob}
                                    isSelected={selectedJob?.urn === job.urn}
                                />
                            ))
                        )}
                    </div>
                </div>

                <main className="flex-grow bg-white dark:bg-gray-800/50">
                    <JobDetailView job={selectedJob} />
                </main>
            </div>
        </div>
    );
};

export default Match;