// frontend/src/components/match-find/Match.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    fetchAllJobs,
    fetchResumeById,
    fetchAllResumes,
    findBestMatches,
    getSkillsArray,
    markJobAsApplied,
    markJobAsDisabled,
    normalizeKeyword,
} from "./MatchLogic.jsx";
import { forbiddenLanguages } from "../../data/ForbiddenLanguages.js";
import { fetchProfiles } from "../../services/profileService.js";
import AdaptResumeSection from "./MatchResumeTailor.jsx";
import CoreJobDetails from "./MatchJobDetails.jsx";
import JobListing from "./MatchListing.jsx";

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
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const profiles = await fetchProfiles();
                if (profiles.length > 0) setSelectedProfile(profiles[0]);
            } catch (error) {
                console.error('Failed to fetch profile:', error);
            }
        };
        loadProfile();
    }, []);

    const forbiddenRegexes = useMemo(() => forbiddenLanguages.map(pattern =>
        new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$', 'i')
    ), []);

    useEffect(() => {
        if (jobs.length > 0) {
            const totalCount = jobs.length;
            const completeCount = jobs.filter(j =>
                j.responsibilities &&
                j.qualifications &&
                j.keywords &&
                j.responsibilities.length > 0 &&
                Object.keys(j.qualifications).length > 0 &&
                j.keywords.length > 0
            ).length;
            setJobMetrics({
                total: totalCount,
                complete: completeCount,
                incomplete: totalCount - completeCount
            });
        }
    }, [jobs]);

    const handleSelectResume = useCallback((id) => {
        const newId = (typeof id === 'string' && id.includes('.')) ? parseFloat(id) : parseInt(id, 10);

        // - REMOVE the 'loading' status and API call
        // + ADD a simple find operation on the resumes array

        const resumeToSelect = resumes.find(r => r.id === newId);

        setSelectedResumeId(newId);

        if (resumeToSelect) {
            setSelectedResume(resumeToSelect);
        } else {
            setSelectedResume(null);
            setErrorMessage(`Could not find resume with ID: ${newId}`);
        }
    }, [resumes]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // `resumesData` now contains ALL the details for every resume
                const [resumesData, jobsData] = await Promise.all([fetchAllResumes(), fetchAllJobs()]);
                setResumes(resumesData);
                setJobs(jobsData);
                if (resumesData.length > 0) {
                    const first = resumesData[0];
                    setSelectedResumeId(first.id);
                    setSelectedResume(first);
                }
            } catch (error) {
                setErrorMessage(error.message || 'Could not load initial data.');
                setStatus('error');
            }
        };
        loadInitialData();
    }, []);

    const handleMatch = () => {
        if (!selectedProfile?.positive_keywords?.length) {
            setErrorMessage('Please ensure your profile has positive keywords to start matching.');
            setStatus('error');
            return;
        }
        setStatus('matching');
        setErrorMessage('');
        setMatchedJobs([]);
        setSelectedJob(null);
        setTimeout(() => {
            const normalizedNegatives = new Set((selectedProfile?.negative_keywords || []).map(normalizeKeyword));
            const filteredJobs = jobs.filter(job => {
                if (job.disabled === true) return false;
                const jobKeywords = getSkillsArray(job.keywords).map(normalizeKeyword);
                return jobKeywords.every(kw => !normalizedNegatives.has(kw));
            });

            const sortedJobs = findBestMatches(filteredJobs, selectedProfile);
            setMatchedJobs(sortedJobs);
            setSelectedJob(sortedJobs.length > 0 ? sortedJobs[0] : null);
            setStatus('success');
        }, 500);
    };

    const updateJobInState = (jobUrn, updatedFields) => {
        const updateFn = (j) => (j.urn === jobUrn ? { ...j, ...updatedFields } : j);
        setJobs(prev => prev.map(updateFn));
        // Remove disabled jobs from the matched list
        if (updatedFields.disabled) {
            setMatchedJobs(prev => prev.filter(j => j.urn !== jobUrn));
            if (selectedJob?.urn === jobUrn) {
                const nextJob = matchedJobs.find(j => j.urn !== jobUrn) || null;
                setSelectedJob(nextJob);
            }
        } else {
            setMatchedJobs(prev => prev.map(updateFn));
        }

        if (selectedJob?.urn === jobUrn) {
            setSelectedJob(prev => ({ ...prev, ...updatedFields }));
        }
    };

    const handleMarkAsApplied = useCallback(async (jobUrn) => {
        try {
            setErrorMessage('');
            const { job } = await markJobAsApplied(jobUrn);
            updateJobInState(jobUrn, job);
            setSuccessMessage('Job marked as applied.');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            setErrorMessage(error.message || 'An unexpected error occurred.');
        }
    }, [selectedJob?.urn, matchedJobs]);

    const handleMarkAsDisabled = useCallback(async (jobUrn) => {
        try {
            setErrorMessage('');
            const { job } = await markJobAsDisabled(jobUrn);
            updateJobInState(jobUrn, job);
            setSuccessMessage('Job marked as disabled.');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            setErrorMessage(error.message || 'An unexpected error occurred.');
        }
    }, [selectedJob?.urn, matchedJobs]);

    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            <div className="flex h-screen">
                <JobListing
                    resumes={resumes}
                    selectedResumeId={selectedResumeId}
                    handleSelectResume={handleSelectResume}
                    jobMetrics={jobMetrics}
                    handleMatch={handleMatch}
                    status={status}
                    errorMessage={errorMessage}
                    successMessage={successMessage}
                    matchedJobs={matchedJobs}
                    setSelectedJob={setSelectedJob}
                    selectedJob={selectedJob}
                    jobs={jobs}
                    forbiddenRegexes={forbiddenRegexes}
                />

                <main className="flex-grow bg-white dark:bg-gray-800/50 overflow-y-auto">
                    {selectedJob && selectedResume ? (
                        <div className="p-6 md:p-8 h-full">
                            <CoreJobDetails
                                job={selectedJob}
                                profile={selectedProfile}
                                onMarkAsApplied={handleMarkAsApplied}
                                onMarkAsDisabled={handleMarkAsDisabled}
                            />
                            <AdaptResumeSection
                                baseResume={selectedResume}
                                job={selectedJob}
                                allResumes={resumes}
                                onSelectResume={handleSelectResume}
                                profile={selectedProfile}
                            />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            <p>Select a job to see the details</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Match;