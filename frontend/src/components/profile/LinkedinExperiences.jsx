import React, { useState, useEffect } from "react";
import {
  Building,
  Calendar,
  MapPin,
  Clock,
  Briefcase,
  Wrench,
  Linkedin,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { fetchProfileExperiences } from "../../services/jobService";

// --- Shared Style Definitions (Matching UserProfile) ---
const palette = {
  bg: {
    card: "bg-gray-800",
    nestedCard: "bg-gray-700/50",
    chip: "bg-gray-700",
  },
  text: {
    primary: "text-gray-200",
    secondary: "text-gray-400",
    light: "text-white",
    accent: "text-emerald-400",
    link: "text-blue-400",
  },
  border: {
    primary: "border-gray-700",
    secondary: "border-gray-600",
  },
  action: {
    primary: "bg-blue-600",
    primaryHover: "hover:bg-blue-500",
  },
};

const styleguide = {
  card: `${palette.bg.card} p-6 rounded-lg shadow-lg border ${palette.border.primary}`,
  nestedCard: `${palette.bg.nestedCard} p-5 rounded-lg border ${palette.border.secondary} transition hover:border-gray-500`,
  label: `block text-xs font-bold uppercase tracking-wider ${palette.text.secondary} mb-1`,
  skillChip: `inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${palette.bg.chip} ${palette.text.accent} border border-gray-600`,
  headerIcon: `p-2 bg-blue-600 rounded-lg text-white mr-3`,
};

const ExperienceCard = ({ exp }) => {
  return (
    <div className={styleguide.nestedCard}>
      {/* Header: Title & Company */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-4 gap-2">
        <div>
          <h3 className={`text-xl font-bold ${palette.text.light}`}>
            {exp.title}
          </h3>
          <div className={`flex items-center gap-2 ${palette.text.link} font-medium text-lg`}>
            <Building size={16} />
            <span>{exp.company_name}</span>
            {exp.employment_type && (
              <span className={`text-sm ${palette.text.secondary} font-normal`}>
                • {exp.employment_type}
              </span>
            )}
          </div>
        </div>

        {/* Meta Info: Dates, Location, Duration */}
        <div className={`flex flex-col items-start md:items-end text-sm ${palette.text.secondary} gap-1`}>
          <div className="flex items-center gap-1.5">
            <Calendar size={14} />
            <span>
              {exp.start_date} - {exp.end_date}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs">
            <Clock size={14} />
            <span>{exp.duration}</span>
          </div>
          {exp.location && (
            <div className="flex items-center gap-1.5">
              <MapPin size={14} />
              <span>
                {exp.location} {exp.work_type ? `(${exp.work_type})` : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {exp.description && (
        <div className={`mb-5 text-sm leading-relaxed whitespace-pre-wrap ${palette.text.primary} border-l-2 border-gray-600 pl-4 py-1`}>
          {exp.description}
        </div>
      )}

      {/* Skills */}
      {exp.skills && exp.skills.length > 0 && (
        <div className="mt-4">
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${palette.text.secondary} mb-2`}>
            <Wrench size={12} /> Skills Used
          </div>
          <div className="flex flex-wrap gap-2">
            {exp.skills.map((skill, idx) => (
              <span key={idx} className={styleguide.skillChip}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LinkedinExperiences = () => {
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadExperiences = async () => {
      try {
        setLoading(true);
        // Uses the default URN set in jobService.js
        const data = await fetchProfileExperiences();

        if (data && data.experiences) {
          setExperiences(data.experiences);
        } else {
          setExperiences([]);
        }
      } catch (err) {
        console.error("Failed to load LinkedIn experiences:", err);
        setError("Failed to load experiences data.");
      } finally {
        setLoading(false);
      }
    };

    loadExperiences();
  }, []);

  if (loading) {
    return (
      <div className={`${palette.bg.card} p-12 rounded-lg border ${palette.border.primary} flex flex-col items-center justify-center text-gray-400`}>
        <Loader2 className="animate-spin mb-3 text-blue-500" size={32} />
        <p>Syncing Profile Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${palette.bg.card} p-8 rounded-lg border border-red-900/50 flex items-center gap-3 text-red-400`}>
        <AlertCircle size={24} />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={styleguide.card}>
      <div className="flex items-center justify-between mb-8 border-b border-gray-700 pb-5">
        <div className="flex items-center">
          <div className={styleguide.headerIcon}>
            <Linkedin size={24} />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${palette.text.light}`}>
              LinkedIn Experiences
            </h2>
            <p className={`text-xs ${palette.text.secondary}`}>
              Synced from live profile data
            </p>
          </div>
        </div>
        <div className={`bg-blue-900/30 px-3 py-1 rounded border border-blue-800 text-blue-200 text-xs font-mono`}>
          Count: {experiences.length}
        </div>
      </div>

      <div className="space-y-6">
        {experiences.length === 0 ? (
          <div className="text-center text-gray-500 py-8 italic">
            No experiences found in the profile data.
          </div>
        ) : (
          experiences.map((exp, index) => (
            <ExperienceCard key={index} exp={exp} />
          ))
        )}
      </div>
    </div>
  );
};

export default LinkedinExperiences;