// --- FILE: JobListView.jsx ---
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {useState} from "react";

const JobListItem = ({ job, onViewDetails }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
    >
        <div className="flex-grow">
            <h3 className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{job.title}</h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm">{job.company_name}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{job.location}</p>
        </div>
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onViewDetails}
            className="bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors hover:bg-indigo-600 w-full sm:w-auto"
        >
            View Details
        </motion.button>
    </motion.div>
);

export const JobListView = ({ jobs, onViewDetails }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const JOBS_PER_PAGE = 8;

    const totalPages = Math.ceil(jobs.length / JOBS_PER_PAGE);
    const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
    const paginatedJobs = jobs.slice(startIndex, startIndex + JOBS_PER_PAGE);

    const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
    const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

    return (
        <div className="w-full max-w-3xl mx-auto p-4">
            <h1 className="text-4xl font-bold text-center mb-8 text-gray-800 dark:text-white">Find Your Next Opportunity</h1>
            <div className="space-y-4 mb-8">
                {paginatedJobs.map((job, index) => (
                    <JobListItem
                        key={job.job_id}
                        job={job}
                        onViewDetails={() => onViewDetails(startIndex + index)}
                    />
                ))}
            </div>
            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center">
                    <button
                        onClick={goToPrevPage}
                        disabled={currentPage === 1}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md shadow disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                        <ArrowLeft size={16} /> Previous
                    </button>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md shadow disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                        Next <ArrowRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

// --- END FILE: JobListView.jsx ---