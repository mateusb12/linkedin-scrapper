import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, MapPin, X, Heart, ExternalLink, Building, Code, Users, Award, ArrowLeft, ArrowRight, Home } from 'lucide-react';

// The job data is now embedded directly into the component
import jobsData from './job_details_augmented.json'


// --- Reusable UI Components ---

const SkillBadge = ({ skill }) => (
  <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full dark:bg-blue-900 dark:text-blue-300 transition-transform hover:scale-105">
    {skill}
  </div>
);

const InfoPill = ({ icon, text, className }) => (
    <div className={`flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full text-sm ${className}`}>
        {icon}
        <span className="font-medium">{text}</span>
    </div>
);

const ActionButton = ({ onClick, icon, colorClass, hoverColorClass }) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    className={`p-4 rounded-full shadow-lg transition-colors duration-300 ${colorClass} ${hoverColorClass}`}
  >
    {icon}
  </motion.button>
);

// --- Job Card Component (for Swiper View) ---

const JobCard = ({ job, onApply }) => {
    if (!job) return null;

    const {
        title,
        company_name,
        location,
        description_text,
        employment_type,
        required_experience_years,
        skills_required = [],
        soft_skills = [],
    } = job;

    const descriptionSnippet = description_text ? `${description_text.substring(0, 280)}...` : 'No description available.';

    return (
        <motion.div
            key={job.job_id}
            initial={{ scale: 0.9, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -50 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="absolute w-full h-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 border border-gray-200 dark:border-gray-700"
        >
            <div className="flex-grow overflow-y-auto pr-2">
                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                    <div className="bg-indigo-500 text-white p-3 rounded-lg shadow-md">
                        <Briefcase size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mt-1">
                            <Building size={16} />
                            <p>{company_name}</p>
                        </div>
                    </div>
                </div>

                {/* Location and Type */}
                <div className="flex flex-wrap gap-2 mb-6">
                    <InfoPill icon={<MapPin size={16} />} text={location} />
                    {employment_type && <InfoPill icon={<Briefcase size={16} />} text={employment_type} />}
                    {required_experience_years && <InfoPill icon={<Award size={16} />} text={`${required_experience_years} years exp.`} />}
                </div>

                {/* Description */}
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Job Description</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{descriptionSnippet}</p>
                </div>

                {/* Skills */}
                <div className="mb-4">
                    <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><Code size={20}/>Required Skills</h3>
                    <div className="flex flex-wrap gap-2">
                        {skills_required.length > 0 ? skills_required.slice(0, 7).map((skill, index) => (
                            <SkillBadge key={index} skill={skill} />
                        )) : <p className="text-sm text-gray-500">Not specified</p>}
                    </div>
                </div>

                {soft_skills && soft_skills.length > 0 && (
                     <div className="mb-4">
                        <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><Users size={20}/>Soft Skills</h3>
                        <div className="flex flex-wrap gap-2">
                            {soft_skills.slice(0, 5).map((skill, index) => (
                                <SkillBadge key={index} skill={skill} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Apply Button */}
            <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onApply}
                    className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 hover:bg-indigo-700 shadow-lg"
                >
                    Apply Now <ExternalLink size={20} />
                </motion.button>
            </div>
        </motion.div>
    );
};

// --- "No More Jobs" Card Component ---

const NoMoreJobsCard = () => (
    <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center justify-center h-full text-center bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8"
    >
        <Briefcase size={64} className="text-indigo-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">That's All For Now!</h2>
        <p className="text-gray-600 dark:text-gray-400">You've swiped through all available jobs. Check back later for new opportunities.</p>
    </motion.div>
);

// --- Swiper View Component ---

const SwiperView = ({ jobs, initialIndex, onBackToList }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const currentJob = useMemo(() => jobs[currentIndex], [jobs, currentIndex]);

    const handleSwipe = () => {
        if (currentIndex < jobs.length) {
            setCurrentIndex(prevIndex => prevIndex + 1);
        }
    };

    const handleApply = () => {
        if (currentJob && currentJob.apply_url) {
            window.open(currentJob.apply_url, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="w-full max-w-sm h-[70vh] md:h-[75vh] relative">
                <AnimatePresence>
                    {currentJob ? (
                        <JobCard
                            key={currentJob.job_id}
                            job={currentJob}
                            onApply={handleApply}
                        />
                    ) : (
                        <NoMoreJobsCard />
                    )}
                </AnimatePresence>
            </div>

            <div className="flex items-center justify-center gap-4 mt-8">
                <ActionButton
                    onClick={onBackToList}
                    icon={<Home size={28} className="text-gray-600" />}
                    colorClass="bg-white dark:bg-gray-700"
                    hoverColorClass="hover:bg-gray-200 dark:hover:bg-gray-600"
                />
                {currentIndex < jobs.length && (
                    <>
                        <ActionButton
                            onClick={handleSwipe}
                            icon={<X size={32} className="text-red-500" />}
                            colorClass="bg-white dark:bg-gray-700"
                            hoverColorClass="hover:bg-red-100 dark:hover:bg-red-900/50"
                        />
                        <ActionButton
                            onClick={handleSwipe}
                            icon={<Heart size={32} className="text-green-500" />}
                            colorClass="bg-white dark:bg-gray-700"
                            hoverColorClass="hover:bg-green-100 dark:hover:bg-green-900/50"
                        />
                    </>
                )}
            </div>
        </div>
    );
};

// --- Job List Item Component ---

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

// --- Job List View Component ---

const JobListView = ({ jobs, onViewDetails }) => {
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
        </div>
    );
};


// --- Main App Component (Controller) ---

export default function JobSwiper() {
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'swiper'
    const [selectedJobIndex, setSelectedJobIndex] = useState(0);

    const handleViewDetails = (index) => {
        setSelectedJobIndex(index);
        setViewMode('swiper');
    };

    const handleBackToList = () => {
        setViewMode('list');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 font-sans">
            <AnimatePresence mode="wait">
                <motion.div
                    key={viewMode}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="w-full h-full"
                >
                    {viewMode === 'list' ? (
                        <JobListView jobs={jobsData} onViewDetails={handleViewDetails} />
                    ) : (
                        <SwiperView jobs={jobsData} initialIndex={selectedJobIndex} onBackToList={handleBackToList} />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
