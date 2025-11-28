// src/components/data-fetching/ConfigEditor.jsx
import React, { useState } from 'react';
import axios from 'axios';

export const ConfigEditor = ({
                                 title,
                                 subtitle,
                                 networkFilter, // 🔥 New Prop
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
    const [copied, setCopied] = useState(false);

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

    const handleCopyFilter = () => {
        if (!networkFilter) return;
        navigator.clipboard.writeText(networkFilter);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
            <div className="flex justify-between items-start mb-4">
                <div className="space-y-2">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
                        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
                    </div>

                    {/* 🔥 New Network Filter UI */}
                    {networkFilter && (
                        <div className="inline-flex items-center gap-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 group">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                Network Filter:
                            </span>
                            <code className="text-sm font-mono text-pink-600 dark:text-pink-400 font-medium">
                                {networkFilter}
                            </code>
                            <button
                                onClick={handleCopyFilter}
                                title="Copy filter"
                                className="ml-1 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                            >
                                {copied ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center rounded-lg bg-gray-200 dark:bg-gray-700 p-1 flex-shrink-0">
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
                className="w-full h-64 p-3 bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none custom-scrollbar"
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