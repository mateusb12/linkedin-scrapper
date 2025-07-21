import React, { useState, useEffect } from 'react';

//=================================================================
// 0. ICONS & REUSABLE COMPONENTS
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


// A simple utility for consistent input styling
const inputClasses = "w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 transition";

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

    // Generate a custom label like "Language", "Positive Keyword", etc.
    const getLabelSuffix = () => {
        const lower = title.toLowerCase();
        if (lower.includes("positive")) return "Positive Keyword";
        if (lower.includes("negative")) return "Negative Keyword";
        if (lower.includes("language")) return "Language";
        return "Item";
    };

    return (
        <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-2">{title}</label>
            {items.map((item, index) => (
                <div key={index} className="flex items-center mb-2">
                    <input
                        type="text"
                        value={item}
                        onChange={(e) => handleItemChange(index, e.target.value)}
                        className={inputClasses}
                    />
                    <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="ml-2 p-1 text-gray-400 hover:text-red-500 disabled:opacity-50 disabled:hover:text-gray-400 transition"
                        disabled={items.length <= 1}
                    >
                        <MinusIcon />
                    </button>
                </div>
            ))}

            <button
                type="button"
                onClick={handleAddItem}
                className="mt-2 text-sm bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded-md transition"
            >
                + Add {getLabelSuffix()}
            </button>
        </div>
    );
};


//=================================================================
// 1. DUMMY DATA
// Simulates the data from your backend.
//=================================================================
const initialProfile = {
    id: 1,
    name: 'Alex Doe',
    email: 'alex.doe@example.com',
    phone: '555-123-4567',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/alexdoe',
    github: 'github.com/alexdoe',
    portfolio: 'alexdoe.dev',
    languages: ['English', 'Spanish'],
    positive_keywords: ['Proactive', 'Team Player', 'Detail-oriented'],
    negative_keywords: ['Micromanagement', 'Legacy Systems'],
};

const initialResumes = [
    {
        id: 101,
        profile_id: 1,
        name: 'Software Engineer Resume',
        hard_skills: ['React', 'Node.js', 'Python', 'SQL', 'Docker', 'AWS'],
        professional_experience: [
            {
                id: 'exp1',
                title: 'Senior Frontend Developer',
                company: 'Tech Solutions Inc.',
                dates: 'Jan 2022 - Present',
                description: 'Led the development of a new client-facing dashboard using React, resulting in a 20% increase in user engagement. Mentored junior developers and established code review standards.'
            },
            {
                id: 'exp2',
                title: 'Software Engineer',
                company: 'Web Innovators',
                dates: 'Jun 2019 - Dec 2021',
                description: 'Built and maintained features for a large-scale e-commerce platform using Node.js and TypeScript. Optimized database queries, reducing page load times by 15%.'
            }
        ],
        education: [
            {
                id: 'edu1',
                degree: 'B.S. in Computer Science',
                school: 'University of Technology',
                dates: '2015 - 2019'
            }
        ]
    },
    {
        id: 102,
        profile_id: 1,
        name: 'Data Analyst Resume',
        hard_skills: ['Python', 'Pandas', 'SQL', 'Tableau', 'R', 'Scikit-learn'],
        professional_experience: [
            {
                id: 'exp3',
                title: 'Data Analyst',
                company: 'Data Insights LLC',
                dates: 'Jul 2020 - Present',
                description: 'Analyzed user data to provide actionable insights for the marketing team, leading to a 10% improvement in campaign ROI. Created automated reports using Tableau.'
            }
        ],
        education: [
            {
                id: 'edu2',
                degree: 'B.S. in Statistics',
                school: 'State University',
                dates: '2016 - 2020'
            }
        ]
    }
];


//=================================================================
// 2. PROFILE DETAILS COMPONENT
// Renders the editable fields for the main user profile.
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
        // Here you would typically make an API call to your backend
        alert("Profile data saved! (Check console)");
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-3">👤 Profile Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                    <input type="text" name="name" value={profile.name} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                    <input type="email" name="email" value={profile.email} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Phone</label>
                    <input type="tel" name="phone" value={profile.phone} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Location</label>
                    <input type="text" name="location" value={profile.location} onChange={handleChange} className={inputClasses} />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-1">LinkedIn URL</label>
                    <input type="text" name="linkedin" value={profile.linkedin} onChange={handleChange} className={inputClasses} />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-1">GitHub URL</label>
                    <input type="text" name="github" value={profile.github} onChange={handleChange} className={inputClasses} />
                </div>

                <DynamicInputSection title="Languages" items={profile.languages || []} setItems={(newItems) => handleArrayChange('languages', newItems)} />
                <DynamicInputSection title="Positive Keywords" items={profile.positive_keywords || []} setItems={(newItems) => handleArrayChange('positive_keywords', newItems)} />
                <DynamicInputSection title="Negative Keywords" items={profile.negative_keywords || []} setItems={(newItems) => handleArrayChange('negative_keywords', newItems)} />
            </div>
            <div className="flex justify-end mt-6 pt-6 border-t border-gray-700">
                <button onClick={handleSaveProfile} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-md transition shadow-md">
                    Save Profile
                </button>
            </div>
        </div>
    );
};

//=================================================================
// 3. RESUME SECTION COMPONENT
// Handles Browse and editing of multiple resumes.
//=================================================================
const ResumeSection = ({ resumes, selectedResume, setSelectedResumeId, setResumes }) => {
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
            ? { id: `exp_${Date.now()}`, title: '', company: '', dates: '', description: '' }
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
        // API call to save the currently selected resume would go here
        alert(`Resume "${selectedResume.name}" saved! (Check console)`);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mt-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 border-b border-gray-700 pb-3">
                <h2 className="text-2xl font-bold text-white mb-3 md:mb-0">📄 Resumes</h2>
                <select onChange={handleSelectChange} value={selectedResume?.id || ''} className={`${inputClasses} md:max-w-xs`}>
                    {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
            </div>

            {selectedResume && (
                <div>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Resume Name</label>
                            <input type="text" name="name" value={selectedResume.name} onChange={(e) => handleResumeFieldChange('name', e.target.value)} className={inputClasses} />
                        </div>

                        <DynamicInputSection
                            title="Hard Skills"
                            items={selectedResume.hard_skills || []}
                            setItems={(newSkills) => handleResumeFieldChange('hard_skills', newSkills)}
                        />

                        {/* Professional Experience Section */}
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-gray-200 pt-4 border-t border-gray-700">Professional Experience</h3>
                            {selectedResume.professional_experience.map((exp, index) => (
                                <div key={exp.id} className="bg-gray-700 p-4 rounded-md border border-gray-600 relative">
                                    <button onClick={() => removeNestedItem(index, 'professional_experience')} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                        <input type="text" name="title" value={exp.title} placeholder="Title" onChange={e => handleNestedChange(e, index, 'professional_experience')} className={inputClasses} />
                                        <input type="text" name="company" value={exp.company} placeholder="Company" onChange={e => handleNestedChange(e, index, 'professional_experience')} className={inputClasses} />
                                        <input type="text" name="dates" value={exp.dates} placeholder="Dates" onChange={e => handleNestedChange(e, index, 'professional_experience')} className={inputClasses} />
                                    </div>
                                    <textarea name="description" value={exp.description} placeholder="Description..." onChange={e => handleNestedChange(e, index, 'professional_experience')} className={`${inputClasses} h-24`} />
                                </div>
                            ))}
                            <button onClick={() => addNestedItem('professional_experience')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition w-full md:w-auto">
                                + Add Experience
                            </button>
                        </div>

                        {/* Education Section */}
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-gray-200 pt-4 border-t border-gray-700">Education</h3>
                            {selectedResume.education.map((edu, index) => (
                                <div key={edu.id} className="bg-gray-700 p-4 rounded-md border border-gray-600 relative">
                                    <button onClick={() => removeNestedItem(index, 'education')} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input type="text" name="degree" value={edu.degree} placeholder="Degree" onChange={e => handleNestedChange(e, index, 'education')} className={inputClasses} />
                                        <input type="text" name="school" value={edu.school} placeholder="School" onChange={e => handleNestedChange(e, index, 'education')} className={inputClasses} />
                                        <input type="text" name="dates" value={edu.dates} placeholder="Dates" onChange={e => handleNestedChange(e, index, 'education')} className={inputClasses} />
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => addNestedItem('education')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition w-full md:w-auto">
                                + Add Education
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-end mt-6 pt-6 border-t border-gray-700">
                        <button onClick={handleSaveResume} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-md transition shadow-md">
                            Save Resume
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};


//=================================================================
// 4. MAIN PROFILE COMPONENT (The Parent)
// This ties everything together.
//=================================================================
const UserProfile = () => {
    const [profile, setProfile] = useState(initialProfile);
    const [resumes, setResumes] = useState(initialResumes);
    const [selectedResumeId, setSelectedResumeId] = useState(initialResumes[0]?.id);

    const selectedResume = resumes.find(r => r.id === selectedResumeId);

    // Optional: Log state changes for debugging
    useEffect(() => {
        console.log("Profile Data Updated:", profile);
    }, [profile]);

    useEffect(() => {
        console.log("Resumes Data Updated:", resumes);
    }, [resumes]);


    return (
        <div className="bg-gray-900 text-gray-200 min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-extrabold text-white mb-8">Edit Profile & Resumes</h1>
                <ProfileDetails profile={profile} setProfile={setProfile} />
                <ResumeSection
                    resumes={resumes}
                    selectedResume={selectedResume}
                    setSelectedResumeId={setSelectedResumeId}
                    setResumes={setResumes}
                />
            </div>
        </div>
    );
};

export default UserProfile;
