// frontend/src/components/match-find/JobListing.jsx
import React, {useMemo, useState, useEffect, useRef, useCallback} from 'react'; // 1. ADDED: useRef, useCallback
import {Award, BarChart2, CheckCircle, Target, Zap} from 'lucide-react';
import {getColorFromScore} from "./MatchLogic.jsx";

const Spinner = ({className = 'h-5 w-5 text-white'}) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const formatPostedDate = (postedOn) => {
    if (!postedOn) return 'Posted date unknown';

    const postedDate = new Date(postedOn);
    const now = new Date();
    const diffMs = now - postedDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const formattedDate = postedDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    let styleClass = "font-semibold text-gray-700 dark:text-gray-300";
    let extraClass = "";
    let label = `(${diffDays}d ago)`; // fallback

    if (diffDays <= 7) {
        styleClass = "font-semibold text-green-600 dark:text-green-400";
        extraClass = "uppercase text-base";
        label = `(${diffDays === 0 ? 'today' : `${diffDays} day${diffDays > 1 ? 's' : ''} ago`})`.toUpperCase();
    } else if (diffDays <= 30) {
        styleClass = "font-semibold text-amber-600 dark:text-amber-400";
        label = `(${diffDays} days ago)`;
    } else {
        styleClass = "font-bold text-red-600 dark:text-red-400";
        label = `(${diffDays} days ago)`;
    }

    return (
        <>
            {`${formattedDate} `}
            <span className={`${styleClass} ${extraClass}`}>{label}</span>
        </>
    );
};

const MatchedJobItem = ({job, onSelect, isSelected}) => {
    const score = Math.round(job.matchScore || 0);
    const barColor = getColorFromScore(score);
    const isApplied = !!job.has_applied;

    const baseClasses = "p-4 border-l-4 cursor-pointer transition-colors duration-200";
    const appliedClasses = "bg-amber-100/50 dark:bg-amber-900/30 border-amber-500";
    const selectedClasses = "bg-sky-100 dark:bg-sky-900/30 border-sky-500";
    const unselectedClasses = "border-transparent hover:bg-gray-100 dark:hover:bg-gray-800";
    const dynamicClasses = isApplied
        ? appliedClasses
        : isSelected ? selectedClasses : unselectedClasses;

    return (
        <div onClick={() => onSelect(job)}
             className={`${baseClasses} ${dynamicClasses}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold flex items-center gap-2">
                        {isApplied && <CheckCircle size={14} className="text-green-500 flex-shrink-0" title="Applied" />}
                        <span className={isApplied ? "text-amber-600 dark:text-amber-400" : "text-gray-800 dark:text-gray-100"}>
                            {job.title}
                        </span>
                        {job.easy_apply &&
                            <Zap size={14} className="text-yellow-500 flex-shrink-0" title="Easy Apply" />}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {formatPostedDate(job.posted_on)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {job.company?.name}
                    </p>
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

    // 2. ADDED: State and refs for the resizable panel
    const [topPanelHeight, setTopPanelHeight] = useState(480); // Default height in pixels
    const topPanelRef = useRef(null);
    const isResizing = useRef(false);

    // 3. ADDED: Handler for resizing logic
    const handleResizeMouseDown = useCallback((e) => {
        isResizing.current = true;
        e.preventDefault(); // Prevent text selection during drag

        const startY = e.clientY;
        const startHeight = topPanelRef.current.offsetHeight;

        const handleResizeMouseMove = (moveEvent) => {
            if (!isResizing.current) return;
            const deltaY = moveEvent.clientY - startY;
            const newHeight = startHeight + deltaY;

            // Constrain the height to prevent collapsing or expanding too much
            const minHeight = 250; // Minimum height for the top panel
            const maxHeight = window.innerHeight - 200; // Leave at least 200px for the list
            const constrainedHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

            setTopPanelHeight(constrainedHeight);
        };

        const handleResizeMouseUp = () => {
            isResizing.current = false;
            window.removeEventListener('mousemove', handleResizeMouseMove);
            window.removeEventListener('mouseup', handleResizeMouseUp);
            document.body.style.cursor = ''; // Reset cursor
        };

        window.addEventListener('mousemove', handleResizeMouseMove);
        window.addEventListener('mouseup', handleResizeMouseUp);
        document.body.style.cursor = 'row-resize';
    }, []);

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
        if (selectedJob) {
            console.log("🟦 Selected Job:", selectedJob);
        }
    }, [selectedJob]);

    useEffect(() => {
        if (allLanguages.includes('python')) setSelectedLanguageFilter('python');
    }, [allLanguages]);

    const filteredMatchedJobs = useMemo(() =>
            matchedJobs.filter(job => {
                const langPass = !selectedLanguageFilter ||
                    (job.programming_languages || [])
                        .map(l => l.toLowerCase())
                        .includes(selectedLanguageFilter);

                let datePass = true;
                if (selectedRecencyFilter && job.posted_on) {
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
            {/* 4. MODIFIED: Layout restructured for resizable panels */}
            <div
                ref={topPanelRef}
                style={{ height: `${topPanelHeight}px`, flexShrink: 0 }}
                className="overflow-y-auto"
            >
                <div className="p-4 space-y-4">
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
            </div>

            {/* 5. ADDED: The draggable resizer bar */}
            <div
                onMouseDown={handleResizeMouseDown}
                className="w-full h-1.5 bg-gray-300 dark:bg-gray-700 cursor-row-resize hover:bg-sky-500 transition-colors duration-200 flex-shrink-0"
                title="Drag to resize"
            ></div>

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