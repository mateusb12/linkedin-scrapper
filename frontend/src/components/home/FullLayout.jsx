import React, { useState } from "react";
import { Sidebar, Header } from "./Navbar.jsx";
import FetchConfig from "../data-fetching/FetchConfig.jsx";
import { FetchJobsView } from "../data-fetching/FetchJobs.jsx";
import JobList from "./JobList.jsx";
import ResumeParser from "../resume/ResumeParser.jsx";
import Match from "../match-find/Match.jsx";

export default function FullLayout() {
    const [activeView, setActiveView] = useState("fetch-config");

    const handleLogout = () => console.log("Logging out...");

    const renderActiveView = () => {
        switch (activeView) {
            case "fetch-config":
                return <FetchConfig />;
            case "fetch-jobs":
                return <FetchJobsView />;
            case "job-listings":
                return <JobList />;
            case "resume":
                return <ResumeParser />;
            case "match":
                return <Match />;
            case "profile":
                return <div>Profile</div>;
            default:
                return null;
        }
    };

    return (
        <div className="flex h-screen font-sans bg-gray-100 dark:bg-gray-900">
            <Sidebar
                activeView={activeView}
                setActiveView={setActiveView}
            />
            <div className="flex flex-col flex-1 min-w-0">
                <Header handleLogout={handleLogout} />
                <main className="flex-1 p-10 overflow-y-auto">
                    {renderActiveView()}
                </main>
            </div>
        </div>
    );
}

