import axios from "axios";

const BASE_URL = "http://localhost:5000/fetch-jobs";

export async function getTotalPages() {
    const res = await axios.get(`${BASE_URL}/get-total-pages`);
    return res.data.total_pages;
}

export async function fetchJobsByPageRange(startPage, endPage, onProgress, onLog) {
    const totalPagesToFetch = endPage - startPage + 1;
    let allData = [];
    let successfulFetches = 0;

    for (let i = startPage; i <= endPage; i++) {
        try {
            onLog?.(`Fetching page ${i}...`);
            const res = await axios.get(`${BASE_URL}/fetch-page/${i}`);

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
