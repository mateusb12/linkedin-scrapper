export type WorkplaceType = "Remote" | "Hybrid" | "On-site" | "Not specified"

export type RawJobPayload = Record<string, unknown>

export type JobCompany = {
    name: string
    logoUrl: string
    pageUrl: string
    websiteUrl?: string
    urn?: string | null
}

export type ScoreSignal = {
    label: string
    points: number
    source: string
}

export type SearchJob = {
    id: string
    jobId: string
    job_id?: string
    title: string
    company: JobCompany
    company_name?: string
    location: string
    location_text?: string
    workplaceType: WorkplaceType
    workplace_type?: WorkplaceType
    postedAt: string
    posted_at?: string | null
    expire_at?: string | null
    created_at?: string | null
    applicantsTotal: number | null
    applicants_total?: number | null
    applicants?: number | null
    applicants_last_24h?: number | null
    applicants_velocity_24h?: number | null
    premium_low_data_state?: boolean
    premium_low_data_message?: string | null
    verified: boolean
    reposted: boolean
    reposted_job?: boolean
    sourceKey: string
    source_key?: string
    sourceLabel: string
    source_label?: string
    jobUrl: string
    job_url?: string
    description: string
    description_snippet?: string | null
    description_full?: string | null
    keywords: string[]
    seniority: string
    jobType: string
    experienceYears: string
    work_remote_allowed?: boolean
    applied?: boolean
    applied_at?: string | null
    application_closed?: unknown
    premium_title?: string | null
    premium_description?: string | null
    seniority_distribution?: unknown[]
    education_distribution?: unknown[]
    verification_action_target?: string | null
    verification_badge_system_image?: string | null
    pythonScore: number
    aiScore: number
    pythonSignalScore?: number
    aiCategoryScores?: Record<string, number> | null
    aiScoreBreakdown?: unknown
    aiArchetype?: string | null
    aiSignals?: unknown
    aiMatchedKeywords?: string[] | null
    aiBonusReasons?: string[]
    aiPenaltyReasons?: string[]
    aiEvidence?: unknown[]
    aiSuspicious?: boolean
    aiSuspiciousReasons?: string[]
    archetype: string
    scoreBreakdown: {
        positive: ScoreSignal[]
        negative: ScoreSignal[]
        categoryTotals: Record<string, number>
    }
    raw?: RawJobPayload
}

export type SearchJobsParams = {
    page?: number
    count?: number
    keywords?: string
    excluded_keywords?: string
    geo_id?: string
    distance?: number
    blacklist?: string[]
    [key: string]: string | number | boolean | string[] | undefined
}

export type SearchJobsProgress = {
    type?: string
    step: string
    message: string
    current: number
    total: number
    [key: string]: unknown
}

export type GraphqlJobsResponse = {
    status: string
    jobs: SearchJob[]
    audit: unknown
    meta: unknown
}

export type StreamBackendErrorDetails = {
    type?: string
    code?: string
    message?: string
    error?: string
    failed_config?: string
    operation?: string
    job_id?: string
    status_code?: number
    action?: string
    [key: string]: unknown
}

export type StreamBackendError = Error & {
    code?: string
    details?: StreamBackendErrorDetails
}

type JobsCachePayload = {
    jobs: SearchJob[]
    cachedAt: string
}

type ScoreItem = {
    id?: string
    external_id?: string
    urn?: string
    data?: ScoreItem
    total_score?: number
    category_scores?: Record<string, number>
    score_breakdown?: unknown
    archetype?: string
    metadata?: {
        archetype?: string
        archetype_signals?: unknown
    }
    matched_keywords?: string[]
    bonus_reasons?: string[]
    penalty_reasons?: string[]
    evidence?: unknown[]
    suspicious?: boolean
    suspicious_reasons?: string[]
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "")
const LIVE_JOBS_ENDPOINT = `${API_BASE_URL}/search-jobs/live`
const JOBS_CACHE_KEY = "new-frontend.search-jobs.jobs.v1"
const SAVED_JOBS_CACHE_KEY = "new-frontend.search-jobs.saved.v1"

const SOURCE_LABELS: Record<string, string> = {
    JOBS_CREATE: "Direct post",
    JOBS_PREMIUM_OFFLINE: "LinkedIn feed",
}

const TITLE_HINTS = [
    {match: "python", label: "Python"},
    {match: "react", label: "React"},
    {match: "django", label: "Django"},
    {match: "fastapi", label: "FastAPI"},
    {match: "flask", label: "Flask"},
    {match: "node", label: "Node.js"},
    {match: "nest", label: "NestJS"},
    {match: "typescript", label: "TypeScript"},
    {match: "javascript", label: "JavaScript"},
    {match: "postgresql", label: "PostgreSQL"},
    {match: "postgres", label: "PostgreSQL"},
    {match: "mysql", label: "MySQL"},
    {match: "nosql", label: "NoSQL"},
    {match: "sql", label: "SQL"},
    {match: "aws", label: "AWS"},
    {match: "gcp", label: "GCP"},
    {match: "google cloud", label: "GCP"},
    {match: "azure", label: "Azure"},
    {match: "cloud infrastructure", label: "Cloud"},
    {match: "task queues", label: "Task queues"},
    {match: "async processing", label: "Async"},
    {match: "data pipeline", label: "Data pipeline"},
    {match: "data pipelines", label: "Data pipeline"},
    {match: "etl", label: "ETL"},
    {match: "machine learning", label: "Machine Learning"},
    {match: "ml", label: "ML"},
    {match: "api", label: "API"},
    {match: "apis", label: "API"},
    {match: "full stack", label: "Full Stack"},
    {match: "fullstack", label: "Full Stack"},
    {match: "back-end", label: "Backend"},
    {match: "backend", label: "Backend"},
    {match: "front-end", label: "Frontend"},
    {match: "frontend", label: "Frontend"},
    {match: "senior", label: "Senior"},
    {match: "pleno", label: "Pleno"},
    {match: "junior", label: "Junior"},
    {match: "remote", label: "Remote"},
]

export function placeholderLogo(companyName: string) {
    const initials = companyName
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
            <rect width="96" height="96" rx="18" fill="#111827"/>
            <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
                fill="#f8fafc" font-family="Arial, sans-serif" font-size="26" font-weight="800">
                ${initials || "JO"}
            </text>
        </svg>
    `

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const getString = (value: unknown, fallback = "") =>
    typeof value === "string" ? value : fallback

const getArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const getStringArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : []

const readJson = <T>(key: string, fallback: T): T => {
    try {
        const raw = window.localStorage.getItem(key)
        return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
        return fallback
    }
}

const writeJson = (key: string, value: unknown) => {
    try {
        window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
        console.warn("Failed to write search jobs local cache.", error)
    }
}

export const readJobsCache = (): JobsCachePayload | null =>
    readJson<JobsCachePayload | null>(JOBS_CACHE_KEY, null)

export const writeJobsCache = (jobs: SearchJob[]) => {
    const cachedAt = new Date().toISOString()
    writeJson(JOBS_CACHE_KEY, {jobs, cachedAt})

    return cachedAt
}

export function clearJobsCache() {
    try {
        window.localStorage.removeItem(JOBS_CACHE_KEY)
    } catch (error) {
        console.warn("Failed to clear search jobs local cache.", error)
    }
}

export function readSavedJobIds() {
    return readJson<string[]>(SAVED_JOBS_CACHE_KEY, [])
}

export function toggleSavedJob(jobId: string) {
    const current = new Set(readSavedJobIds())

    if (current.has(jobId)) {
        current.delete(jobId)
    } else {
        current.add(jobId)
    }

    const updated = [...current]
    writeJson(SAVED_JOBS_CACHE_KEY, updated)

    return updated
}

export function getInitialSearchJobsData() {
    const cached = readJobsCache()

    return {
        jobs: cached?.jobs ?? [],
        cachedAt: cached?.cachedAt ?? null,
        loadedFromCache: Boolean(cached?.jobs?.length),
    }
}

function inferWorkplaceType(locationText = "", workRemoteAllowed = false): WorkplaceType {
    const value = String(locationText).toLowerCase()

    if (workRemoteAllowed || value.includes("remote")) return "Remote"
    if (value.includes("hybrid")) return "Hybrid"
    if (
        value.includes("on-site") ||
        value.includes("onsite") ||
        value.includes("presencial")
    ) {
        return "On-site"
    }

    return "Not specified"
}

function inferKeywords(title = "", description = "") {
    const value = `${title} ${description}`.toLowerCase()

    return Array.from(
        new Set(
            TITLE_HINTS.filter((hint) => value.includes(hint.match)).map(
                (hint) => hint.label,
            ),
        ),
    )
}

function normalizeSourceLabel(sourceKey = "") {
    if (!sourceKey) return "Unknown source"

    return (
        SOURCE_LABELS[sourceKey] ||
        sourceKey
            .split("_")
            .join(" ")
            .toLowerCase()
            .replace(/\b\w/g, (char) => char.toUpperCase())
    )
}

function extractJobId(apiData: RawJobPayload) {
    if (apiData.job_id != null) return String(apiData.job_id)
    if (apiData.id != null) return String(apiData.id)

    const urns = [
        apiData.job_posting_urn,
        apiData.normalized_job_posting_urn,
        apiData.tracking_urn,
        apiData.card_entity_urn,
        apiData.search_card_urn,
    ].filter(Boolean)

    for (const urn of urns) {
        const match = String(urn).match(/(\d{6,})/)
        if (match) return match[1]
    }

    return null
}

function toNumberOrNull(value: unknown) {
    if (value == null || value === "") return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
}

function inferSeniority(title: string, description: string) {
    const value = `${title} ${description}`.toLowerCase()

    if (value.includes("senior") || value.includes("sênior")) return "Senior"
    if (value.includes("pleno") || value.includes("mid")) return "Mid level"
    if (value.includes("junior") || value.includes("entry")) return "Junior"
    if (value.includes("intern") || value.includes("estágio")) return "Internship"

    return "Not specified"
}

function inferJobType(title: string, keywords: string[]) {
    const value = `${title} ${keywords.join(" ")}`.toLowerCase()

    if (value.includes("full stack") || value.includes("fullstack")) return "Full Stack"
    if (value.includes("platform")) return "Platform"
    if (value.includes("frontend") || value.includes("front-end") || value.includes("react")) return "Frontend"
    if (value.includes("backend") || value.includes("back-end") || value.includes("python")) return "Backend"

    return "Engineering"
}

function buildUrl(baseUrl: string, params: SearchJobsParams = {}) {
    const url = new URL(baseUrl)

    Object.entries(params).forEach(([key, value]) => {
        if (value == null || value === "") return

        if (Array.isArray(value)) {
            if (value.length > 0) {
                url.searchParams.set(key, value.join(","))
            }
            return
        }

        url.searchParams.set(key, String(value))
    })

    return url.toString()
}

async function parseJsonResponse(response: Response) {
    const contentType = response.headers.get("content-type") || ""

    if (!contentType.includes("application/json")) {
        const text = await response.text()
        throw new Error(`Expected JSON response, got: ${text || "empty response"}`)
    }

    return response.json() as Promise<unknown>
}

export function normalizeSearchJob(apiData: RawJobPayload): SearchJob | null {
    const jobId = extractJobId(apiData)

    if (!jobId) {
        console.warn("GraphQL job skipped due to missing ID.", apiData)
        return null
    }

    const title = (
        getString(apiData.title) ||
        getString(apiData.title_raw_from_job_posting)
    ).trim()
    const descriptionFull = getString(apiData.description_full) || null
    const descriptionSnippet =
        getString(apiData.description_snippet) ||
        (descriptionFull ? String(descriptionFull).slice(0, 280) : null)
    const description = descriptionFull || descriptionSnippet || ""
    const companyName =
        getString(apiData.company_name) || getString(apiData.company) || "Unknown company"
    const companyLogoUrl =
        getString(apiData.company_logo_url) || getString(apiData.company_logo) || placeholderLogo(companyName)
    const companyPageUrl = getString(apiData.company_page_url)
    const companyUrl = getString(apiData.company_url)
    const locationText = getString(apiData.location_text) || getString(apiData.location) || "Not specified"
    const sourceKey = getString(apiData.source_key) || getString(apiData.content_source)
    const rawApplicantsTotal = toNumberOrNull(apiData.applicants_total ?? apiData.applicants)
    const rawApplicants = toNumberOrNull(apiData.applicants ?? apiData.applicants_total)
    const premiumLowDataState = Boolean(apiData.premium_low_data_state) || rawApplicantsTotal === -1
    const premiumLowDataMessage = getString(apiData.premium_low_data_message) || null
    const workRemoteAllowed = Boolean(apiData.work_remote_allowed)
    const keywords = inferKeywords(title, description)
    const workplaceType = inferWorkplaceType(locationText, workRemoteAllowed)

    const verified =
        apiData.verified ??
        Boolean(
            apiData.verification_urn ||
            apiData.verification_action_target ||
            apiData.verification_badge_system_image ||
            apiData.has_verification_record,
        )

    const normalized: SearchJob = {
        id: jobId,
        jobId,
        job_id: jobId,
        title: title || "Untitled job",
        company: {
            name: companyName,
            logoUrl: companyLogoUrl,
            pageUrl: companyPageUrl,
            websiteUrl: companyUrl,
            urn: getString(apiData.company_urn) || null,
        },
        company_name: companyName,
        location: locationText,
        location_text: locationText,
        workplaceType,
        workplace_type: workplaceType,
        postedAt: getString(apiData.posted_at) || new Date().toISOString(),
        posted_at: getString(apiData.posted_at) || null,
        expire_at: getString(apiData.expire_at) || null,
        created_at: getString(apiData.created_at) || null,
        applicantsTotal: premiumLowDataState ? null : rawApplicantsTotal,
        applicants_total: premiumLowDataState ? null : rawApplicantsTotal,
        applicants: premiumLowDataState ? null : rawApplicants,
        applicants_last_24h: toNumberOrNull(apiData.applicants_last_24h),
        applicants_velocity_24h: toNumberOrNull(apiData.applicants_velocity_24h),
        premium_low_data_state: premiumLowDataState,
        premium_low_data_message: premiumLowDataMessage,
        verified: Boolean(verified),
        reposted: Boolean(apiData.reposted_job),
        reposted_job: Boolean(apiData.reposted_job),
        sourceKey,
        source_key: sourceKey,
        sourceLabel: normalizeSourceLabel(sourceKey),
        source_label: normalizeSourceLabel(sourceKey),
        jobUrl: getString(apiData.job_url) || `https://www.linkedin.com/jobs/view/${jobId}/`,
        job_url: getString(apiData.job_url) || `https://www.linkedin.com/jobs/view/${jobId}/`,
        description,
        description_snippet: descriptionSnippet,
        description_full: descriptionFull,
        keywords,
        seniority: inferSeniority(title, description),
        jobType: inferJobType(title, keywords),
        experienceYears: "Not specified",
        work_remote_allowed: workRemoteAllowed,
        applied: Boolean(apiData.applied),
        applied_at: getString(apiData.applied_at) || null,
        application_closed: apiData.application_closed ?? null,
        premium_title: getString(apiData.premium_title) || null,
        premium_description: getString(apiData.premium_description) || null,
        seniority_distribution: getArray(apiData.seniority_distribution),
        education_distribution: getArray(apiData.education_distribution),
        verification_action_target: getString(apiData.verification_action_target) || null,
        verification_badge_system_image: getString(apiData.verification_badge_system_image) || null,
        pythonScore: 0,
        aiScore: 0,
        archetype: "unscored",
        scoreBreakdown: {
            positive: [],
            negative: [],
            categoryTotals: {},
        },
        raw: apiData,
    }

    return normalized
}

function normalizeGraphqlJobsResponse(apiData: unknown): GraphqlJobsResponse {
    if (!apiData) {
        return {
            status: "error",
            jobs: [],
            audit: null,
            meta: null,
        }
    }

    const apiObject = typeof apiData === "object" ? apiData as Record<string, unknown> : {}
    const payloadRoot = typeof apiObject.data === "object" && apiObject.data !== null
        ? apiObject.data as Record<string, unknown>
        : apiObject
    const rawJobs = Array.isArray(payloadRoot.jobs)
        ? payloadRoot.jobs
        : Array.isArray(apiData)
            ? apiData
            : []

    const jobs = rawJobs
        .map((job) => normalizeSearchJob(job as RawJobPayload))
        .filter((job): job is SearchJob => job !== null)

    return {
        status: getString(apiObject.status) || "success",
        jobs,
        audit: payloadRoot.audit || null,
        meta: payloadRoot.meta || null,
    }
}

async function fetchGraphqlJobsResponse(params: SearchJobsParams = {}) {
    const url = buildUrl(LIVE_JOBS_ENDPOINT, {
        page: 1,
        count: 10,
        ...params,
    })

    const response = await fetch(url, {
        method: "GET",
        headers: {
            Accept: "application/json",
        },
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        throw new Error(
            `Failed to fetch jobs (${response.status} ${response.statusText})${
                errorText ? ` - ${errorText}` : ""
            }`,
        )
    }

    const json = await parseJsonResponse(response)
    return normalizeGraphqlJobsResponse(json)
}

function normalizeProgress(parsed: StreamBackendErrorDetails): SearchJobsProgress {
    const current = toNumberOrNull(parsed.current) ?? toNumberOrNull(parsed.completed) ?? 0
    const total = toNumberOrNull(parsed.total) ?? toNumberOrNull(parsed.count) ?? Math.max(1, current)

    return {
        ...parsed,
        step: getString(parsed.step) || getString(parsed.stage) || "fetching",
        message: getString(parsed.message) || "Fetching LinkedIn jobs...",
        current,
        total: Math.max(1, total),
    }
}

function buildStreamError(parsed: StreamBackendErrorDetails): StreamBackendError {
    const parts = []

    if (parsed.message || parsed.error) {
        parts.push(parsed.message || parsed.error)
    }

    if (parsed.failed_config) {
        parts.push(`Update LinkedIn config: ${parsed.failed_config}.`)
    }

    if (parsed.operation) {
        parts.push(`Failed operation: ${parsed.operation}.`)
    }

    if (parsed.job_id) {
        parts.push(`Job ID: ${parsed.job_id}.`)
    }

    if (parsed.status_code) {
        parts.push(`HTTP status: ${parsed.status_code}.`)
    }

    if (parsed.action) {
        parts.push(parsed.action)
    }

    const error = new Error(parts.join(" ") || "Backend stream failed.") as StreamBackendError
    error.code = parsed.code || parsed.type || "BACKEND_STREAM_ERROR"
    error.details = parsed
    return error
}

export async function streamGraphqlJobs(
    params: SearchJobsParams = {},
    onProgress?: (progress: SearchJobsProgress) => void,
) {
    const url = buildUrl(`${API_BASE_URL}/search-jobs/live/stream`, {
        page: 1,
        count: 10,
        ...params,
    })

    const response = await fetch(url, {
        method: "GET",
        headers: {
            Accept: "text/event-stream",
        },
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        throw new Error(`Failed to stream jobs (${response.status}) - ${errorText}`)
    }

    if (!response.body) {
        throw new Error("Job stream response did not include a readable body.")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder("utf-8")
    let buffer = ""
    let streamError: StreamBackendError | null = null
    let lastEventType: string | null = null

    while (true) {
        const {done, value} = await reader.read()
        if (done) break

        buffer += decoder.decode(value, {stream: true})

        const parts = buffer.split("\n\n")
        buffer = parts.pop() || ""

        for (const part of parts) {
            if (!part.startsWith("data: ")) continue

            const jsonStr = part.replace(/^data:\s*/, "").trim()
            if (!jsonStr) continue

            let parsed: StreamBackendErrorDetails

            try {
                parsed = JSON.parse(jsonStr) as StreamBackendErrorDetails
            } catch (error) {
                console.error("Error parsing SSE chunk:", error, part)
                continue
            }

            lastEventType = parsed.type || "unknown"

            if (parsed.type === "progress") {
                onProgress?.(normalizeProgress(parsed))
                continue
            }

            if (parsed.type === "result") {
                const responseModel = normalizeGraphqlJobsResponse(parsed.data)
                return responseModel.jobs
            }

            if (
                parsed.type === "auth_error" ||
                parsed.type === "enrichment_error" ||
                parsed.type === "error"
            ) {
                streamError = buildStreamError(parsed)
                break
            }
        }

        if (streamError) {
            break
        }
    }

    if (streamError) {
        throw streamError
    }

    throw new Error(
        `Job stream ended without a result. Last event type: ${
            lastEventType || "none"
        }.`,
    )
}

export async function getGraphqlJobs(params: SearchJobsParams = {}) {
    const result = await fetchGraphqlJobsResponse(params)
    return result.jobs
}

export async function getGraphqlJobsWithMeta(params: SearchJobsParams = {}) {
    return fetchGraphqlJobsResponse(params)
}

export async function getGraphqlJobById(jobId: string, params: SearchJobsParams = {}) {
    const jobs = await getGraphqlJobs({
        count: 100,
        page: 1,
        ...params,
    })

    return jobs.find((job) => String(job.job_id) === String(jobId)) ?? null
}

const hasNonEmptyString = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0

const hasNonEmptyArray = (value: unknown) =>
    Array.isArray(value) &&
    value.some((item) => typeof item === "string" && item.trim().length > 0)

const isJobScoreable = (job: SearchJob) =>
    hasNonEmptyString(job.description_full) ||
    hasNonEmptyString(job.description_snippet) ||
    hasNonEmptyString(job.premium_title) ||
    hasNonEmptyString(job.premium_description) ||
    hasNonEmptyArray(job.raw?.qualifications) ||
    hasNonEmptyArray(job.raw?.responsibilities) ||
    hasNonEmptyArray(job.raw?.programming_languages) ||
    hasNonEmptyArray(job.keywords)

async function handleJsonResponse(response: Response, fallbackMessage: string) {
    const contentType = response.headers.get("content-type") || ""
    const payload = contentType.includes("application/json")
        ? await response.json().catch(() => null) as unknown
        : await response.text().catch(() => "")

    if (!response.ok) {
        const data = typeof payload === "object" && payload !== null
            ? payload as Record<string, unknown>
            : {}
        const detail =
            getString(data.description) ||
            getString(data.error) ||
            getString(data.message) ||
            (typeof payload === "string" ? payload : "")

        throw new Error(detail || fallbackMessage)
    }

    return payload
}

export async function scoreJobsBatch(jobs: SearchJob[]) {
    if (!Array.isArray(jobs) || jobs.length === 0) {
        return new Map<string, ScoreItem>()
    }

    const scoreableJobs = jobs.filter(isJobScoreable)
    const skippedCount = jobs.length - scoreableJobs.length

    if (skippedCount > 0) {
        console.debug(
            `Skipped ${skippedCount} job${skippedCount === 1 ? "" : "s"} without descriptive fields from AI scoring.`,
        )
    }

    if (scoreableJobs.length === 0) {
        return new Map<string, ScoreItem>()
    }

    const payload = {
        items: scoreableJobs.map((job) => ({
            id: job.id,
            title: job.title,
            description_full: job.description_full || job.description_snippet || "",
            description_snippet: job.description_snippet || "",
            keywords: Array.isArray(job.keywords) ? job.keywords : [],
            qualifications: getStringArray(job.raw?.qualifications),
            responsibilities: getStringArray(job.raw?.responsibilities),
            programming_languages: getStringArray(job.raw?.programming_languages),
            premium_title: job.premium_title || "",
            premium_description: job.premium_description || "",
        })),
    }

    let json: unknown

    try {
        const response = await fetch(`${API_BASE_URL}/job-scoring/rank`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
        })

        json = await handleJsonResponse(response, "Failed to batch score jobs")
    } catch (error) {
        console.warn(
            "Failed to score jobs. Rendering fetched jobs without AI scores.",
            {
                error,
                scoreableCount: scoreableJobs.length,
                skippedCount,
            },
        )
        return new Map<string, ScoreItem>()
    }

    const payloadObject = typeof json === "object" && json !== null
        ? json as Record<string, unknown>
        : {}
    const dataObject = typeof payloadObject.data === "object" && payloadObject.data !== null
        ? payloadObject.data as Record<string, unknown>
        : {}
    const items = Array.isArray(payloadObject.items)
        ? payloadObject.items
        : Array.isArray(dataObject.items)
            ? dataObject.items
            : Array.isArray(payloadObject.data)
                ? payloadObject.data
                : []

    const map = new Map<string, ScoreItem>()

    items.forEach((item) => {
        const itemObject = item && typeof item === "object" ? item as ScoreItem : null
        if (!itemObject) return

        const normalizedItem =
            itemObject.data && typeof itemObject.data === "object"
                ? {...itemObject.data, ...itemObject}
                : itemObject
        const key =
            normalizedItem.external_id ?? normalizedItem.id ?? normalizedItem.urn

        if (key != null) {
            map.set(String(key), normalizedItem)
        }
    })

    return map
}
