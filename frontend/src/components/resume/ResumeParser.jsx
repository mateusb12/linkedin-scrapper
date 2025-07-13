import React, { useState, useEffect, useRef } from "react";
import mockResumeContent from "../../data/backend_resume.md?raw";
import ExtractedResumeInformation from "./ExtractedResumeInformation.jsx";
import * as resumeService from "../../services/ResumeService.js";
import { parseResume, reconstructMarkdown } from "../../utils/resumeUtils.js";
import BackendData from "./ResumeBackendData.jsx";

// #region Icons
const UploadCloudIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /> <path d="M12 12v9" /> <path d="m16 16-4-4-4 4" /> </svg> );
const FileTextIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /> <polyline points="14 2 14 8 20 8" /> <line x1="16" x2="8" y1="13" y2="13" /> <line x1="16" x2="8" y1="17" y2="17" /> <line x1="10" x2="8" y1="9" y2="9" /> </svg> );
const BriefcaseIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <rect width="20" height="14" x="2" y="7" rx="2" ry="2" /> <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /> </svg> );
const GraduationCapIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <path d="M22 10v6M2 10l10-5 10 5-10 5z" /> <path d="M6 12v5c3 3 9 3 12 0v-5" /> </svg> );
const BotIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <path d="M12 8V4H8" /> <rect width="16" height="12" x="4" y="8" rx="2" /> <path d="M2 14h2" /> <path d="M20 14h2" /> <path d="M15 13v2" /> <path d="M9 13v2" /> </svg> );
const DatabaseIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <ellipse cx="12" cy="5" rx="9" ry="3" /> <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /> <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /> </svg> );
const PlusCircleIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <circle cx="12" cy="12" r="10" /> <line x1="12" y1="8" x2="12" y2="16" /> <line x1="8" y1="12" x2="16" y2="12" /> </svg> );
const TrashIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <path d="M3 6h18" /> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /> </svg> );
const SaveIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /> <polyline points="17 21 17 13 7 13 7 21" /> <polyline points="7 3 7 8 15 8" /> </svg> );
// #endregion

function ResumeParser() {
    // State for file handling, parsing, and editing
    const [editableContent, setEditableContent] = useState(mockResumeContent);
    const [fileName, setFileName] = useState("backend_resume.md");
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState(null);
    const [extractedData, setExtractedData] = useState(null);

    // State for saving data to the backend
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState({ message: '', isError: false });

    const fileInputRef = useRef(null);

    // CRUD states
    const [resumes, setResumes] = useState([]);
    const [selectedResumeId, setSelectedResumeId] = useState('');
    const [resumeName, setResumeName] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        loadResumes();
    }, []);

    const loadResumes = async () => {
        try {
            const data = await resumeService.fetchResumes();
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
                    setEditableContent(content);
                    setFileName(file.name);
                    setError(null);
                    setExtractedData(null);
                    setSaveStatus({ message: '', isError: false });

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
        if (!editableContent) {
            setError("Please upload a resume or write in the editor.");
            return;
        }
        setIsParsing(true);
        setError(null);
        setSaveStatus({ message: '', isError: false });
        setTimeout(() => {
            try {
                const data = parseResume(editableContent);
                setExtractedData(data);
                if (!resumeName) {
                    setResumeName(data.name);
                }
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
            setSaveStatus({ message: 'No extracted data. Please click "Analyze" after making changes.', isError: true });
            return;
        }
        if (!resumeName.trim()) {
            setSaveStatus({ message: 'Resume name cannot be empty.', isError: true });
            return;
        }

        setIsSaving(true);
        setSaveStatus({ message: '', isError: false });

        const payload = {
            name: resumeName,
            hard_skills: extractedData.skills,
            professional_experience: extractedData.experiences,
            education: extractedData.educations,
        };

        try {
            const result = await resumeService.createResume(payload);
            setSaveStatus({ message: `Resume '${result.name}' created successfully!`, isError: false });
            await loadResumes();
            handleNew();
        } catch (error) {
            console.error('Create error:', error);
            setSaveStatus({ message: error.message, isError: true });
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedResumeId || !extractedData) {
            setSaveStatus({ message: 'No resume selected or no data to update. Please "Analyze" first.', isError: true });
            return;
        }

        setIsSaving(true);
        setSaveStatus({ message: '', isError: false });

        const payload = {
            name: resumeName,
            hard_skills: extractedData.skills,
            professional_experience: extractedData.experiences,
            education: extractedData.educations,
        };

        try {
            const result = await resumeService.updateResume(selectedResumeId, payload);
            setSaveStatus({ message: result.message, isError: false });
            await loadResumes();
        } catch (error) {
            console.error('Update error:', error);
            setSaveStatus({ message: error.message, isError: true });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedResumeId) return;
        const resumeToDelete = resumes.find(r => r.id === parseInt(selectedResumeId));
        // Using a simple confirm dialog for this example. In a real app, use a custom modal.
        if (!window.confirm(`Are you sure you want to delete the resume "${resumeToDelete?.name}"?`)) return;

        setIsDeleting(true);
        setSaveStatus({ message: '', isError: false });

        try {
            const result = await resumeService.deleteResume(selectedResumeId);
            setSaveStatus({ message: result.message, isError: false });
            await loadResumes();
            handleNew();
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
            const data = await resumeService.fetchResumeById(id);
            const extracted = {
                name: data.name,
                skills: data.hard_skills,
                experiences: data.professional_experience,
                educations: data.education,
            };

            const reconstructedMd = reconstructMarkdown(extracted);
            setEditableContent(reconstructedMd);
            setExtractedData(extracted);
            setResumeName(data.name);
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
        setEditableContent(mockResumeContent);
        setFileName("backend_resume.md");
        setResumeName('');
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
                        Upload, edit, analyze, and manage your Markdown resumes.
                    </p>
                </header>

                <div className="max-w-4xl mx-auto flex flex-col gap-8">
                    {/* Section 1: Upload, Edit, and Control */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2">Resume Management</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label htmlFor="resume-select" className="block text-sm font-medium text-gray-400 mb-1">Select an Existing Resume</label>
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
                            <div>
                                <label htmlFor="resume-name" className="block text-sm font-medium text-gray-400 mb-1">Resume Name</label>
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
                            <p className="mt-4 text-gray-400"><span className="font-semibold text-cyan-400">Click to upload</span> a new .md file</p>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".md" />
                        </div>

                        {fileName && (
                            <div className="mt-4 bg-gray-700 p-3 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileTextIcon className="h-5 w-5 text-cyan-400" />
                                    <span className="text-gray-300">{fileName}</span>
                                </div>
                            </div>
                        )}

                        <div className="mt-6">
                            <label htmlFor="markdown-editor" className="block text-sm font-medium text-gray-400 mb-1">
                                Resume Editor
                            </label>
                            <textarea
                                id="markdown-editor"
                                value={editableContent}
                                onChange={(e) => setEditableContent(e.target.value)}
                                className="w-full h-64 bg-gray-900 border border-gray-600 rounded-md p-3 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                placeholder="Your resume markdown will appear here..."
                            />
                        </div>

                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <button onClick={handleNew} className="w-full bg-gray-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors duration-300 flex items-center justify-center gap-2"> <PlusCircleIcon className="h-5 w-5" /> New </button>
                            <button onClick={handleAnalyze} disabled={isParsing || !editableContent} className="w-full bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-cyan-600 transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"> {isParsing ? 'Analyzing...' : <><BotIcon className="h-5 w-5" /> Analyze</>} </button>
                            {selectedResumeId ? (
                                <button onClick={handleUpdate} disabled={isSaving || !extractedData} className="w-full bg-green-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-600 transition-colors duration-300 disabled:bg-gray-600 flex items-center justify-center gap-2"> {isSaving ? 'Updating...' : <><SaveIcon className="h-5 w-5" /> Update</>} </button>
                            ) : (
                                <button onClick={handleCreate} disabled={isSaving || !extractedData} className="w-full bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-600 transition-colors duration-300 disabled:bg-gray-600 flex items-center justify-center gap-2"> {isSaving ? 'Saving...' : <><DatabaseIcon className="h-5 w-5" /> Create</>} </button>
                            )}
                            <button onClick={handleDelete} disabled={isDeleting || !selectedResumeId} className="w-full bg-red-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-600 transition-colors duration-300 disabled:bg-gray-600 flex items-center justify-center gap-2"> {isDeleting ? 'Deleting...' : <><TrashIcon className="h-5 w-5" /> Delete</>} </button>
                        </div>
                        {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
                        {saveStatus.message && (
                            <p className={`mt-4 text-center ${saveStatus.isError ? 'text-red-400' : 'text-green-400'}`}>
                                {saveStatus.message}
                            </p>
                        )}
                    </div>

                    {/* Section 2: Extracted Data */}
                    <ExtractedResumeInformation extractedData={extractedData} isParsing={isParsing} />

                    <BackendData extractedData={extractedData} resumeName={resumeName} />
                </div>
            </div>
        </div>
    );
}

export default ResumeParser;
