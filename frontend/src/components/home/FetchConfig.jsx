import React, {useEffect, useState} from "react";
import axios from "axios";
import {FetchJobsView} from "./FetchJobs.jsx";
import {Sidebar} from "./Navbar.jsx";
import {Header} from "./Navbar.jsx";
import JobList from "./JobList.jsx";
import {useDarkMode} from "../../hooks/useDarkMode.jsx";

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

const generateFetchCommand = (jsonString) => {
    try {
        // 1. Parse the input JSON string into a JavaScript object.
        const config = JSON.parse(jsonString);

        // 2. Manually construct the query string to handle the special 'variables' format.
        const queryParams = [];
        const variableParts = {};
        const nestedQueryParts = {};

        // Separate different types of parameters from the config.
        for (const key in config) {
            if (key.startsWith('variables_query_')) {
                // Handle nested query variables, e.g., variables_query_origin -> query:(origin:...)
                const paramName = key.replace('variables_query_', '');
                nestedQueryParts[paramName] = config[key];
            } else if (key.startsWith('variables_')) {
                // Handle top-level variables.
                const paramName = key.replace('variables_', '');
                variableParts[paramName] = config[key];
            }
        }

        // Add standard query parameters.
        queryParams.push('includeWebMetadata=true');
        if (config.query_id) {
            queryParams.push(`queryId=${config.query_id}`);
        }

        // Format the nested query parts if they exist.
        const nestedQueryString = Object.entries(nestedQueryParts)
            .map(([key, value]) => `${key}:${value}`)
            .join(',');

        if (nestedQueryString) {
            variableParts['query'] = `(${nestedQueryString})`;
        }

        // Format the final 'variables' string.
        const variablesString = Object.entries(variableParts)
            .map(([key, value]) => `${key}:${value}`)
            .join(',');

        if (variablesString) {
            // The value is wrapped in parentheses but the parameter itself is not encoded.
            queryParams.push(`variables=(${variablesString})`);
        }

        // 3. Combine the base URL and the constructed query string.
        const finalUrl = `${config.base_url}?${queryParams.join('&')}`;

        // 4. Prepare the options object for the fetch call.
        const fetchOptions = {
            headers: config.headers || {},
            method: config.method || 'GET',
            body: config.body, // Body can be null for GET requests.
        };

        // According to the fetch spec, GET/HEAD requests cannot have a body.
        if (fetchOptions.method.toUpperCase() === 'GET' || fetchOptions.method.toUpperCase() === 'HEAD') {
            delete fetchOptions.body;
        }


        // 5. Assemble and return the final, pretty-printed fetch command string.
        // JSON.stringify with a spacer (2) makes the output readable.
        return `fetch("${finalUrl}", ${JSON.stringify(fetchOptions, null, 2)});`;

    } catch (e) {
        // Handle cases where the input string is not valid JSON.
        console.error("Could not generate fetch command:", e);
        return "Invalid JSON configuration. Cannot generate fetch command.";
    }
};


export default function JobDashboard() {
    const [isDark, toggleDarkMode] = useDarkMode();

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) root.classList.add('dark');
        else root.classList.remove('dark');
    }, [isDark]);

    const [activeView, setActiveView] = useState("fetch-config");
    const [paginationCurl, setPaginationCurl] = useState("Loading...");
    const [individualJobCurl, setIndividualJobCurl] = useState("Loading...");
    const [paginationView, setPaginationView] = useState('fetch');
    const [individualJobView, setIndividualJobView] = useState('fetch');

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

    const handleLogout = () => console.log("Logging out...");

    const ConfigEditor = ({title, subtitle, jsonValue, setJsonValue, view, setView}) => {
        const displayValue = view === 'json' ? jsonValue : generateFetchCommand(jsonValue);
        const [status, setStatus] = useState(null); // null | 'success' | 'error'
        const [showStatus, setShowStatus] = useState(false);
        const [errorMsg, setErrorMsg] = useState('');

        const getDisplayValue = () => {
            switch (view) {
                case 'curl':
                    return generateCurlCommand(jsonValue);
                case 'fetch':
                    return generateFetchCommand(jsonValue);
                default:
                    return jsonValue;
            }
        };

        const handleUpdate = () => {
            // Decide where to send the config
            const endpoint = title === "Pagination Request"
                ? "http://localhost:5000/fetch-jobs/pagination-curl"
                : "http://localhost:5000/fetch-jobs/individual-job-curl";

            // Send the exact textarea content (JSON or otherwise) as plain text
            axios.put(
                endpoint,
                jsonValue,
                {
                    headers: { 'Content-Type': 'text/plain' }
                }
            )
                .then(res => {
                    setStatus('success');
                    setErrorMsg('');
                    setShowStatus(true);
                    setTimeout(() => setShowStatus(false), 2000);
                    console.log('✅ Updated (plain-text) config:', res.data);
                })
                .catch(err => {
                    // Build a helpful error message
                    const detail =
                        err.response?.data?.message ||
                        (typeof err.response?.data === 'string'
                            ? err.response.data
                            : JSON.stringify(err.response?.data || {})) ||
                        err.message ||
                        'Unknown error';

                    console.error('❌ Update failed:', detail);
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
                    onChange={(e) => view === 'json' ? setJsonValue(e.target.value) : null}
                    readOnly={view === 'curl'}
                    className="w-full min-h-[200px] p-4 bg-white dark:bg-[#2d2d3d] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                {showStatus && (
                    <div
                        className={`mt-2 text-sm font-semibold ${
                            status === 'success' ? 'text-green-600' : 'text-red-600'
                        }`}
                    >
                        {status === 'success'
                            ? '✅ Updated!'
                            : `❌ Failed to update: ${errorMsg}`}
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
            case "fetch-config":
                return <FetchConfig/>;
            case "fetch-jobs":
                return <FetchJobsView/>;
            case "job-listings":
                return <JobList/>;
            case "profile":
                return <div>Profile</div>;
            default:
                return null;
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
                    handleLogout={handleLogout}
                />

                <main className="flex-1 p-10 overflow-y-auto">
                    {renderActiveView()}
                </main>
            </div>
        </div>
    );
}