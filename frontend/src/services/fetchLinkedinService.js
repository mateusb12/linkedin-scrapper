import axios from "axios";

// Best practice: Define a single base URL for your API
const API_BASE_URL = "http://localhost:5000";

// URLs for different blueprints
const FETCH_JOBS_URL = `${API_BASE_URL}/fetch-jobs`;
const SERVICES_URL = `${API_BASE_URL}/services`; // <-- URL for the /services blueprint

export async function getTotalPages() {
    // Using the more specific URL variable
    const res = await axios.get(`${FETCH_JOBS_URL}/get-total-pages`);
    return res.data.total_pages;
}

export async function fetchJobsByPageRange(startPage, endPage, onProgress, onLog) {
    const totalPagesToFetch = endPage - startPage + 1;
    let allData = [];
    let successfulFetches = 0;

    for (let i = startPage; i <= endPage; i++) {
        try {
            onLog?.(`Fetching page ${i}...`);
            // Using the more specific URL variable
            const res = await axios.get(`${FETCH_JOBS_URL}/fetch-page/${i}`);

            if (Array.isArray(res.data.jobs)) {
                allData.push(...res.data.jobs);
                onLog?.(`✅ Successfully fetched page ${i}`);
            } else {
                onLog?.(`⚠️ Page ${i} response did not contain a 'jobs' array.`);
            }

            successfulFetches++;
        } catch (err) {
            const errorMessage = err.response?.data?.description || err.message;
            onLog?.(`❌ Failed to fetch page ${i}: ${errorMessage}`);

            const isNetworkError =
                !err.response || err.code === "ERR_NETWORK" || err.message === "Network Error";

            if (isNetworkError) {
                onLog?.("🛑 Network error detected — aborting remaining requests.");
                return { data: allData, successCount: successfulFetches, error: "Network error" };
            }
        }

        const pagesFetched = i - startPage + 1;
        const progress = (pagesFetched / totalPagesToFetch) * 100;
        onProgress?.({ page: i, progress });
    }

    return { data: allData, successCount: successfulFetches };
}

export const startKeywordExtractionStream = (onProgress, onComplete, onError) => {
    // Connect to the new streaming endpoint using the correct base URL and path
    const eventSource = new EventSource(`${API_BASE_URL}/jobs/keywords-stream`);

    // Listener for regular data messages
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onProgress(data); // Pass the data to the component's handler
    };

    // Listener for the custom 'complete' event from the backend
    eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        onComplete(data);
        eventSource.close(); // Close the connection on completion
    });

    // Listener for connection errors or custom 'error' events from the backend
    eventSource.onerror = (event) => {
        let errorData;
        if (event.data) {
            try {
                errorData = JSON.parse(event.data);
            } catch (e) {
                errorData = { error: "An unknown error occurred, and the error payload was not valid JSON." };
            }
        } else {
            errorData = { error: "Connection to the server was lost. Please check the backend console." };
        }
        onError(errorData);
        eventSource.close(); // Close the connection on error
    };

    return eventSource;
};


// --- NEW FUNCTIONS FOR COOKIE MANAGEMENT ---

/**
 * Fetches the current LinkedIn cookie from the backend.
 * @param {string | number} identifier - The name or ID of the FetchCurl record (e.g., 'LinkedIn_Saved_Jobs_Scraper').
 * @returns {Promise<string>} The cookie string.
 */
export async function getLinkedinCookie(identifier) {
    const res = await axios.get(`${SERVICES_URL}/cookies`, {
        params: { identifier }
    });
    return res.data.cookies;
}

/**
 * Updates the LinkedIn cookie in the backend.
 * @param {string | number} identifier - The name or ID of the FetchCurl record.
 * @param {string} cookies - The new cookie string to save.
 * @returns {Promise<object>} The success response from the server.
 */
export async function updateLinkedinCookie(identifier, cookies) {
    const payload = { identifier, cookies };
    const res = await axios.put(`${SERVICES_URL}/cookies`, payload);
    return res.data;
}