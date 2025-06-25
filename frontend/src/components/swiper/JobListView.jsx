// frontend/src/components/swiper/JobListView.jsx
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from "react";

const JobListItem = ({ job, onJobSelect, isSelected }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        // Conditionally apply styles for the selected item for better UX
        className={`p-4 rounded-lg shadow-md hover:shadow-lg transition-all border
                    cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4
                    ${isSelected
            ? 'bg-indigo-50 dark:bg-gray-700 border-indigo-500 dark:border-indigo-400'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}
        onClick={() => onJobSelect(job)}
    >
        <div className="flex-grow">
            <h3 className={`font-bold text-lg ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-indigo-600 dark:text-indigo-400'}`}>{job.title}</h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm">{job.company_name}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{job.location}</p>
        </div>
    </motion.div>
);

// Accept 'selectedJob' as a prop to identify the active item
export const JobListView = ({ jobs, onJobSelect, selectedJob }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const JOBS_PER_PAGE = 24;

    const totalPages = Math.ceil(jobs.length / JOBS_PER_PAGE);
    const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
    const paginatedJobs = jobs.slice(startIndex, startIndex + JOBS_PER_PAGE);

    const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
    const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

    return (
        <div className="w-full mx-auto p-4">
            <h1 className="text-3xl font-bold text-center mb-6 text-gray-800 dark:text-white">Job Listings</h1>
            <div className="space-y-4 mb-6">
                {paginatedJobs.map((job) => (
                    <JobListItem
                        key={job.job_id}
                        job={job}
                        onJobSelect={onJobSelect}
                        // Check if the current list item is the selected one
                        isSelected={selectedJob && selectedJob.job_id === job.job_id}
                    />
                ))}
            </div>
            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6">
                    <button
                        onClick={goToPrevPage}
                        disabled={currentPage === 1}
                        className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md shadow disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                        <ArrowLeft size={16} /> Prev
                    </button>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md shadow disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                        Next <ArrowRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};