import React, { useEffect, useState } from "react";
import { useDarkMode } from "../../hooks/useDarkMode.jsx";
import { CopyableCodeBlock } from "./CopyableCodeBlock.jsx";

import {
  savePaginationCurl,
  saveIndividualJobCurl,
  saveExperienceCurl,
  getPaginationCurl,
  getIndividualJobCurl,
  getExperienceCurl,
  deletePaginationCurl,
  deleteIndividualJobCurl,
  deleteExperienceCurl,
  getGenericCurl,
  saveGenericCurl,
  deleteGenericCurl,
  saveGmailToken,
  getProfiles,
  testGmailConnection,
} from "../../services/fetchLinkedinService.js";

import gmailIcon from "../../assets/ui_icons/gmail.png";

const NETWORK_FILTER_PROFILE_MAIN = "/in/monicasbusatta/";
const NETWORK_FILTER_PROFILE_ABOVE = "profileCardsAboveActivity";
const NETWORK_FILTER_PROFILE_BELOW = "profileCardsBelowActivityPart1";

const NETWORK_FILTER_PAGINATION = "jobCollectionSlug:recommended";
const NETWORK_FILTER_INDIVIDUAL = "jobPostingDetailDescription_start";
const NETWORK_FILTER_EXPERIENCE = "sdui.pagers.profile.details.experience";

const ConfigCard = ({
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

export default function FetchConfig() {
  const [isDark] = useDarkMode();
  const [statusMessage, setStatusMessage] = useState({});

  const [pagConfig, setPagConfig] = useState(null);
  const [indConfig, setIndConfig] = useState(null);
  const [expConfig, setExpConfig] = useState(null);

  const [gmailToken, setGmailToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [gmailStatus, setGmailStatus] = useState("idle");
  const [profileId, setProfileId] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [profMainConfig, setProfMainConfig] = useState(null);
  const [profAboveConfig, setProfAboveConfig] = useState(null);
  const [profBelowConfig, setProfBelowConfig] = useState(null);

  const clearStatusMessage = () => setTimeout(() => setStatusMessage({}), 4000);

  const loadAllData = async () => {
    setProfileLoading(true);

    const loadConfigSafe = async (fn) => {
      try {
        return await fn();
      } catch (e) {
        return null;
      }
    };

    try {
      const [pag, ind, exp, main, above, below] = await Promise.all([
        loadConfigSafe(getPaginationCurl),
        loadConfigSafe(getIndividualJobCurl),
        loadConfigSafe(getExperienceCurl),
        loadConfigSafe(() => getGenericCurl("ProfileMain")),
        loadConfigSafe(() => getGenericCurl("ProfileAboveActivity")),
        loadConfigSafe(() => getGenericCurl("ProfileBelowActivity")),
      ]);

      setPagConfig(pag);
      setIndConfig(ind);
      setExpConfig(exp);
      setProfMainConfig(main);
      setProfAboveConfig(above);
      setProfBelowConfig(below);

      const profiles = await getProfiles();
      if (profiles && profiles.length > 0) {
        const active = profiles[0];
        setProfileId(active.id);
        if (active.email_app_password) {
          setGmailToken(active.email_app_password);
          setGmailStatus("success");
        } else {
          setGmailStatus("idle");
        }
      } else {
        setGmailStatus("error");
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ general: "Error loading initial data." });
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");

    loadAllData();
  }, [isDark]);

  const onSavePag = async (curl) => {
    setStatusMessage({ general: "Saving Pagination..." });
    try {
      await savePaginationCurl(curl);
      setStatusMessage({ general: "✅ Pagination cURL Updated!" });
      setPagConfig({ curl });
    } catch (error) {
      handleError(error);
    } finally {
      clearStatusMessage();
    }
  };

  const onDeletePag = async () => {
    try {
      await deletePaginationCurl();
      setPagConfig(null);
      setStatusMessage({ general: "🗑️ Pagination Config Deleted." });
    } catch (error) {
      handleError(error);
    } finally {
      clearStatusMessage();
    }
  };

  const onSaveInd = async (curl) => {
    setStatusMessage({ general: "Saving Job Config..." });
    try {
      await saveIndividualJobCurl(curl);
      setStatusMessage({ general: "✅ Job cURL Updated!" });
      setIndConfig({ curl });
    } catch (error) {
      handleError(error);
    } finally {
      clearStatusMessage();
    }
  };

  const onDeleteInd = async () => {
    try {
      await deleteIndividualJobCurl();
      setIndConfig(null);
      setStatusMessage({ general: "🗑️ Job Config Deleted." });
    } catch (error) {
      handleError(error);
    } finally {
      clearStatusMessage();
    }
  };

  const onSaveExp = async (curl) => {
    setStatusMessage({ general: "Saving Experience Config..." });
    try {
      await saveExperienceCurl(curl);
      setStatusMessage({ general: "✅ Experience cURL Updated!" });
      setExpConfig({ curl });
    } catch (error) {
      handleError(error);
    } finally {
      clearStatusMessage();
    }
  };

  const onDeleteExp = async () => {
    try {
      await deleteExperienceCurl();
      setExpConfig(null);
      setStatusMessage({ general: "🗑️ Experience Config Deleted." });
    } catch (error) {
      handleError(error);
    } finally {
      clearStatusMessage();
    }
  };

  const createGenericHandler = (configName, stateSetter, label) => {
    return {
      onSave: async (curl) => {
        setStatusMessage({ general: `Saving ${label}...` });
        try {
          await saveGenericCurl(configName, curl);
          setStatusMessage({ general: `✅ ${label} Updated!` });
          stateSetter({ curl });
        } catch (error) {
          handleError(error);
        } finally {
          clearStatusMessage();
        }
      },
      onDelete: async () => {
        try {
          await deleteGenericCurl(configName);
          stateSetter(null);
          setStatusMessage({ general: `🗑️ ${label} Deleted.` });
        } catch (error) {
          handleError(error);
        } finally {
          clearStatusMessage();
        }
      },
    };
  };

  const profMainHandlers = createGenericHandler(
    "ProfileMain",
    setProfMainConfig,
    "Profile Main",
  );
  const profAboveHandlers = createGenericHandler(
    "ProfileAboveActivity",
    setProfAboveConfig,
    "Profile Above",
  );
  const profBelowHandlers = createGenericHandler(
    "ProfileBelowActivity",
    setProfBelowConfig,
    "Profile Below",
  );

  const handleError = (error) => {
    console.error(error);
    const msg = error.response?.data?.description || error.message;
    setStatusMessage({ general: `❌ Error: ${msg}` });
  };

  const handleSaveGmail = async () => {
    if (!gmailToken.trim()) return;
    if (!profileId) {
      setStatusMessage({
        general: "❌ No Profile found. Create a profile first.",
      });
      setGmailStatus("error");
      clearStatusMessage();
      return;
    }
    setStatusMessage({ general: "Saving Gmail Token..." });
    try {
      await saveGmailToken(profileId, gmailToken);
      setStatusMessage({ general: "✅ Gmail Token Saved securely!" });
      setGmailStatus("success");
      setGmailToken("");
      clearStatusMessage();
    } catch (error) {
      const msg = error.response?.data?.error || "Error saving token";
      setStatusMessage({ general: `❌ ${msg}` });
      setGmailStatus("error");
      console.error(error);
      clearStatusMessage();
    }
  };

  const handleTestGmail = async () => {
    if (!profileId) {
      setStatusMessage({
        general: "❌ No Profile found. Cannot test connection.",
      });
      clearStatusMessage();
      return;
    }
    setStatusMessage({ general: "⏳ Sending Test Email..." });
    try {
      await testGmailConnection(profileId);
      setStatusMessage({ general: "✅ Test Email Sent! Check your inbox." });
      setGmailStatus("success");
      clearStatusMessage();
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.error || "Failed to send test email";
      setStatusMessage({ general: `❌ ${msg}` });
      clearStatusMessage();
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center border-b border-gray-300 dark:border-gray-700 pb-3 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Fetch Configuration
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage scraper settings and external integrations.
          </p>
        </div>
      </div>

      {statusMessage.general && (
        <div className="mb-6 p-3 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded font-semibold text-center animate-pulse border border-blue-200 dark:border-blue-800">
          {statusMessage.general}
        </div>
      )}

      <div className="mb-10">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          Scraper Configuration
        </h3>

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
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          Integrations
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 relative overflow-hidden">
            <div
              className={`absolute top-0 left-0 w-full h-1 ${gmailStatus === "success" ? "bg-green-500" : "bg-red-500"}`}
            ></div>

            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <img src={gmailIcon} alt="Gmail Icon" className="w-6 h-6" />
                  Gmail SMTP
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Used to send email notifications for new job matches.
                </p>
              </div>

              <span
                className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${gmailStatus === "success" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}`}
              >
                {gmailStatus === "success" ? "Connected" : "Not Configured"}
              </span>
            </div>

            <div className="relative mb-4">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                App Password (Not your Google Password)
              </label>
              <input
                type={showToken ? "text" : "password"}
                value={gmailToken}
                onChange={(e) => setGmailToken(e.target.value)}
                placeholder="•••• •••• •••• ••••"
                disabled={!profileId}
                className="w-full p-3 pr-10 text-sm font-mono border border-gray-300 rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-red-500 outline-none transition-all disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              />

              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                disabled={!profileId}
                className="absolute right-3 top-8 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {showToken ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a9.018 9.018 0 014.722-.045 23.993 23.993 0 012.336 1.054c.642.348 1.144.757 1.503 1.15.54.59.914 1.198 1.127 1.776.435 1.168.435 2.508 0 3.676-.192.518-.52 1.026-.967 1.503m-3.468 3.125A3.375 3.375 0 0112 15.75c-1.864 0-3.375-1.511-3.375-3.375 0-.58.156-1.122.427-1.595"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 3l18 18"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveGmail}
                disabled={profileLoading || !profileId}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded shadow-sm transition-colors text-sm"
                title={
                  !profileId ? "Create a profile first to save a token" : ""
                }
              >
                {profileLoading
                  ? "Loading Profile..."
                  : !profileId
                    ? "Requires Profile"
                    : "Save Token"}
              </button>

              <button
                onClick={handleTestGmail}
                disabled={profileLoading || !profileId}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-gray-800 dark:text-gray-200 font-semibold rounded shadow-sm transition-colors text-sm"
                title={!profileId ? "Create a profile first to test" : ""}
              >
                Test
              </button>
            </div>
          </div>

          <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex flex-col justify-center items-center p-6 text-gray-400 dark:text-gray-500">
            <svg
              className="w-12 h-12 mb-2 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <span className="text-sm font-medium">Add New Integration</span>
          </div>
        </div>
      </div>
    </div>
  );
}
