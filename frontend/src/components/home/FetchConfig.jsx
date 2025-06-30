import React, { useState, useEffect } from "react";
import axios from "axios";
import { Sun, Moon, LogOut, Loader2, ChevronRight } from "lucide-react";

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


// --- New Fetch Jobs View Component ---
const FetchJobsView = () => {
    const [totalPages, setTotalPages] = useState(0);
    const [startPage, setStartPage] = useState(1);
    const [endPage, setEndPage] = useState(1);
    const [isFetchingTotal, setIsFetchingTotal] = useState(false);
    const [isFetchingPages, setIsFetchingPages] = useState(false);
    const [log, setLog] = useState([]);
    const [error, setError] = useState('');

    const handleGetTotalPages = () => {
        setIsFetchingTotal(true);
        setError('');
        axios.get("http://localhost:5000/fetch-jobs/get-total-pages")
            .then(res => {
                const pages = res.data.total_pages;
                setTotalPages(pages);
                setEndPage(pages > 0 ? pages : 1); // Default end page to total pages
            })
            .catch(err => {
                console.error("Error fetching total pages:", err);
                setError("Failed to fetch total pages. Is the server running?");
            })
            .finally(() => setIsFetchingTotal(false));
    };

    const handleFetchPages = async () => {
        if (startPage < 1 || endPage < startPage || endPage > totalPages) {
            setError("Invalid page range. Ensure Start <= End and End <= Total Pages.");
            return;
        }

        setIsFetchingPages(true);
        setError('');
        setLog([]);

        for (let i = startPage; i <= endPage; i++) {
            try {
                setLog(prev => [...prev, `Fetching page ${i}...`]);
                await axios.get(`http://localhost:5000/fetch-jobs/fetch-page/${i}`);
                setLog(prev => [...prev, `✅ Successfully fetched page ${i}`]);
            } catch (err) {
                console.error(`Error fetching page ${i}:`, err);
                setLog(prev => [...prev, `❌ Failed to fetch page ${i}: ${err.response?.data?.description || err.message}`]);
                setError(`An error occurred. See log for details.`);
                // Optional: break the loop on first error
                // break;
            }
        }

        setLog(prev => [...prev, "--- All tasks complete ---"]);
        setIsFetchingPages(false);
    };

    return (
        <div>
            <h1 className="text-3xl font-bold border-b border-gray-300 dark:border-gray-700 pb-3 text-gray-900 dark:text-gray-100">
                Fetch Job Pages
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 mb-8">
                Run the job fetching process page by page.
            </p>

            {/* Step 1: Get Total Pages */}
            <div className="bg-white dark:bg-[#2d2d3d] p-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">
                    Step 1: Get Total Available Pages
                </h2>
                <div className="flex items-center mt-4 space-x-4">
                    <button
                        onClick={handleGetTotalPages}
                        disabled={isFetchingTotal}
                        className="py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                        {isFetchingTotal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Get Total Pages
                    </button>
                    {totalPages > 0 && (
                        <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
                            Total Pages Found: <span className="font-bold text-blue-600 dark:text-blue-400">{totalPages}</span>
                        </p>
                    )}
                </div>
            </div>

            {/* Step 2: Fetch Page Range */}
            <div className={`mt-8 bg-white dark:bg-[#2d2d3d] p-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 ${totalPages === 0 ? 'opacity-50' : ''}`}>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">
                    Step 2: Select Pages to Fetch
                </h2>
                <div className="flex items-center mt-4 space-x-4">
                    <div>
                        <label htmlFor="startPage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Page</label>
                        <input
                            type="number"
                            id="startPage"
                            value={startPage}
                            onChange={(e) => setStartPage(Number(e.target.value))}
                            disabled={totalPages === 0 || isFetchingPages}
                            className="mt-1 w-28 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                            min="1"
                        />
                    </div>
                    <div>
                        <label htmlFor="endPage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Page</label>
                        <input
                            type="number"
                            id="endPage"
                            value={endPage}
                            onChange={(e) => setEndPage(Number(e.target.value))}
                            disabled={totalPages === 0 || isFetchingPages}
                            className="mt-1 w-28 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                            min={startPage}
                            max={totalPages}
                        />
                    </div>
                    <button
                        onClick={handleFetchPages}
                        disabled={totalPages === 0 || isFetchingPages}
                        className="self-end py-2 px-6 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                        {isFetchingPages && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Start Fetching
                    </button>
                </div>
            </div>

            {/* Log Output */}
            {(log.length > 0 || error) && (
                <div className="mt-8">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">Fetch Log</h2>
                    {error && <p className="mt-2 text-sm text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-md">{error}</p>}
                    <pre className="mt-4 p-4 bg-gray-900 text-white rounded-lg text-sm font-mono overflow-x-auto h-64">
                        {log.map((entry, i) => <div key={i}>{entry}</div>)}
                    </pre>
                </div>
            )}
        </div>
    );
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

    // State to manage view mode (JSON or cURL)
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

    const ConfigEditor = ({ title, subtitle, jsonValue, setJsonValue, view, setView }) => {
        const displayValue = view === 'json' ? jsonValue : generateCurlCommand(jsonValue);

        return (
            <div>
                <div className="flex justify-between mb-2">
                    {/* LEFT: Title + Subtitle stacked */}
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">
                            {title}
                        </h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {subtitle}
                        </p>
                    </div>

                    {/* RIGHT: View toggle buttons */}
                    <div className="flex items-center rounded-lg bg-gray-200 dark:bg-gray-700 p-1">
                        <button
                            onClick={() => setView('json')}
                            className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                                view === 'json'
                                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white'
                                    : 'text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            JSON
                        </button>
                        <button
                            onClick={() => setView('curl')}
                            className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                                view === 'curl'
                                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white'
                                    : 'text-gray-600 dark:text-gray-400'
                            }`}
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
            case "fetch-jobs":
                return <FetchJobsView />;
            case "job-listings": return <div>Job Listings</div>;
            case "profile": return <div>Profile</div>;
            default: return null;
        }
    };

    return (
        <div className="flex h-screen font-sans bg-gray-100 dark:bg-gray-900">
            <aside className="w-64 flex-shrink-0 bg-white dark:bg-[#2d2d3d] p-5 flex flex-col justify-between">
                <nav className="flex flex-col space-y-2">
                    {[
                        { label: "Fetch Config", id: "fetch-config" },
                        { label: "Fetch Jobs", id: "fetch-jobs" },
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