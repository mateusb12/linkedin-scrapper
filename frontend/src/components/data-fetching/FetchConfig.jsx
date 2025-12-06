import React, { useEffect, useState } from "react";
import { useDarkMode } from "../../hooks/useDarkMode.jsx";
import { CopyableCodeBlock } from "./CopyableCodeBlock.jsx";

import {
    savePaginationCurl,
    saveIndividualJobCurl,
    // saveGmailToken, // TODO: You will need to create these service functions
    // testGmailConnection
} from "../../services/fetchLinkedinService.js";

import gmailIcon from "../../assets/ui_icons/gmail.png";


// 🔥 Network Filter Constants
const NETWORK_FILTER_PAGINATION = "jobCollectionSlug:recommended";
const NETWORK_FILTER_INDIVIDUAL = "jobPostingDetailDescription_start";

export default function FetchConfig() {
    const [isDark] = useDarkMode();
    const [statusMessage, setStatusMessage] = useState({});

    // --- State for Scraper Inputs ---
    const [simplePagInput, setSimplePagInput] = useState("");
    const [simpleIndInput, setSimpleIndInput] = useState("");

    // --- State for Gmail Integration ---
    const [gmailToken, setGmailToken] = useState("");
    const [showToken, setShowToken] = useState(false);
    const [gmailStatus, setGmailStatus] = useState("idle"); // idle, success, error

    const clearStatusMessage = () =>
        setTimeout(() => setStatusMessage({}), 4000);

    // Apply Dark Mode
    useEffect(() => {
        const root = document.documentElement;
        if (isDark) root.classList.add("dark");
        else root.classList.remove("dark");
    }, [isDark]);

    // --- Handlers: Scraper ---

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
            const msg = error.response?.data?.description || error.message;
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
            const msg = error.response?.data?.description || error.message;
            setStatusMessage({ general: `❌ Error: ${msg}` });
        }
    };

    // --- Handlers: Gmail (Placeholder Logic) ---
    const handleSaveGmail = async () => {
        if (!gmailToken.trim()) return;
        setStatusMessage({ general: "Saving Gmail Token..." });

        try {
            // await saveGmailToken(gmailToken); // TODO: Hook up your backend here

            // Simulating success for UI demo
            setTimeout(() => {
                setStatusMessage({ general: "✅ Gmail Token Saved securely!" });
                setGmailStatus("success");
                clearStatusMessage();
            }, 800);
        } catch (error) {
            setStatusMessage({ general: `❌ Error saving token` });
            setGmailStatus("error");
            console.error(error);
        }
    };

    const handleTestGmail = async () => {
        setStatusMessage({ general: "Sending Test Email..." });
        // await testGmailConnection();
        clearStatusMessage();
    };

    return (
        <div className="max-w-6xl mx-auto">
            {/* HEADER */}
            <div className="flex justify-between items-center border-b border-gray-300 dark:border-gray-700 pb-3 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        Fetch Configuration
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Manage scraper settings and external integrations.
                    </p>
                </div>
            </div>

            {/* STATUS MESSAGE OVERLAY */}
            {statusMessage.general && (
                <div className="mb-6 p-3 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded font-semibold text-center animate-pulse border border-blue-200 dark:border-blue-800">
                    {statusMessage.general}
                </div>
            )}

            {/* SECTION 1: SCRAPER CONFIGURATION */}
            <div className="mb-10">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    Scraper Configuration
                </h3>

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
                            className="w-full p-3 mb-4 text-xs font-mono border border-gray-300 rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        />

                        <button
                            onClick={handleUpdatePagination}
                            disabled={!simplePagInput}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
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
                            className="w-full p-3 mb-4 text-xs font-mono border border-gray-300 rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                        />

                        <button
                            onClick={handleUpdateIndividual}
                            disabled={!simpleIndInput}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            Update Job Config
                        </button>
                    </div>
                </div>
            </div>

            {/* SECTION 2: INTEGRATIONS */}
            <div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Integrations
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* GMAIL CARD */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 relative overflow-hidden">

                        {/* Decorative Top Line */}
                        <div className={`absolute top-0 left-0 w-full h-1 ${gmailStatus === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>

                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <img src={gmailIcon} alt="Gmail Icon" className="w-6 h-6" />
                                    Gmail SMTP
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    Used to send email notifications for new job matches.
                                </p>
                            </div>

                            {/* Status Badge */}
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${
                                gmailStatus === 'success'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                                {gmailStatus === 'success' ? 'Connected' : 'Not Configured'}
                            </span>
                        </div>

                        {/* Input Field with Eye Toggle */}
                        <div className="relative mb-4">
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                App Password (Not your Google Password)
                            </label>
                            <input
                                type={showToken ? "text" : "password"}
                                value={gmailToken}
                                onChange={(e) => setGmailToken(e.target.value)}
                                placeholder="•••• •••• •••• ••••"
                                className="w-full p-3 pr-10 text-sm font-mono border border-gray-300 rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowToken(!showToken)}
                                className="absolute right-3 top-8 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                                {showToken ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a9.018 9.018 0 014.722-.045 23.993 23.993 0 012.336 1.054c.642.348 1.144.757 1.503 1.15.54.59.914 1.198 1.127 1.776.435 1.168.435 2.508 0 3.676-.192.518-.52 1.026-.967 1.503m-3.468 3.125A3.375 3.375 0 0112 15.75c-1.864 0-3.375-1.511-3.375-3.375 0-.58.156-1.122.427-1.595" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                )}
                            </button>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleSaveGmail}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-sm transition-colors text-sm"
                            >
                                Save Token
                            </button>
                            <button
                                onClick={handleTestGmail}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded shadow-sm transition-colors text-sm"
                            >
                                Test
                            </button>
                        </div>
                    </div>

                    {/* Placeholder for Next Integration (Empty State) */}
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex flex-col justify-center items-center p-6 text-gray-400 dark:text-gray-500">
                        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        <span className="text-sm font-medium">Add New Integration</span>
                    </div>

                </div>
            </div>
        </div>
    );
}