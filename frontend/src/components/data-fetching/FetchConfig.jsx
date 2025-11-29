// src/components/data-fetching/FetchConfig.jsx
import React, { useEffect, useState } from "react";
import { useDarkMode } from "../../hooks/useDarkMode.jsx";
import { generateCurlCommand, generateFetchCommand } from "../../utils/fetchUtils.js";
import { ConfigEditor } from "./ConfigEditor.jsx";

// Import the service functions instead of using axios directly
import {
    getPaginationCurl,
    getIndividualJobCurl,
    savePaginationCurl,
    saveIndividualJobCurl
} from "../../services/fetchLinkedinService.js";

// 🔥 Network Filter Constants
const NETWORK_FILTER_PAGINATION = "jobCollectionSlug:recommended";
const NETWORK_FILTER_INDIVIDUAL = "jobPostingDetailDescription_start";

const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const FilterHelper = ({ label, filterText }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(filterText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded border border-gray-200 dark:border-gray-600 text-xs mt-1">
            <span className="font-mono text-gray-600 dark:text-gray-300 truncate mr-2">{filterText}</span>
            <button
                onClick={handleCopy}
                className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 font-semibold"
                title="Copy Filter"
            >
                {copied ? <span>Copied!</span> : <CopyIcon />}
            </button>
        </div>
    );
};

export default function FetchConfig() {
    const [isDark] = useDarkMode();
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState({});

    // Toggle between Simple (Manual Paste) and Advanced (Full JSON Edit)
    const [isSimpleMode, setIsSimpleMode] = useState(true);

    // --- State for Simple Mode (Direct Inputs) ---
    const [simplePagInput, setSimplePagInput] = useState("");
    const [simpleIndInput, setSimpleIndInput] = useState("");

    // --- State for Full Edit Mode (Visualizers) ---
    const [paginationJson, setPaginationJson] = useState("{}");
    const [paginationFetch, setPaginationFetch] = useState("");
    const [paginationCurl, setPaginationCurl] = useState("");

    const [individualJobJson, setIndividualJobJson] = useState("{}");
    const [individualJobFetch, setIndividualJobFetch] = useState("");
    const [individualJobCurl, setIndividualJobCurl] = useState("");

    const clearStatusMessage = (key) =>
        setTimeout(() => setStatusMessage((prev) => ({ ...prev, [key]: "" })), 4000);

    const processAndSet = (data, setJson, setFetch, setCurl) => {
        const jsonString = JSON.stringify(data, null, 2);
        setJson(jsonString);
        setFetch(generateFetchCommand(jsonString));
        setCurl(generateCurlCommand(jsonString));
    };

    const fetchAndSetData = async (feedbackMessage) => {
        if (feedbackMessage) setStatusMessage({ general: feedbackMessage });

        try {
            // UPDATED: Using Service functions instead of direct axios
            const [pagData, indData] = await Promise.all([
                getPaginationCurl(),
                getIndividualJobCurl(),
            ]);

            processAndSet(pagData, setPaginationJson, setPaginationFetch, setPaginationCurl);
            processAndSet(indData, setIndividualJobJson, setIndividualJobFetch, setIndividualJobCurl);

            if (feedbackMessage) {
                clearStatusMessage("general");
            }
        } catch (err) {
            console.error("Error fetching configs:", err);
            setStatusMessage({ general: "❌ Could not fetch configs." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) root.classList.add("dark");
        else root.classList.remove("dark");
    }, [isDark]);

    useEffect(() => {
        fetchAndSetData();
    }, []);


    // --- Handlers for Simple Mode ---

    const handleUpdatePagination = async () => {
        if (!simplePagInput.trim()) return;
        setStatusMessage({ general: "Saving Pagination..." });
        try {
            // UPDATED: Using Service function
            await savePaginationCurl(simplePagInput);
            setSimplePagInput("");
            await fetchAndSetData("✅ Pagination cURL Updated!");
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.description || error.response?.data?.message || error.message;
            setStatusMessage({ general: `❌ Error: ${msg}` });
        }
    };

    const handleUpdateIndividual = async () => {
        if (!simpleIndInput.trim()) return;
        setStatusMessage({ general: "Saving Job Config..." });
        try {
            // UPDATED: Using Service function
            await saveIndividualJobCurl(simpleIndInput);
            setSimpleIndInput("");
            await fetchAndSetData("✅ Individual Job cURL Updated!");
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.description || error.response?.data?.message || error.message;
            setStatusMessage({ general: `❌ Error: ${msg}` });
        }
    };

    if (isLoading) return <div className="p-4">Loading configuration...</div>;

    return (
        <div>
            {/* HEADER */}
            <div className="flex justify-between items-center border-b border-gray-300 dark:border-gray-700 pb-3 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        Fetch Configuration
                    </h1>

                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {isSimpleMode
                            ? "Paste fresh cURLs directly from the browser."
                            : "Advanced mode for inspecting parsed data."}
                    </p>
                </div>

                <div className="flex items-center space-x-3">
                    <span className={`text-sm font-medium ${!isSimpleMode ? "text-blue-500" : "text-gray-500"}`}>
                        Advanced View
                    </span>
                    <label htmlFor="toggle" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input
                                type="checkbox"
                                id="toggle"
                                className="sr-only"
                                checked={isSimpleMode}
                                onChange={() => setIsSimpleMode(!isSimpleMode)}
                            />
                            <div className={`block w-14 h-8 rounded-full ${isSimpleMode ? "bg-teal-400" : "bg-purple-400"}`} />
                            <div className={`dot absolute top-1 left-1 w-6 h-6 rounded-full bg-white transform transition-transform duration-300 ${isSimpleMode ? "translate-x-6" : ""}`} />
                        </div>
                    </label>
                    <span className={`text-sm font-medium ${isSimpleMode ? "text-blue-500" : "text-gray-500"}`}>
                        Update Mode
                    </span>
                </div>
            </div>

            {/* STATUS MESSAGE OVERLAY */}
            {statusMessage.general && (
                <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded font-semibold text-center animate-pulse">
                    {statusMessage.general}
                </div>
            )}

            {/* BODY */}
            {isSimpleMode ? (
                /* TWO FIELD UPDATE MODE */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* LEFT: PAGINATION */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                        <div className="mb-4">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
                                📄 Pagination Request
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">
                                Controls how we traverse the job list (pages 1, 2, 3...).
                            </p>
                            <FilterHelper label="Network Filter" filterText={NETWORK_FILTER_PAGINATION} />
                        </div>

                        <textarea
                            value={simplePagInput}
                            onChange={(e) => setSimplePagInput(e.target.value)}
                            rows={8}
                            placeholder="Paste cURL with 'jobCollectionSlug' here..."
                            className="w-full p-3 mb-4 text-xs font-mono border border-gray-300 rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                        />

                        <button
                            onClick={handleUpdatePagination}
                            disabled={!simplePagInput}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Update Pagination Config
                        </button>
                    </div>

                    {/* RIGHT: INDIVIDUAL JOB */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                        <div className="mb-4">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
                                💼 Individual Job Request
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">
                                Controls how we fetch details for a single job card.
                            </p>
                            <FilterHelper label="Network Filter" filterText={NETWORK_FILTER_INDIVIDUAL} />
                        </div>

                        <textarea
                            value={simpleIndInput}
                            onChange={(e) => setSimpleIndInput(e.target.value)}
                            rows={8}
                            placeholder="Paste cURL with 'jobPostingDetailDescription' here..."
                            className="w-full p-3 mb-4 text-xs font-mono border border-gray-300 rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-purple-500 outline-none"
                        />

                        <button
                            onClick={handleUpdateIndividual}
                            disabled={!simpleIndInput}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Update Job Config
                        </button>
                    </div>

                </div>
            ) : (
                /* FULL EDIT MODE (READ ONLY / ADVANCED) */
                <div className="space-y-12">
                    <div>
                        <ConfigEditor
                            title="Pagination Request"
                            networkFilter={NETWORK_FILTER_PAGINATION}
                            jsonValue={paginationJson}
                            setJsonValue={setPaginationJson}
                            fetchValue={paginationFetch}
                            setFetchValue={setPaginationFetch}
                            curlValue={paginationCurl}
                            setCurlValue={setPaginationCurl}
                        />
                    </div>
                    <div>
                        <ConfigEditor
                            title="Individual Job Request"
                            networkFilter={NETWORK_FILTER_INDIVIDUAL}
                            jsonValue={individualJobJson}
                            setJsonValue={setIndividualJobJson}
                            fetchValue={individualJobFetch}
                            setFetchValue={setIndividualJobFetch}
                            curlValue={individualJobCurl}
                            setCurlValue={setIndividualJobCurl}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}