// frontend/src/components/match-find/CoreJobDetails.jsx
import React from 'react';
import {
    Code,
    BookOpen,
    CheckCircle,
    Briefcase,
    MapPin,
    Clock,
    Building,
    ChevronRight,
    XCircle,
    ListChecks,
    ClipboardList,
    Users
} from 'lucide-react';
import { getSkillsArray, normalizeKeyword } from "./MatchLogic.jsx";

import csharp from "../../assets/skills_icons/csharp.svg";
import python from "../../assets/skills_icons/python.svg";
import js from "../../assets/skills_icons/javascript.svg";
import ts from "../../assets/skills_icons/typescript.svg";
import go from "../../assets/skills_icons/go.svg";
import rust from "../../assets/skills_icons/rust.svg";
import java from "../../assets/skills_icons/java.svg";
import ruby from "../../assets/skills_icons/ruby.svg";
import php from "../../assets/skills_icons/php.svg";
import nodejs from "../../assets/skills_icons/nodejs.svg";
import html from "../../assets/skills_icons/html.svg";
import css from "../../assets/skills_icons/css.svg";
import graphql from "../../assets/skills_icons/graphql.svg";
import sql from "../../assets/skills_icons/sql.svg";
import dotnet from "../../assets/skills_icons/dotnet.svg";
import usa from "../../assets/skills_icons/usa.svg";
import brazil from "../../assets/skills_icons/brazil.svg";

const languageIcons = {
    python: <img src={python} alt="Python" className="w-6 h-6" />,
    javascript: <img src={js} alt="JavaScript" className="w-6 h-6" />,
    typescript: <img src={ts} alt="Typescript" className="w-6 h-6" />,
    golang: <img src={go} alt="Go" className="w-6 h-6" />,
    rust: <img src={rust} alt="Rust" className="w-6 h-6" />,
    java: <img src={java} alt="Java" className="w-6 h-6" />,
    csharp: <img src={csharp} alt="C#" className="w-6 h-6" />,
    "c#": <img src={csharp} alt="C#" className="w-6 h-6" />,
    dotnet: <img src={dotnet} alt=".NET" className="w-6 h-6" />,
    ".NET Framework": <img src={dotnet} alt=".NET Framework" className="w-6 h-6" />,
    ".NET Core": <img src={dotnet} alt=".NET Framework" className="w-6 h-6" />,
    ".NET": <img src={dotnet} alt=".NET" className="w-6 h-6" />,
    ruby: <img src={ruby} alt="Ruby" className="w-6 h-6" />,
    php: <img src={php} alt="PHP" className="w-6 h-6" />,
    nodejs: <img src={nodejs} alt="Node.js" className="w-6 h-6" />,
    node: <img src={nodejs} alt="Node.js" className="w-6 h-6" />,
    "node.js": <img src={nodejs} alt="Node.js" className="w-6 h-6" />,
    html: <img src={html} alt="HTML" className="w-6 h-6" />,
    css: <img src={css} alt="CSS" className="w-6 h-6" />,
    graphql: <img src={graphql} alt="GraphQL" className="w-6 h-6" />,
    sql: <img src={sql} alt="SQL" className="w-6 h-6" />,
};

const getLanguageFlagIcon = (lang) => {
    if (!lang) return null;
    const normalized = lang.toUpperCase();
    const flagSize = 8;
    const className = `w-${flagSize} h-${flagSize} inline-block mr-1`;
    if (normalized === "PTBR") return <img src={brazil} alt="BR" className={className} />;
    if (normalized === "EN") return <img src={usa} alt="EN" className={className} />;
    return null;
};

const JobMetaItem = ({ icon, color, children }) => {
    const baseClasses = "flex items-center p-3 rounded-lg shadow-sm";
    const colorSchemes = {
        indigo: { container: 'bg-indigo-100 dark:bg-indigo-900/40 border-l-4 border-indigo-500 dark:border-indigo-400 text-indigo-900 dark:text-indigo-100', icon: 'text-indigo-600 dark:text-indigo-300', },
        violet: { container: 'bg-violet-100 dark:bg-violet-900/40 border-l-4 border-violet-500 dark:border-violet-400 text-violet-900 dark:text-violet-100 flex-wrap gap-2', icon: 'text-violet-700 dark:text-violet-300', },
        amber: { container: 'bg-amber-100 dark:bg-amber-900/40 border-l-4 border-amber-500 dark:border-amber-400 text-amber-900 dark:text-amber-100', icon: 'text-amber-600 dark:text-amber-300',},
        default: { container: 'bg-gray-100 dark:bg-gray-800', icon: 'text-gray-500', }
    };
    const scheme = color ? colorSchemes[color] : colorSchemes.default;
    return (
        <div className={`${baseClasses} ${scheme.container}`}>
            {React.cloneElement(icon, { size: 18, className: `mr-3 flex-shrink-0 ${scheme.icon}` })}
            <div className="font-semibold text-sm">{children}</div>
        </div>
    );
};

const CoreJobDetails = ({ job, profile, onMarkAsApplied, onMarkAsDisabled }) => {
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'N/A';
    const isApplied = !!job.has_applied;
    const jobKeywords = getSkillsArray(job.keywords).map(skill => skill.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')).sort((a, b) => a.localeCompare(b));
    const userSkillsSet = new Set((profile?.positive_keywords || []).map(normalizeKeyword));

    const Placeholder = ({ text = "None specified" }) => (
        <div className="flex items-center text-gray-500 dark:text-gray-400 italic">
            <XCircle size={16} className="mr-2" /><span>{text}</span>
        </div>
    );

    const DetailSection = ({ title, icon, items }) => (
        <div>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700 flex items-center">{icon} {title}</h3>
            {items?.length > 0 ? (<ul className="space-y-2 list-disc list-inside text-gray-800 dark:text-gray-300">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>) : <Placeholder />}
        </div>
    );

    return (
        <>
            <header className="flex items-start mb-6">
                <img src={job.company?.logo_url} alt={`${job.company?.name} logo`} className="w-16 h-16 rounded-lg mr-6 object-contain border border-gray-200 dark:border-gray-700"
                     onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/64x64/e2e8f0/4a5568?text=${job.company?.name?.charAt(0) || '?'}`; }} />
                <div>
                    <h2 className={`text-2xl font-bold ${job.has_applied ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'}`}>{job.title}</h2>
                    <p className="text-lg text-gray-700 dark:text-gray-300 flex items-center gap-1">
                        {getLanguageFlagIcon(job.language)} {job.company?.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{job.urn}</p>
                </div>
            </header>

            <div className="flex flex-wrap items-center gap-4 mb-6">
                <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all">Apply Now</a>
                {isApplied ? (
                    <div className="flex items-center gap-2 px-6 py-2 text-green-700 dark:text-green-400 font-semibold rounded-lg bg-green-100 dark:bg-green-900/50">
                        <CheckCircle size={20} /> Applied
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => onMarkAsApplied(job.urn)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">
                            <ListChecks size={20} /> Mark as Applied
                        </button>
                        <button onClick={() => onMarkAsDisabled(job.urn)} className="flex items-center gap-2 px-4 py-2 bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-300 font-semibold rounded-lg hover:bg-red-300 dark:hover:bg-red-800 transition-all">
                            <XCircle size={20} /> Mark as Disabled
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-sm">
                {job.job_type && <JobMetaItem icon={<Briefcase />} color="indigo">{job.job_type}</JobMetaItem>}
                {job.programming_languages?.length > 0 && (<JobMetaItem icon={<Code />} color="violet">{job.programming_languages.map((lang) => (<span key={lang} className="flex items-center gap-2 bg-violet-200 dark:bg-violet-700 text-violet-900 dark:text-violet-100 px-3 py-1 rounded-full text-sm font-bold">{languageIcons[lang.trim().toLowerCase()] || <Code className="w-6 h-6" />}{lang}</span>))}</JobMetaItem>)}
                {job.applicants > 0 && (
                    <JobMetaItem icon={<Users />} color="amber">
                        {job.applicants} applicant{job.applicants === 1 ? '' : 's'}
                    </JobMetaItem>
                )}
                <JobMetaItem icon={<MapPin />}>{job.location}</JobMetaItem>
                <JobMetaItem icon={<Briefcase />}>{job.employment_type}</JobMetaItem>
                <JobMetaItem icon={<Clock />}>Posted: {formatDate(job.posted_on)}</JobMetaItem>
                <JobMetaItem icon={<Building />}>{job.workplace_type}</JobMetaItem>
            </div>

            <div className="space-y-8">
                <div>
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700 flex items-center"><ChevronRight size={20} className="mr-2" /> My Keywords</h3>
                    {profile?.positive_keywords?.length > 0 ? (<div className="flex flex-wrap gap-2">{[...profile.positive_keywords].sort((a, b) => a.localeCompare(b)).map((keyword) => (<span key={keyword} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"><CheckCircle size={14} /> {keyword}</span>))}</div>) : <Placeholder text="No keywords found in your profile" />}
                </div>

                <div>
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700 flex items-center"><ChevronRight size={20} className="mr-2" /> Required Keywords</h3>
                    {jobKeywords.length > 0 ? (<div className="flex flex-wrap gap-2">{jobKeywords.map((keyword, index) => { const isMatched = userSkillsSet.has(normalizeKeyword(keyword)); return (<span key={index} className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isMatched ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>{isMatched ? <CheckCircle size={14} /> : <XCircle size={14} />} {keyword}</span>); })}</div>) : <Placeholder text="No keywords specified" />}
                </div>

                <DetailSection title="Responsibilities" icon={<ClipboardList size={20} className="mr-2" />} items={job.responsibilities} />
                <DetailSection title="Qualifications" icon={<ListChecks size={20} className="mr-2" />} items={job.qualifications} />

                <div>
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700 flex items-center"><BookOpen size={20} className="mr-2" /> About the Job</h3>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-300">
                        <p style={{ whiteSpace: 'pre-wrap' }}>{job.description_full || job.description || "No full description available."}</p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CoreJobDetails;