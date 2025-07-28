// frontend/src/components/match-find/JobListing.jsx
import React, {useMemo, useState, useEffect} from 'react';
import {Award, BarChart2, CheckCircle, Target, Zap} from 'lucide-react';
import {getColorFromScore} from "./MatchLogic.jsx";

const Spinner = ({className = 'h-5 w-5 text-white'}) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const MatchedJobItem = ({job, onSelect, isSelected}) => {
    const score = Math.round(job.matchScore || 0);
    const barColor = getColorFromScore(score);
    const isApplied = !!job.applied_on;

    const baseClasses = "p-4 border-l-4 cursor-pointer transition-colors duration-200";
    const selectedClasses = "bg-sky-100 dark:bg-sky-900/30 border-sky-500";
    const unselectedClasses = "border-transparent hover:bg-gray-100 dark:hover:bg-gray-800";

    return (
        <div onClick={() => onSelect(job)}
             className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        {isApplied && <CheckCircle size={14} className="text-green-500 flex-shrink-0"/>}
                        <span>{job.title}</span>
                        {job.easy_apply &&
                            <Zap size={14} className="text-yellow-500 flex-shrink-0" title="Easy Apply"/>}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{job.company?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{job.location}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 ml-4">
                    <div className="font-bold text-lg" style={{color: barColor}}>{score}%</div>
                    <div className="text-xs text-gray-500">Match</div>
                </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="h-1.5 rounded-full transition-all duration-200"
                     style={{width: `${score}%`, backgroundColor: barColor}}/>
            </div>
        </div>
    );
};

const JobListing = ({
                        resumes, selectedResumeId, handleSelectResume, jobMetrics, handleMatch,
                        status, errorMessage, successMessage, matchedJobs, setSelectedJob, selectedJob,
                        jobs, forbiddenRegexes
                    }) => {
    const [selectedLanguageFilter, setSelectedLanguageFilter] = useState('');
    const [selectedRecencyFilter, setSelectedRecencyFilter] = useState('');

    const allLanguages = useMemo(() => {
        const langSet = new Set();
        jobs.forEach(job => {
            (job.programming_languages || []).forEach(lang => {
                const normalized = lang.toLowerCase();
                if (!forbiddenRegexes.some(regex => regex.test(normalized))) {
                    langSet.add(normalized);
                }
            });
        });
        return Array.from(langSet).sort();
    }, [jobs, forbiddenRegexes]);

    useEffect(() => {
        if (allLanguages.includes('python')) setSelectedLanguageFilter('python');
    }, [allLanguages]);

    const filteredMatchedJobs = useMemo(() =>
            matchedJobs.filter(job => {
                // Language filter
                const langPass = !selectedLanguageFilter ||
                    (job.programming_languages || [])
                        .map(l => l.toLowerCase())
                        .includes(selectedLanguageFilter);

                // Recency filter
                let datePass = true;
                // CHANGE #1: Use 'job.posted_on' instead of 'job.postedAt'
                if (selectedRecencyFilter && job.posted_on) {
                    // CHANGE #2: Use 'job.posted_on' here as well
                    const jobTime = new Date(job.posted_on).getTime();

                    if (isNaN(jobTime)) {
                        datePass = false;
                    } else {
                        const now = Date.now();
                        switch (selectedRecencyFilter) {
                            case '24h':
                                datePass = jobTime >= (now - 24 * 60 * 60 * 1000);
                                break;
                            case '7d':
                                datePass = jobTime >= (now - 7 * 24 * 60 * 60 * 1000);
                                break;
                            case '14d':
                                datePass = jobTime >= (now - 14 * 24 * 60 * 60 * 1000);
                                break;
                            case '30d':
                                datePass = jobTime >= (now - 30 * 24 * 60 * 60 * 1000);
                                break;
                            default:
                                break;
                        }
                    }
                }

                return langPass && datePass;
            }),
        [matchedJobs, selectedLanguageFilter, selectedRecencyFilter]
    );

    if (matchedJobs.length > 0) {
        console.log("Inspecting the first job object:", matchedJobs[0]);
    }

    const StatusIndicator = () => {
        if (status === 'matching') return (
            <div className="p-8 text-center text-gray-500"><Spinner className="mx-auto h-12 w-12 text-sky-500"/>
                <p className="mt-4">Finding the best opportunities for you...</p>
            </div>
        );
        if (status === 'success' && matchedJobs.length === 0) return (
            <div className="p-8 text-center text-gray-500"><h3 className="text-xl font-semibold">No Matching Jobs
                Found</h3><p>Try adjusting your profile keywords.</p></div>
        );
        if (status === 'idle' && matchedJobs.length === 0) return (
            <div className="p-8 text-center text-gray-500"><Target size={48} className="mx-auto mb-4 text-gray-400"/><h3
                className="text-xl font-semibold">Ready to Match</h3><p>Select your resume and find matches.</p></div>
        );
        return null;
    };

    return (
        <aside className="flex flex-col flex-shrink-0 w-[35%] max-w-md border-r border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><Award size={24}
                                                                                 className="text-sky-500"/> Job Matcher
                </h2>
                <div>
                    <label htmlFor="resume-select"
                           className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">1. Select your
                        resume</label>
                    <select id="resume-select" value={selectedResumeId}
                            onChange={(e) => handleSelectResume(e.target.value)}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-sky-500">
                        <option value="">-- Load a resume --</option>
                        {resumes.map(resume => <option key={resume.id} value={resume.id}>{resume.name}</option>)}
                    </select>
                </div>
                {jobMetrics.total > 0 && <div
                    className="text-xs text-center text-gray-500 dark:text-gray-400 space-y-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <p>Analyzing <strong>{jobMetrics.total}</strong> jobs</p><p><span
                    className="text-green-600 dark:text-green-400">{jobMetrics.complete} complete</span><span
                    className="mx-1">/</span><span
                    className="text-yellow-600 dark:text-yellow-400">{jobMetrics.incomplete} incomplete</span></p>
                </div>}
                <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">2. Find your
                        matches</label>
                    <button onClick={handleMatch} disabled={!selectedResumeId || status === 'matching'}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 transition-all disabled:bg-gray-500 disabled:cursor-not-allowed">
                        <BarChart2 size={20}/>{status === 'matching' ? 'Analyzing...' : 'Find Best Matches'}
                    </button>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Filter by
                        Language (Optional)</label>
                    <select value={selectedLanguageFilter} onChange={(e) => setSelectedLanguageFilter(e.target.value)}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-sky-500">
                        <option value="">-- All Languages --</option>
                        {allLanguages.map(lang => (
                            <option key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>))}
                    </select>
                </div>
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Posted within
                    </label>
                    <select
                        value={selectedRecencyFilter}
                        onChange={(e) => setSelectedRecencyFilter(e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-sky-500"
                    >
                        <option value="">Any time</option>
                        <option value="24h">Last 24h</option>
                        <option value="7d">Last 7 days</option>
                        <option value="14d">Last 14 days</option>
                        <option value="30d">Last 30 days</option>
                    </select>
                </div>
                {matchedJobs.length > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
                        Showing <strong>{filteredMatchedJobs.length}</strong> of <strong>{matchedJobs.length}</strong> matched
                        jobs
                    </p>
                )}
                {errorMessage &&
                    <p className="text-sm text-red-500 dark:text-red-400 text-center p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">{errorMessage}</p>}
            </div>
            <div className="flex-grow overflow-y-auto">
                {successMessage &&
                    <p className="text-sm text-green-600 dark:text-green-400 text-center p-2 m-2 bg-green-100 dark:bg-green-900/30 rounded-lg">{successMessage}</p>}
                <StatusIndicator/>
                {filteredMatchedJobs.map(job => (
                    <MatchedJobItem key={job.urn} job={job} onSelect={setSelectedJob}
                                    isSelected={selectedJob?.urn === job.urn}/>
                ))}
            </div>
        </aside>
    );
};

export default JobListing;