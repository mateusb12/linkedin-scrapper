import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar, Header } from "./Navbar.jsx";

export default function FullLayout() {
  const handleLogout = () => console.log("Logging out...");

  return (
    <div className="flex h-screen font-sans bg-gray-100 dark:bg-gray-900">
      {}
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        {}
        <Header handleLogout={handleLogout} />

        <main className="flex-1 p-10 overflow-y-auto">
          {}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
