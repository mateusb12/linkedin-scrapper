import React, { useState } from "react";
import { CopyableCodeBlock } from "./CopyableCodeBlock.jsx";

const NETWORK_FILTER_PROFILE_MAIN = "/in/monicasbusatta/";
const NETWORK_FILTER_PROFILE_ABOVE = "profileCardsAboveActivity";
const NETWORK_FILTER_PROFILE_BELOW = "profileCardsBelowActivityPart1";

const NETWORK_FILTER_PAGINATION = "jobCollectionSlug:recommended";
const NETWORK_FILTER_INDIVIDUAL = "jobPostingDetailDescription_start";
const NETWORK_FILTER_EXPERIENCE = "sdui.pagers.profile.details.experience";
const NETWORK_FILTER_CONNECTIONS = "sdui.pagers.mynetwork.connectionsList";
const NETWORK_FILTER_SAVED_JOBS = "/jobs-tracker/?stage=saved";
const NETWORK_FILTER_PREMIUM_INSIGHTS =
  "com.linkedin.sdui.generated.premium.dsl.impl.premiumApplicantInsights";
const NETWORK_FILTER_NOTIFICATIONS = "voyagerIdentityDashNotificationCards";

export const ConfigCard = ({
  title,
  description,
  networkFilter,
  savedData,
  onSave,
  onDelete,
  placeholder,
  colorClass,
}) => {
  const [input, setInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const colors = {
    blue: {
      btn: "bg-blue-600 hover:bg-blue-700",
      ring: "focus:ring-blue-500",
      light: "bg-blue-50 dark:bg-blue-900/20",
    },
    purple: {
      btn: "bg-purple-600 hover:bg-purple-700",
      ring: "focus:ring-purple-500",
      light: "bg-purple-50 dark:bg-purple-900/20",
    },
    green: {
      btn: "bg-green-600 hover:bg-green-700",
      ring: "focus:ring-green-500",
      light: "bg-green-50 dark:bg-green-900/20",
    },
    orange: {
      btn: "bg-orange-600 hover:bg-orange-700",
      ring: "focus:ring-orange-500",
      light: "bg-orange-50 dark:bg-orange-900/20",
    },
    teal: {
      btn: "bg-teal-600 hover:bg-teal-700",
      ring: "focus:ring-teal-500",
      light: "bg-teal-50 dark:bg-teal-900/20",
    },
    rose: {
      btn: "bg-rose-600 hover:bg-rose-700",
      ring: "focus:ring-rose-500",
      light: "bg-rose-50 dark:bg-rose-900/20",
    },
  };
  const theme = colors[colorClass] || colors.blue;

  const handleSaveInternal = async () => {
    if (!input.trim()) return;
    await onSave(input);
    setInput("");
  };

  const handleDeleteInternal = async () => {
    if (!confirm("Are you sure you want to delete this configuration?")) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const getDisplayContent = () => {
    if (!savedData) return "";
    if (typeof savedData === "string") return savedData;

    if (savedData.curl) {
      return typeof savedData.curl === "object"
        ? JSON.stringify(savedData.curl, null, 2)
        : savedData.curl;
    }

    return JSON.stringify(savedData, null, 2);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 flex flex-col h-full">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
        {title}
      </h2>
      <p className="text-xs text-gray-500 mt-1 mb-3">{description}</p>

      <CopyableCodeBlock label="Network Filter" text={networkFilter} />

      <div className="mt-auto">
        {savedData ? (
          <div className="relative animate-fadeIn">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                ✅ Configured
              </span>
            </div>

            <div
              className={`p-3 rounded border border-gray-200 dark:border-gray-700 mb-4 overflow-hidden overflow-y-auto max-h-48 ${theme.light}`}
            >
              <pre className="text-xs font-mono text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-all">
                {getDisplayContent()}
              </pre>
            </div>

            <button
              onClick={handleDeleteInternal}
              disabled={isDeleting}
              className="w-full py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {isDeleting ? (
                "Deleting..."
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Configuration
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="animate-fadeIn">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={6}
              placeholder={placeholder}
              className={`w-full p-3 mb-4 text-xs font-mono border border-gray-300 rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-gray-300 focus:ring-2 ${theme.ring} outline-none resize-none`}
            />
            <button
              onClick={handleSaveInternal}
              disabled={!input}
              className={`w-full py-2 ${theme.btn} text-white font-bold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm`}
            >
              Save Configuration
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const ScraperConfigCards = ({
  pagConfig,
  indConfig,
  expConfig,
  profMainConfig,
  profAboveConfig,
  profBelowConfig,
  connectionsConfig,
  savedJobsConfig,
  premiumInsightsConfig,
  notificationsConfig,
  onSavePag,
  onDeletePag,
  onSaveInd,
  onDeleteInd,
  onSaveExp,
  onDeleteExp,
  onSaveConnections,
  onDeleteConnections,
  profMainHandlers,
  profAboveHandlers,
  profBelowHandlers,
  savedJobsHandlers,
  premiumInsightsHandlers,
  notificationsHandlers,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <ConfigCard
        title="📄 Pagination Request"
        description="Controls how we traverse the job list (pages 1, 2, 3...)."
        networkFilter={NETWORK_FILTER_PAGINATION}
        savedData={pagConfig}
        onSave={onSavePag}
        onDelete={onDeletePag}
        placeholder="Paste cURL with 'jobCollectionSlug' here..."
        colorClass="blue"
      />

      <ConfigCard
        title="💼 Individual Job Request"
        description="Controls how we fetch details for a single job card."
        networkFilter={NETWORK_FILTER_INDIVIDUAL}
        savedData={indConfig}
        onSave={onSaveInd}
        onDelete={onDeleteInd}
        placeholder="Paste cURL with 'jobPostingDetailDescription' here..."
        colorClass="purple"
      />

      <ConfigCard
        title="🧩 Experience Request"
        description="Controls how we fetch profile experience sections."
        networkFilter={NETWORK_FILTER_EXPERIENCE}
        savedData={expConfig}
        onSave={onSaveExp}
        onDelete={onDeleteExp}
        placeholder="Paste POST cURL with 'sdui.pagers.profile.details.experience' here..."
        colorClass="green"
      />

      <ConfigCard
        title="👤 Profile Main Request"
        description="Chamada base para carregar Header e Skills do perfil."
        networkFilter={NETWORK_FILTER_PROFILE_MAIN}
        savedData={profMainConfig}
        onSave={profMainHandlers.onSave}
        onDelete={profMainHandlers.onDelete}
        placeholder="Cole o GET cURL da página base do perfil..."
        colorClass="orange"
      />

      <ConfigCard
        title="⬆️ Profile Above Activity"
        description="Carrega o 'About' e resumo do usuário (GraphQL)."
        networkFilter={NETWORK_FILTER_PROFILE_ABOVE}
        savedData={profAboveConfig}
        onSave={profAboveHandlers.onSave}
        onDelete={profAboveHandlers.onDelete}
        placeholder="Cole o POST cURL contendo 'profileCardsAboveActivity'..."
        colorClass="teal"
      />

      <ConfigCard
        title="⬇️ Profile Below Activity"
        description="Carrega Experiência, Educação e Licenças (GraphQL)."
        networkFilter={NETWORK_FILTER_PROFILE_BELOW}
        savedData={profBelowConfig}
        onSave={profBelowHandlers.onSave}
        onDelete={profBelowHandlers.onDelete}
        placeholder="Cole o POST cURL contendo 'profileCardsBelowActivityPart1'..."
        colorClass="rose"
      />

      <ConfigCard
        title="🤝 Connections Request"
        description="Carrega a lista de conexões (paginada). O startIndex será formatado."
        networkFilter={NETWORK_FILTER_CONNECTIONS}
        savedData={connectionsConfig}
        onSave={onSaveConnections}
        onDelete={onDeleteConnections}
        placeholder="Cole o POST cURL do connectionsList aqui..."
        colorClass="purple"
      />

      <ConfigCard
        title="📌 Saved Jobs Request"
        description="Carrega a lista de vagas salvas ou aplicadas no Job Tracker."
        networkFilter={NETWORK_FILTER_SAVED_JOBS}
        savedData={savedJobsConfig}
        onSave={savedJobsHandlers.onSave}
        onDelete={savedJobsHandlers.onDelete}
        placeholder="Cole o POST cURL contendo '/jobs-tracker/?stage=saved'..."
        colorClass="blue"
      />

      <ConfigCard
        title="💎 Premium Insights Request"
        description="Carrega insights de comparação com outros candidatos (Premium)."
        networkFilter={NETWORK_FILTER_PREMIUM_INSIGHTS}
        savedData={premiumInsightsConfig}
        onSave={premiumInsightsHandlers.onSave}
        onDelete={premiumInsightsHandlers.onDelete}
        placeholder="Cole o POST cURL contendo 'premiumApplicantInsights'..."
        colorClass="orange"
      />

      <ConfigCard
        title="🔔 Notifications Request"
        description="Carrega cards de notificações (job applications, networking, etc)."
        networkFilter={NETWORK_FILTER_NOTIFICATIONS}
        savedData={notificationsConfig}
        onSave={notificationsHandlers.onSave}
        onDelete={notificationsHandlers.onDelete}
        placeholder="Cole o GET cURL contendo 'voyagerIdentityDashNotificationCards'..."
        colorClass="red"
      />
    </div>
  );
};
