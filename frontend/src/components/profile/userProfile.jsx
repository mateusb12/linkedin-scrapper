import React, { useState, useEffect } from 'react';
import {initialProfile, initialResumes} from "./profileDummyData.js";
import {
    User,
    Mail,
    Phone,
    MapPin,
    Linkedin,
    Github,
} from 'lucide-react';

//=================================================================
// 0. STYLES - SINGLE SOURCE OF TRUTH
//=================================================================

// The palette holds all the color definitions.
// Tweak these values to change the theme of the entire component.
const palette = {
    // Background colors
    bg: {
        page: 'bg-gray-900',
        card: 'bg-gray-800',
        input: 'bg-gray-700',
        nestedCard: 'bg-gray-700',
        previewTextarea: 'bg-gray-900',
    },
    // Text colors
    text: {
        primary: 'text-gray-200',
        secondary: 'text-gray-400',
        light: 'text-white',
        dangerHover: 'hover:text-red-500',
    },
    // Border colors
    border: {
        primary: 'border-gray-700',
        secondary: 'border-gray-900',
        focus: 'focus:border-emerald-500',
        previewTextarea: 'border-gray-600',
    },
    // Accent & Action colors
    action: {
        primary: 'bg-blue-500',
        primaryHover: 'hover:bg-blue-600',
        secondary: 'bg-slate-600',
        secondaryHover: 'hover:bg-slate-500',
        markdown: 'bg-purple-700',
        markdownHover: 'hover:bg-purple-800',
        success: 'bg-amber-600',
        successHover: 'hover:bg-amber-700',
        focusRing: 'focus:ring-amber-600',
    },
    // State-based colors/styles
    state: {
        disabled: 'disabled:opacity-50',
        disabledTextHover: 'disabled:hover:text-gray-400',
    },
};

// The styleguide composes the palette into reusable component classes.
const styleguide = {
    input: `w-full ${palette.bg.input} border ${palette.border.secondary} ${palette.text.primary} rounded-md shadow-sm py-2 px-3 ${palette.action.focusRing} ${palette.border.focus} transition`,
    button: {
        primary: `${palette.action.primary} ${palette.action.primaryHover} ${palette.text.light} font-bold py-2 px-6 rounded-md transition shadow-md`,
        secondary: `${palette.action.secondary} ${palette.action.secondaryHover} ${palette.text.light} font-bold py-2 px-4 rounded-md transition w-full md:w-auto`,
        success: `mt-2 text-sm ${palette.action.success} ${palette.action.successHover} ${palette.text.light} py-1 px-3 rounded-md transition`,
        markdown: `${palette.action.markdown} ${palette.action.markdownHover} ${palette.text.light} font-bold py-2 px-4 rounded-md transition`,
    },
    iconButton: {
        remove: `ml-2 p-1 ${palette.text.secondary} ${palette.text.dangerHover} ${palette.state.disabled} ${palette.state.disabledTextHover} transition`,
        delete: `absolute top-2 right-2 ${palette.text.secondary} ${palette.text.dangerHover} transition`,
    },
    label: `block text-sm font-medium ${palette.text.secondary} mb-1`,
    previewTextarea: `${palette.bg.previewTextarea} ${palette.border.previewTextarea} border ${palette.text.primary} font-mono text-sm w-full rounded-md p-4 transition`,
};

// Renaming for easier integration into existing code structure
const inputClasses = styleguide.input;


//=================================================================
// 1. ICONS & REUSABLE COMPONENTS
//=================================================================

// Using inline SVGs to avoid adding new dependencies like lucide-react
const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
    </svg>
);

const MinusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
);


// A reusable component for creating a list of dynamic input fields
const DynamicInputSection = ({ title, items, setItems }) => {
    const handleAddItem = () => {
        setItems([...items, '']);
    };

    const handleRemoveItem = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleItemChange = (index, value) => {
        const newItems = [...items];
        newItems[index] = value;
        setItems(newItems);
    };

    const getLabelSuffix = () => {
        const lower = title.toLowerCase();
        if (lower.includes("positive")) return "Positive Keyword";
        if (lower.includes("negative")) return "Negative Keyword";
        if (lower.includes("language")) return "Language";
        if (lower.includes("hard skills")) return "Skill";
        return "Item";
    };

    return (
        <div>
            <label className={`${styleguide.label} mb-2`}>{title}</label>
            {items.map((item, index) => (
                <div key={index} className="flex items-center mb-2">
                    <input
                        type="text"
                        value={item}
                        onChange={(e) => handleItemChange(index, e.target.value)}
                        className={inputClasses}
                        placeholder={`Enter ${getLabelSuffix().toLowerCase()}`}
                    />
                    <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className={styleguide.iconButton.remove}
                        disabled={items.length <= 1}
                    >
                        <MinusIcon />
                    </button>
                </div>
            ))}

            <button
                type="button"
                onClick={handleAddItem}
                className={styleguide.button.success}
            >
                + Add {getLabelSuffix()}
            </button>
        </div>
    );
};

// A component to preview the generated markdown for a section
const MarkdownPreview = ({ sectionTitle, markdownContent }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Don't render the button if there's no content to preview
    if (!markdownContent) return null;

    return (
        <div className="mt-4">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={styleguide.button.markdown}
            >
                {isOpen ? 'Hide Markdown' : 'Preview Section Markdown'}
            </button>
            {isOpen && (
                <div className="mt-3">
                    <label className={styleguide.label}>{sectionTitle} Markdown Preview</label>
                    <textarea
                        readOnly
                        value={markdownContent}
                        className={styleguide.previewTextarea}
                        rows={Math.max(5, markdownContent.split('\n').length + 1)}
                        style={{ resize: 'vertical' }}
                    />
                </div>
            )}
        </div>
    );
};


//=================================================================
// 3. PROFILE DETAILS COMPONENT
//=================================================================
const ProfileDetails = ({ profile, setProfile }) => {
    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile({ ...profile, [name]: value });
    };

    const handleArrayChange = (fieldName, newArray) => {
        setProfile({ ...profile, [fieldName]: newArray });
    };

    const handleSaveProfile = () => {
        console.log("Saving Profile Data:", profile);
        alert("Profile data saved! (Check console)");
    };

    const iconSize = 5;

    return (
        <div className={`${palette.bg.card} p-6 rounded-lg shadow-lg`}>
            <h2 className={`text-2xl font-bold ${palette.text.light} mb-6 border-b ${palette.border.primary} pb-3`}>👤 Profile Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <div className="flex items-center gap-1 pb-1">
                        <User className={`h-${iconSize} w-${iconSize}`} /> Name
                    </div>
                    <input type="text" name="name" value={profile.name} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                    <div className="flex items-center gap-1 pb-1">
                        <Mail className={`h-${iconSize} w-${iconSize}`} /> Email
                    </div>
                    <input type="email" name="email" value={profile.email} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                    <div className="flex items-center gap-1 pb-1">
                        <Phone className={`h-${iconSize} w-${iconSize}`} /> Phone
                    </div>
                    <input type="tel" name="phone" value={profile.phone} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                    <div className="flex items-center gap-1 pb-1">
                        <MapPin className={`h-${iconSize} w-${iconSize}`} /> Location
                    </div>
                    <input type="text" name="location" value={profile.location} onChange={handleChange} className={inputClasses} />
                </div>
                <div className="md:col-span-2">
                    <div className="flex items-center gap-1 pb-1">
                        <Linkedin className={`h-${iconSize} w-${iconSize}`} /> LinkedIn URL
                    </div>
                    <input type="text" name="linkedin" value={profile.linkedin} onChange={handleChange} className={inputClasses} />
                </div>
                <div className="md:col-span-2">
                    <div className="flex items-center gap-1 pb-1">
                        <Github className={`h-${iconSize} w-${iconSize}`} /> GitHub URL
                    </div>
                    <input type="text" name="github" value={profile.github} onChange={handleChange} className={inputClasses} />
                </div>
                <div className="md:col-span-2"><DynamicInputSection title="Languages" items={profile.languages || []} setItems={(newItems) => handleArrayChange('languages', newItems)} /></div>
                <div className="md:col-span-2"><DynamicInputSection title="Positive Keywords" items={profile.positive_keywords || []} setItems={(newItems) => handleArrayChange('positive_keywords', newItems)} /></div>
                <div className="md:col-span-2"><DynamicInputSection title="Negative Keywords" items={profile.negative_keywords || []} setItems={(newItems) => handleArrayChange('negative_keywords', newItems)} /></div>
            </div>
            <div className={`flex justify-end mt-6 pt-6 border-t ${palette.border.primary}`}>
                <button onClick={handleSaveProfile} className={styleguide.button.primary}>
                    Save Profile
                </button>
            </div>
        </div>
    );
};

//=================================================================
// 4. RESUME SECTION COMPONENT
//=================================================================
const ResumeSection = ({
                           resumes,
                           selectedResume,
                           setSelectedResumeId,
                           setResumes,
                           generateHardSkillsMarkdown,
                           generateExperienceMarkdown,
                           generateEducationMarkdown,
                           onToggleFullPreview,
                       }) => {
    if (!resumes || resumes.length === 0) return <p>No resumes found.</p>;

    const handleSelectChange = (e) => setSelectedResumeId(Number(e.target.value));

    const handleResumeFieldChange = (fieldName, value) => {
        const updatedResumes = resumes.map(r =>
            r.id === selectedResume.id ? { ...r, [fieldName]: value } : r
        );
        setResumes(updatedResumes);
    };

    const handleNestedChange = (e, index, section) => {
        const { name, value } = e.target;
        const updatedSection = [...selectedResume[section]];
        updatedSection[index] = { ...updatedSection[index], [name]: value };
        handleResumeFieldChange(section, updatedSection);
    };

    const addNestedItem = (section) => {
        const newItem = section === 'professional_experience'
            ? { id: `exp_${Date.now()}`, title: '', company: '', dates: '', description: [''] }
            : { id: `edu_${Date.now()}`, degree: '', school: '', dates: '' };

        const updatedSection = [...selectedResume[section], newItem];
        handleResumeFieldChange(section, updatedSection);
    };

    const removeNestedItem = (index, section) => {
        const updatedSection = selectedResume[section].filter((_, i) => i !== index);
        handleResumeFieldChange(section, updatedSection);
    };

    const handleSaveResume = () => {
        console.log("Saving Current Resume:", selectedResume);
        alert(`Resume "${selectedResume.name}" saved! (Check console)`);
    };

    return (
        <div className={`${palette.bg.card} p-6 rounded-lg shadow-lg mt-8`}>
            <div className={`flex flex-col md:flex-row justify-between md:items-center mb-6 border-b ${palette.border.primary} pb-3`}>
                <h2 className={`text-2xl font-bold ${palette.text.light} mb-3 md:mb-0`}>📄 Resumes</h2>
                <select onChange={handleSelectChange} value={selectedResume?.id || ''} className={`${inputClasses} md:max-w-xs`}>
                    {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
            </div>

            {selectedResume && (
                <div>
                    <div className="space-y-6">
                        <div>
                            <label className={styleguide.label}>Resume Name</label>
                            <input type="text" name="name" value={selectedResume.name} onChange={(e) => handleResumeFieldChange('name', e.target.value)} className={inputClasses} />
                        </div>

                        <div>
                            <DynamicInputSection
                                title="Hard Skills"
                                items={selectedResume.hard_skills || []}
                                setItems={(newSkills) => handleResumeFieldChange('hard_skills', newSkills)}
                            />
                            <MarkdownPreview
                                sectionTitle="Hard Skills"
                                markdownContent={generateHardSkillsMarkdown(selectedResume.hard_skills)}
                            />
                        </div>


                        {/* Professional Experience Section */}
                        <div className="space-y-4">
                            <h3 className={`text-xl font-semibold ${palette.text.primary} pt-4 border-t ${palette.border.primary}`}>Professional Experience</h3>
                            {selectedResume.professional_experience.map((exp, index) => (
                                <div key={exp.id} className={`${palette.bg.nestedCard} p-4 rounded-md border ${palette.border.secondary} relative`}>
                                    <button onClick={() => removeNestedItem(index, 'professional_experience')} className={styleguide.iconButton.delete}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                        <input type="text" name="title" value={exp.title} placeholder="Title" onChange={e => handleNestedChange(e, index, 'professional_experience')} className={inputClasses} />
                                        <input type="text" name="company" value={exp.company} placeholder="Company" onChange={e => handleNestedChange(e, index, 'professional_experience')} className={inputClasses} />
                                        <input type="text" name="dates" value={exp.dates} placeholder="Dates" onChange={e => handleNestedChange(e, index, 'professional_experience')} className={inputClasses} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={styleguide.label}>Description (Key Points)</label>
                                        {(exp.description || []).map((point, dIndex) => (
                                            <div key={dIndex} className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={point}
                                                    onChange={e => {
                                                        const newDesc = [...exp.description];
                                                        newDesc[dIndex] = e.target.value;
                                                        handleNestedChange({ target: { name: 'description', value: newDesc } }, index, 'professional_experience');
                                                    }}
                                                    className={inputClasses}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newDesc = exp.description.filter((_, i) => i !== dIndex);
                                                        handleNestedChange({ target: { name: 'description', value: newDesc } }, index, 'professional_experience');
                                                    }}
                                                    className={styleguide.iconButton.remove}
                                                    disabled={exp.description.length <= 1}
                                                >
                                                    <MinusIcon />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newDesc = [...(exp.description || []), ''];
                                                handleNestedChange({ target: { name: 'description', value: newDesc } }, index, 'professional_experience');
                                            }}
                                            className={styleguide.button.success}
                                        >
                                            + Add Key Point
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => addNestedItem('professional_experience')} className={styleguide.button.success}>
                                + Add Experience
                            </button>
                            <MarkdownPreview
                                sectionTitle="Professional Experience"
                                markdownContent={generateExperienceMarkdown(selectedResume.professional_experience)}
                            />
                        </div>

                        {/* Education Section */}
                        <div className="space-y-4">
                            <h3 className={`text-xl font-semibold ${palette.text.primary} pt-4 border-t ${palette.border.primary}`}>Education</h3>
                            {selectedResume.education.map((edu, index) => (
                                <div key={edu.id} className={`${palette.bg.nestedCard} p-4 rounded-md border ${palette.border.secondary} relative`}>
                                    <button onClick={() => removeNestedItem(index, 'education')} className={styleguide.iconButton.delete}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input type="text" name="degree" value={edu.degree} placeholder="Degree" onChange={e => handleNestedChange(e, index, 'education')} className={inputClasses} />
                                        <input type="text" name="school" value={edu.school} placeholder="School" onChange={e => handleNestedChange(e, index, 'education')} className={inputClasses} />
                                        <input type="text" name="dates" value={edu.dates} placeholder="Dates" onChange={e => handleNestedChange(e, index, 'education')} className={inputClasses} />
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => addNestedItem('education')} className={styleguide.button.success}>
                                + Add Education
                            </button>
                            <MarkdownPreview
                                sectionTitle="Education"
                                markdownContent={generateEducationMarkdown(selectedResume.education)}
                            />
                        </div>
                    </div>
                    <div className={`flex flex-col sm:flex-row justify-end items-center mt-6 pt-6 border-t ${palette.border.primary} space-y-3 sm:space-y-0 sm:space-x-4`}>
                        <button onClick={onToggleFullPreview} className={`${styleguide.button.markdown} w-full sm:w-auto`}>
                            {/* This is the new button */}
                            Preview Full Resume Markdown
                        </button>
                        <button onClick={handleSaveResume} className={`${styleguide.button.primary} w-full sm:w-auto`}>
                            Save Resume
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};


//=================================================================
// 5. MAIN PROFILE COMPONENT (The Parent)
//=================================================================
const UserProfile = () => {
    const [profile, setProfile] = useState(initialProfile);
    const [resumes, setResumes] = useState(initialResumes);
    const [selectedResumeId, setSelectedResumeId] = useState(initialResumes[0]?.id);
    const [showFullPreview, setShowFullPreview] = useState(false);
    const [fullResumeMarkdown, setFullResumeMarkdown] = useState('');

    const selectedResume = resumes.find(r => r.id === selectedResumeId);

    // --- MARKDOWN GENERATION LOGIC ---
    const generateProfileHeaderMarkdown = (profileData) => {
        if (!profileData) return '';
        const { name, email, phone, location, linkedin, github } = profileData;
        const linkedInText = linkedin ? `[LinkedIn](${linkedin})` : '';
        const githubText = github ? `[GitHub](${github})` : '';
        const contacts = [location, phone, email, linkedInText, githubText].filter(Boolean).join(' | ');
        return `# ${name || 'Your Name'}\n${contacts}`;
    };

    const generateHardSkillsMarkdown = (skills) => {
        if (!skills || skills.filter(s => s).length === 0) return '';
        return `## 🛠️ Hard Skills\n- ${skills.filter(s => s).join(', ')}`;
    };

    const generateExperienceMarkdown = (experiences) => {
        if (!experiences || experiences.length === 0) return '';
        const title = '## 💼 Professional Experience';
        let content = '';
        experiences.forEach(exp => {
            if (exp.title && exp.company && exp.dates) {
                content += `\n### ${exp.title}\n`;
                content += `**${exp.company}** | *${exp.dates}*\n`;
                (exp.description || []).forEach(point => {
                    if (point) content += `- ${point}\n`;
                });
            }
        });
        return content ? `${title}\n${content.trim()}` : '';
    };

    const generateEducationMarkdown = (educations) => {
        if (!educations || educations.length === 0) return '';
        const title = '## 🎓 Education';
        let content = '';
        educations.forEach(edu => {
            if (edu.degree && edu.school && edu.dates) {
                content += `\n### ${edu.degree}\n`;
                content += `**${edu.school}** | *${edu.dates}*\n`;
            }
        });
        return content ? `${title}\n${content.trim()}` : '';
    };

    const generateFullResumeMarkdown = () => {
        if (!profile || !selectedResume) return 'No profile or resume selected.';

        const header = generateProfileHeaderMarkdown(profile);
        const skills = generateHardSkillsMarkdown(selectedResume.hard_skills);
        const experience = generateExperienceMarkdown(selectedResume.professional_experience);
        const education = generateEducationMarkdown(selectedResume.education);

        return [header, skills, experience, education]
            .filter(Boolean) // Remove empty or null sections
            .join('\n\n---\n\n');
    };

    const handleToggleFullPreview = () => {
        // Always generate fresh markdown when opening
        if (!showFullPreview) {
            const markdown = generateFullResumeMarkdown();
            setFullResumeMarkdown(markdown);
        }
        setShowFullPreview(!showFullPreview);
    };

    useEffect(() => {
        console.log("Profile Data Updated:", profile);
    }, [profile]);

    useEffect(() => {
        console.log("Resumes Data Updated:", resumes);
    }, [resumes]);


    return (
        <div className={`${palette.bg.page} ${palette.text.primary} min-h-screen p-4 sm:p-6 lg:p-8`}>
            <div className="max-w-4xl mx-auto">
                <h1 className={`text-4xl font-extrabold ${palette.text.light} mb-8`}>Edit Profile & Resumes</h1>
                <ProfileDetails profile={profile} setProfile={setProfile} />
                <ResumeSection
                    resumes={resumes}
                    selectedResume={selectedResume}
                    setSelectedResumeId={setSelectedResumeId}
                    setResumes={setResumes}
                    generateHardSkillsMarkdown={generateHardSkillsMarkdown}
                    generateExperienceMarkdown={generateExperienceMarkdown}
                    generateEducationMarkdown={generateEducationMarkdown}
                    onToggleFullPreview={handleToggleFullPreview}
                />

                {/* This is the new Full Resume Preview Section */}
                {showFullPreview && (
                    <div className={`mt-8 ${palette.bg.card} p-6 rounded-lg shadow-lg`}>
                        <div className={`flex justify-between items-center mb-4 pb-3 border-b ${palette.border.primary}`}>
                            <h2 className={`text-2xl font-bold ${palette.text.light}`}>Full Resume Markdown Preview</h2>
                            <button onClick={handleToggleFullPreview} className={styleguide.button.secondary}>
                                Close Preview
                            </button>
                        </div>
                        <textarea
                            readOnly
                            value={fullResumeMarkdown}
                            className={styleguide.previewTextarea}
                            rows={30}
                            style={{ resize: 'vertical' }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProfile;