import React, { useEffect, useState } from "react";
import { useDarkMode } from "../../hooks/useDarkMode.jsx";
import { CopyableCodeBlock } from "./CopyableCodeBlock.jsx";

import {
    savePaginationCurl,
    saveIndividualJobCurl
} from "../../services/fetchLinkedinService.js";

// 🔥 Network Filter Constants
const NETWORK_FILTER_PAGINATION = "jobCollectionSlug:recommended";
const NETWORK_FILTER_INDIVIDUAL = "jobPostingDetailDescription_start";

export default function FetchConfig() {
    const [isDark] = useDarkMode();
    const [statusMessage, setStatusMessage] = useState({});

    // --- State for Inputs ---
    const [simplePagInput, setSimplePagInput] = useState("");
    const [simpleIndInput, setSimpleIndInput] = useState("");

    const clearStatusMessage = () =>
        setTimeout(() => setStatusMessage({}), 4000);

    // Apply Dark Mode
    useEffect(() => {
        const root = document.documentElement;
        if (isDark) root.classList.add("dark");
        else root.classList.remove("dark");
    }, [isDark]);

    // --- Handlers ---

    const handleUpdatePagination = async () => {
        if (!simplePagInput.trim()) return;
        setStatusMessage({ general: "Saving Pagination..." });

        try {
            await savePaginationCurl(simplePagInput);
            setSimplePagInput("");
            setStatusMessage({ general: "✅ Pagination cURL Updated!" });
            clearStatusMessage();
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
            await saveIndividualJobCurl(simpleIndInput);
            setSimpleIndInput("");
            setStatusMessage({ general: "✅ Individual Job cURL Updated!" });
            clearStatusMessage();
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.description || error.response?.data?.message || error.message;
            setStatusMessage({ general: `❌ Error: ${msg}` });
        }
    };

    return (
        <div>
            {/* HEADER */}
            <div className="flex justify-between items-center border-b border-gray-300 dark:border-gray-700 pb-3 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        Fetch Configuration
                    </h1>

                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Paste fresh cURLs directly from the browser to update the scraper.
                    </p>
                </div>
            </div>

            {/* STATUS MESSAGE OVERLAY */}
            {statusMessage.general && (
                <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded font-semibold text-center animate-pulse">
                    {statusMessage.general}
                </div>
            )}

            {/* BODY - TWO FIELD UPDATE MODE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* LEFT: PAGINATION */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
                            📄 Pagination Request
                        </h2>
                        <p className="text-xs text-gray-500 mt-1 mb-3">
                            Controls how we traverse the job list (pages 1, 2, 3...).
                        </p>
                        <CopyableCodeBlock
                            label="Network Filter"
                            text={NETWORK_FILTER_PAGINATION}
                        />
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
                        <p className="text-xs text-gray-500 mt-1 mb-3">
                            Controls how we fetch details for a single job card.
                        </p>
                        <CopyableCodeBlock
                            label="Network Filter"
                            text={NETWORK_FILTER_INDIVIDUAL}
                        />
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
        </div>
    );
}