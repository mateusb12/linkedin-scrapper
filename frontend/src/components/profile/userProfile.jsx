import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Globe,
  Eye,
  EyeOff,
  Server,
  Database,
  Code,
  Layout,
  BrainCircuit,
  Calendar,
  Briefcase,
  MapPinned,
} from "lucide-react";

import matter from "gray-matter";
import yaml from "js-yaml";

import {
  generateEducationMarkdown,
  generateExperienceMarkdown,
  generateHardSkillsMarkdown,
  generateProfileHeaderMarkdown,
  generateProjectsMarkdown,
} from "../../utils/markdownUtils.js";
import { fetchProfiles, saveProfile } from "../../services/profileService.js";
import { fetchAllResumes } from "../match-find/MatchLogic.jsx";
import {
  createResume,
  deleteResume,
  searchResumeByName,
  updateResume,
} from "../../services/resumeService.js";

const palette = {
  bg: {
    page: "bg-gray-900",
    card: "bg-gray-800",
    input: "bg-gray-700",
    nestedCard: "bg-gray-700/50",
    previewTextarea: "bg-gray-950",
  },
  text: {
    primary: "text-gray-200",
    secondary: "text-gray-400",
    light: "text-white",
    dangerHover: "hover:text-red-500",
    accent: "text-emerald-400",
  },
  border: {
    primary: "border-gray-700",
    secondary: "border-gray-800",
    focus: "focus:border-emerald-500",
    previewTextarea: "border-gray-700",
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
  input: `w-full ${palette.bg.input} border ${palette.border.secondary} ${palette.text.primary} rounded-md shadow-sm py-2 px-3 focus:ring-2 ${palette.action.focusRing} ${palette.border.focus} outline-none transition`,
  button: {
    primary: `${palette.action.primary} ${palette.action.primaryHover} ${palette.text.light} font-bold py-2 px-6 rounded-md transition shadow-md`,
    secondary: `${palette.action.secondary} ${palette.action.secondaryHover} ${palette.text.light} font-bold py-2 px-4 rounded-md transition w-full md:w-auto`,
    success: `mt-2 text-xs uppercase tracking-wider font-semibold ${palette.action.success} ${palette.action.successHover} ${palette.text.light} py-1.5 px-3 rounded-md transition`,
    markdown: `${palette.action.markdown} ${palette.action.markdownHover} ${palette.text.light} font-bold py-2 px-4 rounded-md transition`,
  },
  iconButton: {
    remove: `ml-2 p-1 ${palette.text.secondary} ${palette.text.dangerHover} ${palette.state.disabled} ${palette.state.disabledTextHover} transition`,
    delete: `absolute top-3 right-3 ${palette.text.secondary} ${palette.text.dangerHover} transition bg-gray-800 rounded-full p-1`,
  },
  label: `block text-xs font-bold uppercase tracking-wider ${palette.text.secondary} mb-1`,
  previewTextarea: `${palette.bg.previewTextarea} ${palette.border.previewTextarea} border ${palette.text.primary} font-mono text-xs leading-relaxed w-full rounded-md p-4 transition`,
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

const DynamicInputSection = ({ title, items, setItems, placeholder }) => {
  const handleAddItem = () => setItems([...items, ""]);
  const handleRemoveItem = (index) => {
    if (items.length > 0) {
      setItems(items.filter((_, i) => i !== index));
    }
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
          className="flex items-center mb-2 animate-in fade-in slide-in-from-left-1 duration-200"
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
            className={styleguide.iconButton.remove}
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
        <div className="flex items-center gap-1">
          <PlusIcon /> Add Item
        </div>
      </button>
    </div>
  );
};

const MarkdownPreview = ({ sectionTitle, markdownContent }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!markdownContent) return null;
  return (
    <div className="mt-4 border-t border-gray-700 pt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1"
      >
        {isOpen ? <EyeOff size={14} /> : <Eye size={14} />}
        {isOpen ? "Hide Markdown" : "View Markdown"}
      </button>
      {isOpen && (
        <div className="mt-3">
          <textarea
            readOnly
            value={markdownContent}
            className={styleguide.previewTextarea}
            rows={Math.max(5, markdownContent.split("\n").length + 1)}
            style={{ resize: "vertical" }}
          />
        </div>
      )}
    </div>
  );
};

const normalizeResume = (apiData) => {
  return {
    id: apiData.id,
    name: apiData.internal_name || apiData.name || "Untitled Resume",
    summary: apiData.summary || "",

    hard_skills: Array.isArray(apiData.skills)
      ? { languages: apiData.skills }
      : apiData.skills || {
          languages: [],
          frameworks: [],
          cloud_and_infra: [],
          databases: [],
          concepts: [],
        },

    professional_experience: (apiData.experience || []).map((exp) => ({
      id:
        exp.id ||
        `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: exp.role || exp.title || "",
      company: exp.company || "",
      location: exp.location || "",
      start_date: exp.start_date || "",
      end_date: exp.end_date || "",
      highlights: exp.highlights || exp.description || [],
      stack: exp.stack || [],
    })),

    projects: (apiData.projects || []).map((proj) => ({
      id:
        proj.id ||
        `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: proj.name || proj.title || "",
      description: proj.description || "",
      stack: proj.stack || [],
      links: proj.links || {},
    })),

    education: apiData.education || [],
    meta: apiData.meta || {
      language: "pt-BR",
      page: { size: "letter", font_size: 11 },
    },
    contact_info: apiData.profile?.contacts || {},
  };
};

const denormalizeResume = (uiState) => {
  return {
    id: uiState.id,
    internal_name: uiState.name,
    summary: uiState.summary,

    skills: uiState.hard_skills,

    experience: uiState.professional_experience.map((exp) => ({
      company: exp.company,
      role: exp.role,
      location: exp.location,
      start_date: exp.start_date,
      end_date: exp.end_date,
      highlights: exp.highlights,
      stack: exp.stack,
    })),

    projects: uiState.projects,
    education: uiState.education,

    profile: {
      name: uiState.name,
      contacts: uiState.contact_info,
    },
    meta: uiState.meta,
  };
};

const ProfileDetails = ({ profile, setProfile, onSave }) => {
  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };
  const handleArrayChange = (fieldName, newArray) => {
    setProfile({ ...profile, [fieldName]: newArray });
  };
  const iconSize = 5;

  return (
    <div
      className={`${palette.bg.card} p-6 rounded-lg shadow-lg border border-gray-700`}
    >
      <h2
        className={`text-2xl font-bold ${palette.text.light} mb-6 border-b ${palette.border.primary} pb-3 flex items-center gap-2`}
      >
        <User className="text-blue-500" /> Global Profile Details
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {}
        {[
          { label: "Name", name: "name", icon: User },
          { label: "Email", name: "email", icon: Mail, type: "email" },
          { label: "Phone", name: "phone", icon: Phone, type: "tel" },
          { label: "Location", name: "location", icon: MapPin },
        ].map((field) => (
          <div key={field.name}>
            <div className="flex items-center gap-1.5 pb-1.5 text-gray-400 text-sm font-medium">
              <field.icon className={`h-4 w-4`} /> {field.label}
            </div>
            <input
              type={field.type || "text"}
              name={field.name}
              value={profile[field.name] || ""}
              onChange={handleChange}
              className={inputClasses}
            />
          </div>
        ))}

        {}
        {[
          { label: "LinkedIn URL", name: "linkedin", icon: Linkedin },
          { label: "GitHub URL", name: "github", icon: Github },
          { label: "Portfolio URL", name: "portfolio", icon: Globe },
        ].map((field) => (
          <div key={field.name} className="md:col-span-2">
            <div className="flex items-center gap-1.5 pb-1.5 text-gray-400 text-sm font-medium">
              <field.icon className={`h-4 w-4`} /> {field.label}
            </div>
            <input
              type="text"
              name={field.name}
              value={profile[field.name] || ""}
              onChange={handleChange}
              className={inputClasses}
            />
          </div>
        ))}

        {}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <DynamicInputSection
            title="Languages"
            items={profile.languages || []}
            setItems={(newItems) => handleArrayChange("languages", newItems)}
            placeholder="e.g. English (C2)"
          />
          <DynamicInputSection
            title="Positive Keywords (ATS)"
            items={profile.positive_keywords || []}
            setItems={(newItems) =>
              handleArrayChange("positive_keywords", newItems)
            }
            placeholder="e.g. Python, Agile"
          />
          <DynamicInputSection
            title="Negative Keywords (ATS)"
            items={profile.negative_keywords || []}
            setItems={(newItems) =>
              handleArrayChange("negative_keywords", newItems)
            }
            placeholder="e.g. Java (if unwanted)"
          />
        </div>
      </div>

      <div
        className={`flex justify-end mt-6 pt-6 border-t ${palette.border.primary}`}
      >
        <button onClick={onSave} className={styleguide.button.primary}>
          Save Global Profile
        </button>
      </div>
    </div>
  );
};

const ResumeSection = ({
  resumes,
  selectedResume,
  setSelectedResumeId,
  setResumes,
  onSave,
  onDelete,
  onToggleFullPreview,
}) => {
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
            };
            setResumes([newResume]);
            setSelectedResumeId(newResume.id);
          }}
        >
          <PlusIcon /> Create New Resume
        </button>
      </div>
    );

  const handleSelectChange = (e) => setSelectedResumeId(Number(e.target.value));

  const updateResumeField = (field, value) => {
    setResumes((prev) =>
      prev.map((r) =>
        r.id === selectedResume.id ? { ...r, [field]: value } : r,
      ),
    );
  };

  const updateSkillCategory = (category, items) => {
    const currentSkills = selectedResume.hard_skills || {};
    updateResumeField("hard_skills", { ...currentSkills, [category]: items });
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
    updateResumeField("professional_experience", [
      ...(selectedResume.professional_experience || []),
      newExp,
    ]);
  };

  const updateExperience = (index, field, value) => {
    const exps = [...(selectedResume.professional_experience || [])];
    exps[index] = { ...exps[index], [field]: value };
    updateResumeField("professional_experience", exps);
  };

  const removeExperience = (index) => {
    const exps = [...(selectedResume.professional_experience || [])];
    exps.splice(index, 1);
    updateResumeField("professional_experience", exps);
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

  const removeProject = (index) => {
    const projs = [...(selectedResume.projects || [])];
    projs.splice(index, 1);
    updateResumeField("projects", projs);
  };

  return (
    <div
      className={`${palette.bg.card} p-6 rounded-lg shadow-lg mt-8 border border-gray-700`}
    >
      {}
      <div
        className={`flex flex-col md:flex-row justify-between md:items-center mb-8 border-b ${palette.border.primary} pb-5`}
      >
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Code className="text-white h-6 w-6" />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${palette.text.light}`}>
              Resumes
            </h2>
            <p className="text-xs text-gray-400">
              Manage your specific application versions
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select
            onChange={handleSelectChange}
            value={selectedResume?.id || ""}
            className={`${inputClasses} md:w-64`}
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedResume && (
        <div className="space-y-8 animate-in fade-in duration-500">
          {}
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className={styleguide.label}>Resume Internal Name</label>
              <input
                type="text"
                value={selectedResume.name}
                onChange={(e) => updateResumeField("name", e.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label className={styleguide.label}>Summary / Bio</label>
              <textarea
                value={selectedResume.summary || ""}
                onChange={(e) => updateResumeField("summary", e.target.value)}
                className={inputClasses}
                rows="4"
                placeholder="Brief professional summary..."
              />
            </div>
          </div>

          {}
          <div className="bg-gray-700/30 p-5 rounded-lg border border-gray-700">
            <h3
              className={`text-lg font-bold ${palette.text.light} mb-4 flex items-center gap-2`}
            >
              <BrainCircuit className="text-purple-400" size={20} /> Technical
              Skills
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { key: "languages", label: "Languages", icon: Code },
                { key: "frameworks", label: "Frameworks", icon: Layout },
                {
                  key: "cloud_and_infra",
                  label: "Cloud & Infra",
                  icon: Server,
                },
                { key: "databases", label: "Databases", icon: Database },
                { key: "concepts", label: "Concepts", icon: BrainCircuit },
              ].map((cat) => (
                <DynamicInputSection
                  key={cat.key}
                  title={cat.label}
                  items={selectedResume.hard_skills?.[cat.key] || []}
                  setItems={(items) => updateSkillCategory(cat.key, items)}
                  placeholder={`Add ${cat.label}...`}
                />
              ))}
            </div>
          </div>

          {}
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
              {(selectedResume.professional_experience || []).map(
                (exp, index) => (
                  <div
                    key={exp.id || index}
                    className={`${palette.bg.nestedCard} p-5 rounded-lg border ${palette.border.secondary} relative group`}
                  >
                    <button
                      onClick={() => removeExperience(index)}
                      className={styleguide.iconButton.delete}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
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
                              updateExperience(
                                index,
                                "end_date",
                                e.target.value,
                              )
                            }
                            className={inputClasses}
                            placeholder="YYYY-MM or Present"
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

                    {}
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

                    {}
                    <div className="mt-4">
                      <label className={styleguide.label}>
                        Tech Stack Used
                      </label>
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
                ),
              )}
            </div>
          </div>

          {}
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
                  key={proj.id || index}
                  className={`${palette.bg.nestedCard} p-4 rounded-lg border ${palette.border.secondary} relative`}
                >
                  <button
                    onClick={() => removeProject(index)}
                    className={styleguide.iconButton.delete}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
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

          {}
          <div
            className={`flex flex-col sm:flex-row justify-end items-center mt-8 pt-6 border-t ${palette.border.primary} gap-3`}
          >
            <button
              onClick={onToggleFullPreview}
              className={`${styleguide.button.markdown} w-full sm:w-auto`}
            >
              Preview Full Resume
            </button>
            <button
              onClick={() =>
                window.confirm(`Delete "${selectedResume.name}"?`) && onDelete()
              }
              className="border border-red-900/50 text-red-500 hover:bg-red-900/20 font-bold py-2 px-4 rounded-md transition w-full sm:w-auto"
            >
              Delete
            </button>
            <button
              onClick={onSave}
              className={`${styleguide.button.primary} w-full sm:w-auto`}
            >
              Save Resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const UserProfile = () => {
  const [profile, setProfile] = useState({});
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [fullResumeMarkdown, setFullResumeMarkdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const selectedResume = resumes.find((r) => r.id === selectedResumeId);

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
    if (!selectedResume || !selectedResume.name) {
      alert("Resume must have a name to be saved.");
      return;
    }

    try {
      let existingResume;
      if (selectedResume.id && String(selectedResume.id).length < 13) {
        existingResume = { id: selectedResume.id };
      }

      const payload = denormalizeResume(selectedResume);

      let savedResumeRaw;
      if (existingResume) {
        savedResumeRaw = await updateResume(existingResume.id, payload);
      } else {
        savedResumeRaw = await createResume(payload);
      }

      const savedResumeNormalized = normalizeResume(savedResumeRaw);

      setResumes((prevResumes) =>
        prevResumes.map((r) =>
          r.id === selectedResume.id ? savedResumeNormalized : r,
        ),
      );

      if (!existingResume) {
        setResumes((prev) => [
          ...prev.filter((r) => r.id !== selectedResume.id),
          savedResumeNormalized,
        ]);
        setSelectedResumeId(savedResumeNormalized.id);
      }

      alert(`Resume "${savedResumeNormalized.name}" saved successfully! ✅`);
    } catch (error) {
      console.error("Failed to save resume:", error);
      alert(`Error saving resume: ${error.message} ❌`);
    }
  };

  const handleDeleteResume = async () => {
    if (!selectedResume || !selectedResume.id) return;
    if (
      !window.confirm(
        `Are you sure you want to delete resume "${selectedResume.name}"?`,
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
    if (!showFullPreview) {
      setFullResumeMarkdown(
        "Preview generation for new template structure coming soon...",
      );
    }
    setShowFullPreview(!showFullPreview);
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
        <h1
          className={`text-3xl font-extrabold ${palette.text.light} mb-8 flex items-center gap-3`}
        >
          <Briefcase className="text-blue-500" /> Career Profile & Resumes
        </h1>

        <ProfileDetails
          profile={profile}
          setProfile={setProfile}
          onSave={handleSaveProfile}
        />

        <ResumeSection
          resumes={resumes}
          selectedResume={selectedResume}
          setSelectedResumeId={setSelectedResumeId}
          setResumes={setResumes}
          onSave={handleSaveResume}
          onDelete={handleDeleteResume}
          onToggleFullPreview={handleToggleFullPreview}
        />

        {showFullPreview && (
          <div className="mt-8 bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold">Markdown Preview</h3>
              <button
                onClick={() => setShowFullPreview(false)}
                className="text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <textarea
              readOnly
              value={fullResumeMarkdown}
              className={styleguide.previewTextarea}
              rows={20}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
