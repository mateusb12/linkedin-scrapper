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
