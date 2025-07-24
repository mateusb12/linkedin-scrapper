import {API_BASE, handleResponse} from './config';

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

export const searchProfilesByName = async (name) => {
    const response = await fetch(`${API_BASE}/profiles/search?name=${encodeURIComponent(name)}`);
    return handleResponse(response, `Failed to search profiles by name: ${name}`);
};

export const saveProfile = async (profileData) => {
    if (profileData.id) {
        const response = await fetch(`${API_BASE}/profiles/${profileData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData),
        });

        if (response.ok) {
            return handleResponse(response, 'Failed to update profile');
        }

        if (response.status === 404) {
            console.warn(`Profile with ID ${profileData.id} was not found. A new profile will be created.`);
            const { id, ...newProfileData } = profileData;
            return createProfile(newProfileData);
        }

        return handleResponse(response, 'Failed to update profile');
    } else {
        return createProfile(profileData);
    }
};
