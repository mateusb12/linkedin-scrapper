// frontend/src/components/swiper/JobCoreViewer.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import jobsData from './job_details_augmented.json'
import { JobListView } from "./JobListView.jsx";
import { JobDetailsView } from "./JobDetailsView.jsx";

export default function JobCoreViewer() {
    // Set the first job as selected by default, or null if no jobs exist
    const [selectedJob, setSelectedJob] = useState(jobsData[0] || null);

    const handleJobSelect = (job) => {
        setSelectedJob(job);
    };

    return (
        // Main container uses flexbox for the side-by-side layout
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 font-sans">

            {/* Left Column: Job List */}
            {/* Adjusted width to be 2/5 of the screen for a wider list */}
            <div className="w-2/5 h-full overflow-y-auto border-r border-gray-200 dark:border-gray-700">
                <JobListView jobs={jobsData} onJobSelect={handleJobSelect} selectedJob={selectedJob} />
            </div>

            {/* Right Column: Job Details */}
            {/* Adjusted width to be 3/5 of the screen for a narrower details view */}
            <div className="w-3/5 h-full">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={selectedJob ? selectedJob.job_id : 'no-job'}
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