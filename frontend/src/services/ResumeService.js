/**
 * @file ResumeService.js
 * This service handles all API communications for resume management.
 */

// Define the base URL for the API endpoint
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Fetches all resumes from the backend.
 * @returns {Promise<Array>} A promise that resolves to an array of resumes.
 */
export const fetchResumes = async () => {
    const response = await fetch(`${API_BASE}/jobs/`);
    if (!response.ok) {
        throw new Error('Failed to fetch resumes');
    }
    return response.json();
};

/**
 * Fetches a single resume by its ID.
 * @param {string} id - The ID of the resume to fetch.
 * @returns {Promise<Object>} A promise that resolves to the resume data.
 */
export const fetchResumeById = async (id) => {
    const response = await fetch(`${API_BASE}/jobs/${id}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch resume with ID ${id}`);
    }
    return response.json();
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
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }
    return result;
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
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }
    return result;
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
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }
    return result;
};
