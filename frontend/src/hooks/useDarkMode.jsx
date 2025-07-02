import { useState, useEffect } from 'react';

/**
 * A custom hook to manage and persist dark mode settings in localStorage.
 *
 * @returns {[boolean, function]} A tuple containing the current dark mode state
 * (`isDark`) and a function to toggle it (`toggleDarkMode`).
 */
export const useDarkMode = () => {
    // Initialize state by reading from localStorage, or fall back to system preference.
    const [isDark, setIsDark] = useState(() => {
        const savedMode = localStorage.getItem('darkMode');
        if (savedMode !== null) {
            return JSON.parse(savedMode);
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    // Effect to update localStorage and the DOM when the theme changes.
    useEffect(() => {
        // Apply the 'dark' class to the <html> element
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        // Save the user's preference to localStorage.
        localStorage.setItem('darkMode', JSON.stringify(isDark));
    }, [isDark]); // This effect runs whenever 'isDark' changes.

    const toggleDarkMode = () => setIsDark(prev => !prev);

    return [isDark, toggleDarkMode];
};