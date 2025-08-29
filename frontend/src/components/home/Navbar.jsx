import React from 'react';
import { LogOut, Moon, Sun, Settings, Briefcase, List, ClipboardList, Users, User } from "lucide-react";

export const Sidebar = ({ activeView, setActiveView }) => {
    const navItems = [
        { label: "Fetch Config", id: "fetch-config", icon: Settings },
        { label: "Fetch Jobs", id: "fetch-jobs", icon: Briefcase },
        { label: "Job Listings", id: "job-listings", icon: List },
        { label: "Job Tracking", id: "tracking", icon: ClipboardList },
        { label: "Match", id: "match", icon: Users },
        { label: "Profile", id: "profile", icon: User }
    ];

    const profile = {
        name: "Custom User",
        email: "user@gmail.com",
        avatar: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"
    };

    return (
        <aside className="w-64 flex-shrink-0 bg-white dark:bg-[#2d2d3d] p-5 flex flex-col justify-between">
            <nav className="flex flex-col space-y-2">
                {navItems.map(({ label, id, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveView(id)}
                        className={`w-full flex items-center gap-3 text-left p-3 rounded-lg text-base font-medium transition-colors ${
                            activeView === id
                                ? 'bg-blue-600 text-white font-semibold dark:bg-[#4a4a6a]'
                                : 'text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-[#4a4a6a] dark:hover:text-white'
                        }`}
                    >
                        <Icon size={20} />
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
