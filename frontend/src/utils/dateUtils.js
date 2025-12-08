export const formatCustomDate = (dateString) => {
    if (!dateString) return '-';

    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) return dateString;

    // Get day and pad with 0 if needed (e.g., 4 -> 04)
    const day = date.getDate().toString().padStart(2, '0');

    // Get short month name (e.g., Dec) and convert to lowercase (dec)
    const month = date.toLocaleString('en-US', { month: 'short' }).toLowerCase();

    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
};