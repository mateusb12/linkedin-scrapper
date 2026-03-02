import React from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Globe,
} from "lucide-react";

const palette = {
  bg: { card: "bg-gray-800", input: "bg-gray-700" },
  text: {
    light: "text-white",
    primary: "text-gray-200",
    secondary: "text-gray-400",
  },
  border: {
    primary: "border-gray-700",
    secondary: "border-gray-800",
    focus: "focus:border-emerald-500",
  },
  action: {
    focusRing: "focus:ring-emerald-500",
    primary: "bg-blue-600",
    primaryHover: "hover:bg-blue-500",
    success: "bg-emerald-600",
    successHover: "hover:bg-emerald-500",
  },
};

const styleguide = {
  input: `w-full ${palette.bg.input} border ${palette.border.secondary} ${palette.text.primary} rounded-md shadow-sm py-2 px-3 focus:ring-2 ${palette.action.focusRing} ${palette.border.focus} outline-none transition text-sm`,
  button: {
    primary: `${palette.action.primary} ${palette.action.primaryHover} ${palette.text.light} font-bold py-2 px-6 rounded-md transition shadow-md`,
    success: `mt-2 text-xs uppercase tracking-wider font-semibold ${palette.action.success} ${palette.action.successHover} ${palette.text.light} py-1.5 px-3 rounded-md transition flex items-center gap-1`,
  },
  label: `block text-xs font-bold uppercase tracking-wider ${palette.text.secondary} mb-1`,
};

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
            className={styleguide.input}
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

const ProfileEditor = ({ profile, setProfile, onSave }) => {
  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };
  const handleArrayChange = (fieldName, newArray) => {
    setProfile({ ...profile, [fieldName]: newArray });
  };

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
        {[
          { label: "Name", name: "name", icon: User },
          { label: "Email", name: "email", icon: Mail, type: "email" },
          { label: "Phone", name: "phone", icon: Phone, type: "tel" },
          { label: "Location", name: "location", icon: MapPin },
        ].map((field) => (
          <div key={field.name}>
            <div className="flex items-center gap-1.5 pb-1.5 text-gray-400 text-sm font-medium">
              <field.icon className={`h-4 w-4`} />
              {field.label}
            </div>
            <input
              type={field.type || "text"}
              name={field.name}
              value={profile[field.name] || ""}
              onChange={handleChange}
              className={styleguide.input}
            />
          </div>
        ))}

        {[
          { label: "LinkedIn URL", name: "linkedin", icon: Linkedin },
          { label: "GitHub URL", name: "github", icon: Github },
          { label: "Portfolio URL", name: "portfolio", icon: Globe },
        ].map((field) => (
          <div key={field.name} className="md:col-span-2">
            <div className="flex items-center gap-1.5 pb-1.5 text-gray-400 text-sm font-medium">
              <field.icon className={`h-4 w-4`} />
              {field.label}
            </div>
            <input
              type="text"
              name={field.name}
              value={profile[field.name] || ""}
              onChange={handleChange}
              className={styleguide.input}
            />
          </div>
        ))}

        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <DynamicInputSection
            title="Languages (Global List)"
            items={profile.languages || []}
            setItems={(newItems) => handleArrayChange("languages", newItems)}
            placeholder="e.g. English"
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

export default ProfileEditor;
