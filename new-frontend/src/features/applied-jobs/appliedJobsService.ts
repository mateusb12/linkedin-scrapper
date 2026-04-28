export type ApplicationStatus = "Waiting" | "Applied" | "Accepted" | "Refused"

export type LastEmail = {
    subject: string
    receivedAt: string
    sender?: string
    snippet?: string
    body?: string
}

export type AppliedJob = {
    urn: string
    id?: string
    title: string
    company: string
    location: string
    workRemoteAllowed: boolean
    appliedAt: string
    postedAt?: string
    expireAt?: string
    applicants: number
    applicantsVelocity: number
    applicationStatus: ApplicationStatus
    jobState?: string
    applicationClosed?: boolean
    employmentStatus?: string | null
    description: string
    jobUrl?: string
    lastEmail?: LastEmail
}

export type FetchAppliedJobsResult = {
    jobs: AppliedJob[]
    count?: number
}

export type SmartSyncResult = Record<string, unknown> & {
    syncedCount: number
    synced_count?: number
}

export type BackfillProgressPayload = {
    type?: "progress"
    processed: number
    company: string
    title: string
    diff?: {
        applicants?: {
            from: number
            to: number
            delta: number
        }
        jobState?: {
            from: string
            to: string
        }
        applicationClosed?: {
            from: boolean
            to: boolean
        }
    }
}

export type BackfillFinishPayload = {
    type?: "finished"
    inserted: number
    reason?: string
}

export type BackfillStreamOptions = {
    from: string
    onProgress: (data: BackfillProgressPayload) => void
    onFinish: (data: BackfillFinishPayload) => void
    onError: (error: unknown) => void
}

export type FetchAppliedJobsPaginatedOptions = {
    page?: number
    limit?: number
    startDate?: string
    skipSync?: boolean
}

export const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "")

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

function asString(value: unknown, fallback = "") {
    return typeof value === "string" ? value : fallback
}

function asOptionalString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

function asNumber(value: unknown, fallback = 0) {
    if (typeof value === "number" && Number.isFinite(value)) return value

    if (typeof value === "string") {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }

    return fallback
}

function getFirstString(raw: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = asOptionalString(raw[key])

        if (value) return value
    }

    return undefined
}

function getCompanyName(company: unknown) {
    if (typeof company === "string" && company.trim().length > 0) return company

    if (isRecord(company)) {
        return asOptionalString(company.name) ?? "Unknown Company"
    }

    return "Unknown Company"
}

function normalizeApplicationStatus(value: unknown): ApplicationStatus {
    const status = asString(value, "Waiting").trim().toLowerCase()

    if (status === "accepted" || status === "hired" || status === "offer") return "Accepted"
    if (status === "refused" || status === "rejected" || status === "declined") return "Refused"
    if (status === "applied" || status === "submitted") return "Applied"

    return "Waiting"
}

function normalizeLastEmail(value: unknown): LastEmail | undefined {
    if (!isRecord(value)) return undefined

    const subject = asOptionalString(value.subject)
    const receivedAt = getFirstString(value, ["receivedAt", "received_at", "received_at_brt", "date"])

    if (!subject || !receivedAt) return undefined

    return {
        subject,
        receivedAt,
        sender: asOptionalString(value.sender),
        snippet: asOptionalString(value.snippet),
        body: getFirstString(value, ["body", "body_text"]),
    }
}

export async function handleResponse<T = unknown>(
    response: Response,
    fallbackMessage: string,
): Promise<T> {
    let payload: unknown = null

    try {
        payload = await response.json()
    } catch {
        payload = null
    }

    if (!response.ok) {
        const message =
            isRecord(payload)
                ? asOptionalString(payload.error) ??
                asOptionalString(payload.message) ??
                asOptionalString(payload.description) ??
                fallbackMessage
                : fallbackMessage

        throw new Error(message)
    }

    return payload as T
}

export function normalizeAppliedJob(raw: unknown): AppliedJob {
    const job = isRecord(raw) ? raw : {}
    const urn = getFirstString(job, ["urn", "id", "job_id"]) ?? "unknown-job"
    const appliedAt = getFirstString(job, ["appliedAt", "applied_at_brt", "applied_on", "applied_at"]) ?? ""
    const applicantsVelocity =
        job.applicantsVelocity ??
        job.applicants_velocity ??
        job.applicants_velocity_24h

    return {
        urn,
        id: urn,
        title: getFirstString(job, ["title"]) ?? "Untitled job",
        company: getCompanyName(job.company),
        location: getFirstString(job, ["location", "location_text"]) ?? "",
        workRemoteAllowed: Boolean(job.workRemoteAllowed ?? job.work_remote_allowed),
        appliedAt,
        postedAt: getFirstString(job, ["postedAt", "posted_at", "posted_on", "listed_at", "posted_date_text"]),
        expireAt: getFirstString(job, ["expireAt", "expire_at"]),
        applicants: asNumber(job.applicants ?? job.applicants_total),
        applicantsVelocity: asNumber(applicantsVelocity),
        applicationStatus: normalizeApplicationStatus(
            job.applicationStatus ?? job.application_status ?? job.status,
        ),
        jobState: getFirstString(job, ["jobState", "job_state"]),
        applicationClosed: Boolean(job.applicationClosed ?? job.application_closed),
        employmentStatus: getFirstString(job, ["employmentStatus", "employment_status"])?.replace(
            "urn:li:fs_employmentStatus:",
            "",
        ) ?? null,
        description:
            getFirstString(job, ["description", "description_full", "description_snippet"]) ?? "",
        jobUrl:
            getFirstString(job, [
                "jobUrl",
                "job_url",
                "url",
                "navigation_url",
                "navigationUrl",
                "linkedin_url",
                "linkedinUrl",
            ]) ??
            (urn.match(/\d{6,}/)
                ? `https://www.linkedin.com/jobs/view/${urn.match(/\d{6,}/)?.[0]}/`
                : undefined),
        lastEmail: normalizeLastEmail(job.lastEmail ?? job.last_email),
    }
}

function extractJobs(payload: unknown): unknown[] {
    if (Array.isArray(payload)) return payload

    if (!isRecord(payload)) return []

    if (Array.isArray(payload.data)) return payload.data
    if (Array.isArray(payload.jobs)) return payload.jobs

    if (isRecord(payload.data)) {
        if (Array.isArray(payload.data.jobs)) return payload.data.jobs
        if (Array.isArray(payload.data.data)) return payload.data.data
    }

    return []
}

function extractCount(payload: unknown, jobs: AppliedJob[]) {
    if (!isRecord(payload)) return jobs.length

    if (typeof payload.count === "number") return payload.count
    if (typeof payload.total === "number") return payload.total

    if (isRecord(payload.data)) {
        if (typeof payload.data.count === "number") return payload.data.count
        if (typeof payload.data.total === "number") return payload.data.total
    }

    return jobs.length
}

function sortByAppliedAtDesc(jobs: AppliedJob[]) {
    return [...jobs].sort(
        (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
    )
}

function normalizeJobsResult(payload: unknown): FetchAppliedJobsResult {
    const jobs = sortByAppliedAtDesc(extractJobs(payload).map(normalizeAppliedJob))

    return {
        jobs,
        count: extractCount(payload, jobs),
    }
}

export async function fetchAppliedJobs(): Promise<FetchAppliedJobsResult> {
    const response = await fetch(`${API_BASE_URL}/job-tracker/applied`)
    const json = await handleResponse(response, "Failed to fetch applied jobs")

    return normalizeJobsResult(json)
}

export async function fetchAppliedJobsLive(): Promise<FetchAppliedJobsResult> {
    const response = await fetch(`${API_BASE_URL}/job-tracker/applied-live`)
    const json = await handleResponse(response, "Failed to fetch applied jobs live")

    return normalizeJobsResult(json)
}

export async function syncAppliedSmart(): Promise<SmartSyncResult> {
    const response = await fetch(`${API_BASE_URL}/job-tracker/sync-applied-smart`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
    })
    const result = await handleResponse<Record<string, unknown>>(
        response,
        "Failed to smart sync applied jobs",
    )

    return {
        ...result,
        syncedCount: asNumber(result.syncedCount ?? result.synced_count),
    }
}

export async function syncAppliedIncremental() {
    const response = await fetch(`${API_BASE_URL}/job-tracker/sync-applied`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
    })

    return handleResponse(response, "Failed to sync applied jobs")
}

export function syncAppliedBackfillStream({
    from,
    onProgress,
    onFinish,
    onError,
}: BackfillStreamOptions) {
    const url = `${API_BASE_URL}/job-tracker/sync-applied-backfill-stream?from=${encodeURIComponent(from)}`
    const eventSource = new EventSource(url)
    let finished = false

    eventSource.onmessage = event => {
        try {
            const data = JSON.parse(event.data)

            if (data.type === "progress") {
                onProgress(data)
            }

            if (data.type === "finished") {
                finished = true
                onFinish(data)
                eventSource.close()
            }
        } catch (error) {
            onError(error)
        }
    }

    eventSource.onerror = error => {
        if (finished) return

        onError(error)
        eventSource.close()
    }

    return () => eventSource.close()
}

export async function fetchAppliedJobsPaginated({
    page,
    limit,
    startDate,
    skipSync,
}: FetchAppliedJobsPaginatedOptions = {}) {
    const params = new URLSearchParams()

    if (page) params.set("page", String(page))
    if (limit) params.set("limit", String(limit))
    if (startDate) params.set("start_date", startDate)
    if (skipSync) params.set("skip_sync", "true")

    const query = params.toString()
    const response = await fetch(`${API_BASE_URL}/services/applied${query ? `?${query}` : ""}`)
    const json = await handleResponse(response, "Failed to fetch paginated applied jobs")

    return normalizeJobsResult(json)
}

export async function syncApplicationStatus() {
    const response = await fetch(`${API_BASE_URL}/services/sync-status`, {
        method: "POST",
    })

    return handleResponse(response, "Failed to sync application status")
}

export async function reconcileJobStatuses() {
    const response = await fetch(`${API_BASE_URL}/services/reconcile`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({}),
    })

    return handleResponse(response, "Failed to reconcile job statuses")
}

export async function fetchDashboardInsights(timeRange = "all_time") {
    const response = await fetch(
        `${API_BASE_URL}/services/insights?time_range=${encodeURIComponent(timeRange)}`,
    )

    return handleResponse(response, "Failed to fetch dashboard insights")
}

export function formatDateBR(value: string) {
    if (!value) return "-"

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "-"

    const months = [
        "jan",
        "fev",
        "mar",
        "abr",
        "mai",
        "jun",
        "jul",
        "ago",
        "set",
        "out",
        "nov",
        "dez",
    ]

    const day = String(date.getDate()).padStart(2, "0")
    const month = months[date.getMonth()]
    const year = date.getFullYear()

    return `${day}/${month}/${year}`
}

export function formatTimeBR(value: string) {
    if (!value) return ""

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""

    const hour = String(date.getHours()).padStart(2, "0")
    const minute = String(date.getMinutes()).padStart(2, "0")

    return `${hour}:${minute}`
}

export function calculateJobAge(postedAt: string) {
    if (!postedAt) return null

    const posted = new Date(postedAt)
    if (Number.isNaN(posted.getTime())) return null

    const now = new Date()
    const diffMs = now.getTime() - posted.getTime()
    const days = Math.floor(diffMs / 86_400_000)

    return Math.max(days, 0)
}

export function formatTimeAgo(value: string) {
    if (!value) return "unknown"

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "unknown"

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()

    const minutes = Math.floor(diffMs / 60_000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return "now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`

    return `${days}d ago`
}
