import React, {useState, useEffect, useCallback, useRef} from 'react';
import toast, {Toaster} from 'react-hot-toast'; // ✨ 1. Import toast
import {
    Briefcase,
    XCircle,
    ListChecks,
    Wand2,
    Save,
    ClipboardList,
    Zap,
    FileText,
    Lightbulb,
    GraduationCap,
    PlusCircle,
    Trash2
} from 'lucide-react';
import {getSkillsArray} from "./MatchLogic.jsx";
import {
    generateFullResumeMarkdown,
    isParsedResumeEmpty, markdownHeadings,
    parseMarkdownToResume
} from "../../utils/markdownUtils.js";
import {getMatchScore} from "../../services/jobService.js";
import {tailorResume} from "../../services/resumeService.js";
import usa from "../../assets/skills_icons/usa.svg";
import brazil from "../../assets/skills_icons/brazil.svg";
import MatchPdfGeneration from "./MatchPdfGeneration.jsx";

const Spinner = ({className = 'h-5 w-5 text-white'}) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const EditableSuggestion = ({original, suggested, onChange, isChanged, id, label, rows = 3, highlight = false}) => {
    const baseTextarea = "w-full p-2 rounded-md focus:ring-2 text-sm";
    const borderHighlight = highlight ? "border-yellow-400 dark:border-yellow-300" : "border-gray-300 dark:border-gray-600";
    const bgHighlight = highlight ? "bg-yellow-100 dark:bg-yellow-700/30" : "bg-white dark:bg-gray-700";
    const fullHighlight = `${borderHighlight} ${bgHighlight}`;

    if (!isChanged) {
        return <textarea id={id} value={suggested} onChange={onChange}
                         className={`${baseTextarea} ${fullHighlight} focus:ring-yellow-400 dark:focus:ring-yellow-300`}
                         rows={rows}/>;
    }

    return (
        <div
            className="space-y-3 p-4 bg-white dark:bg-gray-800/70 rounded-lg border border-purple-300 dark:border-purple-700">
            <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">ORIGINAL</label>
                <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 p-2 rounded-md">{original}</p>
            </div>
            <div>
                <label htmlFor={id}
                       className="block text-xs font-semibold text-purple-800 dark:text-purple-300 mb-1">{label}</label>
                <textarea id={id} value={suggested} onChange={onChange}
                          className={`${baseTextarea} ${fullHighlight} focus:ring-yellow-400 dark:focus:ring-yellow-300`}
                          rows={rows}/>
            </div>
        </div>
    );
};

const AdaptResumeSection = ({baseResume, job, allResumes, onSelectResume, profile}) => {
    const [language, setLanguage] = useState('en');
    const [adaptedResume, setAdaptedResume] = useState(null);
    const [isTailoring, setIsTailoring] = useState(false);
    const [tailoringApplied, setTailoringApplied] = useState(false);
    const [showFullPreview, setShowFullPreview] = useState(false);
    const [fullResumeMarkdown, setFullResumeMarkdown] = useState('');
    const [matchScore, setMatchScore] = useState(null);
    const [matchScoreError, setMatchScoreError] = useState(null);
    const [isCalculatingScore, setIsCalculatingScore] = useState(false);
    const scoreCache = useRef(new Map());

    useEffect(() => {
        if (job?.language?.toUpperCase() === 'PTBR') {
            setLanguage('pt');
        } else {
            setLanguage('en');
        }
    }, [job]);

    const headings = markdownHeadings[language];
    const getTitle = md => {
        const parts = md.split(' ');
        return parts.slice(2).join(' ');
    };

    const inputClasses = "w-full p-2 rounded-md bg-white dark:bg-gray-700 focus:ring-2 text-sm border border-gray-300 dark:border-gray-600 focus:ring-purple-500";
    const buttonClasses = "flex items-center gap-2 text-xs px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/50 dark:hover:bg-purple-900/80 text-purple-800 dark:text-purple-200 font-semibold rounded-md transition-all";

    const handleCalculateScore = useCallback(async () => {
        const markdown = generateFullResumeMarkdown(profile, adaptedResume, headings);
        const jobText = `# ${job.title || ''} @ ${job.company?.name || ''}\n\n${job.description || ''}\n\n## Responsibilities\n${(job.responsibilities || []).join('\n')}\n\n## Qualifications\n${(job.qualifications || []).join('\n')}`;

        const cacheKey = jobText + '|||' + markdown;

        if (scoreCache.current.has(cacheKey)) {
            setMatchScore(scoreCache.current.get(cacheKey));
            setMatchScoreError(null);
            setIsCalculatingScore(false);
            return;
        }

        if (!markdown.trim() || !jobText.trim()) {
            setMatchScoreError("❌ Resume or job description is empty");
            setMatchScore(null);
            return;
        }

        try {
            setIsCalculatingScore(true);
            const {match_score} = await getMatchScore(jobText, markdown);
            const newScore = Math.round(match_score * 100);

            setMatchScore(newScore);
            setMatchScoreError(null);
            scoreCache.current.set(cacheKey, newScore);
        } catch (err) {
            console.error("⚠ Match score API error:", err);
            setMatchScore(null);
            setMatchScoreError(`Error code ${err.status || '???'} - ${err.message || 'unknown'}`);
        } finally {
            setIsCalculatingScore(false);
        }
    }, [adaptedResume, headings, job, profile]);

    useEffect(() => {
        if (baseResume) {
            if (baseResume.professional_experience) {
                baseResume.professional_experience.forEach(exp => {
                    exp.details = exp.details || exp.description || [];
                });
            }

            if (baseResume.projects) {
                baseResume.projects.forEach(proj => {
                    proj.details = proj.details || proj.description || [];
                });
            }

            const mappedResume = JSON.parse(JSON.stringify(baseResume));

            if (mappedResume.professional_experience) {
                mappedResume.professional_experience.forEach(exp => {
                    exp.details = exp.details || exp.description || [];
                });
            }

            if (mappedResume.projects) {
                mappedResume.projects.forEach(proj => {
                    proj.details = proj.details || proj.description || [];
                });
            }

            setAdaptedResume(mappedResume);
            setTailoringApplied(false);
        } else {
            setAdaptedResume(null);
        }
    }, [baseResume]);

    const handleUpdate = (updater) => setAdaptedResume(prev => updater(JSON.parse(JSON.stringify(prev))));
    const handleSimpleChange = (field, value) => handleUpdate(draft => {
        draft[field] = value;
        return draft;
    });
    const handleListChange = (listName, index, value) => handleUpdate(draft => {
        draft[listName][index] = value;
        return draft;
    });
    const handleNestedChange = (listName, index, field, value) => handleUpdate(draft => {
        draft[listName][index][field] = value;
        return draft;
    });
    const handleDetailChange = (listName, itemIndex, detailIndex, value) => handleUpdate(draft => {
        draft[listName][itemIndex].details[detailIndex] = value;
        return draft;
    });
    const addListItem = (listName, newItem) => handleUpdate(draft => {
        draft[listName] = [...(draft[listName] || []), newItem];
        return draft;
    });
    const removeListItem = (listName, index) => handleUpdate(draft => {
        draft[listName].splice(index, 1);
        return draft;
    });
    const addDetailItem = (listName, itemIndex) => handleUpdate(draft => {
        draft[listName][itemIndex].details.push('');
        return draft;
    });
    const removeDetailItem = (listName, itemIndex, detailIndex) => handleUpdate(draft => {
        draft[listName][itemIndex].details.splice(detailIndex, 1);
        return draft;
    });

    const handleTailorResume = async () => {
        if (!baseResume || !job) return;
        setIsTailoring(true);
        setTailoringApplied(false);

        let job_description = `# ${job.title} @ ${job.company?.name}\n\n## Description\n${job.description || 'Not provided.'}\n\n## Responsibilities\n`;
        (job.responsibilities || []).forEach(r => {
            job_description += `- ${r}\n`;
        });
        job_description += `\n## Qualifications\n`;
        (job.qualifications || []).forEach(q => {
            job_description += `- ${q}\n`;
        });
        if (job.keywords) job_description += `\n## Keywords\n${getSkillsArray(job.keywords).join(', ')}`;

        try {
            const tailoredData = await tailorResume({
                raw_job_description: job_description,
                raw_resume: generateFullResumeMarkdown(profile, baseResume, headings),
                extracted_job_keywords: getSkillsArray(job.keywords || []),
                extracted_resume_keywords: getSkillsArray(baseResume.hard_skills || []),
                current_cosine_similarity: matchScore ? matchScore / 100 : 0.0,
            });

            console.log('--- RAW MARKDOWN FROM AI ---\n', tailoredData.markdown);
            const aiParsedResume = parseMarkdownToResume(tailoredData.markdown);
            console.log('--- PARSED OUTPUT ---\n', aiParsedResume);

            if (isParsedResumeEmpty(aiParsedResume)) {
                console.error("⚠️ Parsed output is empty or invalid", aiParsedResume);
                throw new Error("❌ AI returned an empty or invalid resume. Please retry.");
            }

            const newAdaptedResume = JSON.parse(JSON.stringify(baseResume));

            if (aiParsedResume.summary) {
                newAdaptedResume.summary = aiParsedResume.summary;
            }

            if (aiParsedResume.hard_skills?.length > 0) {
                newAdaptedResume.hard_skills = aiParsedResume.hard_skills;
            }

            if (aiParsedResume.professional_experience?.length > 0) {
                const originalExpMap = new Map(
                    baseResume.professional_experience.map(exp => [
                        `${exp.title?.toLowerCase().trim()}@${exp.company?.toLowerCase().trim()}`,
                        exp
                    ])
                );

                newAdaptedResume.professional_experience = aiParsedResume.professional_experience.map(aiExp => {
                    const key = `${aiExp.title?.toLowerCase().trim()}@${aiExp.company?.toLowerCase().trim()}`;
                    const originalExp = originalExpMap.get(key);
                    return {
                        ...aiExp,
                        dates: originalExp?.dates || aiExp.dates,
                    };
                });
            }

            if (aiParsedResume.projects?.length > 0) {
                const originalProjMap = new Map(
                    baseResume.projects.map(p => [p.title?.toLowerCase().trim(), p])
                );

                newAdaptedResume.projects = aiParsedResume.projects.map(aiProj => {
                    const originalProj = originalProjMap.get(aiProj.title?.toLowerCase().trim());
                    return {
                        ...aiProj,
                        link: originalProj?.link || aiProj.link,
                    };
                });
            }

            setAdaptedResume(newAdaptedResume);
            setTailoringApplied(true);
            toast.success('✨ Resume tailored successfully!'); // ✨ 3. Replaced alert with toast.success

        } catch (error) {
            console.error("Error tailoring resume:", error);
            // ✨ 3. Replaced alert with toast.error
            toast.error(`Could not tailor resume: ${error.message}`, {
                duration: 5000,
            });
        } finally {
            setIsTailoring(false);
        }
    };

    const handleSaveChanges = () => {
        console.log("--- ADAPTED RESUME DATA ---", adaptedResume);
        // ✨ 3. Replaced alert with toast.success
        toast.success("Adapted resume data saved to console.", {
            icon: '💾',
        });
    };

    const handleToggleFullPreview = () => {
        setShowFullPreview(prev => !prev);
    };

    useEffect(() => {
        if (showFullPreview) {
            const newMarkdown = generateFullResumeMarkdown(profile, adaptedResume, headings);
            setFullResumeMarkdown(newMarkdown);
        }
    }, [language, adaptedResume, showFullPreview, headings, profile]);

    useEffect(() => {
        // This effect will now run whenever `allResumes` or `job` changes.
        if (allResumes?.length > 0) {
            // It always selects the first resume in the reverse-alphabetically sorted list as the default.
            const sorted = [...allResumes].sort((a, b) => b.name.localeCompare(a.name));

            // Find a better default based on the job language, if possible
            const jobLang = job?.language?.toUpperCase();
            let defaultResume = null;

            if (jobLang === 'PTBR') {
                defaultResume = allResumes.find(r => r.name.toUpperCase().includes('PTBR'));
            } else {
                defaultResume = allResumes.find(r => r.name.toUpperCase().includes('ENGLISH'));
            }

            // If a language-specific resume isn't found, use the first one from the sorted list.
            const defaultId = defaultResume ? defaultResume.id : sorted[0]?.id;

            if (defaultId) {
                onSelectResume(defaultId);
            }
        }
    }, [allResumes, job, onSelectResume]);

    useEffect(() => {
        if (showFullPreview) {
            handleCalculateScore();
        }
    }, [showFullPreview, handleCalculateScore]);

    if (!adaptedResume || !job) return null;

    const SectionWrapper = ({title, icon, onAdd, children}) => (
        <div
            className="p-4 border-2 border-dashed border-purple-300 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-900/10">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">{icon} {title}</h3>
                {onAdd &&
                    <button onClick={onAdd} className={buttonClasses}><PlusCircle size={14}/> Add {title.slice(0, -1)}
                    </button>}
            </div>
            <div className="space-y-4">{children}</div>
        </div>
    );

    return (
        <div className="pt-8">
            {/* ✨ 2. Add Toaster component here */}
            <Toaster
                position="top-center"
                reverseOrder={false}
                toastOptions={{
                    className: '',
                    style: {
                        background: '#333',
                        color: '#fff',
                    },
                }}
            />

            <header className="pb-4 border-b-2 border-purple-400 dark:border-purple-600 mb-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Select a base resume to adapt:
                    </label>
                    <div className="flex items-center gap-4">
                        <select
                            id="adapt-resume-select"
                            value={baseResume.id}
                            onChange={(e) => onSelectResume(e.target.value)}
                            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 w-auto"
                        >
                            {[...allResumes]
                                .sort((a, b) => b.name.localeCompare(a.name)) // Reverse alphabetical order
                                .map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name}
                                    </option>
                                ))}
                        </select>

                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-full">
                            <button onClick={() => setLanguage('en')}
                                    className={`p-1 rounded-full transition-all ${language === 'en' ? 'ring-2 ring-purple-500' : 'opacity-60 hover:opacity-100'}`}>
                                <img src={usa} alt="USA Flag" className="w-6 h-6 rounded-full"/>
                            </button>
                            <button onClick={() => setLanguage('pt')}
                                    className={`p-1 rounded-full transition-all ${language === 'pt' ? 'ring-2 ring-purple-500' : 'opacity-60 hover:opacity-100'}`}>
                                <img src={brazil} alt="Brazil Flag" className="w-6 h-6 rounded-full"/>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="space-y-6">
                {/* ... rest of your JSX remains unchanged ... */}
                <SectionWrapper title={getTitle(headings.summary)} icon={<FileText size={20}/>}>
                    <EditableSuggestion id="summary" label="EDITABLE / SUGGESTED" original={baseResume.summary || ''}
                                        suggested={adaptedResume.summary || ''}
                                        onChange={(e) => handleSimpleChange('summary', e.target.value)}
                                        isChanged={tailoringApplied} highlight={tailoringApplied} rows={5}/>
                </SectionWrapper>
                <SectionWrapper title={getTitle(headings.hard_skills)} icon={<Zap size={20}/>}
                                onAdd={() => addListItem('hard_skills', '')}>
                    {(adaptedResume.hard_skills || []).map((skill, index) => (
                        <div key={index} className="flex items-center gap-2"><input type="text" value={skill}
                                                                                    onChange={(e) => handleListChange('hard_skills', index, e.target.value)}
                                                                                    className={inputClasses}
                                                                                    placeholder="Enter skill"/>
                            <button onClick={() => removeListItem('hard_skills', index)}
                                    className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button>
                        </div>))}
                </SectionWrapper>
                <SectionWrapper title={getTitle(headings.professional_experience)} icon={<Briefcase size={20}/>}
                                onAdd={() => addListItem('professional_experience', {
                                    title: '',
                                    company: '',
                                    dates: '',
                                    details: ['']
                                })}>
                    {(adaptedResume.professional_experience || []).map((exp, expIndex) => (<div key={expIndex}
                                                                                                className="bg-white dark:bg-gray-800/50 p-4 rounded-lg shadow-sm relative border border-gray-200 dark:border-gray-700">
                        <button onClick={() => removeListItem('professional_experience', expIndex)}
                                className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1"><Trash2
                            size={18}/></button>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3"><input type="text" value={exp.title}
                                                                                           onChange={e => handleNestedChange('professional_experience', expIndex, 'title', e.target.value)}
                                                                                           placeholder="Job Title"
                                                                                           className={inputClasses}/>
                            <input type="text" value={exp.company}
                                   onChange={e => handleNestedChange('professional_experience', expIndex, 'company', e.target.value)}
                                   placeholder="Company" className={inputClasses}/> <input type="text" value={exp.dates}
                                                                                           onChange={e => handleNestedChange('professional_experience', expIndex, 'dates', e.target.value)}
                                                                                           placeholder="Dates"
                                                                                           className={inputClasses}/>
                        </div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Key
                            Points:</label>
                        <div className="space-y-2"> {(exp.details || []).map((detail, detailIndex) => (
                            <div key={detailIndex} className="flex items-center gap-2"><EditableSuggestion
                                id={`exp-${expIndex}-detail-${detailIndex}`} label="EDITABLE / SUGGESTED"
                                original={baseResume.professional_experience[expIndex]?.details?.[detailIndex] || ''}
                                suggested={detail}
                                onChange={e => handleDetailChange('professional_experience', expIndex, detailIndex, e.target.value)}
                                isChanged={tailoringApplied} highlight={tailoringApplied} rows={2}/>
                                <button
                                    onClick={() => removeDetailItem('professional_experience', expIndex, detailIndex)}
                                    className="text-red-500 hover:text-red-700 p-1 self-center"
                                    disabled={(exp.details || []).length <= 1}><Trash2 size={16}/></button>
                            </div>))}
                            <button onClick={() => addDetailItem('professional_experience', expIndex)}
                                    className={buttonClasses}><PlusCircle size={14}/> Add Key Point
                            </button>
                        </div>
                    </div>))}
                </SectionWrapper>
                <SectionWrapper title={getTitle(headings.projects)} icon={<Lightbulb size={20}/>}
                                onAdd={() => addListItem('projects', {title: '', link: '', details: ['']})}>
                    {(adaptedResume.projects || []).map((proj, projIndex) => (<div key={projIndex}
                                                                                   className="bg-white dark:bg-gray-800/50 p-4 rounded-lg shadow-sm relative border border-gray-200 dark:border-gray-700">
                        <button onClick={() => removeListItem('projects', projIndex)}
                                className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1"><Trash2
                            size={18}/></button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3"><input type="text"
                                                                                           value={proj.title}
                                                                                           onChange={e => handleNestedChange('projects', projIndex, 'title', e.target.value)}
                                                                                           placeholder="Project Title"
                                                                                           className={inputClasses}/>
                            <input type="text" value={proj.link}
                                   onChange={e => handleNestedChange('projects', projIndex, 'link', e.target.value)}
                                   placeholder="Project URL" className={inputClasses}/></div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Key
                            points:</label>
                        <div className="space-y-2"> {(proj.details || []).map((detail, detailIndex) => (
                            <div key={detailIndex} className="flex items-center gap-2"><EditableSuggestion
                                id={`proj-${projIndex}-detail-${detailIndex}`} label="EDITABLE / SUGGESTED"
                                original={baseResume.projects[projIndex]?.details?.[detailIndex] || ''}
                                suggested={detail}
                                onChange={e => handleDetailChange('projects', projIndex, detailIndex, e.target.value)}
                                isChanged={tailoringApplied} highlight={tailoringApplied} rows={2}/>
                                <button onClick={() => removeDetailItem('projects', projIndex, detailIndex)}
                                        className="text-red-500 hover:text-red-700 p-1 self-center"
                                        disabled={(proj.details || []).length <= 1}><Trash2 size={16}/></button>
                            </div>))}
                            <button onClick={() => addDetailItem('projects', projIndex)} className={buttonClasses}>
                                <PlusCircle size={14}/> Add Detail
                            </button>
                        </div>
                    </div>))}
                </SectionWrapper>
                <SectionWrapper title={getTitle(headings.education)} icon={<GraduationCap size={20}/>}
                                onAdd={() => addListItem('education', {degree: '', school: '', dates: ''})}>
                    {(adaptedResume.education || []).map((edu, eduIndex) => (<div key={eduIndex}
                                                                                  className="bg-white dark:bg-gray-800/50 p-4 rounded-lg shadow-sm relative border border-gray-200 dark:border-gray-700">
                        <button onClick={() => removeListItem('education', eduIndex)}
                                className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1"><Trash2
                            size={18}/></button>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><input type="text" value={edu.degree}
                                                                                      onChange={e => handleNestedChange('education', eduIndex, 'degree', e.target.value)}
                                                                                      placeholder="Degree/Certificate"
                                                                                      className={inputClasses}/> <input
                            type="text" value={edu.school}
                            onChange={e => handleNestedChange('education', eduIndex, 'school', e.target.value)}
                            placeholder="School/Institution" className={inputClasses}/> <input type="text"
                                                                                               value={edu.dates}
                                                                                               onChange={e => handleNestedChange('education', eduIndex, 'dates', e.target.value)}
                                                                                               placeholder="Dates"
                                                                                               className={inputClasses}/>
                        </div>
                    </div>))}
                </SectionWrapper>
            </div>

            <footer className="mt-8 pt-6 border-t dark:border-gray-700 flex flex-wrap justify-end items-center gap-4">
                <button onClick={handleToggleFullPreview}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all shadow-lg w-full sm:w-auto"> {showFullPreview ?
                    <XCircle size={20}/> : <FileText size={20}/>}
                    <span>{showFullPreview ? 'Hide Preview' : 'Preview Full Resume'}</span></button>
                <button onClick={handleTailorResume} disabled={isTailoring}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-all shadow-lg disabled:bg-gray-500 disabled:cursor-wait w-full sm:w-auto"> {isTailoring ?
                    <Spinner/> : <Wand2 size={20}/>} <span>{isTailoring ? 'Tailoring...' : 'Tailor with AI'}</span>
                </button>
                <button onClick={handleSaveChanges}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all shadow-lg w-full sm:w-auto">
                    <Save size={20}/> Save Adapted Resume
                </button>
            </footer>

            {showFullPreview && (
                <MatchPdfGeneration
                    fullResumeMarkdown={fullResumeMarkdown}
                    matchScore={matchScore}
                    matchScoreError={matchScoreError}
                    isCalculatingScore={isCalculatingScore}
                    onCalculateScore={handleCalculateScore}
                    onClosePreview={handleToggleFullPreview}
                    resumeLanguage={language}
                    resumeName={baseResume.name}
                />
            )}
        </div>
    );
};

export default AdaptResumeSection;