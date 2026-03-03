import React, { useState, useEffect } from "react";
import {
  Briefcase,
  FileJson,
  X,
  Copy,
  Check,
  Sparkles,
  Settings,
  ArrowDown,
} from "lucide-react";

import { fetchProfiles, saveProfile } from "../../services/profileService.js";
import { fetchAllResumes } from "../match-find/MatchLogic.jsx";
import {
  createResume,
  deleteResume,
  updateResume,
} from "../../services/resumeService.js";

import {
  denormalizeResume,
  normalizeResume,
  generateLatex,
} from "./resumeJsonMapper.js";
import { extractTechStack } from "../resume/constants.js";

import LinkedinExperiences from "./LinkedinExperiences";
import ProfileEditor from "./ProfileEditor";
import ResumeEditor from "./ResumeEditor";

const PROMPT_TEMPLATES = {
  en: `I am applying for a job and I need you to adapt my resume to fit the Job Description provided below.

=== INSTRUCTIONS ===
1. Analyze the keywords in the Job Description.
2. Rewrite the summary and experience bullet points of my resume to highlight matching skills.
3. Keep the exact same format (JSON or LaTeX) so I can paste it back into my system.
4. Do NOT output conversational text, just the code/json.

=== JOB DESCRIPTION ===
{{JOB_DESCRIPTION}}

=== MY CURRENT RESUME ===
{{RESUME_CONTENT}}`,

  pt: `Estou me candidatando a uma vaga e preciso que você adapte meu currículo para se adequar à Descrição da Vaga fornecida abaixo.

=== INSTRUÇÕES ===
1. Analise as palavras-chave na Descrição da Vaga.
2. Reescreva o resumo e os bullet points de experiência do meu currículo para destacar habilidades compatíveis.
3. Mantenha exatamente o mesmo formato (JSON ou LaTeX) para que eu possa colar de volta no meu sistema.
4. NÃO escreva texto conversacional, apenas o código/json de saída.

=== DESCRIÇÃO DA VAGA ===
{{JOB_DESCRIPTION}}

=== MEU CURRÍCULO ATUAL ===
{{RESUME_CONTENT}}`,
};

const getResumeFlag = (resume) => {
  if (!resume) return "";
  const explicit = resume.resume_language;
  const metaLang = resume.meta?.language;
  const lang = (explicit || metaLang || "").toLowerCase();

  if (["pt", "ptbr", "pt-br"].includes(lang)) return "🇧🇷";
  if (["en", "eng", "en-us"].includes(lang)) return "🇺🇸";
  return "⚠️";
};

const getResumeLangKey = (resume) => {
  if (!resume) return "en";
  const explicit = resume.resume_language;
  const metaLang = resume.meta?.language;
  const lang = (explicit || metaLang || "").toLowerCase();

  if (["pt", "ptbr", "pt-br"].includes(lang)) return "pt";
  return "en";
};

const palette = {
  bg: {
    page: "bg-gray-900",
    previewTextarea: "bg-gray-950",
    sectionHeader: "bg-gray-800",
  },
  text: {
    primary: "text-gray-200",
    light: "text-white",
    muted: "text-gray-400",
  },
  border: {
    previewTextarea: "border-gray-700",
    divider: "border-gray-700",
  },
};

const styleguide = {
  previewTextarea: `${palette.bg.previewTextarea} ${palette.border.previewTextarea} border ${palette.text.primary} font-mono text-xs leading-relaxed w-full rounded-md p-3 transition outline-none focus:ring-1 focus:ring-blue-500 resize-none`,
  label:
    "text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1 block flex items-center gap-2",
};

function convertDate(str) {
  if (!str) return "";
  try {
    const [monthStr, year] = str.split(" ");
    const month = {
      Jan: "01",
      Feb: "02",
      Mar: "03",
      Apr: "04",
      May: "05",
      Jun: "06",
      Jul: "07",
      Aug: "08",
      Sep: "09",
      Oct: "10",
      Nov: "11",
      Dec: "12",
    }[monthStr];
    return `${year}-${month}`;
  } catch (err) {
    console.error("Invalid date:", str);
    return "";
  }
}

const ResumeSelector = ({
  resumes,
  selectedResumeId,
  handleResumeChange,
  className = "",
}) => {
  const selectedResume = resumes.find((r) => r.id === selectedResumeId);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {selectedResume && (
        <span className="text-xl select-none" title="Language detected">
          {getResumeFlag(selectedResume)}
        </span>
      )}

      <select
        onChange={handleResumeChange}
        value={selectedResumeId || ""}
        className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm min-w-[150px] max-w-[250px]"
      >
        {resumes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.internal_name}
          </option>
        ))}

        <option disabled>──────────</option>
        <option
          value="create_copy"
          className="font-bold text-emerald-400 bg-gray-800"
        >
          ➕ Create Copy of Current
        </option>
      </select>
    </div>
  );
};

const ResumePreviewModal = ({
  isOpen,
  onClose,
  resume,
  resumes,
  selectedResumeId,
  handleResumeChange,
}) => {
  const [format, setFormat] = useState("json");
  const [resumeContent, setResumeContent] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!resume) return;

    if (format === "json") {
      const jsonPayload = denormalizeResume(resume);
      setResumeContent(JSON.stringify(jsonPayload, null, 2));
    } else {
      const latexContent = generateLatex(resume);
      setResumeContent(latexContent);
    }
  }, [resume, format]);

  useEffect(() => {
    const langKey = getResumeLangKey(resume);

    setPromptTemplate(PROMPT_TEMPLATES[langKey]);
  }, [resume?.id]);

  const finalOutput = promptTemplate
    .replace(
      "{{JOB_DESCRIPTION}}",
      jobDescription || "[PASTE JOB DESCRIPTION HERE]",
    )
    .replace("{{RESUME_CONTENT}}", resumeContent);

  const handleCopy = () => {
    navigator.clipboard.writeText(finalOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 animate-in fade-in backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-[90vw] h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center px-4 py-3 border-b border-gray-700 bg-gray-800 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-white font-bold font-mono text-lg flex items-center gap-2">
              <Sparkles className="text-purple-400" size={20} />
              LLM Context Builder
            </h3>

            <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700 ml-4">
              <button
                onClick={() => setFormat("json")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                  format === "json"
                    ? "bg-emerald-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                JSON
              </button>
              <button
                onClick={() => setFormat("latex")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                  format === "latex"
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                LaTeX
              </button>
            </div>

            <div className="hidden md:block w-px h-6 bg-gray-600 mx-2"></div>
            <ResumeSelector
              resumes={resumes}
              selectedResumeId={selectedResumeId}
              handleResumeChange={handleResumeChange}
            />
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 p-2 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="h-1/3 p-4 bg-gray-900 border-b border-gray-700 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-1">
              <label className={styleguide.label}>
                <Settings size={12} />
                1. Prompt Instructions (Editable)
              </label>
              <span className="text-[10px] text-gray-500 font-mono">
                Variables:{" "}
                <span className="text-yellow-500">{"{{JOB_DESCRIPTION}}"}</span>
                ,{" "}
                <span className="text-emerald-500">{"{{RESUME_CONTENT}}"}</span>
              </span>
            </div>
            <textarea
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              className={`${styleguide.previewTextarea} flex-1 border-dashed border-gray-600 text-gray-300`}
              spellCheck={false}
            />
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-700 bg-gray-900 min-h-0">
            <div className="flex flex-col p-4 min-h-0">
              <label className={`${styleguide.label} text-yellow-500`}>
                2. Variable: Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste job description here..."
                className={`${styleguide.previewTextarea} flex-1 focus:border-yellow-500/50`}
              />
            </div>

            <div className="flex flex-col p-4 min-h-0 bg-gray-900/50">
              <div className="flex justify-between items-center mb-1">
                <label className={`${styleguide.label} text-emerald-500`}>
                  3. Variable: Resume Content
                </label>
                <span className="text-[10px] text-gray-600 font-mono">
                  {format.toUpperCase()}
                </span>
              </div>
              <textarea
                readOnly
                value={resumeContent}
                className={`${styleguide.previewTextarea} flex-1 opacity-60 cursor-not-allowed`}
              />
            </div>

            <div className="flex flex-col p-4 min-h-0 bg-gray-800/30">
              <div className="flex justify-between items-center mb-1">
                <label className={`${styleguide.label} text-purple-400`}>
                  4. Final Result (Auto-Generated)
                </label>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition shadow-lg"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "COPIED!" : "COPY FINAL"}
                </button>
              </div>
              <textarea
                readOnly
                value={finalOutput}
                className={`${styleguide.previewTextarea} flex-1 border-purple-500/30 focus:ring-purple-500 text-gray-300`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const UserProfile = () => {
  const [profile, setProfile] = useState({});
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(null);

  const [showFullPreview, setShowFullPreview] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const selectedResume = resumes.find((r) => r.id === selectedResumeId);

  const handleResumeChange = (e) => {
    const value = e.target.value;

    if (value === "create_copy") {
      const current = resumes.find((r) => r.id === selectedResumeId);
      if (!current) return;

      const newResume = JSON.parse(JSON.stringify(current));
      newResume.id = Date.now();
      newResume.internal_name = `${current.internal_name} (Copy)`;

      setResumes([...resumes, newResume]);
      setSelectedResumeId(newResume.id);
    } else {
      setSelectedResumeId(Number(value));
    }
  };

  const importExperiencesFromLinkedin = (linkedinData) => {
    if (!selectedResume) return;

    const mapped = linkedinData.experiences.map((exp) => ({
      id: Date.now() + Math.random(),
      company: exp.company_name,
      role: exp.title,
      location: exp.location || "",
      start_date: convertDate(exp.start_date),
      end_date:
        exp.end_date === "Present" ? "Present" : convertDate(exp.end_date),

      highlights: exp.description
        ? exp.description
            .split(/\r?\n+/)
            .map((line) => line.replace(/^[-•\s]+/, "").trim())
            .filter((line) => line.length > 0)
        : [],

      stack: extractTechStack(exp.description || ""),
    }));

    setResumes((prev) =>
      prev.map((r) =>
        r.id === selectedResume.id ? { ...r, experience: mapped } : r,
      ),
    );
  };

  useEffect(() => {
    window.importLinkedinExperienceHook = importExperiencesFromLinkedin;
  }, [importExperiencesFromLinkedin]);

  useEffect(() => {
    const loadDataFromApi = async () => {
      setLoading(true);
      try {
        const [profilesData, resumesData] = await Promise.all([
          fetchProfiles(),
          fetchAllResumes(),
        ]);

        if (profilesData && profilesData.length > 0) {
          const sortedProfile = {
            ...profilesData[0],
            languages: [...(profilesData[0].languages || [])].sort(),
            positive_keywords: [
              ...(profilesData[0].positive_keywords || []),
            ].sort(),
            negative_keywords: [
              ...(profilesData[0].negative_keywords || []),
            ].sort(),
          };
          setProfile(sortedProfile);
        }

        const normalizedResumes = (resumesData || []).map(normalizeResume);
        setResumes(normalizedResumes);

        if (normalizedResumes.length > 0) {
          setSelectedResumeId(normalizedResumes[0].id);
        }
      } catch (err) {
        console.error("💥 ERROR during data fetching:", err);
        setError(
          err.message || "Failed to fetch data. Please check the console.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadDataFromApi();
  }, []);

  const handleSaveProfile = async () => {
    try {
      const savedProfile = await saveProfile(profile);
      setProfile(savedProfile);
      alert("Profile saved successfully! ✅");
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert(`Error saving profile: ${error.message} ❌`);
    }
  };

  const handleSaveResume = async () => {
    if (!selectedResume) {
      alert("Resume must have a name to be saved.");
      return;
    }

    try {
      const payload = denormalizeResume(selectedResume);

      let savedResumeRaw;
      if (selectedResume.id && String(selectedResume.id).length < 13) {
        savedResumeRaw = await updateResume(selectedResume.id, payload);
      } else {
        savedResumeRaw = await createResume(payload);
      }

      const savedResumeNormalized = normalizeResume(savedResumeRaw);

      setResumes((prevResumes) => {
        if (selectedResume.id === savedResumeNormalized.id) {
          return prevResumes.map((r) =>
            r.id === selectedResume.id ? savedResumeNormalized : r,
          );
        }

        return [
          ...prevResumes.filter((r) => r.id !== selectedResume.id),
          savedResumeNormalized,
        ];
      });

      setSelectedResumeId(savedResumeNormalized.id);
      alert(
        `Resume "${savedResumeNormalized.internal_name}" saved successfully! ✅`,
      );
    } catch (error) {
      console.error("Failed to save resume:", error);
      alert(`Error saving resume: ${error.message} ❌`);
    }
  };

  const handleDeleteResume = async () => {
    if (!selectedResume || !selectedResume.id) return;
    if (
      !window.confirm(
        `Are you sure you want to delete resume "${selectedResume.internal_name}"?`,
      )
    )
      return;

    try {
      await deleteResume(selectedResume.id);
      const updated = resumes.filter((r) => r.id !== selectedResume.id);
      setResumes(updated);
      setSelectedResumeId(updated.length > 0 ? updated[0].id : null);
      alert("Resume deleted successfully! ✅");
    } catch (err) {
      console.error("Error deleting resume:", err);
      alert(`Failed to delete resume: ${err.message}`);
    }
  };

  const handleToggleFullPreview = () => {
    setShowFullPreview(true);
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-gray-900">
        Loading...
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500 bg-gray-900">
        Error: {error}
      </div>
    );

  return (
    <div
      className={`${palette.bg.page} ${palette.text.primary} min-h-screen p-4 sm:p-6 lg:p-8`}
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1
            className={`text-3xl font-extrabold ${palette.text.light} flex items-center gap-3`}
          >
            <Briefcase className="text-blue-500" /> Career Profile & Resumes
          </h1>

          <div className="bg-gray-800 p-2 rounded-lg border border-gray-700 shadow-md">
            <span className="text-[10px] text-gray-400 block mb-1 px-1 uppercase tracking-wider font-bold">
              Active Resume
            </span>
            <ResumeSelector
              resumes={resumes}
              selectedResumeId={selectedResumeId}
              handleResumeChange={handleResumeChange}
            />
          </div>
        </div>

        <div className="mb-8">
          <LinkedinExperiences onImport={importExperiencesFromLinkedin} />
        </div>

        <ProfileEditor
          profile={profile}
          setProfile={setProfile}
          onSave={handleSaveProfile}
        />

        <ResumeEditor
          resumes={resumes}
          selectedResumeId={selectedResumeId}
          setSelectedResumeId={setSelectedResumeId}
          setResumes={setResumes}
          onSave={handleSaveResume}
          onDelete={handleDeleteResume}
          onToggleFullPreview={handleToggleFullPreview}
          handleResumeChange={handleResumeChange}
        />

        <ResumePreviewModal
          isOpen={showFullPreview}
          onClose={() => setShowFullPreview(false)}
          resume={selectedResume}
          resumes={resumes}
          selectedResumeId={selectedResumeId}
          handleResumeChange={handleResumeChange}
        />

        {!showFullPreview && (
          <div className="fixed bottom-6 right-6 z-40 bg-gray-800 border border-gray-600 p-2 rounded-lg shadow-2xl flex flex-col gap-1 opacity-50 hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center">
              Quick Switch
            </span>
            <ResumeSelector
              resumes={resumes}
              selectedResumeId={selectedResumeId}
              handleResumeChange={handleResumeChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
