import React from 'react';
import {LogOut, Moon, Sun} from "lucide-react";
import { useState, useEffect } from 'react';
import {useDarkMode} from "../../hooks/useDarkMode.jsx";

export const Sidebar = ({ activeView, setActiveView }) => {
    const navItems = [
        { label: "Fetch Config", id: "fetch-config" },
        { label: "Fetch Jobs", id: "fetch-jobs" },
        { label: "Job Listings", id: "job-listings" },
        { label: "Job Tracking", id: "tracking" },
        { label: "Match", id: "match" },
        { label: "Profile", id: "profile" }
    ];

    const profile = {
        name: "Custom User",
        email: "user@gmail.com",
        avatar: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"
    };

    return (
        <aside className="w-64 flex-shrink-0 bg-white dark:bg-[#2d2d3d] p-5 flex flex-col justify-between">
            <nav className="flex flex-col space-y-2">
                {navItems.map(({ label, id }) => (
                    <button
                        key={id}
                        onClick={() => setActiveView(id)}
                        className={`w-full text-left p-3 rounded-lg text-base font-medium transition-colors ${
                            activeView === id
                                ? 'bg-blue-600 text-white font-semibold dark:bg-[#4a4a6a]'
                                : 'text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-[#4a4a6a] dark:hover:text-white'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </nav>
            <div className="flex items-center space-x-3 pt-4 border-t border-gray-300 dark:border-gray-700">
                <img
                    src={profile.avatar}
                    alt="User Avatar"
                    className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex flex-col leading-tight">
                    <span className="text-gray-800 dark:text-gray-200 font-semibold">
                        {profile.name}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 text-xs">
                        {profile.email}
                    </span>
                </div>
            </div>
        </aside>
    );
};

export const Header = ({ handleLogout }) => {
    const [isDark, toggleDarkMode] = useDarkMode();
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