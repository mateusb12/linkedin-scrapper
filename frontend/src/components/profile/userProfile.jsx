import React, { useState, useEffect } from "react";
import { Briefcase } from "lucide-react";

import { fetchProfiles, saveProfile } from "../../services/profileService.js";
import { fetchAllResumes } from "../match-find/MatchLogic.jsx";
import {
  createResume,
  deleteResume,
  updateResume,
} from "../../services/resumeService.js";

import { denormalizeResume, normalizeResume } from "./resumeJsonMapper.js";
import { extractTechStack } from "../resume/constants.js";

import LinkedinExperiences from "./LinkedinExperiences";
import ProfileEditor from "./ProfileEditor";
import ResumeEditor from "./ResumeEditor";
import ResumeContextBuilder, { ResumeSelector } from "./ResumeContextBuilder";

const palette = {
  bg: {
    page: "bg-gray-900",
  },
  text: {
    primary: "text-gray-200",
    light: "text-white",
  },
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

        <ResumeContextBuilder
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
