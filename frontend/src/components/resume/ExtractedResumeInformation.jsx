import React from "react";
import { BotIcon } from "lucide-react";
import { BriefcaseIcon, GraduationCapIcon } from "lucide-react";

function ExtractedResumeInformation({ extractedData, isParsing }) {
    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2">Extracted Information</h2>
            {!extractedData && !isParsing && (
                <div className="text-center text-gray-500 py-16">
                    <BotIcon className="mx-auto h-16 w-16 text-gray-600" />
                    <p className="mt-4">Analysis results will appear here after you click "Analyze".</p>
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
    );
}

export default ExtractedResumeInformation;
