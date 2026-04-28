export type ResumeLanguage = "PTBR" | "EN"

export type ResumeSkillMap = {
    languages: string[]
    frameworks: string[]
    cloud_and_infra: string[]
    databases: string[]
    concepts: string[]
}

export type ResumeExperience = {
    id: string
    company: string
    role: string
    location: string
    startDate: string
    endDate: string
    highlights: string[]
    stack: string[]
}

export type ResumeProject = {
    id: string
    name: string
    description: string
    stack: string[]
    links: {
        github: string
        website: string
    }
}

export type ResumeEducation = {
    id: string
    institution: string
    degree: string
    location: string
    startYear: string
    endYear: string
    year: string
}

export type ResumeLanguageItem = {
    id: string
    name: string
    level: string
}

export type CareerProfile = {
    id: number
    name: string
    email: string
    phone: string
    location: string
    linkedin: string
    github: string
    portfolio: string
    languages: string[]
    positiveKeywords: string[]
    negativeKeywords: string[]
    education: ResumeEducation[]
}

export type ResumeDraft = {
    id: number
    profileId: number | null
    internalName: string
    language: ResumeLanguage
    summary: string
    contacts: {
        email: string
        github: string
        phone: string
        linkedin: string
        portfolio: string
    }
    skills: ResumeSkillMap
    experiences: ResumeExperience[]
    projects: ResumeProject[]
    education: ResumeEducation[]
    languages: ResumeLanguageItem[]
    meta: {
        language: string
        page: {
            fontSize: number
            size: string
        }
    }
}

type ApiProfile = {
    id?: number
    name?: string
    email?: string
    phone?: string
    location?: string
    linkedin?: string
    github?: string
    portfolio?: string
    languages?: unknown
    positive_keywords?: unknown
    negative_keywords?: unknown
    education?: unknown
}

type ApiResume = {
    id?: number
    internal_name?: string
    name?: string
    resume_language?: string
    summary?: string
    profile_id?: number | null
    contacts?: Partial<ResumeDraft["contacts"]>
    contact_info?: Partial<ResumeDraft["contacts"]>
    profile?: {
        name?: string
        contacts?: Partial<ResumeDraft["contacts"]>
    }
    languages?: unknown
    skills?: Partial<ResumeSkillMap>
    hard_skills?: Partial<ResumeSkillMap>
    experience?: unknown
    professional_experience?: unknown
    projects?: unknown
    education?: unknown
    meta?: {
        language?: string
        page?: {
            font_size?: number
            fontSize?: number
            size?: string
        }
    }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000"

const emptyContacts: ResumeDraft["contacts"] = {
    email: "",
    github: "",
    phone: "",
    linkedin: "",
    portfolio: "",
}

const emptySkills: ResumeSkillMap = {
    languages: [],
    frameworks: [],
    cloud_and_infra: [],
    databases: [],
    concepts: [],
}

const makeId = (prefix: string, index: number) => `${prefix}-${index}-${Date.now()}`

async function handleResponse<T>(response: Response, message: string): Promise<T> {
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? message)
    }

    return response.json() as Promise<T>
}

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []

    return value
        .map(item => String(item ?? "").trim())
        .filter(Boolean)
}

function normalizeLanguage(value: string | undefined): ResumeLanguage {
    const lower = (value ?? "").toLowerCase()
    return lower.includes("en") ? "EN" : "PTBR"
}

function normalizeEducation(value: unknown): ResumeEducation[] {
    if (!Array.isArray(value)) return []

    return value.map((item, index) => {
        const education = item as Partial<{
            id: string
            institution: string
            school: string
            degree: string
            location: string
            start_year: string
            startYear: string
            end_year: string
            endYear: string
            year: string
        }>

        return {
            id: education.id ?? makeId("edu", index),
            institution: education.institution ?? education.school ?? "",
            degree: education.degree ?? "",
            location: education.location ?? "",
            startYear: education.startYear ?? education.start_year ?? "",
            endYear: education.endYear ?? education.end_year ?? "",
            year: education.year ?? "",
        }
    })
}

function normalizeSkills(value: ApiResume["skills"] | ApiResume["hard_skills"]): ResumeSkillMap {
    return {
        languages: toStringArray(value?.languages),
        frameworks: toStringArray(value?.frameworks),
        cloud_and_infra: toStringArray(value?.cloud_and_infra),
        databases: toStringArray(value?.databases),
        concepts: toStringArray(value?.concepts),
    }
}

function normalizeContacts(value: ApiResume): ResumeDraft["contacts"] {
    const contacts = value.contacts ?? value.contact_info ?? value.profile?.contacts ?? {}

    return {
        email: contacts.email ?? "",
        github: contacts.github ?? "",
        phone: contacts.phone ?? "",
        linkedin: contacts.linkedin ?? "",
        portfolio: contacts.portfolio ?? "",
    }
}

function normalizeExperiences(value: unknown): ResumeExperience[] {
    if (!Array.isArray(value)) return []

    return value.map((item, index) => {
        const experience = item as Partial<{
            id: string
            company: string
            role: string
            title: string
            location: string
            start_date: string
            startDate: string
            end_date: string
            endDate: string
            highlights: unknown
            description: unknown
            stack: unknown
        }>

        return {
            id: experience.id ?? makeId("exp", index),
            company: experience.company ?? "",
            role: experience.role ?? experience.title ?? "",
            location: experience.location ?? "",
            startDate: experience.startDate ?? experience.start_date ?? "",
            endDate: experience.endDate ?? experience.end_date ?? "",
            highlights: Array.isArray(experience.highlights)
                ? toStringArray(experience.highlights)
                : toStringArray(String(experience.description ?? "").split(/\r?\n/)),
            stack: toStringArray(experience.stack),
        }
    })
}

function normalizeProjects(value: unknown): ResumeProject[] {
    if (!Array.isArray(value)) return []

    return value.map((item, index) => {
        const project = item as Partial<{
            id: string
            name: string
            title: string
            description: string
            stack: unknown
            links: Partial<ResumeProject["links"]>
        }>

        return {
            id: project.id ?? makeId("project", index),
            name: project.name ?? project.title ?? "",
            description: project.description ?? "",
            stack: toStringArray(project.stack),
            links: {
                github: project.links?.github ?? "",
                website: project.links?.website ?? "",
            },
        }
    })
}

function normalizeLanguages(value: unknown): ResumeLanguageItem[] {
    if (!Array.isArray(value)) return []

    return value.map((item, index) => {
        if (typeof item === "string") {
            return {id: makeId("lang", index), name: item, level: ""}
        }

        const language = item as Partial<{ id: string; name: string; level: string }>

        return {
            id: language.id ?? makeId("lang", index),
            name: language.name ?? "",
            level: language.level ?? "",
        }
    })
}

function toProfile(profile: ApiProfile): CareerProfile {
    return {
        id: profile.id ?? 0,
        name: profile.name ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        location: profile.location ?? "",
        linkedin: profile.linkedin ?? "",
        github: profile.github ?? "",
        portfolio: profile.portfolio ?? "",
        languages: toStringArray(profile.languages),
        positiveKeywords: toStringArray(profile.positive_keywords),
        negativeKeywords: toStringArray(profile.negative_keywords),
        education: normalizeEducation(profile.education),
    }
}

function toResume(resume: ApiResume, profile?: CareerProfile): ResumeDraft {
    const language = normalizeLanguage(resume.resume_language ?? resume.meta?.language)
    const page = resume.meta?.page ?? {}

    return {
        id: resume.id ?? 0,
        profileId: resume.profile_id ?? profile?.id ?? null,
        internalName: resume.internal_name ?? resume.name ?? "Untitled Resume",
        language,
        summary: resume.summary ?? "",
        contacts: {
            ...emptyContacts,
            ...normalizeContacts(resume),
        },
        skills: {
            ...emptySkills,
            ...normalizeSkills(resume.skills ?? resume.hard_skills),
        },
        experiences: normalizeExperiences(resume.experience ?? resume.professional_experience),
        projects: normalizeProjects(resume.projects),
        education: normalizeEducation(resume.education),
        languages: normalizeLanguages(resume.languages),
        meta: {
            language: resume.meta?.language ?? (language === "EN" ? "en-US" : "pt-BR"),
            page: {
                fontSize: page.fontSize ?? page.font_size ?? 11,
                size: page.size ?? "letter",
            },
        },
    }
}

function toApiProfile(profile: CareerProfile) {
    return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        linkedin: profile.linkedin,
        github: profile.github,
        portfolio: profile.portfolio,
        languages: profile.languages,
        positive_keywords: profile.positiveKeywords,
        negative_keywords: profile.negativeKeywords,
        education: profile.education.map(item => ({
            institution: item.institution,
            degree: item.degree,
            location: item.location,
            start_year: item.startYear,
            end_year: item.endYear,
            year: item.year,
        })),
    }
}

function toApiResume(resume: ResumeDraft, profile?: CareerProfile) {
    return {
        id: resume.id,
        resume_language: resume.language === "EN" ? "EN" : "PT",
        internal_name: resume.internalName,
        summary: resume.summary,
        profile_id: resume.profileId ?? profile?.id ?? null,
        profile: {
            name: profile?.name ?? resume.internalName,
            contacts: resume.contacts,
        },
        contacts: resume.contacts,
        languages: resume.languages.map(item => ({
            name: item.name,
            level: item.level,
        })),
        skills: resume.skills,
        experience: resume.experiences.map(item => ({
            company: item.company,
            role: item.role,
            location: item.location,
            start_date: item.startDate,
            end_date: item.endDate,
            highlights: item.highlights.filter(Boolean),
            stack: item.stack.filter(Boolean),
        })),
        projects: resume.projects.map(item => ({
            name: item.name,
            description: item.description,
            stack: item.stack.filter(Boolean),
            links: item.links,
        })),
        education: resume.education.map(item => ({
            institution: item.institution,
            degree: item.degree,
            location: item.location,
            start_year: item.startYear,
            end_year: item.endYear,
            year: item.year,
        })),
        meta: {
            language: resume.language === "EN" ? "en-US" : "pt-BR",
            page: {
                font_size: resume.meta.page.fontSize,
                size: resume.meta.page.size,
            },
        },
    }
}

export async function fetchProfile() {
    const profiles = await handleResponse<ApiProfile[]>(
        await fetch(`${API_BASE}/profiles/`),
        "Failed to fetch profiles",
    )

    return toProfile(profiles[0] ?? {})
}

export async function saveProfile(profile: CareerProfile) {
    const payload = toApiProfile(profile)
    const hasPersistedId = profile.id > 0
    const response = await fetch(`${API_BASE}/profiles/${hasPersistedId ? profile.id : ""}`, {
        method: hasPersistedId ? "PUT" : "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
    })

    if (response.ok && hasPersistedId) return profile
    if (response.ok) {
        const created = await response.json() as { id?: number }
        return {...profile, id: created.id ?? profile.id}
    }

    throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? "Failed to save profile")
}

export async function fetchResumes(profile?: CareerProfile) {
    const resumes = await handleResponse<ApiResume[]>(
        await fetch(`${API_BASE}/resumes/`),
        "Failed to fetch resumes",
    )

    return resumes.map(resume => toResume(resume, profile))
}

export async function saveResume(resume: ResumeDraft, profile?: CareerProfile) {
    const isPersisted = resume.id > 0
    const savedResume = await handleResponse<ApiResume>(
        await fetch(`${API_BASE}/resumes/${isPersisted ? resume.id : ""}`, {
            method: isPersisted ? "PUT" : "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(toApiResume(resume, profile)),
        }),
        "Failed to save resume",
    )

    return toResume(savedResume, profile)
}

export async function deleteResume(resumeId: number) {
    await handleResponse<{ message: string }>(
        await fetch(`${API_BASE}/resumes/${resumeId}`, {method: "DELETE"}),
        "Failed to delete resume",
    )

    return fetchResumes()
}

export async function duplicateResume(resume: ResumeDraft, profile?: CareerProfile) {
    const copy: ResumeDraft = {
        ...resume,
        id: 0,
        internalName: `${resume.internalName} Copy`,
    }

    return saveResume(copy, profile)
}

export async function reloadProfileData() {
    const profile = await fetchProfile()
    const resumes = await fetchResumes(profile)

    return {profile, resumes}
}
