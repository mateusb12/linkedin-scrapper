import React, { useState, useEffect, useRef } from "react";
import mockResumeContent from "../../data/backend_resume.md?raw";

// Define the base URL for the API endpoint
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";


// Helper function to parse a specific section from the resume markdown
const parseSection = (text, startHeading) => {
    const lines = text.split('\n');
    let content = [];
    let inSection = false;
    for (const line of lines) {
        if (line.startsWith(startHeading)) {
            inSection = true;
            continue;
        }
        if (inSection && (line.startsWith('---') || line.startsWith('## '))) {
            break;
        }
        if (inSection && line.trim() !== '') {
            content.push(line);
        }
    }
    return content;
};

// Main parser function to extract all relevant information
const parseResume = (markdownText) => {
    // Extract name from the first H1 tag
    const nameMatch = markdownText.match(/^#\s+(.*)/);
    const name = nameMatch ? nameMatch[1].trim() : 'Could not load resume name';

    const skillsSection = parseSection(markdownText, '## Habilidades');
    const skills = skillsSection.flatMap(line => {
        const parts = line.split(':');
        if (parts.length > 1) {
            return parts[1].split(',').map(skill => skill.trim());
        }
        return [];
    });

    const experienceSection = parseSection(markdownText, '## Experiências Profissionais');
    const experiences = [];
    let currentExperience = null;
    for (const line of experienceSection) {
        if (line.startsWith('###')) {
            if (currentExperience) experiences.push(currentExperience);
            const [title, date] = line.replace('###', '').split('(');
            currentExperience = {
                title: `${title.trim()}${date ? `(${date}` : ''}`,
                details: []
            };
        } else if (currentExperience && line.trim().startsWith('-')) {
            currentExperience.details.push(line.trim().substring(1).trim());
        }
    }
    if (currentExperience) experiences.push(currentExperience);

    const educationSection = parseSection(markdownText, '## Educação');
    const educations = [];
    for (let i = 0; i < educationSection.length; i++) {
        const line = educationSection[i];
        if (line.startsWith('- **')) {
            const nextLine = educationSection[i + 1] || '';
            const [location, date] = nextLine.split('|');

            educations.push({
                degree: line.replace('- **', '').split('**')[0].trim() + ' ' + line.split('–')[1].trim(),
                date: date ? date.trim().replace(/\*/g, '') : '',
                details: [location ? location.trim().replace(/\*/g, '') : '']
            });
            i++;
        }
    }

    return { name, skills, experiences, educations };
};


// Icons for UI (assuming they are defined as before)
const UploadCloudIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
        <path d="M12 12v9" />
        <path d="m16 16-4-4-4 4" />
    </svg>
);
const FileTextIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
);
const BriefcaseIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
);
const GraduationCapIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
);
const BotIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
    </svg>
);
const DatabaseIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
);
const PlusCircleIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
);
const TrashIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);
const SaveIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </svg>
);



function ResumeParser() {
    // State for file handling and parsing
    const [resumeContent, setResumeContent] = useState(mockResumeContent);
    const [fileName, setFileName] = useState("backend_resume.md");
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState(null);
    const [extractedData, setExtractedData] = useState(null);

    // State for saving data to the backend
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState({ message: '', isError: false });

    const fileInputRef = useRef(null);

    // CRUD states
    const [resumes, setResumes] = useState([]); // <-- Changed from resumeIds
    const [selectedResumeId, setSelectedResumeId] = useState('');
    const [resumeName, setResumeName] = useState(''); // <-- New state for the name
    const [isDeleting, setIsDeleting] = useState(false);


    // Fetch all resumes on component mount
    useEffect(() => {
        fetchResumes();
    }, []);

    const fetchResumes = async () => {
        try {
            // Fetch the full list of resumes (id and name)
            const response = await fetch(`${API_BASE}/jobs/`);
            if (!response.ok) throw new Error('Failed to fetch resumes');
            const data = await response.json();
            setResumes(data);
        } catch (error) {
            setSaveStatus({ message: error.message, isError: true });
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.name.endsWith('.md')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    setResumeContent(content);
                    setFileName(file.name);
                    setError(null);
                    setExtractedData(null);
                    setSaveStatus({ message: '', isError: false });

                    // Automatically parse and set the name from the file
                    const data = parseResume(content);
                    setResumeName(data.name);
                };
                reader.readAsText(file);
            } else {
                setError("Please upload a Markdown (.md) file.");
            }
        }
    };

    const handleAnalyze = () => {
        if (!resumeContent) {
            setError("Please upload a resume first.");
            return;
        }
        setIsParsing(true);
        setError(null);
        setSaveStatus({ message: '', isError: false });
        setTimeout(() => {
            try {
                const data = parseResume(resumeContent);
                setExtractedData(data);
                setResumeName(data.name); // Set name on analysis
            } catch (err) {
                setError("Failed to parse the resume. Please check the format.");
                console.error(err);
            } finally {
                setIsParsing(false);
            }
        }, 1000);
    };

    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    const handleCreate = async () => {
        if (!extractedData) {
            setSaveStatus({ message: 'No extracted data to save. Please analyze a resume first.', isError: true });
            return;
        }
        if (!resumeName.trim()) {
            setSaveStatus({ message: 'Resume name cannot be empty.', isError: true });
            return;
        }

        setIsSaving(true);
        setSaveStatus({ message: '', isError: false });

        const payload = {
            name: resumeName, // <-- Add name to payload
            hard_skills: extractedData.skills,
            professional_experience: extractedData.experiences,
            education: extractedData.educations,
        };

        try {
            const response = await fetch(`${API_BASE}/jobs/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `HTTP error! status: ${response.status}`);

            setSaveStatus({ message: `Resume '${result.name}' created successfully!`, isError: false });
            fetchResumes(); // Refresh the list of resumes
            handleNew(); // Clear form for next entry
        } catch (error) {
            console.error('Create error:', error);
            setSaveStatus({ message: error.message, isError: true });
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedResumeId || !extractedData) {
            setSaveStatus({ message: 'No resume selected or no data to update.', isError: true });
            return;
        }

        setIsSaving(true);
        setSaveStatus({ message: '', isError: false });

        const payload = {
            name: resumeName, // <-- Add name to payload
            hard_skills: extractedData.skills,
            professional_experience: extractedData.experiences,
            education: extractedData.educations,
        };

        try {
            const response = await fetch(`${API_BASE}/jobs/${selectedResumeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            setSaveStatus({ message: result.message, isError: false });
            fetchResumes(); // Refresh resume list to show the new name
        } catch (error) {
            console.error('Update error:', error);
            setSaveStatus({ message: error.message, isError: true });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedResumeId) {
            setSaveStatus({ message: 'Please select a resume to delete.', isError: true });
            return;
        }
        const resumeToDelete = resumes.find(r => r.id === parseInt(selectedResumeId));
        if (!window.confirm(`Are you sure you want to delete the resume "${resumeToDelete?.name}"?`)) {
            return;
        }

        setIsDeleting(true);
        setSaveStatus({ message: '', isError: false });

        try {
            const response = await fetch(`${API_BASE}/jobs/${selectedResumeId}`, {
                method: 'DELETE',
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            setSaveStatus({ message: result.message, isError: false });
            fetchResumes(); // Refresh list
            handleNew(); // Clear form
        } catch (error) {
            console.error('Delete error:', error);
            setSaveStatus({ message: error.message, isError: true });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSelectResume = async (id) => {
        setSelectedResumeId(id);
        if (!id) {
            handleNew();
            return;
        }

        setIsParsing(true);
        setSaveStatus({ message: '', isError: false });

        try {
            const response = await fetch(`${API_BASE}/jobs/${id}`);
            if (!response.ok) throw new Error(`Failed to fetch resume ${id}`);
            const data = await response.json();

            setResumeName(data.name); // <-- Set the name from fetched data
            setExtractedData({
                skills: data.hard_skills,
                experiences: data.professional_experience,
                educations: data.education,
            });
            setResumeContent("Resume loaded from database. You can edit the name or re-upload a file to update.");
            setFileName(`Loaded: ${data.name}`);
        } catch (error) {
            setError(error.message);
            setExtractedData(null);
        } finally {
            setIsParsing(false);
        }
    };

    const handleNew = () => {
        setSelectedResumeId('');
        setResumeContent(mockResumeContent);
        setFileName("backend_resume.md");
        setResumeName(''); // <-- Clear the name
        setExtractedData(null);
        setError(null);
        setSaveStatus({ message: '', isError: false });
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };


    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-center text-cyan-400">Resume Analyzer</h1>
                    <p className="text-center text-gray-400 mt-2">
                        Upload, analyze, and manage your Markdown resumes.
                    </p>
                </header>

                <div className="max-w-4xl mx-auto flex flex-col gap-8">
                    {/* Section 1: Upload and Control */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2">Resume Management</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            {/* Resume Selection Dropdown */}
                            <div>
                                <label htmlFor="resume-select" className="block text-sm font-medium text-gray-400 mb-1">
                                    Select an Existing Resume
                                </label>
                                <select
                                    id="resume-select"
                                    value={selectedResumeId}
                                    onChange={(e) => handleSelectResume(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">-- Load a saved resume --</option>
                                    {resumes.map(resume => (
                                        <option key={resume.id} value={resume.id}>{resume.name}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Resume Name Input */}
                            <div>
                                <label htmlFor="resume-name" className="block text-sm font-medium text-gray-400 mb-1">
                                    Resume Name
                                </label>
                                <input
                                    type="text"
                                    id="resume-name"
                                    value={resumeName}
                                    onChange={(e) => setResumeName(e.target.value)}
                                    placeholder="Enter a name for the resume"
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>
                        </div>


                        <div
                            className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-cyan-400 hover:bg-gray-700/50 transition-all duration-300"
                            onClick={handleUploadClick}
                        >
                            <UploadCloudIcon className="mx-auto h-12 w-12 text-gray-500" />
                            <p className="mt-4 text-gray-400">
                                <span className="font-semibold text-cyan-400">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Markdown (.md) files only</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".md"
                            />
                        </div>

                        {fileName && (
                            <div className="mt-4 bg-gray-700 p-3 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileTextIcon className="h-5 w-5 text-cyan-400" />
                                    <span className="text-gray-300">{fileName}</span>
                                </div>
                            </div>
                        )}

                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* New/Clear Button */}
                            <button
                                onClick={handleNew}
                                className="w-full bg-gray-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors duration-300 flex items-center justify-center gap-2"
                            >
                                <PlusCircleIcon className="h-5 w-5" /> New
                            </button>
                            {/* Analyze Button */}
                            <button
                                onClick={handleAnalyze}
                                disabled={isParsing || !resumeContent}
                                className="w-full bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-cyan-600 transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isParsing ? 'Analyzing...' : <><BotIcon className="h-5 w-5" /> Analyze</>}
                            </button>

                            {/* Conditional Save/Update Button */}
                            {selectedResumeId ? (
                                <button
                                    onClick={handleUpdate}
                                    disabled={isSaving || !extractedData}
                                    className="w-full bg-green-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-600 transition-colors duration-300 disabled:bg-gray-600 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? 'Updating...' : <><SaveIcon className="h-5 w-5" /> Update</>}
                                </button>
                            ) : (
                                <button
                                    onClick={handleCreate}
                                    disabled={isSaving || !extractedData}
                                    className="w-full bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-600 transition-colors duration-300 disabled:bg-gray-600 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? 'Saving...' : <><DatabaseIcon className="h-5 w-5" /> Create</>}
                                </button>
                            )}

                            {/* Delete Button */}
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting || !selectedResumeId}
                                className="w-full bg-red-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-600 transition-colors duration-300 disabled:bg-gray-600 flex items-center justify-center gap-2"
                            >
                                {isDeleting ? 'Deleting...' : <><TrashIcon className="h-5 w-5" /> Delete</>}
                            </button>
                        </div>
                        {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
                        {saveStatus.message && (
                            <p className={`mt-4 text-center ${saveStatus.isError ? 'text-red-400' : 'text-green-400'}`}>
                                {saveStatus.message}
                            </p>
                        )}
                    </div>

                    {/* Section 2: Extracted Data (This section remains unchanged) */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2">Extracted Information</h2>
                        {!extractedData && !isParsing && (
                            <div className="text-center text-gray-500 py-16">
                                <BotIcon className="mx-auto h-16 w-16 text-gray-600" />
                                <p className="mt-4">Analysis results will appear here.</p>
                            </div>
                        )}
                        {isParsing && (
                            <div className="text-center text-gray-500 pt-16">
                                <svg className="animate-spin mx-auto h-12 w-12 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <p className="mt-4">Parsing your resume...</p>
                            </div>
                        )}
                        {extractedData && (
                            <div className="space-y-6">
                                {/* Skills */}
                                <div>
                                    <h3 className="text-xl font-semibold text-cyan-400 mb-3">🛠 Hard Skills</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {extractedData.skills.map((skill, index) => (
                                            <span key={index} className="bg-gray-700 text-cyan-300 text-sm font-medium px-3 py-1 rounded-full">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {/* Professional Experience */}
                                <div>
                                    <h3 className="text-xl font-semibold text-cyan-400 mb-3 flex items-center gap-2"><BriefcaseIcon /> Professional Experience</h3>
                                    <div className="space-y-4">
                                        {extractedData.experiences.map((exp, index) => (
                                            <div key={index} className="bg-gray-700/50 p-4 rounded-lg">
                                                <h4 className="font-bold text-gray-200">{exp.title}</h4>
                                                <ul className="list-disc list-inside text-gray-400 text-sm ml-2 mt-1">
                                                    {exp.details.map((detail, i) => (
                                                        <li key={i}>{detail}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Education */}
                                <div>
                                    <h3 className="text-xl font-semibold text-cyan-400 mb-3 flex items-center gap-2"><GraduationCapIcon /> Education</h3>
                                    <div className="space-y-4">
                                        {extractedData.educations.map((edu, index) => (
                                            <div key={index} className="bg-gray-700/50 p-4 rounded-lg">
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-bold text-gray-200">{edu.degree}</h4>
                                                    <span className="text-sm text-gray-500">{edu.date}</span>
                                                </div>
                                                {edu.details.map((detail, i) => (
                                                    <p key={i} className="text-gray-400 text-sm">{detail}</p>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ResumeParser;