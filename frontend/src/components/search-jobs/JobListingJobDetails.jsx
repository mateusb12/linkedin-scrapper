import React from "react";
import {
  MapPin,
  Building2,
  ShieldCheck,
  ExternalLink,
  Briefcase,
  Clock3,
  Users,
  Sparkles,
  Code2,
  ChevronRight,
  XCircle,
} from "lucide-react";

import {
  getCompetitionStyle,
  getExperienceStyle,
  getSeniorityStyle,
  getTypeStyle,
} from "../tracking/utils/jobUtils.js";
import {
  getPostedBadgeClasses,
  getPostedBadgeText,
  InsightBadge,
  placeholderLogo,
  ScoreBadge,
  Badge,
  formatApplicantsLabel,
  formatDateValue,
  TechBadge,
  buildJobInsights,
} from "./joblistUtils.jsx";

const InfoCard = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/70 px-4 py-3">
    <Icon size={18} className="shrink-0 text-slate-400" />
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="truncate text-sm text-slate-200">
        {value || "Not specified"}
      </p>
    </div>
  </div>
);

const Placeholder = ({ text = "None specified." }) => (
  <div className="flex items-center text-sm italic text-slate-400">
    <XCircle size={16} className="mr-2 shrink-0" />
    <span>{text}</span>
  </div>
);

const JobListingJobDetails = ({ job }) => {
  if (!job) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Select a job to see the details
      </div>
    );
  }

  const insights = buildJobInsights(job);
  const description =
    insights.cleanedDescription ||
    job.description_full ||
    job.description_snippet ||
    null;

  return (
    <div className="h-full overflow-y-auto px-6 py-7 md:px-8">
      <div className="mb-8 flex items-start gap-5">
        <img
          src={job.company.logo_url}
          alt={`${job.company.name} logo`}
          className="h-16 w-16 rounded-xl border border-slate-700 bg-slate-900 object-contain"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = placeholderLogo(job.company.name);
          }}
        />

        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-bold leading-tight text-white">
            {job.title}
            {job.isNegativeMatch && (
              <span className="ml-3 inline-flex items-center gap-1 align-middle rounded-md border border-red-900 bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
                <XCircle size={12} /> Negative Match
              </span>
            )}
          </h2>

          <p className="mt-1 text-xl text-slate-300">{job.company.name}</p>
          <p className="mt-1 text-sm text-slate-400">{job.location}</p>
          <p className="mt-1 text-xs text-slate-500">Job ID: {job.job_id}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <ScoreBadge
              score={job.positiveScore}
              matchedKeywords={job.matchedPositiveKeywords}
            />

            {job.pythonScore != null && (
              <InsightBadge
                icon={Code2}
                className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                title="Calibrated Python match score from AI scorer"
              >
                Python Score: {Math.round(job.pythonScore)}
              </InsightBadge>
            )}

            {job.verified && <Badge tone="green">Verified</Badge>}
            {job.reposted && <Badge tone="amber">Reposted</Badge>}

            {job.workplace_type && job.workplace_type !== "Not specified" && (
              <Badge tone="blue">{job.workplace_type}</Badge>
            )}

            <InsightBadge
              icon={Clock3}
              className={getPostedBadgeClasses(job.posted_at)}
            >
              {getPostedBadgeText(job.posted_at)}
            </InsightBadge>

            {job.applicants_total != null && (
              <InsightBadge
                icon={Users}
                className={getCompetitionStyle(job.applicants_total)}
              >
                {formatApplicantsLabel(job.applicants_total)}
              </InsightBadge>
            )}

            {insights.seniority && (
              <InsightBadge
                icon={Briefcase}
                className={getSeniorityStyle(insights.seniority)}
              >
                {insights.seniority}
              </InsightBadge>
            )}

            {insights.jobType && (
              <InsightBadge
                icon={Code2}
                className={getTypeStyle(insights.jobType)}
              >
                {insights.jobType}
              </InsightBadge>
            )}

            {insights.experience?.text && (
              <InsightBadge
                icon={Clock3}
                className={getExperienceStyle(insights.experience)}
              >
                {insights.experience.text} exp
              </InsightBadge>
            )}
          </div>

          {job.matchedPositiveKeywords?.length > 0 && (
            <p className="mt-3 text-sm text-slate-400">
              Positive matches:{" "}
              <span className="text-slate-200">
                {job.matchedPositiveKeywords.join(", ")}
              </span>
            </p>
          )}

          {job.missingMustHaveKeywords?.length > 0 && (
            <p className="mt-1 text-sm text-red-400">
              Missing required keywords:{" "}
              <span className="font-semibold">
                {job.missingMustHaveKeywords.join(", ")}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <a
          href={job.job_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
        >
          <ExternalLink size={16} />
          Open Job
        </a>

        {job.company.page_url && (
          <a
            href={job.company.page_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 font-semibold text-slate-100 transition hover:bg-slate-700"
          >
            <Building2 size={16} />
            Company Page
          </a>
        )}

        {job.company.url && job.company.url !== job.company.page_url && (
          <a
            href={job.company.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 font-semibold text-slate-100 transition hover:bg-slate-700"
          >
            <Building2 size={16} />
            Company Website
          </a>
        )}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoCard icon={MapPin} label="Location" value={job.location} />
        <InfoCard
          icon={Briefcase}
          label="Workplace Type"
          value={job.workplace_type}
        />
        <InfoCard
          icon={Clock3}
          label="Posted At"
          value={formatDateValue(job.posted_at)}
        />
        <InfoCard
          icon={Users}
          label="Applicants"
          value={formatApplicantsLabel(job.applicants_total)}
        />
        <InfoCard
          icon={ShieldCheck}
          label="Verification"
          value={job.verified ? "Verified" : "Not verified"}
        />
        <InfoCard
          icon={Sparkles}
          label="Keyword Score"
          value={String(job.positiveScore || 0)}
        />
        <InfoCard
          icon={Code2}
          label="Python Score"
          value={
            job.pythonScore != null ? String(Math.round(job.pythonScore)) : "Not scored"
          }
        />
      </div>

      <div className="space-y-8">
        <section>
          <h3 className="mb-4 flex items-center border-b border-slate-800 pb-2 text-xl font-semibold text-slate-100">
            <Code2 size={18} className="mr-2" />
            Extracted Signals
          </h3>

          <div className="flex flex-wrap gap-2">
            <ScoreBadge
              score={job.positiveScore}
              matchedKeywords={job.matchedPositiveKeywords}
            />

            {job.pythonScore != null && (
              <InsightBadge
                icon={Code2}
                className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                title="Calibrated Python match score from AI scorer"
              >
                Python Score: {Math.round(job.pythonScore)}
              </InsightBadge>
            )}

            {insights.seniority && (
              <InsightBadge
                icon={Briefcase}
                className={getSeniorityStyle(insights.seniority)}
              >
                Seniority: {insights.seniority}
              </InsightBadge>
            )}

            {insights.jobType && (
              <InsightBadge
                icon={Code2}
                className={getTypeStyle(insights.jobType)}
              >
                Type: {insights.jobType}
              </InsightBadge>
            )}

            {insights.experience?.text && (
              <InsightBadge
                icon={Clock3}
                className={getExperienceStyle(insights.experience)}
              >
                Experience: {insights.experience.text} exp
              </InsightBadge>
            )}

            {job.applicants_total != null && (
              <InsightBadge
                icon={Users}
                className={getCompetitionStyle(job.applicants_total)}
              >
                Competition: {formatApplicantsLabel(job.applicants_total)}
              </InsightBadge>
            )}

            <InsightBadge
              icon={Clock3}
              className={getPostedBadgeClasses(job.posted_at)}
            >
              {getPostedBadgeText(job.posted_at)}
            </InsightBadge>
          </div>
        </section>

        <section>
          <h3 className="mb-4 flex items-center border-b border-slate-800 pb-2 text-xl font-semibold text-slate-100">
            <Code2 size={18} className="mr-2" />
            Detected Stack
          </h3>

          {insights.techStack.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {insights.techStack.map((tech, index) => (
                <TechBadge
                  key={`${job.id}-detail-${tech}`}
                  tech={tech}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <Placeholder text="No useful stack hints were extracted from this listing." />
          )}
        </section>

        <section>
          <h3 className="mb-4 flex items-center border-b border-slate-800 pb-2 text-xl font-semibold text-slate-100">
            <ChevronRight size={18} className="mr-2" />
            About This Listing
          </h3>

          {description ? (
            <div className="whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-800/60 p-4 text-sm leading-7 text-slate-300">
              {description}
            </div>
          ) : (
            <Placeholder text="No description is available for this listing." />
          )}
        </section>
      </div>
    </div>
  );
};

export default JobListingJobDetails;
