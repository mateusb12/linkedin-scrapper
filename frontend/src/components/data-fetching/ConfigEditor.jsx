import React, { useState } from 'react';
import axios from 'axios';
import {CopyableCodeBlock} from "./CopyableCodeBlock.jsx";

export const ConfigEditor = ({
                                 title,
                                 subtitle,
                                 networkFilter,
                                 jsonValue,
                                 setJsonValue,
                                 fetchValue,
                                 setFetchValue,
                                 curlValue,
                                 setCurlValue
                             }) => {
    const [view, setView] = useState('fetch');
    const [status, setStatus] = useState(null);
    const [showStatus, setShowStatus] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const getDisplayValue = () => {
        switch (view) {
            case 'curl':
                return curlValue;
            case 'fetch':
                return fetchValue;
            default: // 'json'
                return jsonValue;
        }
    };

    const handleOnChange = (e) => {
        const newValue = e.target.value;
        switch (view) {
            case 'curl':
                setCurlValue(newValue);
                break;
            case 'fetch':
                setFetchValue(newValue);
                break;
            default: // 'json'
                setJsonValue(newValue);
                break;
        }
    };

    const handleUpdate = () => {
        const endpoint = title === "Pagination Request"
            ? "http://localhost:5000/fetch-jobs/pagination-curl"
            : "http://localhost:5000/fetch-jobs/individual-job-curl";

        const payload = fetchValue;

        axios.put(endpoint, payload, { headers: { 'Content-Type': 'text/plain' } })
            .then(res => {
                setStatus('success');
                setErrorMsg('');
                setShowStatus(true);
                setTimeout(() => setShowStatus(false), 3000);
            })
            .catch(err => {
                const detail = err.response?.data?.description || err.message || 'Unknown error';
                setErrorMsg(detail);
                setStatus('error');
                setShowStatus(true);
                setTimeout(() => setShowStatus(false), 5000);
            });
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
                <div className="space-y-3 w-full sm:max-w-md">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{title}</h2>
                        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
                    </div>

                    {/* 🔥 Reusable Component used here */}
                    {networkFilter && (
                        <div className="mt-2">
                            <CopyableCodeBlock
                                label="Network Filter"
                                text={networkFilter}
                                className="w-full max-w-sm"
                            />
                        </div>
                    )}
                </div>

                <div className="flex items-center rounded-lg bg-gray-200 dark:bg-gray-700 p-1 flex-shrink-0 self-start">
                    {['fetch', 'json', 'curl'].map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setView(mode)}
                            className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors uppercase ${view === mode ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            <textarea
                value={getDisplayValue()}
                onChange={handleOnChange}
                className="w-full h-64 p-3 bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none custom-scrollbar resize-none"
                placeholder={`Paste the full ${view} command here...`}
            />

            <div className="flex items-center mt-4">
                <button onClick={handleUpdate} className="py-2 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Update Configuration
                </button>
                {showStatus && (
                    <div className={`ml-4 flex items-center gap-2 text-sm font-semibold animate-fade-in ${status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {status === 'success' ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Updated successfully!
                            </>
                        ) : (
                            `❌ Error: ${errorMsg}`
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};