import React, { useState } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { ResultsView } from "../home/ResultsView.jsx"; // Assumes ResultsView.jsx is in the same folder

export const FetchJobsView = () => {
    const [totalPages, setTotalPages] = useState(0);
    const [startPage, setStartPage] = useState(1);
    const [endPage, setEndPage] = useState(1);
    const [isFetchingTotal, setIsFetchingTotal] = useState(false);
    const [isFetchingPages, setIsFetchingPages] = useState(false);
    const [log, setLog] = useState([]);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [fetchedData, setFetchedData] = useState([]);

    const handleGetTotalPages = () => {
        setIsFetchingTotal(true);
        setError('');
        setFetchedData([]);
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
        setFetchedData([]);
        setProgress(0);

        const totalPagesToFetch = endPage - startPage + 1;
        let successfulFetches = 0;
        let allData = [];

        for (let i = startPage; i <= endPage; i++) {
            try {
                setLog(prev => [...prev, `Fetching page ${i}...`]);

                const res = await axios.get(
                    `http://localhost:5000/fetch-jobs/fetch-page/${i}`
                );

                setLog(prev => [...prev, `✅ Successfully fetched page ${i}`]);

                if (Array.isArray(res.data.jobs)) {
                    allData = [...allData, ...res.data.jobs];
                } else {
                    setLog(prev => [
                        ...prev,
                        `⚠️ Page ${i} response did not contain a 'jobs' array.`
                    ]);
                }

                successfulFetches++;
            } catch (err) {
                console.error(`Error fetching page ${i}:`, err);

                const errorMessage = err.response?.data?.description || err.message;
                setLog(prev => [
                    ...prev,
                    `❌ Failed to fetch page ${i}: ${errorMessage}`
                ]);
                setError("An error occurred. See log for details.");

                const isNetworkError =
                    !err.response ||
                    err.code === "ERR_NETWORK" ||
                    err.message === "Network Error";

                if (isNetworkError) {
                    const pagesFetched = i - startPage + 1;
                    setProgress((pagesFetched / totalPagesToFetch) * 100);

                    setLog(prev => [
                        ...prev,
                        "🛑 Network error detected — aborting remaining requests."
                    ]);
                    break;
                }
            }
            const pagesFetched = i - startPage + 1;
            setProgress((pagesFetched / totalPagesToFetch) * 100);
        }

        setFetchedData(allData);
        setLog(prev => [...prev, `--- All tasks complete. Fetched ${successfulFetches}/${totalPagesToFetch} pages successfully. ---`]);
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
            <div
                className="bg-white dark:bg-[#2d2d3d] p-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">
                    Step 1: Get Total Available Pages
                </h2>
                <div className="flex items-center mt-4 space-x-4">
                    <button
                        onClick={handleGetTotalPages}
                        disabled={isFetchingTotal || isFetchingPages}
                        className="py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                        {isFetchingTotal && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Get Total Pages
                    </button>
                    {totalPages > 0 && (
                        <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
                            Total Pages Found: <span
                            className="font-bold text-blue-600 dark:text-blue-400">{totalPages}</span>
                        </p>
                    )}
                </div>
            </div>

            {/* Step 2: Fetch Page Range */}
            <div
                className={`mt-8 bg-white dark:bg-[#2d2d3d] p-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 ${totalPages === 0 ? 'opacity-50' : ''}`}>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">
                    Step 2: Select Pages to Fetch
                </h2>
                <div className="flex items-center mt-4 space-x-4">
                    <div>
                        <label htmlFor="startPage"
                               className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Page</label>
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
                        <label htmlFor="endPage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">End
                            Page</label>
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
                        {isFetchingPages && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Start Fetching
                    </button>
                </div>
            </div>

            {/* Progress Bar and Log */}
            {(isFetchingPages || log.length > 0) && (
                <div className="mt-8">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">Fetch Progress</h2>
                    {isFetchingPages && (
                        <div className="mt-4">
                            <div className="flex justify-between mb-1">
                                <span className="text-base font-medium text-blue-700 dark:text-white">Progress</span>
                                <span
                                    className="text-sm font-medium text-blue-700 dark:text-white">{Math.round(progress)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                     style={{width: `${progress}%`}}></div>
                            </div>
                        </div>
                    )}
                    {error &&
                        <p className="mt-4 text-sm text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-md">{error}</p>}
                    <pre className="mt-4 p-4 bg-gray-900 text-white rounded-lg text-sm font-mono overflow-x-auto h-64">
                        {log.map((entry, i) => <div key={i}>{entry}</div>)}
                    </pre>
                </div>
            )}

            {/* Results Output */}
            {fetchedData.length > 0 && !isFetchingPages && (
                <ResultsView data={fetchedData} />
            )}
        </div>
    );
};