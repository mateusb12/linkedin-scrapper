import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ResultsView } from "../home/ResultsView.jsx";
import {
    fetchJobsByPageRange,
    getTotalPages,
    startKeywordExtractionStream
} from "../../services/fetchLinkedinService.js";

// Helper function to format milliseconds into HH:MM:SS
const formatDuration = (ms) => {
    if (ms < 0 || !isFinite(ms)) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');
};

// Helper function to format a Date object into HH:MM:SS
const formatTime = (date) => {
    if (!date || !(date instanceof Date) || !isFinite(date)) return '...';
    return date.toLocaleTimeString('en-GB'); // en-GB for HH:MM:SS format
};


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

    // --- State for Keyword Extraction ---
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionProgress, setExtractionProgress] = useState(0);
    const [extractionLog, setExtractionLog] = useState([]);
    const [extractionError, setExtractionError] = useState('');
    const [totalToProcess, setTotalToProcess] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [eventSource, setEventSource] = useState(null);
    const [extractionStartTime, setExtractionStartTime] = useState(null);
    const [extractionStats, setExtractionStats] = useState(null);

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


    const handleStartExtraction = () => {
        setIsExtracting(true);
        setExtractionProgress(0);
        setExtractionLog([]);
        setExtractionError('');
        setTotalToProcess(0);
        setProcessedCount(0);
        setExtractionStats(null);
        setExtractionStartTime(Date.now());

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

    const handleStopExtraction = () => {
        if (eventSource) {
            eventSource.close();
        }
        setIsExtracting(false);
        setEventSource(null);
        setExtractionLog(prev => [...prev, '🛑 Extraction stopped by user.']);
    };


    // Effect for calculating real-time stats
    useEffect(() => {
        if (!isExtracting || processedCount === 0 || !extractionStartTime || totalToProcess === 0) {
            setExtractionStats(null);
            return;
        }

        const intervalId = setInterval(() => {
            const elapsedTimeMs = Date.now() - extractionStartTime;
            if (elapsedTimeMs <= 0 || processedCount === 0) return;

            const timePerJob = elapsedTimeMs / processedCount;
            const jobsPerMinute = (processedCount / elapsedTimeMs) * 60000;
            const remainingJobs = totalToProcess - processedCount;
            const remainingTimeMs = remainingJobs * timePerJob;
            const eta = new Date(Date.now() + remainingTimeMs);

            setExtractionStats({
                remaining: remainingJobs,
                timePerJob: (timePerJob / 1000).toFixed(2),
                jobsPerMinute: jobsPerMinute.toFixed(1),
                remainingTime: formatDuration(remainingTimeMs),
                eta: formatTime(eta),
            });
        }, 1000); // Update stats every second

        return () => clearInterval(intervalId);
    }, [isExtracting, processedCount, totalToProcess, extractionStartTime]);


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

            {/* Step 1: Get Total Pages */}
            <div className="bg-white dark:bg-[#2d2d3d] p-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600">
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

            {/* Step 2: Fetch Page Range */}
            <div className={`mt-8 bg-white dark:bg-[#2d2d3d] p-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 ${totalPages === 0 ? 'opacity-50' : ''}`}>
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

            {/* Step 3: Keyword Extraction */}
            <div className="mt-8 bg-white dark:bg-[#2d2d3d] p-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">
                    Step 3: Extract Keywords & Skills
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2 mb-4">
                    Process all jobs in the database to extract keywords and skills using the LLM. This is a long-running process that will stream its progress.
                </p>
                {!isExtracting ? (
                    <button
                        onClick={handleStartExtraction}
                        disabled={isFetchingPages}
                        className="py-2 px-4 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                        Start Extraction
                    </button>
                ) : (
                    <button
                        onClick={handleStopExtraction}
                        className="py-2 px-4 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-500 transition-colors flex items-center"
                    >
                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                        Stop Extraction
                    </button>
                )}
            </div>

            {/* Progress Bar and Log for Page Fetching */}
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

            {/* Progress Bar, Stats, and Log for Extraction */}
            {(isExtracting || extractionLog.length > 0) && (
                <div className="mt-8">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">Extraction Progress</h2>
                    {(isExtracting || processedCount > 0) && totalToProcess > 0 && (
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
                            {extractionStats && (
                                <div className="mt-3 flex flex-wrap items-center justify-center text-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-900/50 p-3 rounded-md">
                                    <span>remaining: <strong className="text-gray-800 dark:text-gray-200">{extractionStats.remaining}</strong></span>
                                    <span className="text-gray-400 dark:text-gray-600 hidden sm:inline">|</span>
                                    <span>time/job: <strong className="text-gray-800 dark:text-gray-200">{extractionStats.timePerJob}s</strong></span>
                                    <span className="text-gray-400 dark:text-gray-600 hidden sm:inline">|</span>
                                    <span>jobs/min: <strong className="text-gray-800 dark:text-gray-200">{extractionStats.jobsPerMinute}</strong></span>
                                    <span className="text-gray-400 dark:text-gray-600 hidden md:inline">|</span>
                                    <span>rem time: <strong className="text-gray-800 dark:text-gray-200">{extractionStats.remainingTime}</strong></span>
                                    <span className="text-gray-400 dark:text-gray-600 hidden md:inline">|</span>
                                    <span>ETA: <strong className="text-gray-800 dark:text-gray-200">{extractionStats.eta}</strong></span>
                                </div>
                            )}
                        </div>
                    )}
                    {extractionError &&
                        <p className="mt-4 text-sm text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-md">{extractionError}</p>}
                    <pre className="mt-4 p-4 bg-gray-900 text-white rounded-lg text-sm font-mono overflow-x-auto h-64">
                        {extractionLog.map((entry, i) => <div key={i}>{entry}</div>)}
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