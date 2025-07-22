const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const handleResponse = async (response, defaultErrorMsg) => {
    const result = await response.json().catch(() => {
        return { error: `Invalid JSON response from server.` };
    });

    if (!response.ok) {
        throw new Error(result.error || defaultErrorMsg || `HTTP error! status: ${response.status}`);
    }

    return result;
};

// ---------------- RESUME FUNCTIONS ---------------- //

export const fetchResumes = async () => {
    const response = await fetch(`${API_BASE}/jobs/`);
    return handleResponse(response, 'Failed to fetch resumes');
};

export const fetchResumeById = async (id) => {
    const response = await fetch(`${API_BASE}/jobs/${id}`);
    return handleResponse(response, `Failed to fetch resume with ID ${id}`);
};

/**
 * Creates a new resume with full fields including summary and projects.
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
 * Updates a resume including fields: name, summary, hard_skills, experience, education, and projects.
 */
export const updateResume = async (id, payload) => {
    const response = await fetch(`${API_BASE}/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response, 'Failed to update resume');
};

export const deleteResume = async (id) => {
    const response = await fetch(`${API_BASE}/jobs/${id}`, {
        method: 'DELETE'
    });
    return handleResponse(response, 'Failed to delete resume');
};

export const tailorResume = async (payload) => {
    const response = await fetch(`${API_BASE}/jobs/tailor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response, 'Failed to tailor resume');
};

// ---------------- PROFILE FUNCTIONS ---------------- //

export const fetchProfiles = async () => {
    const response = await fetch(`${API_BASE}/profiles/`);
    return handleResponse(response, 'Failed to fetch profiles');
};

export const fetchProfileById = async (id) => {
    const response = await fetch(`${API_BASE}/profiles/${id}`);
    return handleResponse(response, `Failed to fetch profile with ID ${id}`);
};

export const createProfile = async (payload) => {
    const response = await fetch(`${API_BASE}/profiles/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response, 'Failed to create profile');
};

export const updateProfile = async (id, payload) => {
    const response = await fetch(`${API_BASE}/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response, 'Failed to update profile');
};

export const deleteProfile = async (id) => {
    const response = await fetch(`${API_BASE}/profiles/${id}`, {
        method: 'DELETE'
    });
    return handleResponse(response, 'Failed to delete profile');
};

// ---------------- JOB FUNCTIONS ---------------- //

export const fetchAllJobs = async () => {
    const response = await fetch(`${API_BASE}/jobs/all`);
    return handleResponse(response, 'Failed to fetch all jobs');
};

export const markJobAsApplied = async (jobUrn) => {
    const response = await fetch(`${API_BASE}/jobs/${jobUrn}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applied_on: new Date().toISOString() }),
    });
    return handleResponse(response, 'Failed to mark job as applied');
};
