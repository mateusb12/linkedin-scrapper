import React from "react";
import {
  Code,
  User,
  Languages,
  GraduationCap,
  BrainCircuit,
  Briefcase,
  FileJson,
} from "lucide-react";

const parseTimelineValue = (value) => {
  if (!value) return -Infinity;

  const normalized = String(value).trim().toLowerCase();

  if (["present", "current", "now"].includes(normalized)) {
    return Infinity;
  }

  const match = normalized.match(/^(\d{4})-(\d{2})$/);
  if (!match) return -Infinity;

  const [, year, month] = match;
  return Number(year) * 100 + Number(month);
};

const sortExperiencesByTimeline = (experiences = []) => {
  return [...experiences].sort((a, b) => {
    const endDiff =
      parseTimelineValue(b.end_date) - parseTimelineValue(a.end_date);
    if (endDiff !== 0) return endDiff;

    const startDiff =
      parseTimelineValue(b.start_date) - parseTimelineValue(a.start_date);
    if (startDiff !== 0) return startDiff;

    return String(b.id || "").localeCompare(String(a.id || ""));
  });
};

const palette = {
  bg: {
    card: "bg-gray-800",
    input: "bg-gray-700",
    nestedCard: "bg-gray-700/50",
  },
  text: {
    light: "text-white",
    primary: "text-gray-200",
    secondary: "text-gray-400",
    dangerHover: "hover:text-red-500",
    accent: "text-emerald-400",
  },
  border: {
    primary: "border-gray-700",
    secondary: "border-gray-800",
    focus: "focus:border-emerald-500",
  },
  action: {
    primary: "bg-blue-600",
    primaryHover: "hover:bg-blue-500",
    secondary: "bg-gray-700",
    secondaryHover: "hover:bg-gray-600",
    markdown: "bg-purple-600",
    markdownHover: "hover:bg-purple-500",
    success: "bg-emerald-600",
    successHover: "hover:bg-emerald-500",
    focusRing: "focus:ring-emerald-500",
  },
  state: {
    disabled: "disabled:opacity-50",
    disabledTextHover: "disabled:hover:text-gray-400",
  },
};

const styleguide = {
  input: `w-full ${palette.bg.input} border ${palette.border.secondary} ${palette.text.primary} rounded-md shadow-sm py-2 px-3 focus:ring-2 ${palette.action.focusRing} ${palette.border.focus} outline-none transition text-sm`,
  button: {
    primary: `${palette.action.primary} ${palette.action.primaryHover} ${palette.text.light} font-bold py-2 px-6 rounded-md transition shadow-md`,
    success: `mt-2 text-xs uppercase tracking-wider font-semibold ${palette.action.success} ${palette.action.successHover} ${palette.text.light} py-1.5 px-3 rounded-md transition flex items-center gap-1`,
    markdown: `${palette.action.markdown} ${palette.action.markdownHover} ${palette.text.light} font-bold py-2 px-4 rounded-md transition`,
  },
  iconButton: {
    delete: `absolute top-3 right-3 ${palette.text.secondary} ${palette.text.dangerHover} transition bg-gray-800/80 rounded-full p-1.5 hover:bg-gray-700`,
  },
  label: `block text-xs font-bold uppercase tracking-wider ${palette.text.secondary} mb-1`,
};
const inputClasses = styleguide.input;

const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
      clipRule="evenodd"
    />
  </svg>
);
const MinusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z"
      clipRule="evenodd"
    />
  </svg>
);

const getResumeFlag = (resume) => {
  if (!resume) return "";
  const explicit = resume.resume_language;
  const metaLang = resume.meta?.language;
  const lang = (explicit || metaLang || "").toLowerCase();
  if (["pt", "ptbr", "pt-br"].includes(lang)) return "🇧🇷";
  if (["en", "eng", "en-us"].includes(lang)) return "🇺🇸";
  return "⚠️";
};

const LocalResumeSelector = ({
  resumes,
  selectedResumeId,
  handleResumeChange,
}) => {
  const selectedResume = resumes.find((r) => r.id === selectedResumeId);
  return (
    <div className={`flex items-center gap-3`}>
      {selectedResume && (
        <span className="text-2xl select-none" title="Language detected">
          {getResumeFlag(selectedResume)}
        </span>
      )}
      <select
        onChange={handleResumeChange}
        value={selectedResumeId || ""}
        className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm min-w-[200px] max-w-[300px]"
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

const DynamicInputSection = ({ title, items, setItems, placeholder }) => {
  const handleAddItem = () => setItems([...items, ""]);
  const handleRemoveItem = (index) => {
    if (items.length > 0) setItems(items.filter((_, i) => i !== index));
  };
  const handleItemChange = (index, value) => {
    const newItems = [...items];
    newItems[index] = value;
    setItems(newItems);
  };
  return (
    <div>
      <label className={`${styleguide.label} mb-2`}>{title}</label>
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-center mb-2 animate-in fade-in slide-in-from-left-1 duration-200 gap-2"
        >
          <input
            type="text"
            value={item}
            onChange={(e) => handleItemChange(index, e.target.value)}
            className={inputClasses}
            placeholder={placeholder || `Enter item...`}
          />
          <button
            type="button"
            onClick={() => handleRemoveItem(index)}
            className="text-gray-400 hover:text-red-500"
          >
            <MinusIcon />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handleAddItem}
        className={styleguide.button.success}
      >
        <PlusIcon /> Add Item
      </button>
    </div>
  );
};

const normalizePreviewValue = (value) => String(value ?? "").trim();

const normalizePreviewArray = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => normalizePreviewValue(item))
    .filter(Boolean);

const didPreviewFieldChange = (before, after, field) => {
  if (field === "highlights" || field === "stack") {
    return (
      JSON.stringify(normalizePreviewArray(before?.[field])) !==
      JSON.stringify(normalizePreviewArray(after?.[field]))
    );
  }

  return (
    normalizePreviewValue(before?.[field]) !==
    normalizePreviewValue(after?.[field])
  );
};

const formatPreviewValue = (value, multiline = false) => {
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value.join(multiline ? "\n" : ", ");
  }

  const text = String(value ?? "").trim();
  return text || "—";
};

const importStatusMeta = {
  changed: {
    label: "Changed",
    classes: "bg-amber-900/40 text-amber-300 border border-amber-700/40",
  },
  new: {
    label: "New",
    classes: "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40",
  },
  unchanged: {
    label: "Unchanged",
    classes: "bg-gray-800 text-gray-300 border border-gray-600",
  },
  missing_in_import: {
    label: "Missing in import",
    classes: "bg-rose-900/40 text-rose-300 border border-rose-700/40",
  },
};

const ReadOnlyDiffField = ({
  label,
  beforeValue,
  afterValue,
  multiline = false,
  changed = false,
}) => {
  const fieldClasses = `${inputClasses} ${
    changed ? "border-amber-500 bg-amber-950/20 text-amber-50" : "opacity-80"
  } cursor-default`;

  return (
    <div>
      <label className={styleguide.label}>{label}</label>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-bold">
            Before
          </div>
          {multiline ? (
            <textarea
              readOnly
              rows="4"
              value={beforeValue}
              className={fieldClasses}
            />
          ) : (
            <input readOnly value={beforeValue} className={fieldClasses} />
          )}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-bold">
            After import
          </div>
          {multiline ? (
            <textarea
              readOnly
              rows="4"
              value={afterValue}
              className={fieldClasses}
            />
          ) : (
            <input readOnly value={afterValue} className={fieldClasses} />
          )}
        </div>
      </div>
    </div>
  );
};

const ResumeEditor = ({
  resumes,
  selectedResumeId,
  setSelectedResumeId,
  setResumes,
  onSave,
  onDelete,
  onToggleFullPreview,
  handleResumeChange,
  experienceImportPreview,
  onApplyExperienceImport,
  onDiscardExperienceImport,
  onToggleExperienceImportItem,
}) => {
  const selectedResume = resumes.find((r) => r.id === selectedResumeId);

  const activeImportPreview =
    experienceImportPreview?.resumeId === selectedResume?.id
      ? experienceImportPreview
      : null;

  const previewStats = (activeImportPreview?.items || []).reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {
      changed: 0,
      new: 0,
      unchanged: 0,
      missing_in_import: 0,
    },
  );

  if (!resumes || resumes.length === 0)
    return (
      <div
        className={`${palette.bg.card} p-8 rounded-lg shadow-lg mt-8 text-center border border-gray-700`}
      >
        <div className="text-gray-500 mb-4">
          No resumes found. Start by creating one.
        </div>
        <button
          className={styleguide.button.primary}
          onClick={() => {
            const newResume = {
              id: Date.now(),
              name: "New Resume",
              summary: "",
              hard_skills: {
                languages: [],
                frameworks: [],
                cloud_and_infra: [],
                databases: [],
                concepts: [],
              },
              professional_experience: [],
              projects: [],
              education: [],
              languages: [],
              contacts: {},
            };
            setResumes([newResume]);
            setSelectedResumeId(newResume.id);
          }}
        >
          <PlusIcon /> Create New Resume
        </button>
      </div>
    );

  const updateResumeField = (field, value) => {
    setResumes((prev) =>
      prev.map((r) =>
        r.id === selectedResume.id ? { ...r, [field]: value } : r,
      ),
    );
  };

  const updateContact = (key, value) => {
    const currentContacts = selectedResume.contacts || {};
    updateResumeField("contacts", { ...currentContacts, [key]: value });
  };

  const updateSkillCategory = (category, items) => {
    const currentSkills = selectedResume.skills || {};
    updateResumeField("skills", { ...currentSkills, [category]: items });
  };

  const addLanguage = () => {
    updateResumeField("languages", [
      ...(selectedResume.languages || []),
      { name: "", level: "" },
    ]);
  };
  const updateLanguage = (index, key, value) => {
    const langs = [...(selectedResume.languages || [])];
    langs[index] = { ...langs[index], [key]: value };
    updateResumeField("languages", langs);
  };
  const removeLanguage = (index) => {
    const langs = [...(selectedResume.languages || [])];
    langs.splice(index, 1);
    updateResumeField("languages", langs);
  };

  const addEducation = () => {
    updateResumeField("education", [
      ...(selectedResume.education || []),
      {
        id: Date.now(),
        institution: "",
        degree: "",
        location: "",
        start_year: "",
        end_year: "",
      },
    ]);
  };
  const updateEducation = (index, key, value) => {
    const edus = [...(selectedResume.education || [])];
    edus[index] = { ...edus[index], [key]: value };
    updateResumeField("education", edus);
  };
  const removeEducation = (index) => {
    const edus = [...(selectedResume.education || [])];
    edus.splice(index, 1);
    updateResumeField("education", edus);
  };

  const addExperience = () => {
    const newExp = {
      id: Date.now(),
      role: "",
      company: "",
      location: "",
      start_date: "",
      end_date: "",
      highlights: [],
      stack: [],
    };

    updateResumeField(
      "experience",
      sortExperiencesByTimeline([...(selectedResume.experience || []), newExp]),
    );
  };
  const updateExperience = (index, field, value) => {
    const exps = [...(selectedResume.experience || [])];
    exps[index] = { ...exps[index], [field]: value };

    updateResumeField("experience", sortExperiencesByTimeline(exps));
  };
  const removeExperience = (index) => {
    const exps = [...(selectedResume.experience || [])];
    exps.splice(index, 1);

    updateResumeField("experience", sortExperiencesByTimeline(exps));
  };

  const addProject = () => {
    const newProj = {
      id: Date.now(),
      name: "",
      description: "",
      stack: [],
      links: { github: "", website: "" },
    };
    updateResumeField("projects", [
      ...(selectedResume.projects || []),
      newProj,
    ]);
  };
  const updateProject = (index, field, value) => {
    const projs = [...(selectedResume.projects || [])];
    projs[index] = { ...projs[index], [field]: value };
    updateResumeField("projects", projs);
  };
  const updateProjectLink = (index, linkKey, value) => {
    const projs = [...(selectedResume.projects || [])];
    const links = { ...(projs[index].links || {}), [linkKey]: value };
    projs[index] = { ...projs[index], links };
    updateResumeField("projects", projs);
  };
  const removeProject = (index) => {
    const projs = [...(selectedResume.projects || [])];
    projs.splice(index, 1);
    updateResumeField("projects", projs);
  };

  return (
    <div
      className={`${palette.bg.card} p-6 rounded-lg shadow-lg mt-8 border border-gray-700`}
    >
      <div
        className={`flex flex-col md:flex-row justify-between md:items-center mb-8 border-b ${palette.border.primary} pb-5`}
      >
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Code className="text-white h-6 w-6" />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${palette.text.light}`}>
              Resume Editor
            </h2>
            <p className="text-xs text-gray-400">
              Customize specific application versions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <LocalResumeSelector
            resumes={resumes}
            selectedResumeId={selectedResumeId}
            handleResumeChange={handleResumeChange}
          />
        </div>
      </div>

      {selectedResume && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={styleguide.label}>Resume Internal Name</label>
              <input
                value={selectedResume.internal_name}
                onChange={(e) =>
                  updateResumeField("internal_name", e.target.value)
                }
                className={inputClasses}
              />
            </div>
            <div>
              <label className={styleguide.label}>Summary / Bio</label>
              <textarea
                value={selectedResume.summary || ""}
                onChange={(e) => updateResumeField("summary", e.target.value)}
                className={inputClasses}
                rows="3"
                placeholder="Brief professional summary..."
              />
            </div>
          </div>

          <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-700">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <User size={16} /> Resume Contacts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["email", "phone", "linkedin", "github", "portfolio"].map(
                (key) => (
                  <div key={key}>
                    <label className={styleguide.label}>{key}</label>
                    <input
                      value={selectedResume.contacts?.[key] || ""}
                      onChange={(e) => updateContact(key, e.target.value)}
                      className={inputClasses}
                    />
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Languages size={16} /> Languages
                </h3>
                <button
                  onClick={addLanguage}
                  className={styleguide.button.success}
                >
                  + Add
                </button>
              </div>
              {(selectedResume.languages || []).map((lang, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input
                    placeholder="Language"
                    value={lang.name}
                    onChange={(e) =>
                      updateLanguage(idx, "name", e.target.value)
                    }
                    className={inputClasses}
                  />
                  <input
                    placeholder="Level (e.g. C2)"
                    value={lang.level}
                    onChange={(e) =>
                      updateLanguage(idx, "level", e.target.value)
                    }
                    className={inputClasses}
                  />
                  <button
                    onClick={() => removeLanguage(idx)}
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <GraduationCap size={16} /> Education
                </h3>
                <button
                  onClick={addEducation}
                  className={styleguide.button.success}
                >
                  + Add
                </button>
              </div>
              {(selectedResume.education || []).map((edu, idx) => (
                <div
                  key={idx}
                  className="bg-gray-800 p-3 rounded mb-3 border border-gray-600 relative"
                >
                  <button
                    onClick={() => removeEducation(idx)}
                    className={styleguide.iconButton.delete}
                  >
                    ×
                  </button>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      placeholder="Institution"
                      value={edu.institution}
                      onChange={(e) =>
                        updateEducation(idx, "institution", e.target.value)
                      }
                      className={inputClasses}
                    />
                    <input
                      placeholder="Degree"
                      value={edu.degree}
                      onChange={(e) =>
                        updateEducation(idx, "degree", e.target.value)
                      }
                      className={inputClasses}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      placeholder="City"
                      value={edu.location}
                      onChange={(e) =>
                        updateEducation(idx, "location", e.target.value)
                      }
                      className={inputClasses}
                    />
                    <input
                      placeholder="Start"
                      value={edu.start_year}
                      onChange={(e) =>
                        updateEducation(idx, "start_year", e.target.value)
                      }
                      className={inputClasses}
                    />
                    <input
                      placeholder="End"
                      value={edu.end_year}
                      onChange={(e) =>
                        updateEducation(idx, "end_year", e.target.value)
                      }
                      className={inputClasses}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-700/30 p-5 rounded-lg border border-gray-700">
            <h3
              className={`text-lg font-bold ${palette.text.light} mb-4 flex items-center gap-2`}
            >
              <BrainCircuit className="text-purple-400" size={20} /> Technical
              Skills
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { key: "languages", label: "Prog. Languages" },
                { key: "frameworks", label: "Frameworks" },
                { key: "cloud_and_infra", label: "Cloud & Infra" },
                { key: "databases", label: "Databases" },
                { key: "concepts", label: "Concepts" },
              ].map((cat) => (
                <DynamicInputSection
                  key={cat.key}
                  title={cat.label}
                  items={selectedResume.skills?.[cat.key] || []}
                  setItems={(items) => updateSkillCategory(cat.key, items)}
                  placeholder={`Add ${cat.label}...`}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center border-t border-gray-700 pt-6 mb-4">
              <h3
                className={`text-xl font-bold ${palette.text.light} flex items-center gap-2`}
              >
                <Briefcase className="text-emerald-400" /> Professional
                Experience
              </h3>
              <button
                onClick={addExperience}
                className={styleguide.button.success}
              >
                + Add Role
              </button>
            </div>
            {activeImportPreview && (
              <div className="mb-6 rounded-lg border border-amber-700/40 bg-amber-950/20 p-5">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-5">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-amber-200">
                      LinkedIn import diff preview
                    </h4>
                    <p className="text-sm text-gray-300 mt-1">
                      Review the current resume experience against the imported
                      LinkedIn version before replacing the editor content.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="px-2 py-1 rounded border border-amber-700/40 bg-amber-900/30 text-amber-200">
                      Changed: {previewStats.changed}
                    </span>
                    <span className="px-2 py-1 rounded border border-emerald-700/40 bg-emerald-900/30 text-emerald-200">
                      New: {previewStats.new}
                    </span>
                    <span className="px-2 py-1 rounded border border-gray-600 bg-gray-800 text-gray-300">
                      Unchanged: {previewStats.unchanged}
                    </span>
                    <span className="px-2 py-1 rounded border border-rose-700/40 bg-rose-900/30 text-rose-200">
                      Missing in import: {previewStats.missing_in_import}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 mb-5">
                  <button
                    type="button"
                    onClick={onDiscardExperienceImport}
                    className="border border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 font-semibold py-2 px-4 rounded-md transition"
                  >
                    Discard Preview
                  </button>

                  <button
                    type="button"
                    onClick={onApplyExperienceImport}
                    className="border border-emerald-700 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-md transition"
                  >
                    Apply Imported Version
                  </button>
                </div>

                <div className="space-y-5">
                  {activeImportPreview.items.map((item, index) => {
                    const before = item.before || {};
                    const after = item.after || {};
                    const statusMeta =
                      importStatusMeta[item.status] || importStatusMeta.unchanged;

                    const titleRole = after.role || before.role || "Untitled role";
                    const titleCompany =
                      after.company || before.company || "Unknown company";
                    const isAccepted = item.accepted !== false;

                    const decisionText =
                      item.status === "new"
                        ? isAccepted
                          ? "This new imported item will be added when you apply."
                          : "This new imported item will be ignored."
                        : item.status === "changed"
                          ? isAccepted
                            ? "The imported version will replace the current one."
                            : "The current version will be kept."
                          : item.status === "missing_in_import"
                            ? isAccepted
                              ? "This current-only item will be kept."
                              : "This current-only item will be removed when you apply."
                            : "No differences detected for this item.";

                    return (
                      <div
                        key={item.id || index}
                        className="rounded-lg border border-gray-700 bg-gray-900/40 p-4"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                          <div>
                            <h5 className="text-base font-bold text-white">
                              {titleRole} — {titleCompany}
                            </h5>
                            <p className="text-xs text-gray-400">
                              Review field-by-field differences below
                            </p>
                            <p
                              className={`text-xs mt-1 ${
                                isAccepted ? "text-emerald-300" : "text-gray-500"
                              }`}
                            >
                              {decisionText}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex w-fit px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${statusMeta.classes}`}
                            >
                              {statusMeta.label}
                            </span>

                            {item.status !== "unchanged" && (
                              <button
                                type="button"
                                onClick={() =>
                                  onToggleExperienceImportItem(item.id)
                                }
                                className={`px-3 py-1 rounded text-xs font-bold border transition ${
                                  isAccepted
                                    ? "border-red-700/50 bg-red-900/30 text-red-300 hover:bg-red-900/50"
                                    : "border-emerald-700/50 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50"
                                }`}
                              >
                                {item.status === "new"
                                  ? isAccepted
                                    ? "Skip this item"
                                    : "Include this item"
                                  : item.status === "missing_in_import"
                                    ? isAccepted
                                      ? "Remove current item"
                                      : "Keep current item"
                                    : isAccepted
                                      ? "Keep current version"
                                      : "Use imported version"}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <ReadOnlyDiffField
                            label="Company"
                            beforeValue={formatPreviewValue(before.company)}
                            afterValue={formatPreviewValue(after.company)}
                            changed={didPreviewFieldChange(before, after, "company")}
                          />

                          <ReadOnlyDiffField
                            label="Role"
                            beforeValue={formatPreviewValue(before.role)}
                            afterValue={formatPreviewValue(after.role)}
                            changed={didPreviewFieldChange(before, after, "role")}
                          />

                          <ReadOnlyDiffField
                            label="Location"
                            beforeValue={formatPreviewValue(before.location)}
                            afterValue={formatPreviewValue(after.location)}
                            changed={didPreviewFieldChange(before, after, "location")}
                          />

                          <ReadOnlyDiffField
                            label="Start Date"
                            beforeValue={formatPreviewValue(before.start_date)}
                            afterValue={formatPreviewValue(after.start_date)}
                            changed={didPreviewFieldChange(before, after, "start_date")}
                          />

                          <ReadOnlyDiffField
                            label="End Date"
                            beforeValue={formatPreviewValue(before.end_date)}
                            afterValue={formatPreviewValue(after.end_date)}
                            changed={didPreviewFieldChange(before, after, "end_date")}
                          />

                          <ReadOnlyDiffField
                            label="Highlights"
                            beforeValue={formatPreviewValue(before.highlights, true)}
                            afterValue={formatPreviewValue(after.highlights, true)}
                            multiline
                            changed={didPreviewFieldChange(before, after, "highlights")}
                          />

                          <ReadOnlyDiffField
                            label="Tech Stack"
                            beforeValue={formatPreviewValue(before.stack)}
                            afterValue={formatPreviewValue(after.stack)}
                            changed={didPreviewFieldChange(before, after, "stack")}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {(selectedResume.experience || []).map((exp, index) => (
                <div
                  key={exp.id || index}
                  className={`${palette.bg.nestedCard} p-5 rounded-lg border ${palette.border.secondary} relative group`}
                >
                  <button
                    onClick={() => removeExperience(index)}
                    className={styleguide.iconButton.delete}
                  >
                    ×
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className={styleguide.label}>Company</label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) =>
                          updateExperience(index, "company", e.target.value)
                        }
                        className={inputClasses}
                        placeholder="Company Name"
                      />
                    </div>
                    <div>
                      <label className={styleguide.label}>Role</label>
                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) =>
                          updateExperience(index, "role", e.target.value)
                        }
                        className={inputClasses}
                        placeholder="Job Title"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={styleguide.label}>Start Date</label>
                        <input
                          type="text"
                          value={exp.start_date}
                          onChange={(e) =>
                            updateExperience(
                              index,
                              "start_date",
                              e.target.value,
                            )
                          }
                          className={inputClasses}
                          placeholder="YYYY-MM"
                        />
                      </div>
                      <div>
                        <label className={styleguide.label}>End Date</label>
                        <input
                          type="text"
                          value={exp.end_date}
                          onChange={(e) =>
                            updateExperience(index, "end_date", e.target.value)
                          }
                          className={inputClasses}
                          placeholder="YYYY-MM"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={styleguide.label}>Location</label>
                      <input
                        type="text"
                        value={exp.location}
                        onChange={(e) =>
                          updateExperience(index, "location", e.target.value)
                        }
                        className={inputClasses}
                        placeholder="City, Country"
                      />
                    </div>
                  </div>
                  <div className="pl-2 border-l-2 border-gray-600">
                    <DynamicInputSection
                      title="Highlights / Achievements"
                      items={exp.highlights || []}
                      setItems={(items) =>
                        updateExperience(index, "highlights", items)
                      }
                      placeholder="Describe a key achievement..."
                    />
                  </div>
                  <div className="mt-4">
                    <label className={styleguide.label}>Tech Stack Used</label>
                    <input
                      type="text"
                      value={
                        Array.isArray(exp.stack)
                          ? exp.stack.join(", ")
                          : exp.stack
                      }
                      onChange={(e) =>
                        updateExperience(
                          index,
                          "stack",
                          e.target.value.split(",").map((s) => s.trim()),
                        )
                      }
                      className={inputClasses}
                      placeholder="React, Python, AWS (comma separated)"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center border-t border-gray-700 pt-6 mb-4">
              <h3
                className={`text-xl font-bold ${palette.text.light} flex items-center gap-2`}
              >
                <Code className="text-blue-400" /> Projects
              </h3>
              <button
                onClick={addProject}
                className={styleguide.button.success}
              >
                + Add Project
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(selectedResume.projects || []).map((proj, index) => (
                <div
                  key={index}
                  className={`${palette.bg.nestedCard} p-4 rounded-lg border ${palette.border.secondary} relative`}
                >
                  <button
                    onClick={() => removeProject(index)}
                    className={styleguide.iconButton.delete}
                  >
                    ×
                  </button>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={proj.name}
                      onChange={(e) =>
                        updateProject(index, "name", e.target.value)
                      }
                      className={`${inputClasses} font-bold`}
                      placeholder="Project Name"
                    />
                    <textarea
                      value={proj.description}
                      onChange={(e) =>
                        updateProject(index, "description", e.target.value)
                      }
                      className={inputClasses}
                      rows="3"
                      placeholder="Project Description..."
                    />
                    <div className="grid grid-cols-2 gap-2 mt-2 bg-gray-800 p-2 rounded">
                      <div>
                        <label className={styleguide.label}>Github</label>
                        <input
                          value={proj.links?.github || ""}
                          onChange={(e) =>
                            updateProjectLink(index, "github", e.target.value)
                          }
                          className={inputClasses}
                        />
                      </div>
                      <div>
                        <label className={styleguide.label}>Website</label>
                        <input
                          value={proj.links?.website || ""}
                          onChange={(e) =>
                            updateProjectLink(index, "website", e.target.value)
                          }
                          className={inputClasses}
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={
                        Array.isArray(proj.stack)
                          ? proj.stack.join(", ")
                          : proj.stack
                      }
                      onChange={(e) =>
                        updateProject(
                          index,
                          "stack",
                          e.target.value.split(",").map((s) => s.trim()),
                        )
                      }
                      className={inputClasses}
                      placeholder="Stack: React, Node..."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`flex flex-col sm:flex-row justify-between items-center mt-8 pt-6 border-t ${palette.border.primary} gap-3`}
          >
            <div className="w-full sm:w-auto flex justify-start">
              <button
                onClick={() =>
                  window.confirm(`Delete "${selectedResume.internal_name}"?`) &&
                  onDelete()
                }
                className="border border-red-700/60 bg-red-900/30 text-red-400 hover:bg-red-900/50 font-bold py-2 px-4 rounded-md transition"
              >
                Delete
              </button>
            </div>
            <div className="w-full sm:w-auto flex justify-end gap-3">
              <button
                onClick={onToggleFullPreview}
                className={`${styleguide.button.markdown} flex items-center justify-center gap-2`}
              >
                <FileJson size={16} /> Preview JSON Payload
              </button>
              <button
                onClick={onSave}
                className={`${styleguide.button.primary}`}
              >
                Save Resume
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeEditor;
