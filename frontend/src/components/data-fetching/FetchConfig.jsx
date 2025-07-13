// src/components/home/FetchConfig.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { FetchJobsView } from "./FetchJobs.jsx";
import { Sidebar, Header } from "../home/Navbar.jsx";
import JobList from "../home/JobList.jsx";
import { useDarkMode } from "../../hooks/useDarkMode.jsx";
import { ConfigEditor } from "./ConfigEditor.jsx";
import ResumeParser from "../home/Resume.jsx";
import Match from "../home/Match.jsx"; // Import the extracted component

// Helper functions moved here to be used for initial state generation
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
        const config = JSON.parse(jsonString);
        const queryParams = [];
        const variableParts = {};
        const nestedQueryParts = {};

        for (const key in config) {
            if (key.startsWith('variables_query_')) {
                const paramName = key.replace('variables_query_', '');
                nestedQueryParts[paramName] = config[key];
            } else if (key.startsWith('variables_')) {
                const paramName = key.replace('variables_', '');
                variableParts[paramName] = config[key];
            }
        }

        queryParams.push('includeWebMetadata=true');
        if (config.query_id) {
            queryParams.push(`queryId=${config.query_id}`);
        }

        const nestedQueryString = Object.entries(nestedQueryParts)
            .map(([key, value]) => `${key}:${value}`)
            .join(',');

        if (nestedQueryString) {
            variableParts['query'] = `(${nestedQueryString})`;
        }

        const variablesString = Object.entries(variableParts)
            .map(([key, value]) => `${key}:${value}`)
            .join(',');

        if (variablesString) {
            queryParams.push(`variables=(${variablesString})`);
        }

        const finalUrl = `${config.base_url}?${queryParams.join('&')}`;
        const fetchOptions = {
            headers: config.headers || {},
            method: config.method || 'GET',
            body: config.body,
        };

        if (fetchOptions.method.toUpperCase() === 'GET' || fetchOptions.method.toUpperCase() === 'HEAD') {
            delete fetchOptions.body;
        }

        return `fetch("${finalUrl}", ${JSON.stringify(fetchOptions, null, 2)});`;
    } catch (e) {
        console.error("Could not generate fetch command:", e);
        return "Invalid JSON configuration. Cannot generate fetch command.";
    }
};

export default function JobDashboard() {
    const [isDark] = useDarkMode();
    const [activeView, setActiveView] = useState("fetch-config");

    // Create separate states for each config type (for Pagination)
    const [paginationJson, setPaginationJson] = useState("Loading...");
    const [paginationFetch, setPaginationFetch] = useState("Loading...");
    const [paginationCurl, setPaginationCurl] = useState("Loading...");

    // Create separate states for each config type (for Individual Job)
    const [individualJobJson, setIndividualJobJson] = useState("Loading...");
    const [individualJobFetch, setIndividualJobFetch] = useState("Loading...");
    const [individualJobCurl, setIndividualJobCurl] = useState("Loading...");

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) root.classList.add('dark');
        else root.classList.remove('dark');
    }, [isDark]);

    useEffect(() => {
        const paginationUrl    = "http://localhost:5000/fetch-jobs/pagination-curl";
        const individualJobUrl = "http://localhost:5000/fetch-jobs/individual-job-curl";

        const processAndSet = (data, setJson, setFetch, setCurl) => {
            // If the backend stored headers as a JSON string, parse it
            if (data && typeof data.headers === "string") {
                try {
                    data.headers = JSON.parse(data.headers);
                    if (typeof data.headers["x-li-track"] === "string") {
                        data.headers["x-li-track"] = JSON.parse(data.headers["x-li-track"]);
                    }
                } catch (err) {
                    console.error("Failed to parse nested header JSON:", err);
                }
            }

            const jsonString = JSON.stringify(data, null, 2);
            setJson(jsonString);
            setFetch(generateFetchCommand(jsonString));
            setCurl(generateCurlCommand(jsonString));
        };

        Promise.all([axios.get(paginationUrl), axios.get(individualJobUrl)])
            .then(([pagRes, indRes]) => {
                processAndSet(
                    pagRes.data,
                    setPaginationJson,
                    setPaginationFetch,
                    setPaginationCurl
                );
                processAndSet(
                    indRes.data,
                    setIndividualJobJson,
                    setIndividualJobFetch,
                    setIndividualJobCurl
                );
            })
            .catch((err) => {
                console.error("Error fetching configs:", err);
                // Update the UI to show an error message
                const errorMessage = `Failed to fetch config. Check browser console for CORS errors.`;
                setPaginationJson(errorMessage);
                setIndividualJobJson(errorMessage);
            });
    }, []);

    useEffect(() => {
        if (!paginationJson || paginationJson.startsWith("Load") || paginationJson.startsWith("Failed")) return;
        setPaginationFetch(generateFetchCommand(paginationJson));
        setPaginationCurl(generateCurlCommand(paginationJson));
    }, [paginationJson]);

    useEffect(() => {
        if (!individualJobJson || individualJobJson.startsWith("Load") || individualJobJson.startsWith("Failed")) return;
        setIndividualJobFetch(generateFetchCommand(individualJobJson));
        setIndividualJobCurl(generateCurlCommand(individualJobJson));
    }, [individualJobJson]);

    const handleLogout = () => console.log("Logging out...");

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
                                jsonValue={paginationJson}
                                setJsonValue={setPaginationJson}
                                fetchValue={paginationFetch}
                                setFetchValue={setPaginationFetch}
                                curlValue={paginationCurl}
                                setCurlValue={setPaginationCurl}
                            />
                            <ConfigEditor
                                title="Individual Job Request"
                                subtitle="Filter: voyagerJobsDashJobCards"
                                jsonValue={individualJobJson}
                                setJsonValue={setIndividualJobJson}
                                fetchValue={individualJobFetch}
                                setFetchValue={setIndividualJobFetch}
                                curlValue={individualJobCurl}
                                setCurlValue={setIndividualJobCurl}
                            />
                        </div>
                    </div>
                );
            case "fetch-jobs":
                return <FetchJobsView />;
            case "job-listings":
                return <JobList />;
            case "resume":
                return <ResumeParser />;
            case "match":
                return <Match />;
            case "profile":
                return <div>Profile</div>;
            default:
                return null;
        }
    };

    return (
        <div className="flex h-screen font-sans bg-gray-100 dark:bg-gray-900">
            <Sidebar
                activeView={activeView}
                setActiveView={setActiveView}
            />
            <div className="flex flex-col flex-1 min-w-0">
                <Header handleLogout={handleLogout} />
                <main className="flex-1 p-10 overflow-y-auto">
                    {renderActiveView()}
                </main>
            </div>
        </div>
    );
}