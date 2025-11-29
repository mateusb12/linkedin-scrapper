import axios from "axios";

const API_BASE_URL = "http://localhost:5000";

// ✅ UPDATED: Distinct constants for distinct resources
const PIPELINE_URL = `${API_BASE_URL}/pipeline`; // For running the fetch process
const CONFIG_URL = `${API_BASE_URL}/config`;     // For saving cURL settings
const SERVICES_URL = `${API_BASE_URL}/services`;

// 1. Pipeline Actions
export async function getTotalPages() {
    const res = await axios.get(`${PIPELINE_URL}/get-total-pages`);
    return res.data.total_pages;
}

export async function fetchJobsByPageRange(startPage, endPage, onProgress, onLog) {
    const totalPagesToFetch = endPage - startPage + 1;
    let successfulFetches = 0;
    let allData = [];

    for (let i = startPage; i <= endPage; i++) {
        try {
            onLog?.(`Fetching page ${i}...`);
            // ✅ UPDATED URL
            const res = await axios.get(`${PIPELINE_URL}/fetch-page/${i}`);

            if (res.data.success) {
                const count = res.data.count || 0;
                const totalFound = res.data.total_found || 0;

                if (count > 0) {
                    onLog?.(`✅ Page ${i}: Saved ${count} new jobs (Found ${totalFound})`);
                } else {
                    onLog?.(`⚠️ Page ${i}: Processed successfully but no new jobs saved.`);
                }
                successfulFetches++;
            } else {
                const msg = res.data.message || res.data.error || "Unknown backend error";
                onLog?.(`⚠️ Page ${i}: Backend reported failure: ${msg}`);
            }

        } catch (err) {
            const errorMessage = err.response?.data?.description || err.response?.data?.error || err.message;
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

// 2. Configuration Actions (If you have a settings page calling these)
// You didn't show the frontend code for these, but if they exist, update them:
export async function savePaginationCurl(curlString) {
    return axios.put(`${CONFIG_URL}/pagination-curl`, { curl: curlString });
}

export async function saveIndividualJobCurl(curlString) {
    return axios.put(`${CONFIG_URL}/individual-job-curl`, { curl: curlString });
}

// ... existing Keyword Extraction and Cookie functions remain unchanged ...
export const startKeywordExtractionStream = (onProgress, onComplete, onError) => {
    // This is on a different controller (JobController), so ensure that URL is correct too.
    // Assuming your app.py registers job_data_bp with /jobs prefix:
    const eventSource = new EventSource(`${API_BASE_URL}/jobs/keywords-stream`);

    // ... rest of stream logic ...
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onProgress(data);
    };

    eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        onComplete(data);
        eventSource.close();
    });

    eventSource.onerror = (event) => {
        let errorData;
        if (event.data) {
            try { errorData = JSON.parse(event.data); } catch (e) { errorData = { error: "Unknown error" }; }
        } else {
            errorData = { error: "Connection lost." };
        }
        onError(errorData);
        eventSource.close();
    };
    return eventSource;
};

export async function getLinkedinCookie(identifier) {
    const res = await axios.get(`${SERVICES_URL}/cookies`, { params: { identifier } });
    return res.data.cookies;
}

export async function updateLinkedinCookie(identifier, cookies) {
    const payload = { identifier, cookies };
    const res = await axios.put(`${SERVICES_URL}/cookies`, payload);
    return res.data;
}