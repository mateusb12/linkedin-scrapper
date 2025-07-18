// frontend/src/components/swiper/JobDetailsView.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, ExternalLink, Building, Code, Users, Award } from 'lucide-react';

// --- Helper components (InfoPill, SkillBadge, etc.) are unchanged ---

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
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
  `}</style>
);


export const JobDetailsView = ({ job }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const TRUNCATION_LENGTH = 1000;

    useEffect(() => {
        setIsExpanded(false);
    }, [job.urn]); // Use 'urn' as the unique identifier

    if (!job) return null;

    // 1. De-structure using the CORRECT property names from the API
    const {
        title,
        company, // company is now an object
        location,
        description_full, // Use description_full
        employment_type,
        keywords = [], // Use keywords
        job_url, // Use job_url
        job_type,
        programming_languages = []
    } = job;

    const handleApply = () => {
        if (job_url) { // Use job_url here
            window.open(job_url, '_blank', 'noopener,noreferrer');
        }
    };

    const description = description_full || 'No description available.';
    const isLongDescription = description.length > TRUNCATION_LENGTH;

    return (
        <div className="h-full bg-white dark:bg-gray-800 flex flex-col p-6 border-l border-gray-200 dark:border-gray-700">
            <HideScrollbarStyles />
            <div className="flex-grow overflow-y-auto pr-2 no-scrollbar">
                {/* Header Section */}
                <div className="flex items-start gap-4 mb-4">
                    <div className="bg-indigo-500 text-white p-3 rounded-lg shadow-md">
                        <img src={company?.logo_url} alt={`${company?.name} logo`} className="w-8 h-8 rounded-md object-contain" onError={(e) => e.target.style.display='none'} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mt-1">
                            <Building size={16} />
                            {/* 2. Access company name via company.name */}
                            <p>{company?.name}</p>
                        </div>
                    </div>
                </div>

                {/* Pills Section - Update to use correct properties */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {location && <InfoPill icon={<MapPin size={16} />} text={location} />}
                    {employment_type && <InfoPill icon={<Briefcase size={16} />} text={employment_type} />}
                </div>

                {/* Description Section */}
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Key Responsibilities</h2>
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

                {/* Skills Section */}
                <div className="mb-4">
                    <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><Code size={20} />Skills</h3>
                    <div className="flex flex-wrap gap-2">
                        {/* 3. Map over 'keywords' instead of 'skills_required' */}
                        {keywords.length > 0 ? keywords.map((skill, index) => (
                            <SkillBadge key={index} skill={skill} />
                        )) : <p className="text-sm text-gray-500">Not specified</p>}
                    </div>
                </div>

                {/* --- THE NEW FIELDS --- */}
                {/* These will now render correctly because the whole 'job' object is being read properly. */}

                {job_type && (
                    <div className="mb-4">
                        <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                            <Briefcase size={20} /> Job Type
                        </h3>
                        <SkillBadge skill={job_type} />
                    </div>
                )}

                {programming_languages && programming_languages.length > 0 && (
                    <div className="mb-4">
                        <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                            <Code size={20} /> Programming Languages
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {programming_languages.map((lang, index) => (
                                <SkillBadge key={index} skill={lang} />
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