/**
 * @file JobService.js
 * This service handles all API communications for resumes and jobs.
 */

// Define the base URL for the API endpoint from environment variables or a default
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * A generic handler for API responses.
 * It checks if the response is successful and parses the JSON body.
 * Throws a formatted error if the request fails.
 * @param {Response} response - The fetch response object.
 * @param {string} defaultErrorMsg - A default error message to use if the response body doesn't contain one.
 * @returns {Promise<any>} The parsed JSON data.
 */
const handleResponse = async (response, defaultErrorMsg) => {
    // Try to parse the JSON body, even for errors, as it may contain an 'error' key.
    const result = await response.json().catch(() => {
        // If JSON parsing fails, create a standard error object.
        return { error: `Invalid JSON response from server.` };
    });

    if (!response.ok) {
        // Throw an error using the message from the API response, the default message, or a generic status error.
        throw new Error(result.error || defaultErrorMsg || `HTTP error! status: ${response.status}`);
    }

    return result;
};


// --- Resume/Profile Functions ---

/**
 * Fetches all resumes (profiles) from the backend.
 * @returns {Promise<Array>} A promise that resolves to an array of resumes.
 */
export const fetchResumes = async () => {
    const response = await fetch(`${API_BASE}/jobs/`);
    return handleResponse(response, 'Failed to fetch resumes');
};

/**
 * Fetches a single resume by its ID.
 * @param {string} id - The ID of the resume to fetch.
 * @returns {Promise<Object>} A promise that resolves to the resume data.
 */
export const fetchResumeById = async (id) => {
    const response = await fetch(`${API_BASE}/jobs/${id}`);
    return handleResponse(response, `Failed to fetch resume with ID ${id}`);
};

/**
 * Creates a new resume on the backend.
 * @param {Object} payload - The data for the new resume.
 * @returns {Promise<Object>} A promise that resolves to the created resume data.
 */
export const createResume = async (payload) => {
    const response = await fetch(`${API_BASE}/jobs/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response, 'Failed to create resume');
};

/**
 * Updates an existing resume.
 * @param {string} id - The ID of the resume to update.
 * @param {Object} payload - The updated data for the resume.
 * @returns {Promise<Object>} A promise that resolves to the success message.
 */
export const updateResume = async (id, payload) => {
    const response = await fetch(`${API_BASE}/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response, 'Failed to update resume');
};

/**
 * Deletes a resume from the backend.
 * @param {string} id - The ID of the resume to delete.
 * @returns {Promise<Object>} A promise that resolves to the success message.
 */
export const deleteResume = async (id) => {
    const response = await fetch(`${API_BASE}/jobs/${id}`, {
        method: 'DELETE'
    });
    return handleResponse(response, 'Failed to delete resume');
};


// --- Job Matching Functions ---

/**
 * Fetches all jobs from the backend for matching.
 * @returns {Promise<Array>} A promise that resolves to an array of all jobs.
 */
export const fetchAllJobs = async () => {
    const response = await fetch(`${API_BASE}/jobs/all`);
    return handleResponse(response, 'Failed to fetch all jobs');
};

/**
 * Marks a specific job as applied by sending a PATCH request.
 * @param {string} jobUrn - The URN of the job to update.
 * @returns {Promise<Object>} A promise that resolves to the updated job data.
 */
export const markJobAsApplied = async (jobUrn) => {
    const response = await fetch(`${API_BASE}/jobs/${jobUrn}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applied_on: new Date().toISOString() }),
    });
    return handleResponse(response, 'Failed to mark job as applied');
};
