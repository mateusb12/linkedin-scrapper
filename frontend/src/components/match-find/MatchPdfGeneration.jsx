import React from 'react';
import { XCircle } from 'lucide-react';
import { getColorFromScore } from "./MatchLogic.jsx";

const Spinner = ({ className = 'h-5 w-5 text-white' }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const MatchPdfGeneration = ({
                                fullResumeMarkdown,
                                matchScore,
                                matchScoreError,
                                isCalculatingScore,
                                onCalculateScore,
                                onClosePreview
                            }) => {
    return (
        <div className="mt-8 pt-6 border-t dark:border-gray-700">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 sm:p-6 rounded-xl shadow-lg w-full flex flex-col border dark:border-gray-700">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-300 dark:border-gray-600 flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Full Resume Markdown Preview</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onCalculateScore}
                            disabled={isCalculatingScore}
                            className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold text-xs rounded-md disabled:cursor-wait disabled:opacity-50 transition-all"
                        >
                            {isCalculatingScore ? (
                                <div className="flex items-center gap-2">
                                    <Spinner className="w-4 h-4 text-black" />
                                    Calculating...
                                </div>
                            ) : (
                                "Calculate Score"
                            )}
                        </button>
                        <button
                            onClick={onClosePreview}
                            className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white p-2 rounded-full transition-colors"
                        >
                            <XCircle size={24} />
                        </button>
                    </div>
                </div>
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
                <textarea
                    readOnly
                    value={fullResumeMarkdown}
                    className="mt-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 font-mono text-sm w-full rounded-md p-4 resize-none focus:ring-2 focus:ring-indigo-500"
                    style={{ height: '60vh' }}
                />
            </div>
        </div>
    );
};

export default MatchPdfGeneration;