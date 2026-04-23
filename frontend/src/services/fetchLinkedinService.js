import axios from "axios";

const API_BASE_URL = "http://localhost:5000";

const PIPELINE_URL = `${API_BASE_URL}/pipeline`;
const CONFIG_URL = `${API_BASE_URL}/config`;
const PROFILES_URL = `${API_BASE_URL}/profiles`;

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

export async function getTotalPages() {
  const res = await axios.get(`${PIPELINE_URL}/get-total-pages`);
  return res.data.total_pages;
}

export async function fetchJobsByPageRange(
  startPage,
  endPage,
  onProgress,
  onLog,
) {
  return new Promise((resolve) => {
    let completed = false;
    const eventSource = new EventSource(
      `${PIPELINE_URL}/fetch-range-stream?start_page=${startPage}&end_page=${endPage}`,
    );

    const finalize = (payload = {}) => {
      if (completed) return;
      completed = true;
      eventSource.close();
      resolve({
        data: [],
        successCount: payload.successful_pages || 0,
        failedCount: payload.failed_pages || 0,
        processedPages: payload.processed_pages || 0,
        aborted: payload.aborted || false,
        error:
          payload.success === false
            ? payload.abort_reason || payload.error || "Pipeline failed"
            : null,
      });
    };

    const parseEventData = (event) => {
      try {
        return JSON.parse(event.data);
      } catch {
        return {};
      }
    };

    eventSource.addEventListener("page_start", (event) => {
      const data = parseEventData(event);
      onLog?.(data.message || `Fetching page ${data.page}...`);
    });

    eventSource.addEventListener("retry", (event) => {
      const data = parseEventData(event);
      const status = data.status ? ` status=${data.status}` : "";
      const step = data.step ? ` at ${data.step}` : "";
      onLog?.(
        `🔁 Page ${data.page}${step}${status}: retry ${data.attempt}/${data.max_attempts} in ${data.delay_seconds}s`,
      );
    });

    eventSource.addEventListener("warning", (event) => {
      const data = parseEventData(event);
      if (data.enrichment) {
        const enrichment = data.enrichment;
        const sample = enrichment.missing_ids_sample?.length
          ? ` sample=${enrichment.missing_ids_sample.join(", ")}`
          : "";
        onLog?.(
          `⚠️ Page ${data.page}: enrichment partial requested=${enrichment.requested} received=${enrichment.received} missing=${enrichment.missing_count}${sample}`,
        );
        return;
      }
      onLog?.(`⚠️ ${data.message || `Page ${data.page} warning`}`);
    });

    eventSource.addEventListener("page_result", (event) => {
      const data = parseEventData(event);

      if (data.success) {
        const count = data.count || 0;
        const totalFound = data.total_found || 0;
        if (data.result_type === "empty_page") {
          onLog?.(`⚠️ Page ${data.page}: No jobs found on this page.`);
        } else if (count > 0) {
          onLog?.(
            `✅ Page ${data.page}: Saved ${count} new jobs (Found ${totalFound})`,
          );
        } else if (totalFound > 0) {
          onLog?.(
            `⏭️ SKIPPING PAGE ${data.page} - All ${totalFound} jobs already in database.`,
          );
        } else {
          onLog?.(`✅ ${data.message || `Page ${data.page} completed`}`);
        }
        return;
      }

      const step = data.step ? ` at ${data.step}` : "";
      const curl = data.curl ? ` [${data.curl}]` : "";
      const status = data.status ? ` status=${data.status}` : "";
      const details = data.details ? ` (${data.details})` : "";
      const fatal = data.fatal ? " [fatal]" : "";
      onLog?.(
        `❌ Page ${data.page} failed${step}${curl}${status}${fatal}: ${data.error || data.message || "Unknown error"}${details}`,
      );
    });

    eventSource.addEventListener("progress", (event) => {
      const data = parseEventData(event);
      onProgress?.(data);
    });

    eventSource.addEventListener("pipeline_error", (event) => {
      const data = parseEventData(event);
      onLog?.(`🛑 ${data.message || data.error || "Pipeline error"}`);
    });

    eventSource.addEventListener("complete", (event) => {
      const data = parseEventData(event);
      onLog?.(
        data.success
          ? `--- ${data.message}. Fetched ${data.successful_pages}/${endPage - startPage + 1} pages successfully. ---`
          : `--- ${data.message}: ${data.abort_reason || "Unknown reason"}. ---`,
      );
      finalize(data);
    });

    eventSource.onerror = () => {
      if (completed) return;
      onLog?.("🛑 Stream connection lost. Check backend and retry.");
      finalize({
        success: false,
        aborted: true,
        error: "Stream connection lost",
      });
    };
  });
}

export const startKeywordExtractionStream = (
  onProgress,
  onComplete,
  onError,
) => {
  const eventSource = new EventSource(`${API_BASE_URL}/jobs/keywords-stream`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onProgress(data);
  };

  eventSource.addEventListener("complete", (event) => {
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

export async function getProfiles() {
  const res = await axios.get(`${PROFILES_URL}/`);
  return res.data;
}

export const saveGmailToken = async (profileId, token) => {
  try {
    const response = await axios.patch(
      `${PROFILES_URL}/${profileId}/smtp-password`,
      {
        email_app_password: token,
      },
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const testGmailConnection = async (profileId) => {
  try {
    const response = await axios.post(`${PROFILES_URL}/${profileId}/test-smtp`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export async function saveExperienceCurl(rawCurl) {
  return axios.put(`${CONFIG_URL}/experience`, { curl: rawCurl });
}

export async function deletePaginationCurl() {
  return axios.delete(`${CONFIG_URL}/pagination-curl`);
}

export async function deleteIndividualJobCurl() {
  return axios.delete(`${CONFIG_URL}/individual-job-curl`);
}

export async function getExperienceCurl() {
  const res = await axios.get(`${CONFIG_URL}/experience`);
  return res.data;
}

export async function deleteExperienceCurl() {
  return axios.delete(`${CONFIG_URL}/experience`);
}

export async function getGenericCurl(name) {
  const res = await axios.get(`${CONFIG_URL}/curl/${name}`);
  return res.data;
}

export async function saveGenericCurl(name, curlString) {
  return axios.put(`${CONFIG_URL}/curl/${name}`, curlString, {
    headers: { "Content-Type": "text/plain" },
  });
}

export async function deleteGenericCurl(name) {
  return axios.delete(`${CONFIG_URL}/curl/${name}`);
}
