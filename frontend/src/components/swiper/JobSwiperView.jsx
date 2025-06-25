// --- FILE: SwiperView.jsx ---

import {useMemo, useState} from "react";
import { motion, AnimatePresence } from 'framer-motion';
import {ActionButton, InfoPill, SkillBadge} from "./Utils.jsx";
import {Home, X, Heart, Briefcase, Building, MapPin, Code, Users, Award, ExternalLink, ArrowLeft, ArrowRight} from "lucide-react";

const HideScrollbarStyles = () => (
    <style>{`
    /* Chrome / Safari / Opera */
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }

    /* Firefox */
    .no-scrollbar {
      scrollbar-width: none;       /* Firefox */
      -ms-overflow-style: none;    /* IE & Edge */
    }
  `}</style>
);

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
            <HideScrollbarStyles />
            <div className="flex-grow overflow-y-auto pr-2 scrollbar-hide">
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

export const SwiperView = ({ jobs, initialIndex, onBackToList }) => {
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

// --- END FILE: SwiperView.jsx ---