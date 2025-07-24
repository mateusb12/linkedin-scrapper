export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const handleResponse = async (response, defaultErrorMsg) => {
    const result = await response.json().catch(() => {
        return { error: `Invalid JSON response from server.` };
    });

    if (!response.ok) {
        throw new Error(result.error || defaultErrorMsg || `HTTP error! status: ${response.status}`);
    }

    return result;
};