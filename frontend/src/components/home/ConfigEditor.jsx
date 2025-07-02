// src/components/home/ConfigEditor.jsx
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

        // IMPORTANT: The update logic still sends the JSON value,
        // as the backend API is designed to receive a JSON configuration.
        axios.put(endpoint, jsonValue, { headers: { 'Content-Type': 'text/plain' } })
            .then(res => {
                setStatus('success');
                setErrorMsg('');
                setShowStatus(true);
                setTimeout(() => setShowStatus(false), 2000);
            })
            .catch(err => {
                const detail = err.response?.data?.message || err.message || 'Unknown error';
                setErrorMsg(detail);
                setStatus('error');
                setShowStatus(true);
                setTimeout(() => setShowStatus(false), 3000);
            });
    };

    return (
        <div>
            <div className="flex justify-between mb-2">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">{title}</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
                </div>
                <div className="flex items-center rounded-lg bg-gray-200 dark:bg-gray-700 p-1">
                    <button
                        onClick={() => setView('fetch')}
                        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${view === 'fetch' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}
                    >
                        Fetch
                    </button>
                    <button
                        onClick={() => setView('json')}
                        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${view === 'json' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}
                    >
                        JSON
                    </button>
                    <button
                        onClick={() => setView('curl')}
                        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${view === 'curl' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}
                    >
                        cURL
                    </button>
                </div>
            </div>
            <textarea
                value={getDisplayValue()}
                onChange={handleOnChange}
                className="w-full min-h-[200px] p-4 bg-white dark:bg-[#2d2d3d] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {showStatus && (
                <div className={`mt-2 text-sm font-semibold ${status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {status === 'success' ? '✅ Updated!' : `❌ Failed to update: ${errorMsg}`}
                </div>
            )}
            <button
                onClick={handleUpdate}
                className="mt-4 py-2 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-500 transition-colors">
                Update
            </button>
        </div>
    );
};