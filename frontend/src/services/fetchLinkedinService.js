import axios from "axios";

const API_BASE_URL = "http://localhost:5000";

// Correct URL prefixes matching the backend Blueprints
const PIPELINE_URL = `${API_BASE_URL}/pipeline`;
const CONFIG_URL = `${API_BASE_URL}/config`;
const PROFILES_URL = `${API_BASE_URL}/profiles`;

// --- 1. CONFIGURATION (Generic Scrapers) ---

export async function getPaginationCurl() {
    const res = await axios.get(`${CONFIG_URL}/pagination-curl`);
    return res.data;
}

export async function getIndividualJobCurl() {
    const res = await axios.get(`${CONFIG_URL}/individual-job-curl`);
    return res.data;
}

export async function savePaginationCurl(curlString) {
    return axios.put(`${CONFIG_URL}/pagination-curl`, { curl: curlString });
}

export async function saveIndividualJobCurl(curlString) {
    return axios.put(`${CONFIG_URL}/individual-job-curl`, { curl: curlString });
}

// --- 2. PIPELINE EXECUTION ---

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

            const res = await axios.get(`${PIPELINE_URL}/fetch-page/${i}`);

            if (res.data.success) {
                const count = res.data.count || 0;
                const totalFound = res.data.total_found || 0;

                if (count > 0) {
                    onLog?.(`✅ Page ${i}: Saved ${count} new jobs (Found ${totalFound})`);
                } else if (totalFound > 0 && count === 0) {
                    onLog?.(`⏭️ SKIPPING PAGE ${i} - All ${totalFound} jobs already in database.`);
                } else {
                    onLog?.(`⚠️ Page ${i}: No jobs found on this page.`);
                }

                successfulFetches++;
            } else {
                const msg = res.data.message || res.data.error || "Unknown error";
                onLog?.(`❌ Page ${i} Error: ${msg}`);
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

// --- 3. EXTRACTION STREAM ---

export const startKeywordExtractionStream = (onProgress, onComplete, onError) => {
    const eventSource = new EventSource(`${API_BASE_URL}/jobs/keywords-stream`);

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
            try {
                errorData = JSON.parse(event.data);
            } catch (e) {
                errorData = { error: "An unknown error occurred." };
            }
        } else {
            errorData = { error: "Connection lost. Check backend console." };
        }
        onError(errorData);
        eventSource.close();
    };

    return eventSource;
};

// --- 4. PROFILE & INTEGRATIONS ---

/**
 * Fetch all profiles.
 * Used to determine the current active user context.
 */
export async function getProfiles() {
    const res = await axios.get(`${PROFILES_URL}/`);
    return res.data;
}

/**
 * Updates the SMTP password for a specific profile.
 */
export const saveGmailToken = async (profileId, token) => {
    try {
        const response = await axios.patch(`${PROFILES_URL}/${profileId}/smtp-password`, {
            email_app_password: token
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Tests the Gmail connection by asking the backend to send a self-email.
 */
export const testGmailConnection = async (profileId) => {
    try {
        const response = await axios.post(`${PROFILES_URL}/${profileId}/test-smtp`);
        return response.data;
    } catch (error) {
        throw error;
    }
};