import React, { useState } from "react";
import {
  User,
  Link as LinkIcon,
  Briefcase,
  Clock,
  Network,
} from "lucide-react";

export default function Connections() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handleFetch = async () => {
    setLoading(true);
    setStatus("Buscando dados no servidor...");

    try {
      const response = await fetch("http://localhost:5000/connections/sync");

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro desconhecido");
      }

      setConnections(result.data);
      setStatus("Concluído!");
    } catch (error) {
      console.error(error);
      setStatus(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center border-b border-gray-300 dark:border-gray-700 pb-5 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Network className="w-8 h-8 text-purple-500" />
            My Network
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Extract and manage your first-degree connections.
          </p>
        </div>

        <button
          onClick={handleFetch}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 disabled:opacity-70 transition-colors shadow-sm"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {status}
            </>
          ) : (
            "Sync Connections"
          )}
        </button>
      </div>

      {connections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fadeIn">
          {connections.map((conn, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center text-center transition-transform hover:-translate-y-1 hover:shadow-lg relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-r from-purple-500 to-blue-500 opacity-20 dark:opacity-40"></div>

              <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 mb-4 mt-2 overflow-hidden border-4 border-white dark:border-gray-800 relative z-10 shadow-sm">
                {conn.image ? (
                  <img
                    src={conn.image}
                    alt={conn.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-full h-full p-5 text-gray-400 dark:text-gray-500" />
                )}
              </div>

              <h3
                className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-1 line-clamp-1 w-full"
                title={conn.name}
              >
                {conn.name}
              </h3>

              <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 h-10 flex items-start justify-center w-full">
                <span className="line-clamp-2" title={conn.headline}>
                  {conn.headline}
                </span>
              </div>

              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-5 flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                <Clock size={12} /> {conn.connected_time}
              </div>

              <a
                href={conn.profile_url}
                target="_blank"
                rel="noreferrer"
                className="mt-auto w-full py-2 border border-purple-500 text-purple-600 dark:text-purple-400 dark:border-purple-400 text-sm font-bold rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors flex justify-center items-center gap-2"
              >
                View Profile <LinkIcon size={14} />
              </a>
            </div>
          ))}
        </div>
      ) : (
        !loading && (
          <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
            <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Network size={36} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              No connections loaded
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
              Your network grid is currently empty. Click on "Sync Connections"
              to fetch the latest data from your LinkedIn profile.
            </p>
          </div>
        )
      )}
    </div>
  );
}
