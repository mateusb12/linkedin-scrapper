import {API_BASE, handleResponse} from './config';

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

export const markJobAsDisabled = async (jobUrn) => {
    const response = await fetch(`${API_BASE}/jobs/${jobUrn}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: true }),
    });
    return handleResponse(response, 'Failed to mark job as disabled');
};
