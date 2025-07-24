import {API_BASE, handleResponse} from './config';

export const fetchResumes = async () => {
    const response = await fetch(`${API_BASE}/jobs/`);
    return handleResponse(response, 'Failed to fetch resumes');
};

export const fetchResumeById = async (id) => {
    const response = await fetch(`${API_BASE}/jobs/${id}`);
    return handleResponse(response, `Failed to fetch resume with ID ${id}`);
};

export const createResume = async (payload) => {
    const response = await fetch(`${API_BASE}/jobs/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response, 'Failed to create resume');
};

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
    const requiredKeys = [
        'raw_job_description',
        'raw_resume',
        'extracted_job_keywords',
        'extracted_resume_keywords',
        'current_cosine_similarity'
    ];

    const missingKeys = requiredKeys.filter((key) => !(key in payload));

    if (missingKeys.length > 0) {
        throw new Error(
            `Invalid payload for tailorResume. Missing keys: ${missingKeys.join(', ')}`
        );
    }

    const response = await fetch(`${API_BASE}/jobs/tailor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    return handleResponse(response, 'Failed to tailor resume');
};

export const searchResumeByName = async (name) => {
    const response = await fetch(`${API_BASE}/jobs/search?name=${encodeURIComponent(name)}`);
    return handleResponse(response, `Failed to search resume by name: ${name}`);
};
