import React, { useState, useEffect } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { ResultsView } from "../home/ResultsView.jsx";
import {
    fetchJobsByPageRange,
    getTotalPages,
    startKeywordExtractionStream
} from "../../services/fetchLinkedinService.js";
// Import the new streaming service

export const FetchJobsView = () => {
    // --- Existing State ---
    const [totalPages, setTotalPages] = useState(0);
    const [startPage, setStartPage] = useState(1);
    const [endPage, setEndPage] = useState(1);
    const [isFetchingTotal, setIsFetchingTotal] = useState(false);
    const [isFetchingPages, setIsFetchingPages] = useState(false);
    const [log, setLog] = useState([]);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [fetchedData, setFetchedData] = useState([]);

    // --- New State for Keyword Extraction ---
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionProgress, setExtractionProgress] = useState(0);
    const [extractionLog, setExtractionLog] = useState([]);
    const [extractionError, setExtractionError] = useState('');
    const [totalToProcess, setTotalToProcess] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [eventSource, setEventSource] = useState(null);

    // --- Existing Handlers (handleGetTotalPages, handleFetchPages) remain the same ---
    const handleGetTotalPages = async () => {
        setIsFetchingTotal(true);
        setError('');
        setFetchedData([]);
        try {
            const pages = await getTotalPages();
            setTotalPages(pages);
            setEndPage(pages > 0 ? pages : 1);
        } catch (err) {
            console.error("Error fetching total pages:", err);
            setError("Failed to fetch total pages. Is the server running?");
        } finally {
            setIsFetchingTotal(false);
        }
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
        const result = await fetchJobsByPageRange(
            startPage,
            endPage,
            ({ progress }) => setProgress(progress),
            (message) => setLog(prev => [...prev, message])
        );
        setFetchedData(result.data);
        if (result.error) {
            setError("An error occurred. See log for details.");
        }
        setLog(prev => [
            ...prev,
            `--- All tasks complete. Fetched ${result.successCount}/${endPage - startPage + 1} pages successfully. ---`
        ]);
        setIsFetchingPages(false);
    };


    // --- New Handler for Keyword Extraction ---
    const handleKeywordExtraction = () => {
        // Reset state before starting
        setIsExtracting(true);
        setExtractionProgress(0);
        setExtractionLog([]);
        setExtractionError('');
        setTotalToProcess(0);
        setProcessedCount(0);

        const es = startKeywordExtractionStream(
            (progressData) => { // onProgress
                if (progressData.total && totalToProcess === 0) {
                    setTotalToProcess(progressData.total);
                    setExtractionLog(prev => [...prev, `Found ${progressData.total} jobs to process...`]);
                }
                if (progressData.processed && progressData.total) {
                    const percent = (progressData.processed / progressData.total) * 100;
                    setExtractionProgress(percent);
                    setProcessedCount(progressData.processed);
                    setExtractionLog(prev => [...prev, `[${progressData.processed}/${progressData.total}] ${progressData.message}`]);
                }
            },
            (completeData) => { // onComplete
                setExtractionLog(prev => [...prev, `✅ ${completeData.message}`]);
                setIsExtracting(false);
                setEventSource(null);
            },
            (errorData) => { // onError
                setExtractionError(errorData.error || 'An unknown error occurred during extraction.');
                setExtractionLog(prev => [...prev, `❌ Error: ${errorData.error}`]);
                setIsExtracting(false);
                setEventSource(null);
            }
        );
        setEventSource(es);
    };

    // Cleanup effect to close the connection if the component unmounts
    useEffect(() => {
        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [eventSource]);


    return (
        <div>
            <h1 className="text-3xl font-bold border-b border-gray-300 dark:border-gray-700 pb-3 text-gray-900 dark:text-gray-100">
                Data Processing Pipeline
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 mb-8">
                Run the full data fetching and processing pipeline step-by-step.
            </p>

            {/* Step 1: Get Total Pages (Existing UI) */}
            <div className="bg-white dark:bg-[#2d2d3d] p-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600">
                {/* ... your existing JSX for Step 1 ... */}
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">
                    Step 1: Get Total Available Pages
                </h2>
                <div className="flex items-center mt-4 space-x-4">
                    <button
                        onClick={handleGetTotalPages}
                        disabled={isFetchingTotal || isFetchingPages || isExtracting}
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


            {/* Step 2: Fetch Page Range (Existing UI) */}
            <div className={`mt-8 bg-white dark:bg-[#2d2d3d] p-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 ${totalPages === 0 ? 'opacity-50' : ''}`}>
                {/* ... your existing JSX for Step 2 ... */}
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
                            disabled={totalPages === 0 || isFetchingPages || isExtracting}
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
                            disabled={totalPages === 0 || isFetchingPages || isExtracting}
                            className="mt-1 w-28 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                            min={startPage}
                            max={totalPages}
                        />
                    </div>
                    <button
                        onClick={handleFetchPages}
                        disabled={totalPages === 0 || isFetchingPages || isExtracting}
                        className="self-end py-2 px-6 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                        {isFetchingPages && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Start Fetching
                    </button>
                </div>
            </div>

            {/* --- New UI: Step 3 for Keyword Extraction --- */}
            <div className="mt-8 bg-white dark:bg-[#2d2d3d] p-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">
                    Step 3: Extract Keywords & Skills
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2 mb-4">
                    Process all jobs in the database to extract keywords and skills using the LLM. This is a long-running process that will stream its progress.
                </p>
                <button
                    onClick={handleKeywordExtraction}
                    disabled={isExtracting || isFetchingPages}
                    className="py-2 px-4 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                    {isExtracting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Start Extraction
                </button>
            </div>

            {/* Progress Bar and Log for Page Fetching (Existing UI) */}
            {(isFetchingPages || log.length > 0) && (
                <div className="mt-8">
                    {/* ... your existing JSX for page fetching progress ... */}
                </div>
            )}

            {/* --- New UI: Progress Bar and Log for Extraction --- */}
            {(isExtracting || extractionLog.length > 0) && (
                <div className="mt-8">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">Extraction Progress</h2>
                    {isExtracting && totalToProcess > 0 && (
                        <div className="mt-4">
                            <div className="flex justify-between mb-1">
                                <span className="text-base font-medium text-purple-700 dark:text-white">
                                    Processing Job {processedCount} of {totalToProcess}
                                </span>
                                <span className="text-sm font-medium text-purple-700 dark:text-white">
                                    {Math.round(extractionProgress)}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                                     style={{width: `${extractionProgress}%`}}></div>
                            </div>
                        </div>
                    )}
                    {extractionError &&
                        <p className="mt-4 text-sm text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-md">{extractionError}</p>}
                    <pre className="mt-4 p-4 bg-gray-900 text-white rounded-lg text-sm font-mono overflow-x-auto h-64">
                        {extractionLog.map((entry, i) => <div key={i}>{entry}</div>)}
                    </pre>
                </div>
            )}


            {/* Results Output (Existing UI) */}
            {fetchedData.length > 0 && !isFetchingPages && (
                <ResultsView data={fetchedData} />
            )}
        </div>
    );
};
