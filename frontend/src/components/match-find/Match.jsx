import React, { useState, useEffect, useCallback } from 'react';
import { Target, CheckCircle, BarChart2, Briefcase, MapPin, Clock, Building, Users, ChevronRight, XCircle, Globe, Award, ClipboardList, ListChecks, Wand2, Edit, Save, ArrowLeft } from 'lucide-react';

// --- Service Mocks and Logic ---
// In a real app, this would be in separate files (e.g., services/ResumeService.js, utils/matchLogic.js)

const API_BASE = "http://localhost:5000";

// Mock data as a fallback in case the API fails
const MOCK_RESUMES = [{
    "education": [{ "date": "2019–2023 - Politechnika Lubelska – Intercâmbio acadêmico", "degree": "Universidade de Fortaleza Bacharelado em Ciências da Computação ", "details": ["Fortaleza, Brazil"] }],
    "hard_skills": ["Python", "C#", "Javascript", "NextJS", "ReactNative", "React", "SQL", "HTML", "CSS", "Unit tests", "Integration tests", "Scrum", "Agile", "Kanban", "Swagger", "AWS", "Google Cloud", "Azure", "Docker", "Kubernetes", "TILT", "Github Actions", "Linux", "Flask", "Django", "NodeJS", "Postgres", "Mongo", "Supabase", "JWT", "OAuth2", "Github", "Gitlab", "Backend", "Frontend", "Fullstack", "Firebase", "Typescript", "GIT", "JSON", "REST", "Desenvolvimento de Software", "DevOps", "CI/CD", "NoSQL", "Software Engineering", "Cloud Computing", "Clean Code", "Clean Architecture"],
    "id": 1,
    "name": "Backend python",
    "professional_experience": [{ "details": ["Coordenei os sprints da equipe de backend e distribuí tarefas utilizando Scrum.", "Mentoria e code review de membros da equipe, melhorando a eficiência.", "Desenvolvi APIs RESTful com Flask, microsserviços e autenticação JWT.", "Modelei e otimizei banco de dados PostgreSQL com ORM.", "Adotei Clean Code, Design Patterns e documentação via Swagger.", "Configurei webhooks e integração com frontend React para sincronização de chatbot."], "title": "Pontotel – Backend Developer(Mar/2025 - Jun/2025)" }, { "details": ["Implementei scripts via Google Cloud para atender demandas urgentes.", "Refatorei código legado com DTOs e validações modernas.", "Desenvolvi importadores de dados com pré-validação e testes.", "Criei API interna para métricas de calendário com MongoDB.", "Trabalhei com Flask, Celery, FastAPI, Pytest, TILT, Alembic, Poetry, Docker e Kubernetes."], "title": "Omnichat – Backend Lead(Aug/2024 - Jan/2025)" }, { "details": ["Desenvolvi sistemas backend para jogos Unity com C#.", "Colaborei com equipes de Game Design e Áudio.", "Gerenciei produção de assets em Tech Art com Blender.", "Fiz mapeamento UV e shaders, garantindo qualidade dos produtos."], "title": "Insane Games – Intern(Feb/2024 - Jun/2024)" }]
}];

const MOCK_JOBS = [
    { applicants: 5, company: { name: "Innovatech Solutions", logo_url: "https://placehold.co/64x64/3b82f6/ffffff?text=IS" }, job_url: "#", location: "San Francisco, CA", posted_on: "2025-07-10T12:00:00Z", title: "Senior Frontend Developer", urn: "urn:li:job:1", workplace_type: "On-site", employment_type: "Full-time", responsibilities: ["Develop new user-facing features for our flagship product.", "Build reusable code and libraries for future use.", "Ensure the technical feasibility of UI/UX designs.", "Optimize application for maximum speed and scalability."], qualifications: ["5+ years of experience with React and the modern JavaScript ecosystem.", "Strong proficiency in JavaScript, TypeScript, HTML5, and CSS3.", "Experience with state management libraries like Redux or Zustand.", "Familiarity with RESTful APIs and modern authorization mechanisms."], keywords: "React,TypeScript,Next.js,JavaScript,CSS,HTML,Frontend,UI,UX", easy_apply: true, applied_on: null, description_full: "Join our dynamic frontend team to build the next generation of user interfaces. You will be a key player in driving the technical direction of our products." },
    { applicants: 12, company: { name: "Auramind.ai", logo_url: "https://placehold.co/64x64/8b5cf6/ffffff?text=A" }, job_url: "#", location: "Goiânia, Brazil (Remote)", posted_on: "2025-07-12T12:00:00Z", title: "Backend Developer - Python", urn: "urn:li:job:2", workplace_type: "Remote", employment_type: "Full-time", responsibilities: ["Design and implement scalable and secure RESTful APIs using Python.", "Maintain and improve database performance and reliability (PostgreSQL).", "Write clean, maintainable, and well-tested code.", "Collaborate with frontend developers and product managers to deliver high-quality features."], qualifications: ["Proven experience as a Python Developer.", "Strong experience with Django or Flask frameworks.", "Solid understanding of database design, SQL, and ORMs.", "Experience with containerization (Docker) and CI/CD pipelines."], keywords: "Python,Django,Flask,PostgreSQL,Docker,Backend,RESTful APIs,SQL,CI/CD", easy_apply: true, applied_on: null, description_full: "Auramind.ai is seeking a talented Python Backend Developer to join our fully remote team. You will be responsible for building the core infrastructure that powers our AI-driven platform." },
];

const handleResponse = async (response, defaultErrorMsg) => {
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
        throw new Error(errorBody.error || defaultErrorMsg);
    }
    return response.json();
};

const fetchResumes = async () => {
    try {
        const response = await fetch(`${API_BASE}/jobs/`);
        return handleResponse(response, 'Failed to fetch resumes');
    } catch (error) {
        console.warn("API fetch for resumes failed, using mock data as a fallback.", error);
        return Promise.resolve(MOCK_RESUMES);
    }
};

const fetchResumeById = async (id) => {
    try {
        const response = await fetch(`${API_BASE}/jobs/${id}`);
        return handleResponse(response, `Failed to fetch resume with ID ${id}`);
    } catch (error) {
        console.warn(`API fetch for resume ${id} failed, using mock data as a fallback.`, error);
        const resume = MOCK_RESUMES.find(r => r.id == id);
        if (resume) return Promise.resolve(resume);
        return Promise.reject(new Error(`Resume with ID ${id} not found in mock data.`));
    }
};

const fetchAllJobs = async () => {
    try {
        const response = await fetch(`${API_BASE}/jobs/all`);
        return handleResponse(response, 'Failed to fetch all jobs');
    } catch (error) {
        console.warn("API fetch for all jobs failed, using mock data as a fallback.", error);
        return Promise.resolve(MOCK_JOBS);
    }
};

const markJobAsApplied = async (jobUrn) => {
    const response = await fetch(`${API_BASE}/jobs/${jobUrn}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applied_on: new Date().toISOString() }),
    });
    return handleResponse(response, 'Failed to mark job as applied');
};

const getSkillsArray = (keywords) => {
    if (!keywords) return [];
    if (Array.isArray(keywords)) return keywords;
    return keywords.split(',').map(k => k.trim()).filter(Boolean);
};

const findBestMatches = (jobs, resume) => {
    const resumeSkills = new Set(resume.hard_skills.map(s => s.toLowerCase()));
    if (resumeSkills.size === 0) return jobs.map(j => ({ ...j, matchScore: 0, matchedSkillsSet: new Set() }));

    return jobs.map(job => {
        const jobKeywords = getSkillsArray(job.keywords);
        if (jobKeywords.length === 0) return { ...job, matchScore: 0, matchedSkillsSet: new Set() };

        const matchedSkillsSet = new Set();
        jobKeywords.forEach(keyword => {
            if (resumeSkills.has(keyword.toLowerCase())) {
                matchedSkillsSet.add(keyword);
            }
        });

        const matchScore = (matchedSkillsSet.size / jobKeywords.length) * 100;
        return { ...job, matchScore, matchedSkillsSet };
    }).sort((a, b) => b.matchScore - a.matchScore);
};

// --- React Components ---

const getColorFromScore = (score) => {
    const capped = Math.min(Math.max(score, 0), 100);
    const hue = Math.round((capped / 100) * 120);
    return `hsl(${hue}, 70%, 45%)`;
};

const MatchedJobItem = ({ job, onSelect, isSelected }) => {
    const score = Math.round(job.matchScore || 0);
    const barColor = getColorFromScore(score);
    const isApplied = !!job.applied_on;

    const baseClasses = "p-4 border-l-4 cursor-pointer transition-colors duration-200";
    const selectedClasses = "bg-sky-100 dark:bg-sky-900/30 border-sky-500";
    const unselectedClasses = "border-transparent hover:bg-gray-100 dark:hover:bg-gray-800";

    return (
        <div onClick={() => onSelect(job)} className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        {isApplied && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
                        <span>{job.title}</span>
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{job.company?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{job.location}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 ml-4">
                    <div className="font-bold text-lg" style={{ color: barColor }}>{score}%</div>
                    <div className="text-xs text-gray-500">Match</div>
                </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="h-1.5 rounded-full transition-all duration-200" style={{ width: `${score}%`, backgroundColor: barColor }} />
            </div>
        </div>
    );
};

const JobDetailView = ({ job, resume, onMarkAsApplied }) => {
    const [editedSkills, setEditedSkills] = useState('');
    const [editedExperience, setEditedExperience] = useState([]);

    useEffect(() => {
        if (resume) {
            setEditedSkills(resume.hard_skills.join(', '));
            setEditedExperience(JSON.parse(JSON.stringify(resume.professional_experience)));
        }
    }, [resume]);


    if (!job || !resume) {
        return <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400"><p>Select a job to see the details</p></div>;
    }

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'N/A';
    const isApplied = !!job.applied_on;
    const jobKeywords = getSkillsArray(job.keywords);

    const handleExperienceChange = (expIndex, detailIndex, value) => {
        const newExperience = [...editedExperience];
        newExperience[expIndex].details[detailIndex] = value;
        setEditedExperience(newExperience);
    };

    const handleAdapt = () => {
        console.log("--- ADAPTATION DATA ---");
        console.log("Job Title:", job.title);
        console.log("Adapted Skills:", editedSkills);
        console.log("Adapted Experience:", editedExperience);
        console.log("--- END ADAPTATION ---");
        alert("Adaptation logic triggered. Check the console for details.");
    };

    const Placeholder = ({ text = "None specified" }) => <div className="flex items-center text-gray-500 dark:text-gray-400 italic"><XCircle size={16} className="mr-2" /><span>{text}</span></div>;
    const DetailSection = ({ title, icon, items }) => (
        <div>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700 flex items-center">{icon} {title}</h3>
            {items && items.length > 0 ? <ul className="space-y-2 list-disc list-inside text-gray-800 dark:text-gray-300">{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <Placeholder />}
        </div>
    );

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto">
            <div className="flex items-start mb-6">
                <img src={job.company?.logo_url} alt={`${job.company?.name} logo`} className="w-16 h-16 rounded-lg mr-6 object-contain border border-gray-200 dark:border-gray-700" onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/64x64/e2e8f0/4a5568?text=${job.company?.name?.charAt(0) || '?'}`; }} />
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{job.title}</h2>
                    <p className="text-lg text-gray-700 dark:text-gray-300">{job.company?.name}</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 mb-6">
                <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all">Apply Now</a>
                {isApplied ? <div className="flex items-center gap-2 px-6 py-2 text-green-700 dark:text-green-400 font-semibold rounded-lg bg-green-100 dark:bg-green-900/50"><CheckCircle size={20} /> Applied on {formatDate(job.applied_on)}</div> : <button onClick={() => onMarkAsApplied(job.urn)} className="flex items-center gap-2 px-6 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"><ListChecks size={20} /> Mark as Applied</button>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-sm">
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-lg"><MapPin size={18} className="mr-3 text-gray-500"/>{job.location}</div>
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-lg"><Briefcase size={18} className="mr-3 text-gray-500"/>{job.employment_type}</div>
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-lg"><Clock size={18} className="mr-3 text-gray-500"/>Posted: {formatDate(job.posted_on)}</div>
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-lg"><Building size={18} className="mr-3 text-gray-500"/>{job.workplace_type}</div>
            </div>

            <div className="space-y-8">
                <div>
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700 flex items-center"><ChevronRight size={20} className="mr-2" /> Required Keywords</h3>
                    {jobKeywords.length > 0 ? <div className="flex flex-wrap gap-2">{jobKeywords.map((keyword, index) => { const isMatched = job.matchedSkillsSet?.has(keyword); return <span key={index} className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isMatched ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>{isMatched ? <CheckCircle size={14} /> : <XCircle size={14} />}{keyword}</span>; })}</div> : <Placeholder text="No keywords specified" />}
                </div>

                <DetailSection title="Responsibilities" icon={<ClipboardList size={20} className="mr-2" />} items={job.responsibilities} />

                <DetailSection title="Qualifications" icon={<ListChecks size={20} className="mr-2" />} items={job.qualifications} />

                {/* --- Adapt Resume Section --- */}
                <div className="pt-8">
                    <header className="pb-4 border-b-2 border-purple-400 dark:border-purple-600 mb-6">
                        <h2 className="text-2xl font-bold flex items-center gap-3"><Wand2 className="text-purple-500" /> Adapt Resume For This Job</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Modify your skills and experience below to better match the job requirements.</p>
                    </header>

                    <div className="space-y-6">
                        <div className="p-4 border-2 border-dashed border-purple-300 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-900/10">
                            <label htmlFor="edited-skills" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Hard Skills</label>
                            <textarea id="edited-skills" value={editedSkills} onChange={e => setEditedSkills(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500" rows="4"></textarea>
                            <p className="text-xs text-gray-500 mt-1">Separate skills with a comma.</p>
                        </div>

                        <div className="p-4 border-2 border-dashed border-purple-300 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-900/10">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Professional Experience</h3>
                            <div className="space-y-4">
                                {editedExperience.map((exp, expIndex) => (
                                    <div key={expIndex} className="bg-white dark:bg-gray-800/50 p-4 rounded-lg shadow-sm">
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100">{exp.title}</h4>
                                        <ul className="mt-2 space-y-2">
                                            {exp.details.map((detail, detailIndex) => (
                                                <li key={detailIndex}>
                                                    <textarea value={detail} onChange={e => handleExperienceChange(expIndex, detailIndex, e.target.value)} className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500 text-sm" rows="3"></textarea>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <footer className="mt-6 pt-6 border-t dark:border-gray-700 flex justify-end">
                        <button onClick={handleAdapt} className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all shadow-lg"><Save size={20} /> Adapt</button>
                    </footer>
                </div>
            </div>
        </div>
    );
};

const Match = () => {
    const [resumes, setResumes] = useState([]);
    const [selectedResumeId, setSelectedResumeId] = useState('');
    const [selectedResume, setSelectedResume] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [matchedJobs, setMatchedJobs] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [status, setStatus] = useState('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [jobMetrics, setJobMetrics] = useState({ total: 0, complete: 0, incomplete: 0 });

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [resumesData, jobsData] = await Promise.all([fetchResumes(), fetchAllJobs()]);
                setResumes(resumesData);
                setJobs(jobsData);
                if (resumesData.length > 0) {
                    handleSelectResume(resumesData[0].id);
                }
            } catch (error) {
                console.error(error);
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
            setJobMetrics({ total: totalCount, complete: completeCount, incomplete: totalCount - completeCount });
        }
    }, [jobs]);

    const handleSelectResume = useCallback(async (id) => {
        setSelectedResumeId(id);
        if (!id) {
            setSelectedResume(null); setMatchedJobs([]); setSelectedJob(null); setStatus('idle');
            return;
        }
        setStatus('loading'); setErrorMessage('');
        try {
            const data = await fetchResumeById(id);
            setSelectedResume(data);
            setStatus('idle');
        } catch (error) {
            console.error(error); setErrorMessage(error.message || `Failed to load resume.`); setStatus('error');
        }
    }, []);

    const handleMatch = () => {
        if (!selectedResume || !selectedResume.hard_skills) {
            setErrorMessage('Please select a resume with skills to start matching.'); setStatus('error');
            return;
        }
        setStatus('matching'); setErrorMessage(''); setMatchedJobs([]); setSelectedJob(null);
        setTimeout(() => {
            const sortedJobs = findBestMatches(jobs, selectedResume);
            setMatchedJobs(sortedJobs);
            setSelectedJob(sortedJobs.length > 0 ? sortedJobs[0] : null);
            setStatus('success');
        }, 500);
    };

    const handleMarkAsApplied = useCallback(async (jobUrn) => {
        try {
            setErrorMessage('');
            const updatedJobData = await markJobAsApplied(jobUrn);
            const updateJobState = (j) => (j.urn === jobUrn ? { ...j, ...updatedJobData.job } : j);
            setJobs(prev => prev.map(updateJobState));
            setMatchedJobs(prev => prev.map(updateJobState));
            if (selectedJob?.urn === jobUrn) {
                setSelectedJob(prev => ({ ...prev, ...updatedJobData.job }));
            }
        } catch (error) {
            console.error("Error marking job as applied:", error);
            setErrorMessage(error.message || 'An unexpected error occurred.');
        }
    }, [selectedJob?.urn]);

    const StatusIndicator = () => {
        if (status === 'idle' && matchedJobs.length === 0) return <div className="p-8 text-center text-gray-500"><Target size={48} className="mx-auto mb-4 text-gray-400" /><h3 className="text-xl font-semibold">Ready to Match</h3><p>Select your resume and click "Find Best Matches".</p></div>;
        if (status === 'matching') return <div className="p-8 text-center text-gray-500"><svg className="animate-spin mx-auto h-12 w-12 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p className="mt-4">Finding the best opportunities for you...</p></div>;
        if (status === 'success' && matchedJobs.length === 0) return <div className="p-8 text-center text-gray-500"><h3 className="text-xl font-semibold">No Matching Jobs Found</h3><p>We couldn't find any jobs that match the skills in the selected resume.</p></div>;
        return null;
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            <div className="flex h-screen">
                <div className="flex flex-col flex-shrink-0 w-[35%] max-w-md border-r border-gray-200 dark:border-gray-700">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2"><Award size={24} className="text-sky-500" /> Job Matcher</h2>
                        <div>
                            <label htmlFor="resume-select" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">1. Select your resume</label>
                            <select id="resume-select" value={selectedResumeId} onChange={(e) => handleSelectResume(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-sky-500">
                                <option value="">-- Load a resume --</option>
                                {resumes.map(resume => <option key={resume.id} value={resume.id}>{resume.name}</option>)}
                            </select>
                        </div>
                        {jobMetrics.total > 0 && <div className="text-xs text-center text-gray-500 dark:text-gray-400 space-y-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg"><p>Analyzing <strong>{jobMetrics.total}</strong> jobs</p><p><span className="text-green-600 dark:text-green-400">{jobMetrics.complete} complete</span><span className="mx-1">/</span><span className="text-yellow-600 dark:text-yellow-400">{jobMetrics.incomplete} incomplete</span></p></div>}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">2. Find your matches</label>
                            <button onClick={handleMatch} disabled={!selectedResumeId || status === 'matching'} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 transition-all disabled:bg-gray-500 disabled:cursor-not-allowed"><BarChart2 size={20} />{status === 'matching' ? 'Analyzing...' : 'Find Best Matches'}</button>
                        </div>
                        {errorMessage && <p className="text-sm text-red-500 dark:text-red-400 text-center p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">{errorMessage}</p>}
                    </div>
                    <div className="flex-grow overflow-y-auto">
                        <StatusIndicator />
                        {matchedJobs.length > 0 && matchedJobs.map(job => <MatchedJobItem key={job.urn} job={job} onSelect={setSelectedJob} isSelected={selectedJob?.urn === job.urn} />)}
                    </div>
                </div>
                <main className="flex-grow bg-white dark:bg-gray-800/50">
                    <JobDetailView
                        job={selectedJob}
                        resume={selectedResume}
                        onMarkAsApplied={handleMarkAsApplied}
                    />
                </main>
            </div>
        </div>
    );
};

export default Match;
