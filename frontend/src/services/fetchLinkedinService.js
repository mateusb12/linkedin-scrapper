import axios from "axios";

const API_BASE_URL = "http://localhost:5000";

// Correct URL prefixes
const PIPELINE_URL = `${API_BASE_URL}/pipeline`;
const CONFIG_URL = `${API_BASE_URL}/config`;
const SERVICES_URL = `${API_BASE_URL}/services`;

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

                // --- LOGIC FOR SKIPPING ---
                if (count > 0) {
                    // Scenario A: found new jobs
                    onLog?.(`✅ Page ${i}: Saved ${count} new jobs (Found ${totalFound})`);
                } else if (totalFound > 0 && count === 0) {
                    // Scenario B: found jobs, but all exist in DB -> SKIP
                    onLog?.(`⏭️ SKIPPING PAGE ${i} - All ${totalFound} jobs already in database.`);
                } else {
                    // Scenario C: page was empty
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

            if (!err.response || err.code === "ERR_NETWORK") {
                onLog?.("🛑 Network error detected — aborting.");
                return { data: allData, successCount: successfulFetches, error: "Network error" };
            }
        }

        const pagesFetched = i - startPage + 1;
        const progress = (pagesFetched / totalPagesToFetch) * 100;
        onProgress?.({ page: i, progress });
    }

    return { data: allData, successCount: successfulFetches };
}

// ... (Keep the rest of your file: startKeywordExtractionStream, cookies, etc.)
export const startKeywordExtractionStream = (onProgress, onComplete, onError) => {
    const eventSource = new EventSource(`${API_BASE_URL}/jobs/keywords-stream`);
    eventSource.onmessage = (event) => onProgress(JSON.parse(event.data));
    eventSource.addEventListener('complete', (event) => {
        onComplete(JSON.parse(event.data));
        eventSource.close();
    });
    eventSource.onerror = (event) => {
        onError({ error: "Connection lost" });
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