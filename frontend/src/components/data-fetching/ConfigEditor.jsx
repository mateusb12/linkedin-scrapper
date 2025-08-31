// src/components/data-fetching/ConfigEditor.jsx
import React, { useState } from 'react';
import axios from 'axios';

export const ConfigEditor = ({
                                 title,
                                 subtitle,
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

        const payload = fetchValue; // Always send the fetch string, as the backend is set up to parse it.

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
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
                </div>
                <div className="flex items-center rounded-lg bg-gray-200 dark:bg-gray-700 p-1 flex-shrink-0">
                    <button onClick={() => setView('fetch')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${view === 'fetch' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>Fetch</button>
                    <button onClick={() => setView('json')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${view === 'json' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>JSON</button>
                    <button onClick={() => setView('curl')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${view === 'curl' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>cURL</button>
                </div>
            </div>
            <textarea
                value={getDisplayValue()}
                onChange={handleOnChange}
                className="w-full h-64 p-3 bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder={`Paste the full ${view} command here...`}
            />
            <div className="flex items-center mt-4">
                <button onClick={handleUpdate} className="py-2 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors">
                    Update Configuration
                </button>
                {showStatus && (
                    <div className={`ml-4 text-sm font-semibold ${status === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                        {status === 'success' ? '✅ Updated successfully!' : `❌ Error: ${errorMsg}`}
                    </div>
                )}
            </div>
        </div>
    );
};