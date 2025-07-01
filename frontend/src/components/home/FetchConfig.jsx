import React, {useEffect, useState} from "react";
import axios from "axios";
import {FetchJobsView} from "./FetchJobs.jsx";
import {Sidebar} from "./Navbar.jsx";
import {Header} from "./Navbar.jsx";

// ✅ cURL Command Generation Function (unchanged)
const generateCurlCommand = (jsonString) => {
    try {
        const config = JSON.parse(jsonString);
        const url = new URL(config.base_url);
        Object.keys(config).forEach(key => {
            if (key.startsWith('variables_')) {
                const queryParamKey = key.replace('variables_', '');
                url.searchParams.append(queryParamKey, config[key]);
            }
        });

        let curlCmd = `curl '${url.toString()}'`;

        if (config.method && config.method.toUpperCase() !== 'GET') {
            curlCmd += ` \\\n  -X ${config.method.toUpperCase()}`;
        }

        if (config.headers) {
            for (const [key, value] of Object.entries(config.headers)) {
                const headerValue = typeof value === 'object' ? JSON.stringify(value) : value;
                curlCmd += ` \\\n  -H '${key}: ${headerValue.replace(/'/g, "'\\''")}'`;
            }
        }

        if (config.body && config.body !== 'null') {
            const bodyValue = typeof config.body === 'object' ? JSON.stringify(config.body) : config.body;
            curlCmd += ` \\\n  --data-raw '${bodyValue.replace(/'/g, "'\\''")}'`;
        }

        curlCmd += ' \\\n  --compressed';
        return curlCmd;
    } catch (e) {
        console.error("Could not generate cURL command:", e);
        return "Invalid JSON configuration. Cannot generate cURL.";
    }
};


export default function JobDashboard() {
    const [isDark, setIsDark] = useState(() =>
        document.documentElement.classList.contains("dark")
    );

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) root.classList.add('dark');
        else root.classList.remove('dark');
    }, [isDark]);

    const [activeView, setActiveView] = useState("fetch-config");
    const [paginationCurl, setPaginationCurl] = useState("Loading...");
    const [individualJobCurl, setIndividualJobCurl] = useState("Loading...");
    const [paginationView, setPaginationView] = useState('json');
    const [individualJobView, setIndividualJobView] = useState('json');

    useEffect(() => {
        const paginationUrl = "http://localhost:5000/fetch-jobs/pagination-curl";
        const individualJobUrl = "http://localhost:5000/fetch-jobs/individual-job-curl";

        const processAndSetData = (data, setter) => {
            let processedData = data;
            if (processedData && typeof processedData.headers === 'string') {
                try {
                    processedData.headers = JSON.parse(processedData.headers);
                    if (processedData.headers && typeof processedData.headers['x-li-track'] === 'string') {
                        processedData.headers['x-li-track'] = JSON.parse(processedData.headers['x-li-track']);
                    }
                } catch (e) {
                    console.error("Failed to parse nested JSON", e);
                }
            }
            setter(JSON.stringify(processedData, null, 2));
        };

        axios.get(paginationUrl)
            .then((res) => processAndSetData(res.data, setPaginationCurl))
            .catch((err) => {
                console.error("Error fetching pagination curl:", err);
                setPaginationCurl("Failed to fetch.");
            });

        axios.get(individualJobUrl)
            .then((res) => processAndSetData(res.data, setIndividualJobCurl))
            .catch((err) => {
                console.error("Error fetching individual job curl:", err);
                setIndividualJobCurl("Failed to fetch.");
            });
    }, []);

    const toggleDarkMode = () => setIsDark(prev => !prev);
    const handleLogout = () => console.log("Logging out...");

    const ConfigEditor = ({ title, subtitle, jsonValue, setJsonValue, view, setView }) => {
        const displayValue = view === 'json' ? jsonValue : generateCurlCommand(jsonValue);

        return (
            <div>
                <div className="flex justify-between mb-2">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">{title}</h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
                    </div>
                    <div className="flex items-center rounded-lg bg-gray-200 dark:bg-gray-700 p-1">
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
                    value={displayValue}
                    onChange={(e) => view === 'json' ? setJsonValue(e.target.value) : null}
                    readOnly={view === 'curl'}
                    className="w-full min-h-[200px] p-4 bg-white dark:bg-[#2d2d3d] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button className="mt-4 py-2 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-500 transition-colors">
                    Update
                </button>
            </div>
        );
    };

    const FetchConfig = () => (
        <div>
            <h1 className="text-3xl font-bold border-b border-gray-300 dark:border-gray-700 pb-3 text-gray-900 dark:text-gray-100">
                Fetch Configuration
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 mb-8">
                Define the GET request details for fetching job data.
            </p>
            <div className="space-y-8">
                <ConfigEditor
                    title="Pagination Request"
                    subtitle="Filter: jobCollectionSlug"
                    jsonValue={paginationCurl}
                    setJsonValue={setPaginationCurl}
                    view={paginationView}
                    setView={setPaginationView}
                />
                <ConfigEditor
                    title="Individual Job Request"
                    subtitle="Filter: voyagerJobsDashJobCards"
                    jsonValue={individualJobCurl}
                    setJsonValue={setIndividualJobCurl}
                    view={individualJobView}
                    setView={setIndividualJobView}
                />
            </div>
        </div>
    );

    const renderActiveView = () => {
        switch (activeView) {
            case "fetch-config": return <FetchConfig />;
            case "fetch-jobs": return <FetchJobsView />;
            case "job-listings": return <div>Job Listings</div>;
            case "profile": return <div>Profile</div>;
            default: return null;
        }
    };

    return (
        <div className="flex h-screen font-sans bg-gray-100 dark:bg-gray-900">
            {/* ✅ REFACTORED: Sidebar component */}
            <Sidebar
                activeView={activeView}
                setActiveView={setActiveView}
            />

            <div className="flex flex-col flex-1 min-w-0">
                {/* ✅ REFACTORED: Header component */}
                <Header
                    isDark={isDark}
                    toggleDarkMode={toggleDarkMode}
                    handleLogout={handleLogout}
                />

                <main className="flex-1 p-10 overflow-y-auto">
                    {renderActiveView()}
                </main>
            </div>
        </div>
    );
}