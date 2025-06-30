import React, { useState, useEffect } from "react";
import axios from "axios";
import { Sun, Moon, LogOut } from "lucide-react";

export default function JobDashboard() {
    // 1. Initial state is determined by checking the <html> tag once.
    const [isDark, setIsDark] = useState(() =>
        document.documentElement.classList.contains("dark")
    );

    // 2. A useEffect hook now syncs the state to the DOM.
    // This is the single source of truth for the dark class.
    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [isDark]); // This effect runs only when the `isDark` state changes.

    const [activeView, setActiveView] = useState("fetch-config");
    const [paginationCurl, setPaginationCurl] = useState("Loading...");
    const [individualJobCurl, setIndividualJobCurl] = useState("Loading...");

    const profile = {
        name: "Custom User",
        email: "user@gmail.com",
        avatar: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"
    };

    useEffect(() => {
        const paginationUrl = "http://localhost:5000/fetch-jobs/pagination-curl";
        const individualJobUrl = "http://localhost:5000/fetch-jobs/individual-job-curl";

        axios.get(paginationUrl)
            .then((res) => setPaginationCurl(res.data))
            .catch((err) => {
                console.error("Error fetching pagination curl:", err);
                setPaginationCurl("Failed to fetch. Is your local server running?\n\nExample:\nGET http://example.com/api/jobs?page=1");
            });

        axios.get(individualJobUrl)
            .then((res) => setIndividualJobCurl(res.data))
            .catch((err) => {
                console.error("Error fetching individual job curl:", err);
                setIndividualJobCurl("Failed to fetch. Is your local server running?\n\nExample:\nGET http://example.com/api/job/123");
            });
    }, []);

    // 3. The handler now only needs to toggle the state.
    const toggleDarkMode = () => {
        setIsDark(prev => !prev);
    };

    const handleLogout = () => {
        console.log("Logging out...");
    };

    const renderActiveView = () => {
        // ... (The rest of this function remains unchanged)
        switch (activeView) {
            case "fetch-config":
                return (
                    <div>
                        <h1 className="text-3xl font-bold border-b border-gray-300 dark:border-gray-700 pb-3 text-gray-900 dark:text-gray-100">
                            Fetch Configuration
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2 mb-8">
                            Define the GET request details for fetching job data.
                        </p>
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300 mb-2">
                                    Pagination Request
                                </h2>
                                <textarea
                                    value={paginationCurl}
                                    onChange={(e) => setPaginationCurl(e.target.value)}
                                    className="w-full min-h-[150px] p-4 bg-white dark:bg-[#2d2d3d] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <button className="mt-4 py-2 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-500 transition-colors">
                                    Update
                                </button>
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300 mb-2">
                                    Individual Job Request
                                </h2>
                                <textarea
                                    value={individualJobCurl}
                                    onChange={(e) => setIndividualJobCurl(e.target.value)}
                                    className="w-full min-h-[150px] p-4 bg-white dark:bg-[#2d2d3d] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <button className="mt-4 py-2 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-500 transition-colors">
                                    Update
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case "job-listings":
                return (
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                            Job Listings
                        </h1>
                    </div>
                );
            case "profile":
                return (
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Profile</h1>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex h-screen font-sans bg-gray-100 dark:bg-gray-900">
            <aside className="w-64 flex-shrink-0 bg-white dark:bg-[#2d2d3d] p-5 flex flex-col justify-between">
                <nav className="flex flex-col space-y-2">
                    {[
                        { label: "Fetch Config", id: "fetch-config" },
                        { label: "Job Listings", id: "job-listings" },
                        { label: "Profile", id: "profile" }
                    ].map(({ label, id }) => (
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
            <div className="flex flex-col flex-1 min-w-0">
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
                <main className="flex-1 p-10 overflow-y-auto">
                    {renderActiveView()}
                </main>
            </div>
        </div>
    );
}