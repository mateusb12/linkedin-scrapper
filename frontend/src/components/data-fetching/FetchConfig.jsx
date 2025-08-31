// src/components/data-fetching/FetchConfig.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useDarkMode } from "../../hooks/useDarkMode.jsx";
import { generateCurlCommand, generateFetchCommand } from "../../utils/fetchUtils.js";
import { ConfigEditor } from "./ConfigEditor.jsx";

const PAGINATION_TEMPLATE = {
    base_url: "https://www.linkedin.com/voyager/api/graphql",
    query_id: "voyagerJobsDashJobCards.93590893e4adb90623f00d61719b838c",
    variables_count: 24,
    variables_job_collection_slug: "recommended",
    variables_start: 0,
    variables_query_origin: "GENERIC_JOB_COLLECTIONS_LANDING",
    headers: { "Referer": "https://www.linkedin.com/jobs/collections/recommended/", "accept": "application/vnd.linkedin.normalized+json+2.1", "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7", "priority": "u=1, i", "sec-ch-prefers-color-scheme": "dark", "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Microsoft Edge\";v=\"138\"", "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": "\"Windows\"", "sec-fetch-dest": "empty", "sec-fetch-mode": "cors", "sec-fetch-site": "same-origin", "x-li-lang": "en_US", "x-li-page-instance": "urn:li:page:d_flagship3_job_collections_discovery_landing;50NZCKkKTNeg3KVooOQLyQ==", "x-li-pem-metadata": "Voyager - Careers - Job Collections=job-collection-pagination-fetch", "x-li-prefetch": "1", "x-li-track": "{\"clientVersion\":\"1.13.37692\",\"mpVersion\":\"1.13.37692\",\"osName\":\"web\",\"timezoneOffset\":-3,\"timezone\":\"America/Fortaleza\",\"deviceFormFactor\":\"DESKTOP\",\"mpName\":\"voyager-web\",\"displayDensity\":1,\"displayWidth\":1920,\"displayHeight\":1080}", "x-restli-protocol-version": "2.0.0" },
    method: "GET"
};

const INDIVIDUAL_TEMPLATE = {
    ...PAGINATION_TEMPLATE,
    query_id: "voyagerJobsDashJobCards.174f05382121bd73f2f133da2e4af893",
    variables_count: 5,
    variables_job_collection_slug: "",
    variables_query_origin: "",
    headers: { ...PAGINATION_TEMPLATE.headers, "x-li-pem-metadata": "" }
};

const RefreshIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
    </svg>
);

export default function FetchConfig() {
    const [isDark] = useDarkMode();
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState({});
    const [isTokenMode, setIsTokenMode] = useState(true);

    // State for Token Mode
    const [cookie, setCookie] = useState("");
    const [csrfToken, setCsrfToken] = useState("");

    // State for Full Edit Mode
    const [paginationJson, setPaginationJson] = useState("");
    const [paginationFetch, setPaginationFetch] = useState("");
    const [paginationCurl, setPaginationCurl] = useState("");
    const [individualJobJson, setIndividualJobJson] = useState("");
    const [individualJobFetch, setIndividualJobFetch] = useState("");
    const [individualJobCurl, setIndividualJobCurl] = useState("");

    const clearStatusMessage = (key) => setTimeout(() => setStatusMessage(prev => ({ ...prev, [key]: '' })), 4000);

    const processAndSet = (data, setJson, setFetch, setCurl) => {
        const jsonString = JSON.stringify(data, null, 2);
        setJson(jsonString);
        setFetch(generateFetchCommand(jsonString));
        setCurl(generateCurlCommand(jsonString));
    };

    const fetchAndSetData = async (feedbackMessage) => {
        if (feedbackMessage) setStatusMessage({ general: feedbackMessage });
        try {
            const [pagRes, indRes] = await Promise.all([
                axios.get("http://localhost:5000/fetch-jobs/pagination-curl"),
                axios.get("http://localhost:5000/fetch-jobs/individual-job-curl")
            ]);

            // Populate state for Token Mode
            const headers = typeof pagRes.data.headers === 'string' ? JSON.parse(pagRes.data.headers) : pagRes.data.headers;
            setCookie(headers.cookie || "");
            setCsrfToken(headers["csrf-token"] || "");

            // Populate state for Full Edit Mode
            processAndSet(pagRes.data, setPaginationJson, setPaginationFetch, setPaginationCurl);
            processAndSet(indRes.data, setIndividualJobJson, setIndividualJobFetch, setIndividualJobCurl);

            if (feedbackMessage) {
                setStatusMessage({ general: "✅ Tokens refreshed successfully!" });
                clearStatusMessage('general');
            }
        } catch (err) {
            console.error("Error fetching configs:", err);
            const errorMsg = "❌ Could not fetch configs.";
            setStatusMessage({ general: errorMsg });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) root.classList.add('dark');
        else root.classList.remove('dark');
    }, [isDark]);

    useEffect(() => {
        fetchAndSetData(); // Initial load
    }, []);

    const handleTokenSave = async () => {
        setStatusMessage({ general: "Saving..." });
        const pagConfig = { ...PAGINATION_TEMPLATE, headers: { ...PAGINATION_TEMPLATE.headers, cookie, "csrf-token": csrfToken } };
        const indConfig = { ...INDIVIDUAL_TEMPLATE, headers: { ...INDIVIDUAL_TEMPLATE.headers, cookie, "csrf-token": csrfToken } };
        const paginationFetchString = generateFetchCommand(JSON.stringify(pagConfig));
        const individualFetchString = generateFetchCommand(JSON.stringify(indConfig));
        try {
            await Promise.all([
                axios.put("http://localhost:5000/fetch-jobs/pagination-curl", paginationFetchString, { headers: { 'Content-Type': 'text/plain' } }),
                axios.put("http://localhost:5000/fetch-jobs/individual-job-curl", individualFetchString, { headers: { 'Content-Type': 'text/plain' } })
            ]);
            setStatusMessage({ general: "✅ Tokens updated successfully!" });
        } catch (error) {
            setStatusMessage({ general: `❌ Error saving tokens: ${error.response?.data?.description || error.message}` });
        } finally {
            clearStatusMessage('general');
        }
    };

    if (isLoading) return <div className="p-4">Loading configuration...</div>;

    return (
        <div>
            <div className="flex justify-between items-center border-b border-gray-300 dark:border-gray-700 pb-3 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Fetch Configuration</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {isTokenMode ? "Quickly update session tokens." : "Advanced mode for full request editing."}
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    <span className={`text-sm font-medium ${!isTokenMode ? 'text-blue-500' : 'text-gray-500'}`}>Full Edit</span>
                    <label htmlFor="toggle" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input type="checkbox" id="toggle" className="sr-only" checked={isTokenMode} onChange={() => setIsTokenMode(!isTokenMode)} />
                            <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform"></div>
                        </div>
                    </label>
                    <span className={`text-sm font-medium ${isTokenMode ? 'text-blue-500' : 'text-gray-500'}`}>Token Only</span>
                </div>
            </div>

            {isTokenMode ? (
                <div className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="csrf-token" className="block text-sm font-medium text-gray-700 dark:text-gray-300">CSRF Token</label>
                            <button onClick={() => fetchAndSetData("🔄 Refreshing tokens...")} title="Refresh tokens from backend" className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400"><RefreshIcon /></button>
                        </div>
                        <input type="text" id="csrf-token" value={csrfToken} onChange={(e) => setCsrfToken(e.target.value)} placeholder="ajax:1234567890123456789" className="w-full p-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="cookie" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cookie</label>
                            <button onClick={() => fetchAndSetData("🔄 Refreshing tokens...")} title="Refresh tokens from backend" className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400"><RefreshIcon /></button>
                        </div>
                        <textarea id="cookie" value={cookie} onChange={(e) => setCookie(e.target.value)} rows={6} placeholder="li_at=...; JSESSIONID=...;" className="w-full p-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"/>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button onClick={handleTokenSave} disabled={!cookie || !csrfToken} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed">Save Tokens</button>
                        {statusMessage.general && <p className="text-sm">{statusMessage.general}</p>}
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    <ConfigEditor title="Pagination Request" subtitle="Used for fetching lists of jobs." jsonValue={paginationJson} setJsonValue={setPaginationJson} fetchValue={paginationFetch} setFetchValue={setPaginationFetch} curlValue={paginationCurl} setCurlValue={setPaginationCurl}/>
                    <ConfigEditor title="Individual Job Request" subtitle="Used for fetching details of a single job." jsonValue={individualJobJson} setJsonValue={setIndividualJobJson} fetchValue={individualJobFetch} setFetchValue={setIndividualJobFetch} curlValue={individualJobCurl} setCurlValue={setIndividualJobCurl}/>
                </div>
            )}
        </div>
    );
}