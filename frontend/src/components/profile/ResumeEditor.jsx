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

const ResumeEditor = ({
  resumes,
  selectedResumeId,
  setSelectedResumeId,
  setResumes,
  onSave,
  onDelete,
  onToggleFullPreview,
  handleResumeChange,
}) => {
  const selectedResume = resumes.find((r) => r.id === selectedResumeId);

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
    updateResumeField("experience", [
      ...(selectedResume.experience || []),
      newExp,
    ]);
  };
  const updateExperience = (index, field, value) => {
    const exps = [...(selectedResume.experience || [])];
    exps[index] = { ...exps[index], [field]: value };
    updateResumeField("experience", exps);
  };
  const removeExperience = (index) => {
    const exps = [...(selectedResume.experience || [])];
    exps.splice(index, 1);
    updateResumeField("experience", exps);
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
            <div className="space-y-4">
              {(selectedResume.experience || []).map((exp, index) => (
                <div
                  key={index}
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
