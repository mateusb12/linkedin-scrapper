import React, { useState, useEffect } from "react";
import {
  User,
  Link as LinkIcon,
  Briefcase,
  Clock,
  Network,
  ChevronDown,
  Code,
  Award,
  ExternalLink,
  Download,
} from "lucide-react";

export default function Connections() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [expandedCard, setExpandedCard] = useState(null);

  const formatNameFromUrl = (url) => {
    if (!url) return "LinkedIn Connection";
    const match = url.match(/\/in\/([^/]+)/);
    if (match && match[1]) {
      return match[1]
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }
    return "LinkedIn Connection";
  };

  const loadDatabase = async () => {
    try {
      const response = await fetch("http://localhost:5000/connections/");
      const data = await response.json();
      setConnections(data);
    } catch (error) {
      console.error("Erro ao carregar banco:", error);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, []);

  const handleFetch = async () => {
    setLoading(true);
    setStatus("Conectando ao bot...");

    try {
      const response = await fetch("http://localhost:5000/connections/sync");
      if (!response.ok) throw new Error("Erro de comunicação com o servidor.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));

              if (["start", "progress", "wait"].includes(data.status)) {
                if (data.total) {
                  setStatus(
                    `${data.message} (${data.processed}/${data.total})`,
                  );
                } else {
                  setStatus(data.message);
                }
              } else if (data.status === "error") {
                setStatus(`❌ ${data.message}`);

                setTimeout(() => {
                  setLoading(false);
                  setStatus("");
                }, 5000);
                return;
              } else if (data.status === "complete" || data.status === "info") {
                setStatus(`✅ ${data.message}`);
                loadDatabase();
              }
            } catch (e) {
              console.error("Erro ao processar linha:", e, "Linha:", line);
            }
          }
        }
      }
    } catch (error) {
      setStatus(`Erro: ${error.message}`);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setStatus("");
      }, 3000);
    }
  };

  const toggleExpand = (id) => {
    setExpandedCard(expandedCard === id ? null : id);
  };

  const safeParse = (data) => {
    if (!data) return [];
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch (e) {
        return [];
      }
    }
    return Array.isArray(data) ? data : [];
  };

  const handleDownloadJSON = () => {
    const formattedConnections = connections.map((conn) => ({
      ...conn,
      experiences: safeParse(conn.experiences),
      skills: safeParse(conn.skills),
      certifications: safeParse(conn.certifications),
    }));

    const jsonString = JSON.stringify(formattedConnections, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "minhas_conexoes_linkedin.json";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadJSON}
            disabled={connections.length === 0}
            className="bg-gray-800 hover:bg-gray-700 text-white dark:bg-gray-700 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            title="Download JSON"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Exportar JSON</span>
          </button>

          <button
            onClick={handleFetch}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 disabled:opacity-70 transition-colors shadow-sm min-w-[200px] justify-center"
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
                <span className="text-sm">{status}</span>
              </>
            ) : (
              "Sync Connections"
            )}
          </button>
        </div>
      </div>

      {connections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fadeIn items-start">
          {connections.map((conn, index) => {
            const profileUrl = conn.profile_url || "#";
            const isExpanded = expandedCard === profileUrl;

            const displayName =
              conn.name === "div" || !conn.name
                ? formatNameFromUrl(profileUrl)
                : conn.name;
            const displayHeadline =
              conn.headline === "text-attr-0" || !conn.headline
                ? "1st Degree Connection"
                : conn.headline;

            const experiences = safeParse(conn.experiences);
            const skills = safeParse(conn.skills);
            const certifications = safeParse(conn.certifications);

            return (
              <div
                key={index}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-md border ${
                  conn.is_fully_scraped
                    ? "border-purple-400 dark:border-purple-600"
                    : "border-gray-200 dark:border-gray-700"
                } transition-all duration-300 relative overflow-hidden flex flex-col ${
                  isExpanded
                    ? "col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 flex-col md:flex-row"
                    : "hover:-translate-y-1 hover:shadow-lg"
                }`}
              >
                <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-r from-purple-500 to-blue-500 opacity-20 dark:opacity-40"></div>

                <div
                  className={`p-6 flex flex-col items-center text-center relative z-10 ${isExpanded ? "w-full md:w-1/3 md:border-r border-gray-200 dark:border-gray-700 shrink-0" : "w-full h-full"}`}
                >
                  <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 mb-4 mt-2 overflow-hidden border-4 border-white dark:border-gray-800 relative shadow-sm flex items-center justify-center">
                    {conn.image ? (
                      <img
                        src={conn.image}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>

                  <h3
                    className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-1 w-full"
                    title={displayName}
                  >
                    {displayName}
                  </h3>

                  <div
                    className={`text-sm text-gray-600 dark:text-gray-300 mb-4 flex justify-center w-full ${isExpanded ? "" : "h-10 items-start line-clamp-2"}`}
                    title={displayHeadline}
                  >
                    {displayHeadline}
                  </div>

                  {isExpanded && conn.about && (
                    <p className="text-sm mb-3 text-gray-700 dark:text-gray-300 mt-2 text-left whitespace-pre-line">
                      {conn.about}
                    </p>
                  )}

                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-5 flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                    <Clock size={12} />{" "}
                    {conn.connected_time || "Recently Added"}
                  </div>

                  <div className="mt-auto w-full flex flex-col gap-2">
                    {isExpanded && (
                      <a
                        href={profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors flex justify-center items-center gap-2"
                      >
                        Ver no LinkedIn <ExternalLink size={14} />
                      </a>
                    )}
                    <button
                      onClick={() => toggleExpand(profileUrl)}
                      className={`w-full py-2 border border-purple-500 text-purple-600 dark:text-purple-400 dark:border-purple-400 text-sm font-bold rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors flex justify-center items-center gap-2 ${isExpanded ? "bg-purple-50 dark:bg-purple-900/20" : ""}`}
                    >
                      {isExpanded ? "Collapse" : "View Profile"}{" "}
                      <ChevronDown
                        size={14}
                        className={`transform transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6 w-full md:w-2/3 flex flex-col gap-6 relative z-10 bg-gray-50 dark:bg-gray-800/50">
                    {skills.length > 0 && (
                      <div>
                        <h4 className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                          <Code size={18} className="text-purple-500" /> Skills
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {skills.map((skill, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium border border-purple-200 dark:border-purple-700"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {experiences.length > 0 && (
                      <div>
                        <h4 className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                          <Briefcase size={18} className="text-blue-500" />{" "}
                          Experiência
                        </h4>
                        <div className="flex flex-col gap-4">
                          {experiences.map((exp, i) => (
                            <div key={i} className="flex flex-col gap-1">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {exp.cargo}
                              </span>

                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {exp.empresa}
                                {exp.tipo ? ` · ${exp.tipo}` : ""}
                                {exp.modelo_trabalho
                                  ? ` · ${exp.modelo_trabalho}`
                                  : ""}
                              </span>

                              {exp.localizacao && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  📍 {exp.localizacao}
                                </span>
                              )}

                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {exp.inicio} – {exp.fim}{" "}
                                {exp.duracao ? `• ${exp.duracao}` : ""}
                              </span>

                              {exp.descricao && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line mt-2">
                                  {exp.descricao}
                                </p>
                              )}

                              {Array.isArray(exp.tecnologias) &&
                                exp.tecnologias.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {exp.tecnologias.map((tech, tIndex) => (
                                      <span
                                        key={tIndex}
                                        className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full text-[10px] border border-blue-200 dark:border-blue-700"
                                      >
                                        {tech}
                                      </span>
                                    ))}
                                  </div>
                                )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {certifications.length > 0 && (
                      <div>
                        <h4 className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                          <Award size={18} className="text-yellow-500" />{" "}
                          Certificações
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {certifications.map((cert, i) => (
                            <div
                              key={i}
                              className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                            >
                              <p
                                className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-1"
                                title={cert.nome}
                              >
                                {cert.nome}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {cert.instituicao}
                              </p>
                              {cert.data_emissao && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {cert.data_emissao}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
