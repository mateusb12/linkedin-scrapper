import React, { useState, useEffect } from "react";
import axios from "axios";
import { Sun, Moon, LogOut } from "lucide-react";

// ✅ NEW: cURL Command Generation Function
const generateCurlCommand = (jsonString) => {
    try {
        // First, parse the JSON from the textarea
        const config = JSON.parse(jsonString);

        // This is the ideal structure, we assume the previous fixes are on the server
        // or we can re-apply them here if needed.
        const url = new URL(config.base_url);
        // Add query variables to URL
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

        // Generate headers
        if (config.headers) {
            for (const [key, value] of Object.entries(config.headers)) {
                // If a value is an object (like a parsed x-li-track), stringify it back for the header
                const headerValue = typeof value === 'object' ? JSON.stringify(value) : value;
                curlCmd += ` \\\n  -H '${key}: ${headerValue.replace(/'/g, "'\\''")}'`;
            }
        }

        // Handle body
        if (config.body && config.body !== null && config.body !== 'null') {
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

    // ✅ NEW: State to manage view mode (JSON or cURL)
    const [paginationView, setPaginationView] = useState('json');
    const [individualJobView, setIndividualJobView] = useState('json');


    const profile = {
        name: "Custom User",
        email: "user@gmail.com",
        avatar: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"
    };

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

    // ✅ UPDATED: The view rendering logic is now cleaner
    const ConfigEditor = ({ title, jsonValue, setJsonValue, view, setView }) => {
        const displayValue = view === 'json' ? jsonValue : generateCurlCommand(jsonValue);

        return (
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">
                        {title}
                    </h2>
                    <div className="flex items-center rounded-lg bg-gray-200 dark:bg-gray-700 p-1">
                        <button onClick={() => setView('json')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${view === 'json' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>JSON</button>
                        <button onClick={() => setView('curl')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${view === 'curl' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>cURL</button>
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

    const renderActiveView = () => {
        switch (activeView) {
            case "fetch-config":
                return (
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
                                jsonValue={paginationCurl}
                                setJsonValue={setPaginationCurl}
                                view={paginationView}
                                setView={setPaginationView}
                            />
                            <ConfigEditor
                                title="Individual Job Request"
                                jsonValue={individualJobCurl}
                                setJsonValue={setIndividualJobCurl}
                                view={individualJobView}
                                setView={setIndividualJobView}
                            />
                        </div>
                    </div>
                );
            // ... other cases remain the same
            case "job-listings": return <div>Job Listings</div>;
            case "profile": return <div>Profile</div>;
            default: return null;
        }
    };

    return (
        <div className="flex h-screen font-sans bg-gray-100 dark:bg-gray-900">
            {/* Sidebar and Header remain the same */}
            <aside className="w-64 flex-shrink-0 bg-white dark:bg-[#2d2d3d] p-5 flex flex-col justify-between">
                <nav className="flex flex-col space-y-2">
                    {[
                        { label: "Fetch Config", id: "fetch-config" },
                        { label: "Job Listings", id: "job-listings" },
                        { label: "Profile", id: "profile" }
                    ].map(({ label, id }) => (
                        <button
                            key={id}
                            onClick={() => setActiveView(id)}
                            className={`w-full text-left p-3 rounded-lg text-base font-medium transition-colors ${
                                activeView === id
                                    ? 'bg-blue-600 text-white font-semibold dark:bg-[#4a4a6a]'
                                    : 'text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-[#4a4a6a] dark:hover:text-white'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </nav>
                <div className="flex items-center space-x-3 pt-4 border-t border-gray-300 dark:border-gray-700">
                    <img
                        src={profile.avatar}
                        alt="User Avatar"
                        className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex flex-col leading-tight">
                        <span className="text-gray-800 dark:text-gray-200 font-semibold">
                            {profile.name}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 text-xs">
                            {profile.email}
                        </span>
                    </div>
                </div>
            </aside>
            <div className="flex flex-col flex-1 min-w-0">
                <header className="h-14 flex items-center justify-end px-4 bg-gray-200 dark:bg-gray-800 shadow-sm space-x-2">
                    <button
                        onClick={toggleDarkMode}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
                        aria-label="Toggle dark mode"
                    >
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                        aria-label="Logout"
                    >
                        <LogOut size={18} />
                    </button>
                </header>
                <main className="flex-1 p-10 overflow-y-auto">
                    {renderActiveView()}
                </main>
            </div>
        </div>
    );
}