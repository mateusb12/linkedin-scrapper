import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
    Code,
    Target,
    BookOpen,
    CheckCircle,
    BarChart2,
    Briefcase,
    MapPin,
    Clock,
    Building,
    ChevronRight,
    XCircle,
    ListChecks,
    Wand2,
    Save,
    Award,
    ClipboardList,
    Zap,
    FileText,
    Lightbulb,
    GraduationCap,
    PlusCircle,
    Trash2
} from 'lucide-react';
import {
    fetchAllJobs,
    fetchResumeById,
    fetchResumes,
    findBestMatches,
    getColorFromScore,
    getSkillsArray,
    markJobAsApplied,
    markJobAsDisabled,
    normalizeKeyword,
} from "./MatchLogic.jsx";
import csharp from "../../assets/skills_icons/csharp.svg"
import python from "../../assets/skills_icons/python.svg"
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
import {forbiddenLanguages} from "../../data/ForbiddenLanguages.js";
import {generateFullResumeMarkdown} from "../../utils/markdownUtils.js";
import {fetchProfiles} from "../../services/profileService.js";
import {getMatchScore} from "../../services/jobService.js";

// --- Reusable UI Components ---

const languageIcons = {
    python: <img src={python} alt="Python" className="w-6 h-6"/>,
    javascript: <img src={js} alt="JavaScript" className="w-6 h-6"/>,
    typescript: <img src={ts} alt="Typescript" className="w-6 h-6"/>,
    golang: <img src={go} alt="Go" className="w-6 h-6"/>,
    rust: <img src={rust} alt="Rust" className="w-6 h-6"/>,
    java: <img src={java} alt="Java" className="w-6 h-6"/>,
    csharp: <img src={csharp} alt="C#" className="w-6 h-6"/>,
    "c#": <img src={csharp} alt="C#" className="w-6 h-6"/>,
    dotnet: <img src={dotnet} alt=".NET" className="w-6 h-6"/>,
    ".NET Framework": <img src={dotnet} alt=".NET Framework" className="w-6 h-6"/>,
    ".NET Core": <img src={dotnet} alt=".NET Framework" className="w-6 h-6"/>,
    ".NET": <img src={dotnet} alt=".NET" className="w-6 h-6"/>,
    ruby: <img src={ruby} alt="Ruby" className="w-6 h-6"/>,
    php: <img src={php} alt="PHP" className="w-6 h-6"/>,
    nodejs: <img src={nodejs} alt="Node.js" className="w-6 h-6"/>,
    node: <img src={nodejs} alt="Node.js" className="w-6 h-6"/>,
    "node.js": <img src={nodejs} alt="Node.js" className="w-6 h-6"/>,
    html: <img src={html} alt="HTML" className="w-6 h-6"/>,
    css: <img src={css} alt="CSS" className="w-6 h-6"/>,
    graphql: <img src={graphql} alt="GraphQL" className="w-6 h-6"/>,
    sql: <img src={sql} alt="SQL" className="w-6 h-6"/>,
};

const Spinner = ({ className = 'h-5 w-5 text-white' }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const EditableSuggestion = ({ original, suggested, onChange, isChanged, id, label, rows = 3, highlight = false }) => {
    const baseTextarea = "w-full p-2 rounded-md focus:ring-2 text-sm";
    const borderHighlight = highlight
        ? "border-yellow-400 dark:border-yellow-300"
        : "border-gray-300 dark:border-gray-600";
    const bgHighlight = highlight
        ? "bg-yellow-100 dark:bg-yellow-700/30"
        : "bg-white dark:bg-gray-700";
    const fullHighlight = `${borderHighlight} ${bgHighlight}`;

    if (!isChanged) {
        return (
            <textarea
                id={id}
                value={suggested}
                onChange={onChange}
                className={`${baseTextarea} ${fullHighlight} focus:ring-yellow-400 dark:focus:ring-yellow-300`}
                rows={rows}
            />
        );
    }

    return (
        <div className="space-y-3 p-4 bg-white dark:bg-gray-800/70 rounded-lg border border-purple-300 dark:border-purple-700">
            <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">ORIGINAL</label>
                <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 p-2 rounded-md">{original}</p>
            </div>
            <div>
                <label htmlFor={id} className="block text-xs font-semibold text-purple-800 dark:text-purple-300 mb-1">
                    {label}
                </label>
                <textarea
                    id={id}
                    value={suggested}
                    onChange={onChange}
                    className={`${baseTextarea} ${fullHighlight} focus:ring-yellow-400 dark:focus:ring-yellow-300`}
                    rows={rows}
                />
            </div>
        </div>
    );
};

const JobMetaItem = ({ icon, color, children }) => {
    const baseClasses = "flex items-center p-3 rounded-lg shadow-sm";
    const colorSchemes = {
        indigo: {
            container: 'bg-indigo-100 dark:bg-indigo-900/40 border-l-4 border-indigo-500 dark:border-indigo-400 text-indigo-900 dark:text-indigo-100',
            icon: 'text-indigo-600 dark:text-indigo-300',
        },
        violet: {
            container: 'bg-violet-100 dark:bg-violet-900/40 border-l-4 border-violet-500 dark:border-violet-400 text-violet-900 dark:text-violet-100 flex-wrap gap-2',
            icon: 'text-violet-700 dark:text-violet-300',
        },
        default: {
            container: 'bg-gray-100 dark:bg-gray-800',
            icon: 'text-gray-500',
        }
    };

    const scheme = color ? colorSchemes[color] : colorSchemes.default;

    return (
        <div className={`${baseClasses} ${scheme.container}`}>
            {React.cloneElement(icon, { size: 18, className: `mr-3 flex-shrink-0 ${scheme.icon}` })}
            <div className="font-semibold text-sm">{children}</div>
        </div>
    );
};


// --- Feature Components ---

const MatchedJobItem = ({job, onSelect, isSelected}) => {
    const score = Math.round(job.matchScore || 0);
    const barColor = getColorFromScore(score);
    const isApplied = !!job.applied_on;

    const baseClasses = "p-4 border-l-4 cursor-pointer transition-colors duration-200";
    const selectedClasses = "bg-sky-100 dark:bg-sky-900/30 border-sky-500";
    const unselectedClasses = "border-transparent hover:bg-gray-100 dark:hover:bg-gray-800";

    return (
        <div onClick={() => onSelect(job)}
             className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        {isApplied && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
                        <span>{job.title}</span>
                        {job.easy_apply && (
                            <Zap size={14} className="text-yellow-500 flex-shrink-0" title="Easy Apply" />
                        )}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{job.company?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{job.location}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 ml-4">
                    <div className="font-bold text-lg" style={{color: barColor}}>{score}%</div>
                    <div className="text-xs text-gray-500">Match</div>
                </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="h-1.5 rounded-full transition-all duration-200"
                     style={{width: `${score}%`, backgroundColor: barColor}}/>
            </div>
        </div>
    );
};

const AdaptJobSection = ({ baseResume, job, allResumes, onSelectResume, profile }) => {
    const [adaptedResume, setAdaptedResume] = useState(null);
    const [isTailoring, setIsTailoring] = useState(false);
    const [tailoringApplied, setTailoringApplied] = useState(false);
    // New state for markdown preview
    const [showFullPreview, setShowFullPreview] = useState(false);
    const [fullResumeMarkdown, setFullResumeMarkdown] = useState('');
    const [matchScore, setMatchScore] = useState(null);
    const [matchScoreError, setMatchScoreError] = useState(null);


    const inputClasses = "w-full p-2 rounded-md bg-white dark:bg-gray-700 focus:ring-2 text-sm border border-gray-300 dark:border-gray-600 focus:ring-purple-500";
    const buttonClasses = "flex items-center gap-2 text-xs px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/50 dark:hover:bg-purple-900/80 text-purple-800 dark:text-purple-200 font-semibold rounded-md transition-all";

    useEffect(() => {
        if (baseResume) {
            const mappedResume = JSON.parse(JSON.stringify(baseResume));
            if (mappedResume.professional_experience) {
                mappedResume.professional_experience.forEach(exp => { exp.details = exp.description || []; });
            }
            if (mappedResume.projects) {
                mappedResume.projects.forEach(proj => { proj.details = proj.description || []; });
            }
            setAdaptedResume(mappedResume);
            setTailoringApplied(false);
        } else {
            setAdaptedResume(null);
        }
    }, [baseResume]);

    // --- Generic Handlers for State Updates ---
    const handleUpdate = (updater) => setAdaptedResume(prev => updater(JSON.parse(JSON.stringify(prev))));
    const handleSimpleChange = (field, value) => handleUpdate(draft => { draft[field] = value; return draft; });
    const handleListChange = (listName, index, value) => handleUpdate(draft => { draft[listName][index] = value; return draft; });
    const handleNestedChange = (listName, index, field, value) => handleUpdate(draft => { draft[listName][index][field] = value; return draft; });
    const handleDetailChange = (listName, itemIndex, detailIndex, value) => handleUpdate(draft => { draft[listName][itemIndex].details[detailIndex] = value; return draft; });
    const addListItem = (listName, newItem) => handleUpdate(draft => { draft[listName] = [...(draft[listName] || []), newItem]; return draft; });
    const removeListItem = (listName, index) => handleUpdate(draft => { draft[listName].splice(index, 1); return draft; });
    const addDetailItem = (listName, itemIndex) => handleUpdate(draft => { draft[listName][itemIndex].details.push(''); return draft; });
    const removeDetailItem = (listName, itemIndex, detailIndex) => handleUpdate(draft => { draft[listName][itemIndex].details.splice(detailIndex, 1); return draft; });


    const handleTailorResume = async () => {
        if (!baseResume || !job) return;
        setIsTailoring(true);
        setTailoringApplied(false);
        let resume_markdown = `# ${baseResume.name}\n\n## Summary\n${baseResume.summary || ''}\n\n`;
        if (baseResume.professional_experience?.length) {
            resume_markdown += '## Professional Experience\n';
            baseResume.professional_experience.forEach(exp => {
                resume_markdown += `### ${exp.title} @ ${exp.company} (${exp.dates})\n`;
                (exp.description || []).forEach(detail => { resume_markdown += `- ${detail}\n`; });
                resume_markdown += '\n';
            });
        }
        if (baseResume.projects?.length) {
            resume_markdown += '## Projects\n';
            baseResume.projects.forEach(proj => {
                resume_markdown += `### ${proj.title}\n`;
                (proj.description || []).forEach(detail => { resume_markdown += `- ${detail}\n`; });
                resume_markdown += '\n';
            });
        }
        let job_description = `# ${job.title} @ ${job.company?.name}\n\n## Description\n${job.description || 'Not provided.'}\n\n## Responsibilities\n`;
        (job.responsibilities || []).forEach(r => { job_description += `- ${r}\n`; });
        job_description += `\n## Qualifications\n`;
        (job.qualifications || []).forEach(q => { job_description += `- ${q}\n`; });
        if (job.keywords) job_description += `\n## Keywords\n${getSkillsArray(job.keywords).join(', ')}`;
        try {
            const tailoredData = await tailorResume({ resume_markdown, job_description });
            setAdaptedResume(prev => ({
                ...JSON.parse(JSON.stringify(prev)),
                summary: tailoredData.summary !== undefined ? tailoredData.summary : prev.summary,
                hard_skills: tailoredData.hard_skills !== undefined ? tailoredData.hard_skills : prev.hard_skills,
                professional_experience: tailoredData.professional_experience !== undefined ? tailoredData.professional_experience : prev.professional_experience,
                projects: tailoredData.projects !== undefined ? tailoredData.projects : prev.projects,
            }));
            setTailoringApplied(true);
        } catch (error) {
            console.error("Error tailoring resume:", error);
            alert(`Could not tailor resume: ${error.message}`);
        } finally {
            setIsTailoring(false);
        }
    };

    const handleSaveChanges = () => {
        console.log("--- ADAPTED RESUME DATA ---", adaptedResume);
        alert("Adapted resume data saved to console. A new resume could be created from this data.");
    };

    const handleToggleFullPreview = async () => {
        if (!showFullPreview) {
            console.log("🔍 job_description (raw):", job.description || job.description_full || '');
            console.log("🔍 resume (raw):", generateFullResumeMarkdown(profile, adaptedResume));
            const markdown = generateFullResumeMarkdown(profile, adaptedResume);
            setFullResumeMarkdown(markdown);

            const jobText = `# ${job.title || ''} @ ${job.company?.name || ''}\n\n${job.description || ''}\n\n## Responsibilities\n${(job.responsibilities || []).join('\n')}\n\n## Qualifications\n${(job.qualifications || []).join('\n')}`;

            if (!markdown.trim() || !jobText.trim()) {
                setMatchScoreError("❌ Resume or job description is empty");
                setMatchScore(null);
                return;
            }

            try {
                const { match_score } = await getMatchScore(jobText, markdown);
                setMatchScore(Math.round(match_score * 100));
                setMatchScoreError(null);
            } catch (err) {
                console.error("⚠ Match score API error:", err);
                setMatchScore(null);
                setMatchScoreError(
                    `Error code ${err.status || '???'} - ${err.message || 'unknown'}`
                );
            }
        }
        setShowFullPreview(prev => !prev);
    };

    if (!adaptedResume || !job) return null;

    const SectionWrapper = ({ title, icon, onAdd, children }) => (
        <div className="p-4 border-2 border-dashed border-purple-300 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-900/10">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">{icon} {title}</h3>
                {onAdd && <button onClick={onAdd} className={buttonClasses}><PlusCircle size={14}/> Add {title.slice(0, -1)}</button>}
            </div>
            <div className="space-y-4">{children}</div>
        </div>
    );

    return (
        <div className="pt-8">
            <header className="pb-4 border-b-2 border-purple-400 dark:border-purple-600 mb-6 space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-3"><Wand2 className="text-purple-500"/> Adapt Resume For This Job</h2>
                <div>
                    <label htmlFor="adapt-resume-select" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Select a base resume to adapt:</label>
                    <select id="adapt-resume-select" value={baseResume.id} onChange={(e) => onSelectResume(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500">
                        {allResumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </div>
            </header>

            <div className="space-y-6">
                {/* Summary, Skills, Experience, Projects, Education sections remain unchanged... */}
                <SectionWrapper title="Summary" icon={<FileText size={20}/>}>
                    <EditableSuggestion id="summary" label="SUGGESTED (EDITABLE)" original={baseResume.summary || ''} suggested={adaptedResume.summary || ''} onChange={(e) => handleSimpleChange('summary', e.target.value)} isChanged={tailoringApplied && adaptedResume.summary !== baseResume.summary} highlight={true} rows={5} />
                </SectionWrapper>
                <SectionWrapper title="Hard Skills" icon={<Zap size={20}/>} onAdd={() => addListItem('hard_skills', '')}>
                    {(adaptedResume.hard_skills || []).map((skill, index) => ( <div key={index} className="flex items-center gap-2"><input type="text" value={skill} onChange={(e) => handleListChange('hard_skills', index, e.target.value)} className={inputClasses} placeholder="Enter skill" /> <button onClick={() => removeListItem('hard_skills', index)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button> </div> ))}
                </SectionWrapper>
                <SectionWrapper title="Professional Experience" icon={<Briefcase size={20}/>} onAdd={() => addListItem('professional_experience', { title: '', company: '', dates: '', details: [''] })}>
                    {(adaptedResume.professional_experience || []).map((exp, expIndex) => ( <div key={expIndex} className="bg-white dark:bg-gray-800/50 p-4 rounded-lg shadow-sm relative border border-gray-200 dark:border-gray-700"> <button onClick={() => removeListItem('professional_experience', expIndex)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1"><Trash2 size={18}/></button> <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3"> <input type="text" value={exp.title} onChange={e => handleNestedChange('professional_experience', expIndex, 'title', e.target.value)} placeholder="Job Title" className={inputClasses} /> <input type="text" value={exp.company} onChange={e => handleNestedChange('professional_experience', expIndex, 'company', e.target.value)} placeholder="Company" className={inputClasses} /> <input type="text" value={exp.dates} onChange={e => handleNestedChange('professional_experience', expIndex, 'dates', e.target.value)} placeholder="Dates (e.g., 2021-Present)" className={inputClasses} /> </div> <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Key Points:</label> <div className="space-y-2"> {(exp.details || []).map((detail, detailIndex) => ( <div key={detailIndex} className="flex items-center gap-2"> <textarea value={detail} onChange={e => handleDetailChange('professional_experience', expIndex, detailIndex, e.target.value)} className={`${inputClasses} text-sm border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/10`} rows="2" placeholder="Accomplishment or responsibility..." /> <button onClick={() => removeDetailItem('professional_experience', expIndex, detailIndex)} className="text-red-500 hover:text-red-700 p-1 self-center" disabled={(exp.details || []).length <= 1}><Trash2 size={16}/></button> </div> ))} <button onClick={() => addDetailItem('professional_experience', expIndex)} className={buttonClasses}><PlusCircle size={14}/> Add Key Point</button> </div> </div> ))}
                </SectionWrapper>
                <SectionWrapper title="Projects" icon={<Lightbulb size={20}/>} onAdd={() => addListItem('projects', { title: '', link: '', details: [''] })}>
                    {(adaptedResume.projects || []).map((proj, projIndex) => ( <div key={projIndex} className="bg-white dark:bg-gray-800/50 p-4 rounded-lg shadow-sm relative border border-gray-200 dark:border-gray-700"> <button onClick={() => removeListItem('projects', projIndex)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1"><Trash2 size={18}/></button> <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3"> <input type="text" value={proj.title} onChange={e => handleNestedChange('projects', projIndex, 'title', e.target.value)} placeholder="Project Title" className={inputClasses} /> <input type="text" value={proj.link} onChange={e => handleNestedChange('projects', projIndex, 'link', e.target.value)} placeholder="Project URL" className={inputClasses} /> </div> <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Key points:</label> <div className="space-y-2"> {(proj.details || []).map((detail, detailIndex) => ( <div key={detailIndex} className="flex items-center gap-2"> <textarea value={detail} onChange={e => handleDetailChange('projects', projIndex, detailIndex, e.target.value)} className={`${inputClasses} text-sm border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/10`} rows="2" placeholder="Feature or technology used..." /> <button onClick={() => removeDetailItem('projects', projIndex, detailIndex)} className="text-red-500 hover:text-red-700 p-1 self-center" disabled={(proj.details || []).length <= 1}><Trash2 size={16}/></button> </div> ))} <button onClick={() => addDetailItem('projects', projIndex)} className={buttonClasses}><PlusCircle size={14}/> Add Detail</button> </div> </div> ))}
                </SectionWrapper>
                <SectionWrapper title="Education" icon={<GraduationCap size={20}/>} onAdd={() => addListItem('education', { degree: '', school: '', dates: '' })}>
                    {(adaptedResume.education || []).map((edu, eduIndex) => ( <div key={eduIndex} className="bg-white dark:bg-gray-800/50 p-4 rounded-lg shadow-sm relative border border-gray-200 dark:border-gray-700"> <button onClick={() => removeListItem('education', eduIndex)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1"><Trash2 size={18}/></button> <div className="grid grid-cols-1 md:grid-cols-3 gap-3"> <input type="text" value={edu.degree} onChange={e => handleNestedChange('education', eduIndex, 'degree', e.target.value)} placeholder="Degree/Certificate" className={inputClasses} /> <input type="text" value={edu.school} onChange={e => handleNestedChange('education', eduIndex, 'school', e.target.value)} placeholder="School/Institution" className={inputClasses} /> <input type="text" value={edu.dates} onChange={e => handleNestedChange('education', eduIndex, 'dates', e.target.value)} placeholder="Dates" className={inputClasses} /> </div> </div> ))}
                </SectionWrapper>
            </div>

            <footer className="mt-8 pt-6 border-t dark:border-gray-700 flex flex-wrap justify-end items-center gap-4">
                <button
                    onClick={handleToggleFullPreview}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all shadow-lg w-full sm:w-auto"
                >
                    {showFullPreview ? <XCircle size={20} /> : <FileText size={20} />}
                    <span>{showFullPreview ? 'Hide Preview' : 'Preview Full Resume'}</span>
                </button>
                <button
                    onClick={handleTailorResume}
                    disabled={isTailoring}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-all shadow-lg disabled:bg-gray-500 disabled:cursor-wait w-full sm:w-auto"
                >
                    {isTailoring ? <Spinner/> : <Wand2 size={20}/>}
                    <span>{isTailoring ? 'Tailoring...' : 'Tailor with AI'}</span>
                </button>
                <button
                    onClick={handleSaveChanges}
                    className="flex items-center justify-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all shadow-lg w-full sm:w-auto"
                >
                    <Save size={20}/> Save Adapted Resume
                </button>
            </footer>

            {showFullPreview && (() => {
                const matchedKeywords = job.keywords?.filter(kw =>
                    (profile?.positive_keywords || []).map(normalizeKeyword).includes(normalizeKeyword(kw))
                ) || [];

                const score = matchScore ?? 0;
                const barColor = getColorFromScore(score);

                return (
                    <div className="mt-8 pt-6 border-t dark:border-gray-700">
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 sm:p-6 rounded-xl shadow-lg w-full flex flex-col border dark:border-gray-700">
                            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-300 dark:border-gray-600 flex-shrink-0">
                                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Full Resume Markdown Preview</h2>
                                <button onClick={handleToggleFullPreview} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white p-2 rounded-full transition-colors">
                                    <XCircle size={24}/>
                                </button>
                            </div>

                            {/* Match Score Bar (Centered with % width) */}
                            <div className="w-full flex justify-center">
                                <div className="w-[85%]">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">Match Score</div>
                                        <div className="text-right">
                                            {matchScoreError ? (
                                                <div className="text-xs text-red-500 dark:text-red-400">⚠ {matchScoreError}</div>
                                            ) : (
                                                <>
                                                    <div className="font-bold text-lg" style={{ color: getColorFromScore(matchScore ?? 0) }}>
                                                        {matchScore !== null ? `${matchScore}%` : '...'}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Match</div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-2 rounded-full transition-all duration-200"
                                            style={{
                                                width: matchScore !== null ? `${matchScore}%` : '0%',
                                                backgroundColor: matchScoreError ? 'transparent' : getColorFromScore(matchScore ?? 0),
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Markdown Preview */}
                            <textarea
                                readOnly
                                value={fullResumeMarkdown}
                                className="mt-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 font-mono text-sm w-full rounded-md p-4 resize-none focus:ring-2 focus:ring-indigo-500"
                                style={{ height: '60vh' }}
                            />
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};


const JobDetailView = ({job, resume, allResumes, onSelectResume, profile, onMarkAsApplied, onMarkAsDisabled}) => {
    if (!job || !resume) {
        return <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400"><p>Select a job
            to see the details</p></div>;
    }

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'N/A';
    const isApplied = !!job.applied_on;

    const jobKeywords = getSkillsArray(job.keywords)
        .map(skill => skill.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '))
        .sort((a, b) => a.localeCompare(b));

    const userSkillsSet = new Set((profile?.positive_keywords || []).map(normalizeKeyword));

    const Placeholder = ({text = "None specified"}) => (
        <div className="flex items-center text-gray-500 dark:text-gray-400 italic">
            <XCircle size={16} className="mr-2"/><span>{text}</span>
        </div>
    );

    const DetailSection = ({title, icon, items}) => (
        <div>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700 flex items-center">{icon} {title}</h3>
            {items?.length > 0 ? (
                <ul className="space-y-2 list-disc list-inside text-gray-800 dark:text-gray-300">
                    {items.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
            ) : <Placeholder/>}
        </div>
    );

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto">
            <header className="flex items-start mb-6">
                <img src={job.company?.logo_url} alt={`${job.company?.name} logo`}
                     className="w-16 h-16 rounded-lg mr-6 object-contain border border-gray-200 dark:border-gray-700"
                     onError={(e) => {
                         e.target.onerror = null;
                         e.target.src = `https://placehold.co/64x64/e2e8f0/4a5568?text=${job.company?.name?.charAt(0) || '?'}`;
                     }}/>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{job.title}</h2>
                    <p className="text-lg text-gray-700 dark:text-gray-300">{job.company?.name}</p>
                </div>
            </header>

            <div className="flex flex-wrap items-center gap-4 mb-6">
                <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all">Apply Now</a>
                {isApplied ? (
                    <div className="flex items-center gap-2 px-6 py-2 text-green-700 dark:text-green-400 font-semibold rounded-lg bg-green-100 dark:bg-green-900/50">
                        <CheckCircle size={20}/> Applied on {formatDate(job.applied_on)}
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => onMarkAsApplied(job.urn)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">
                            <ListChecks size={20}/> Mark as Applied
                        </button>
                        <button onClick={() => onMarkAsDisabled(job.urn)} className="flex items-center gap-2 px-4 py-2 bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-300 font-semibold rounded-lg hover:bg-red-300 dark:hover:bg-red-800 transition-all">
                            <XCircle size={20}/> Mark as Disabled
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-sm">
                {job.job_type && <JobMetaItem icon={<Briefcase/>} color="indigo">{job.job_type}</JobMetaItem>}
                {job.programming_languages?.length > 0 && (
                    <JobMetaItem icon={<Code/>} color="violet">
                        {job.programming_languages.map((lang) => (
                            <span key={lang} className="flex items-center gap-2 bg-violet-200 dark:bg-violet-700 text-violet-900 dark:text-violet-100 px-3 py-1 rounded-full text-sm font-bold">
                                 {languageIcons[lang.trim().toLowerCase()] || <Code className="w-6 h-6"/>}
                                {lang}
                            </span>
                        ))}
                    </JobMetaItem>
                )}
                <JobMetaItem icon={<MapPin/>}>{job.location}</JobMetaItem>
                <JobMetaItem icon={<Briefcase/>}>{job.employment_type}</JobMetaItem>
                <JobMetaItem icon={<Clock/>}>Posted: {formatDate(job.posted_on)}</JobMetaItem>
                <JobMetaItem icon={<Building/>}>{job.workplace_type}</JobMetaItem>
            </div>

            <div className="space-y-8">
                <div>
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700 flex items-center"><ChevronRight size={20} className="mr-2"/> My Keywords</h3>
                    {profile?.positive_keywords?.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {[...profile.positive_keywords].sort((a, b) => a.localeCompare(b)).map((keyword) => (
                                <span key={keyword} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                    <CheckCircle size={14}/> {keyword}
                                </span>
                            ))}
                        </div>
                    ) : <Placeholder text="No keywords found in your profile"/>}
                </div>

                <div>
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700 flex items-center"><ChevronRight size={20} className="mr-2"/> Required Keywords</h3>
                    {jobKeywords.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {jobKeywords.map((keyword, index) => {
                                const isMatched = userSkillsSet.has(normalizeKeyword(keyword));
                                return (
                                    <span key={index} className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isMatched ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                                        {isMatched ? <CheckCircle size={14}/> : <XCircle size={14}/>} {keyword}
                                    </span>
                                );
                            })}
                        </div>
                    ) : <Placeholder text="No keywords specified"/>}
                </div>

                <DetailSection title="Responsibilities" icon={<ClipboardList size={20} className="mr-2"/>} items={job.responsibilities}/>
                <DetailSection title="Qualifications" icon={<ListChecks size={20} className="mr-2"/>} items={job.qualifications}/>

                <div>
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700 flex items-center"><BookOpen size={20} className="mr-2"/> About the Job</h3>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-300">
                        <p style={{whiteSpace: 'pre-wrap'}}>{job.description_full || job.description || "No full description available."}</p>
                    </div>
                </div>

                <AdaptJobSection
                    baseResume={resume}
                    job={job}
                    allResumes={allResumes}
                    onSelectResume={onSelectResume}
                    profile={profile}
                />
            </div>
        </div>
    );
};

// --- Main Page Component ---

const Match = () => {
    const [resumes, setResumes] = useState([]);
    const [selectedResumeId, setSelectedResumeId] = useState('');
    const [selectedResume, setSelectedResume] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [matchedJobs, setMatchedJobs] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [status, setStatus] = useState('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [jobMetrics, setJobMetrics] = useState({total: 0, complete: 0, incomplete: 0});
    const [selectedLanguageFilter, setSelectedLanguageFilter] = useState('');
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

    const allLanguages = useMemo(() => {
        const langSet = new Set();
        jobs.forEach(job => {
            (job.programming_languages || []).forEach(lang => {
                const normalized = lang.toLowerCase();
                if (!forbiddenRegexes.some(regex => regex.test(normalized))) {
                    langSet.add(normalized);
                }
            });
        });
        return Array.from(langSet).sort();
    }, [jobs, forbiddenRegexes]);

    useEffect(() => {
        if (allLanguages.includes('python')) setSelectedLanguageFilter('python');
    }, [allLanguages]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [resumesData, jobsData] = await Promise.all([fetchResumes(), fetchAllJobs()]);
                setResumes(resumesData);
                setJobs(jobsData);
                if (resumesData.length > 0) {
                    // Automatically select the first resume
                    handleSelectResume(resumesData[0].id);
                }
            } catch (error) {
                setErrorMessage(error.message || 'Could not load initial data.');
                setStatus('error');
            }
        };
        loadInitialData();
    }, []);

    useEffect(() => {
        if (jobs.length > 0) {
            const totalCount = jobs.length;
            const completeCount = jobs.filter(j => j.title && j.location).length;
            setJobMetrics({total: totalCount, complete: completeCount, incomplete: totalCount - completeCount});
        }
    }, [jobs]);

    const handleSelectResume = useCallback(async (id) => {
        const newId = (typeof id === 'string' && id.includes('.')) ? parseFloat(id) : parseInt(id, 10);
        setSelectedResumeId(newId);
        if (!newId) {
            setSelectedResume(null);
            setStatus('idle');
            return;
        }
        setStatus('loading');
        setErrorMessage('');
        try {
            const resume = await fetchResumeById(newId);
            setSelectedResume(resume);
            setStatus('idle');
        } catch (error) {
            setErrorMessage(error.message || `Failed to load resume.`);
            setStatus('error');
            setSelectedResume(null); // Clear resume on error
        }
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

    const updateJobInState = (jobUrn, updatedJob) => {
        const updateFn = (j) => (j.urn === jobUrn ? {...j, ...updatedJob} : j);
        setJobs(prev => prev.map(updateFn));
        setMatchedJobs(prev => prev.filter(j => j.urn !== jobUrn));
        if (selectedJob?.urn === jobUrn) setSelectedJob(prev => ({...prev, ...updatedJob}));
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
    }, [selectedJob?.urn]);

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
    }, [selectedJob?.urn]);

    const filteredMatchedJobs = useMemo(() => matchedJobs.filter(job =>
        !selectedLanguageFilter ||
        (job.programming_languages || []).map(l => l.toLowerCase()).includes(selectedLanguageFilter)
    ), [matchedJobs, selectedLanguageFilter]);

    const StatusIndicator = () => {
        if (status === 'matching') return (
            <div className="p-8 text-center text-gray-500"><Spinner className="mx-auto h-12 w-12 text-sky-500" />
                <p className="mt-4">Finding the best opportunities for you...</p>
            </div>
        );
        if (status === 'success' && matchedJobs.length === 0) return (
            <div className="p-8 text-center text-gray-500"><h3 className="text-xl font-semibold">No Matching Jobs Found</h3><p>Try adjusting your profile keywords.</p></div>
        );
        if (status === 'idle' && matchedJobs.length === 0) return (
            <div className="p-8 text-center text-gray-500"><Target size={48} className="mx-auto mb-4 text-gray-400"/><h3 className="text-xl font-semibold">Ready to Match</h3><p>Select your resume and find matches.</p></div>
        );
        return null;
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            <div className="flex h-screen">
                <aside className="flex flex-col flex-shrink-0 w-[35%] max-w-md border-r border-gray-200 dark:border-gray-700">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2"><Award size={24} className="text-sky-500"/> Job Matcher</h2>
                        <div>
                            <label htmlFor="resume-select" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">1. Select your resume</label>
                            <select id="resume-select" value={selectedResumeId} onChange={(e) => handleSelectResume(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-sky-500">
                                <option value="">-- Load a resume --</option>
                                {resumes.map(resume => <option key={resume.id} value={resume.id}>{resume.name}</option>)}
                            </select>
                        </div>
                        {jobMetrics.total > 0 && <div className="text-xs text-center text-gray-500 dark:text-gray-400 space-y-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <p>Analyzing <strong>{jobMetrics.total}</strong> jobs</p><p><span className="text-green-600 dark:text-green-400">{jobMetrics.complete} complete</span><span className="mx-1">/</span><span className="text-yellow-600 dark:text-yellow-400">{jobMetrics.incomplete} incomplete</span></p>
                        </div>}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">2. Find your matches</label>
                            <button onClick={handleMatch} disabled={!selectedResumeId || status === 'matching'} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 transition-all disabled:bg-gray-500 disabled:cursor-not-allowed">
                                <BarChart2 size={20}/>{status === 'matching' ? 'Analyzing...' : 'Find Best Matches'}
                            </button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Filter by Language (Optional)</label>
                            <select value={selectedLanguageFilter} onChange={(e) => setSelectedLanguageFilter(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-sky-500">
                                <option value="">-- All Languages --</option>
                                {allLanguages.map(lang => (<option key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>))}
                            </select>
                        </div>
                        {matchedJobs.length > 0 && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
                                Showing <strong>{filteredMatchedJobs.length}</strong> of <strong>{jobMetrics.total}</strong> jobs
                            </p>
                        )}
                        {errorMessage && <p className="text-sm text-red-500 dark:text-red-400 text-center p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">{errorMessage}</p>}
                    </div>
                    <div className="flex-grow overflow-y-auto">
                        {successMessage && <p className="text-sm text-green-600 dark:text-green-400 text-center p-2 m-2 bg-green-100 dark:bg-green-900/30 rounded-lg">{successMessage}</p>}
                        <StatusIndicator/>
                        {filteredMatchedJobs.map(job => (
                            <MatchedJobItem key={job.urn} job={job} onSelect={setSelectedJob} isSelected={selectedJob?.urn === job.urn}/>
                        ))}
                    </div>
                </aside>
                <main className="flex-grow bg-white dark:bg-gray-800/50">
                    <JobDetailView job={selectedJob} resume={selectedResume} allResumes={resumes} onSelectResume={handleSelectResume} profile={selectedProfile} onMarkAsApplied={handleMarkAsApplied} onMarkAsDisabled={handleMarkAsDisabled} />
                </main>
            </div>
        </div>
    );
};

export default Match;