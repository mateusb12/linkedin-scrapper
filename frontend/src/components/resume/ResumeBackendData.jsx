import React from 'react';

// #region Icons & Styled Components
const DatabaseIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
);

// Styled components for syntax highlighting
const JsonKey = ({ name }) => <span className="text-cyan-400">{`"${name}"`}</span>;
const JsonString = ({ value }) => <span className="text-green-300">{`"${value}"`}</span>;
const Bracket = ({ children, className }) => <span className={`text-gray-400 ${className}`}>{children}</span>;
const Comma = () => <span className="text-gray-400">,</span>;
// #endregion

function BackendData({ extractedData, resumeName }) {
    // Don't render the component if there's no data extracted yet
    if (!extractedData) {
        return null;
    }

    // Construct the payload object that mirrors the backend model
    const payload = {
        name: resumeName || extractedData.name,
        hard_skills: extractedData.skills || [],
        professional_experience: extractedData.experiences || [],
        education: extractedData.educations || [],
    };

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2 flex items-center gap-2">
                <DatabaseIcon className="w-6 h-6" />
                Backend Data
            </h2>
            <p className="text-sm text-gray-400 mb-4">
                This is the JSON payload that will be sent to the backend when you click "Create" or "Update".
            </p>

            {/* Styled JSON Viewer */}
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm space-y-1">
                <Bracket>{"{"}</Bracket>

                {/* Name */}
                <div className="pl-4">
                    <JsonKey name="name" />: <JsonString value={payload.name} /><Comma />
                </div>

                {/* Hard Skills */}
                <div className="pl-4">
                    <span><JsonKey name="hard_skills" />: </span>
                    <Bracket>{"["}</Bracket>
                    <div className="pl-4">
                        {payload.hard_skills.map((skill, index) => (
                            <span key={index} className="block">
                               <JsonString value={skill} />
                                {index < payload.hard_skills.length - 1 && <Comma />}
                           </span>
                        ))}
                    </div>
                    <Bracket>{"]"}</Bracket><Comma />
                </div>

                {/* Professional Experience */}
                <div className="pl-4">
                    <span><JsonKey name="professional_experience" />: </span>
                    <Bracket>{"["}</Bracket>
                    <div className="pl-4 space-y-1">
                        {payload.professional_experience.map((exp, expIndex) => (
                            <div key={expIndex}>
                                <Bracket>{"{"}</Bracket>
                                <div className="pl-4">
                                    <p><JsonKey name="title" />: <JsonString value={exp.title} /><Comma /></p>
                                    <p><JsonKey name="details" />: <Bracket>{"["}</Bracket></p>
                                    <div className="pl-8">
                                        {exp.details.map((detail, detailIndex) => (
                                            <span className="block" key={detailIndex}>
                                            <JsonString value={detail} />
                                                {detailIndex < exp.details.length - 1 && <Comma />}
                                         </span>
                                        ))}
                                    </div>
                                    <p><Bracket>{"]"}</Bracket></p>
                                </div>
                                <Bracket>{"}"}</Bracket>
                                {expIndex < payload.professional_experience.length - 1 && <Comma />}
                            </div>
                        ))}
                    </div>
                    <Bracket>{"]"}</Bracket><Comma />
                </div>

                {/* Education */}
                <div className="pl-4">
                    <span><JsonKey name="education" />: </span>
                    <Bracket>{"["}</Bracket>
                    <div className="pl-4 space-y-1">
                        {payload.education.map((edu, eduIndex) => (
                            <div key={eduIndex}>
                                <Bracket>{"{"}</Bracket>
                                <div className="pl-4">
                                    <p><JsonKey name="degree" />: <JsonString value={edu.degree} /><Comma /></p>
                                    <p><JsonKey name="date" />: <JsonString value={edu.date} /><Comma /></p>
                                    <p><JsonKey name="details" />: <Bracket>{"["}</Bracket></p>
                                    <div className="pl-8">
                                        {edu.details.map((detail, detailIndex) => (
                                            <span className="block" key={detailIndex}>
                                            <JsonString value={detail} />
                                                {detailIndex < edu.details.length - 1 && <Comma />}
                                         </span>
                                        ))}
                                    </div>
                                    <p><Bracket>{"]"}</Bracket></p>
                                </div>
                                <Bracket>{"}"}</Bracket>
                                {eduIndex < payload.education.length - 1 && <Comma />}
                            </div>
                        ))}
                    </div>
                    <Bracket>{"]"}</Bracket>
                </div>
                <Bracket>{"}"}</Bracket>
            </div>
        </div>
    );
}

export default BackendData;