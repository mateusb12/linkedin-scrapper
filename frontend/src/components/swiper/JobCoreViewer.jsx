// frontend/src/components/swiper/JobCoreViewer.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { JobListView } from "./JobListView.jsx";
import { JobDetailsView } from "./JobDetailsView.jsx";
import {fetchAllJobs} from "../../services/jobService.js";

export default function JobCoreViewer() {
    const [jobs, setJobs] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        console.log("🔥 useEffect started"); // <<<<< ISSO AQUI

        const loadJobs = async () => {
            console.log("📡 Calling fetchAllJobs");
            try {
                const data = await fetchAllJobs();
                console.log("✅ Data received from backend:", data);
                setJobs(data);
                if (data && data.length > 0) {
                    console.log("📌 First job:", data[0]);
                    setSelectedJob(data[0]);
                }
            } catch (err) {
                console.error("❌ Error fetching jobs:", err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        loadJobs();
    }, []);

    const handleJobSelect = (job) => {
        setSelectedJob(job);
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen dark:bg-gray-900 dark:text-white">Loading jobs...</div>;
    }

    if (error) {
        return <div className="flex items-center justify-center h-screen text-red-500 dark:bg-gray-900">Error: {error}</div>;
    }

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 font-sans">
            <div className="w-2/5 h-full overflow-y-auto border-r border-gray-200 dark:border-gray-700">
                <JobListView jobs={jobs} onJobSelect={handleJobSelect} selectedJob={selectedJob} />
            </div>
            <div className="w-3/5 h-full">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={selectedJob ? selectedJob.urn : 'no-job'}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="h-full"
                    >
                        {selectedJob ? (
                            <JobDetailsView job={selectedJob} />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-gray-500 dark:text-gray-400">Select a job to see the details.</p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}