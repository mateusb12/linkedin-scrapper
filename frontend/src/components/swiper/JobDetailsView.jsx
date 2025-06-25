// frontend/src/components/swiper/JobDetailsView.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, ExternalLink, Building, Code, Users, Award } from 'lucide-react';

const InfoPill = ({ icon, text }) => (
    <div className="flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 px-3 py-1 rounded-full text-sm">
        {icon}
        <span>{text}</span>
    </div>
);

const SkillBadge = ({ skill }) => (
    <span className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2.5 py-1 rounded-md text-xs font-medium">
        {skill}
    </span>
);

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


export const JobDetailsView = ({ job }) => {
    // State to manage the expansion of the job description
    const [isExpanded, setIsExpanded] = useState(false);
    const TRUNCATION_LENGTH = 1000;

    // Reset the expanded state whenever the job (and its ID) changes
    useEffect(() => {
        setIsExpanded(false);
    }, [job.job_id]);

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
        apply_url
    } = job;

    const handleApply = () => {
        if (apply_url) {
            window.open(apply_url, '_blank', 'noopener,noreferrer');
        }
    };

    const description = description_text || 'No description available.';
    const isLongDescription = description.length > TRUNCATION_LENGTH;

    return (
        <div className="h-full bg-white dark:bg-gray-800 flex flex-col p-6 border-l border-gray-200 dark:border-gray-700">
            <HideScrollbarStyles />
            <div className="flex-grow overflow-y-auto pr-2 no-scrollbar">
                {/* Header Section */}
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

                {/* Pills Section */}
                <div className="flex flex-wrap gap-2 mb-6">
                    <InfoPill icon={<MapPin size={16} />} text={location} />
                    {employment_type && <InfoPill icon={<Briefcase size={16} />} text={employment_type} />}
                    {required_experience_years && <InfoPill icon={<Award size={16} />} text={`${required_experience_years} years exp.`} />}
                </div>

                {/* Description Section */}
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Job Description</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                        {isLongDescription && !isExpanded
                            ? `${description.substring(0, TRUNCATION_LENGTH)}...`
                            : description}
                    </p>
                    {isLongDescription && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-semibold mt-2"
                        >
                            {isExpanded ? 'Read less' : 'Read more'}
                        </button>
                    )}
                </div>

                {/* Skills Sections */}
                <div className="mb-4">
                    <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><Code size={20} />Required Skills</h3>
                    <div className="flex flex-wrap gap-2">
                        {skills_required.length > 0 ? skills_required.map((skill, index) => (
                            <SkillBadge key={index} skill={skill} />
                        )) : <p className="text-sm text-gray-500">Not specified</p>}
                    </div>
                </div>

                {soft_skills && soft_skills.length > 0 && (
                    <div className="mb-4">
                        <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><Users size={20}/>Soft Skills</h3>
                        <div className="flex flex-wrap gap-2">
                            {soft_skills.map((skill, index) => (
                                <SkillBadge key={index} skill={skill} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Apply Button Footer */}
            <div className="mt-auto pt-6 border-t border-gray-200 dark:border-gray-700">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleApply}
                    className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 hover:bg-indigo-700 shadow-lg"
                >
                    Apply Now <ExternalLink size={20} />
                </motion.button>
            </div>
        </div>
    );
};