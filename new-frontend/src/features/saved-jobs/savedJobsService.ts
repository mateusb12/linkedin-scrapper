import {fetchProfile, fetchResumes} from "../profile/profileService.ts"
import type {ResumeDraft} from "../profile/profileService.ts"
import {
    normalizeSearchJob,
    placeholderLogo,
    type RawJobPayload,
    type SearchJob,
} from "../search-jobs/searchJobsService.ts"

export type SavedJobsTab = "saved" | "applied" | "in_progress" | "archived"

export type SavedJob = SearchJob & {
    tab: SavedJobsTab
    statusLabel: string
    insight: string
    savedAt: string
}

export type SavedJobScoreMap = Record<string, number>

export type ResumeForSavedJobs = {
    id: number
    name: string
    language: "en" | "pt"
    headline: string
    content: {
        summary: string
        skills: string[]
        experience: Array<{
            role: string
            company: string
            period: string
            highlights: string[]
        }>
        education: string[]
    }
}

type SavedJobsBackendResponse = {
    status?: string
    data?: {
        count?: number
        jobs?: RawJobPayload[]
    }
    count?: number
    jobs?: RawJobPayload[]
    error?: string
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "")
const SAVED_JOBS_SCORE_KEY = "linkedin_job_scores"
const SAVED_JOBS_CACHE_PREFIX = "new-frontend.saved-jobs.tab"

function getCacheKey(tab: SavedJobsTab) {
    return `${SAVED_JOBS_CACHE_PREFIX}.${tab}.v2`
}

function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = window.localStorage.getItem(key)
        return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
        return fallback
    }
}

function writeJson(key: string, value: unknown) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
        console.warn("Failed to write saved jobs local cache.", error)
    }
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
    const body = await response.json().catch(() => null) as T & {error?: string} | null

    if (!response.ok) {
        throw new Error(body?.error || fallbackMessage)
    }

    if (!body) throw new Error(fallbackMessage)
    return body
}

function extractNumericJobId(value: unknown) {
    if (value == null) return null
    const match = String(value).match(/(\d{6,})/)
    return match?.[1] ?? null
}

function coerceSavedJobPayload(raw: RawJobPayload): RawJobPayload {
    const jobId =
        raw.job_id ??
        raw.id ??
        extractNumericJobId(raw.urn) ??
        extractNumericJobId(raw.entity_urn) ??
        extractNumericJobId(raw.job_url)
    const companyName =
        raw.company_name ??
        (typeof raw.company === "string" ? raw.company : undefined) ??
        "Unknown company"
    const description = raw.description_full ?? raw.description ?? raw.premium_description ?? ""
    const applicants = raw.applicants_total ?? raw.applicants

    return {
        ...raw,
        job_id: jobId,
        company_name: companyName,
        company_logo_url: raw.company_logo_url ?? raw.company_logo ?? placeholderLogo(String(companyName)),
        company_page_url: raw.company_page_url ?? raw.company_url,
        location_text: raw.location_text ?? raw.location,
        description_full: description,
        applicants_total: applicants,
        job_url: raw.job_url ?? (jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : undefined),
        posted_at: raw.posted_at ?? raw.posted_date_text ?? raw.created_at,
        work_remote_allowed: raw.work_remote_allowed ?? false,
    }
}

function withSavedMetadata(job: SearchJob, tab: SavedJobsTab): SavedJob {
    const savedAt = job.created_at || job.posted_at || new Date().toISOString()
    const applicants =
        job.applicantsTotal == null ? "Applicant count unavailable" : `${job.applicantsTotal} applicants`

    return {
        ...job,
        tab,
        statusLabel: tab === "saved" ? "Saved on LinkedIn" : "LinkedIn item",
        insight: `${applicants}. Review score, stack match, and description before applying.`,
        savedAt,
    }
}

function getJobsFromResponse(payload: SavedJobsBackendResponse): RawJobPayload[] {
    if (Array.isArray(payload.data?.jobs)) return payload.data.jobs
    if (Array.isArray(payload.jobs)) return payload.jobs
    return []
}

async function fetchSavedJobsFromLinkedIn(tab: SavedJobsTab): Promise<SavedJob[]> {
    const endpoint =
        tab === "saved"
            ? `${API_BASE_URL}/job-tracker/saved-live`
            : `${API_BASE_URL}/services/linkedin-applied-jobs/raw?card_type=${tab}&start=0`

    const payload = await parseJsonResponse<SavedJobsBackendResponse>(
        await fetch(endpoint, {headers: {Accept: "application/json"}}),
        "Failed to fetch LinkedIn saved jobs.",
    )

    if (payload.status && payload.status !== "success") {
        throw new Error(payload.error || "LinkedIn saved jobs request failed.")
    }

    return getJobsFromResponse(payload)
        .map(coerceSavedJobPayload)
        .map((job) => normalizeSearchJob(job))
        .filter((job): job is SearchJob => job !== null)
        .map((job) => withSavedMetadata(job, tab))
}

export async function fetchSavedJobs(tab: SavedJobsTab): Promise<SavedJob[]> {
    const cachedJobs = readJson<SavedJob[] | null>(getCacheKey(tab), null)
    if (cachedJobs) return cachedJobs

    const jobs = await fetchSavedJobsFromLinkedIn(tab)
    writeJson(getCacheKey(tab), jobs)
    return jobs
}

export async function refreshSavedJobs(tab: SavedJobsTab): Promise<SavedJob[]> {
    const jobs = await fetchSavedJobsFromLinkedIn(tab)
    writeJson(getCacheKey(tab), jobs)
    return jobs
}

export function clearSavedJobsCache(tab: SavedJobsTab) {
    try {
        window.localStorage.removeItem(getCacheKey(tab))
    } catch (error) {
        console.warn("Failed to clear saved jobs local cache.", error)
    }
}

export function readSavedJobScores(): SavedJobScoreMap {
    return readJson<SavedJobScoreMap>(SAVED_JOBS_SCORE_KEY, {})
}

export function saveSavedJobScore(jobId: string, score: number): SavedJobScoreMap {
    const scores = readSavedJobScores()
    const nextScores = {
        ...scores,
        [jobId]: Math.max(0, Math.min(100, Math.round(score))),
    }

    writeJson(SAVED_JOBS_SCORE_KEY, nextScores)
    return nextScores
}

function flattenSkills(resume: ResumeDraft) {
    return [
        ...resume.skills.languages,
        ...resume.skills.frameworks,
        ...resume.skills.cloud_and_infra,
        ...resume.skills.databases,
        ...resume.skills.concepts,
    ]
}

function toSavedJobsResume(resume: ResumeDraft): ResumeForSavedJobs {
    return {
        id: resume.id,
        name: resume.internalName,
        language: resume.language === "EN" ? "en" : "pt",
        headline: resume.summary.split(/[.!?]\s/)[0] || resume.internalName,
        content: {
            summary: resume.summary,
            skills: flattenSkills(resume),
            experience: resume.experiences.map((experience) => ({
                role: experience.role,
                company: experience.company,
                period: [experience.startDate, experience.endDate].filter(Boolean).join(" - "),
                highlights: experience.highlights,
            })),
            education: resume.education.map((education) =>
                [education.degree, education.institution, education.year].filter(Boolean).join(" - "),
            ),
        },
    }
}

export async function fetchSavedJobsResumes(): Promise<ResumeForSavedJobs[]> {
    const profile = await fetchProfile().catch(() => undefined)
    const resumes = await fetchResumes(profile)
    return resumes.map(toSavedJobsResume)
}
