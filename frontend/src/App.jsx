import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import FullLayout from "./components/home/FullLayout.jsx";

import FetchConfig from "./components/data-fetching/FetchConfig.jsx";
import { FetchJobsView } from "./components/data-fetching/FetchJobs.jsx";
import JobList from "./components/home/JobList.jsx";
import { JobDashboard } from "./components/tracking/JobDashboard.jsx";
import Match from "./components/match-find/Match.jsx";
import UserProfile from "./components/profile/userProfile.jsx";
import Connections from "./components/connections/Connections.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FullLayout />}>
          <Route index element={<Navigate to="/config" replace />} />

          <Route path="config" element={<FetchConfig />} />
          <Route path="fetch" element={<FetchJobsView />} />
          <Route path="jobs" element={<JobList />} />
          <Route path="dashboard" element={<JobDashboard />} />
          <Route path="match" element={<Match />} />
          <Route path="profile" element={<UserProfile />} />
          <Route path="connections" element={<Connections />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
