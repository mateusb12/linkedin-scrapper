import React from 'react';
import { LogOut, Moon, Sun } from "lucide-react";

const Header = ({ isDark, toggleDarkMode, handleLogout }) => {
    return (
        <header className="h-14 flex items-center justify-end px-4 bg-gray-200 dark:bg-gray-800 shadow-sm space-x-2">
            <button
                onClick={toggleDarkMode}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
                aria-label="Toggle dark mode"
            >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
                onClick={handleLogout}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                aria-label="Logout"
            >
                <LogOut size={18} />
            </button>
        </header>
    );
};

export default Header;