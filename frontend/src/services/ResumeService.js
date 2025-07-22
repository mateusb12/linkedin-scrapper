const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const handleResponse = async (response, defaultErrorMsg) => {
    const result = await response.json().catch(() => {
        return {error: `Invalid JSON response from server.`};
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
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
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    });
    return handleResponse(response, 'Failed to tailor resume');
};

export const searchResumeByName = async (name) => {
    const response = await fetch(`${API_BASE}/jobs/search?name=${encodeURIComponent(name)}`);
    return handleResponse(response, `Failed to search resume by name: ${name}`);
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
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    });
    return handleResponse(response, 'Failed to create profile');
};

/**
 * Saves a profile by updating it if an ID exists, or creating a new one otherwise.
 * If an update is attempted on a non-existent ID (404), it proceeds to create a new profile.
 */
export const saveProfile = async (profileData) => {
    if (profileData.id) {
        const response = await fetch(`${API_BASE}/profiles/${profileData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData),
        });

        if (response.ok) {
            // Success, handle and return the result
            return handleResponse(response, 'Failed to update profile');
        }

        if (response.status === 404) {
            // Profile with ID not found, so create a new one instead.
            console.warn(`Profile with ID ${profileData.id} was not found. A new profile will be created.`);
            const { id, ...newProfileData } = profileData; // Remove the invalid ID
            return createProfile(newProfileData);
        }

        // For all other errors, let handleResponse throw an exception
        return handleResponse(response, 'Failed to update profile');
    } else {
        // No ID, so create a new profile
        return createProfile(profileData);
    }
};

export const updateProfile = async (id, payload) => {
    const response = await fetch(`${API_BASE}/profiles/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
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

export const searchProfilesByName = async (name) => {
    const response = await fetch(`${API_BASE}/profiles/search?name=${encodeURIComponent(name)}`);
    return handleResponse(response, `Failed to search profiles by name: ${name}`);
};

// ---------------- JOB FUNCTIONS ---------------- //

export const fetchAllJobs = async () => {
    const response = await fetch(`${API_BASE}/jobs/all`);
    return handleResponse(response, 'Failed to fetch all jobs');
};

export const markJobAsApplied = async (jobUrn) => {
    const response = await fetch(`${API_BASE}/jobs/${jobUrn}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({applied_on: new Date().toISOString()}),
    });
    return handleResponse(response, 'Failed to mark job as applied');
};

export const markJobAsDisabled = async (jobUrn) => {
    const response = await fetch(`${API_BASE}/jobs/${jobUrn}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: true }),
    });
    return handleResponse(response, 'Failed to mark job as disabled');
};