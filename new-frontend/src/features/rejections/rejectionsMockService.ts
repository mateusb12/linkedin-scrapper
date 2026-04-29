export type RejectionEmail = {
    id: number
    threadId: string
    jobUrn?: string
    company?: string
    jobTitle?: string
    jobDescription?: string
    competition?: number
    folder: "Job fails"
    category: "rejection"
    sender: string
    senderEmail: string
    recipient: string
    subject: string
    snippet: string
    bodyText: string
    receivedAt: string
    createdAt: string
    isRead: boolean
}

export type FetchRejectionEmailsParams = {
    page: number
    limit: number
    searchTerm?: string
}

export type FetchRejectionEmailsResult = {
    data: RejectionEmail[]
    total: number
    page: number
    totalPages: number
}

type SyncRejectionEmailsResult = {
    newCount: number
    [key: string]: unknown
}

const API_BASE = (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000"
).replace(/\/$/, "")

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

function getNestedRecord(raw: Record<string, unknown>, key: string) {
    const value = raw[key]

    return isRecord(value) ? value : undefined
}

function getFirstNestedString(
    raw: Record<string, unknown>,
    entries: Array<[string, string]>,
) {
    for (const [recordKey, fieldKey] of entries) {
        const record = getNestedRecord(raw, recordKey)
        const value = record ? asOptionalString(record[fieldKey]) : undefined

        if (value) return value
    }

    return undefined
}

function getFirstNumber(raw: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = raw[key]

        if (typeof value === "number" && Number.isFinite(value)) return value

        if (typeof value === "string") {
            const parsed = Number(value)
            if (Number.isFinite(parsed)) return parsed
        }
    }

    return undefined
}

function getFirstNestedNumber(
    raw: Record<string, unknown>,
    entries: Array<[string, string]>,
) {
    for (const [recordKey, fieldKey] of entries) {
        const record = getNestedRecord(raw, recordKey)
        const value = record?.[fieldKey]

        if (typeof value === "number" && Number.isFinite(value)) return value

        if (typeof value === "string") {
            const parsed = Number(value)
            if (Number.isFinite(parsed)) return parsed
        }
    }

    return undefined
}

function isProbablyHtml(value: string) {
    return /<\/?[a-z][\s\S]*>/i.test(value)
}

function htmlToReadableText(html: string) {
    const htmlWithBreaks = html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")

    if (typeof DOMParser === "undefined") {
        return htmlWithBreaks
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\u00a0/g, " ")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/[ \t]{2,}/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlWithBreaks, "text/html")

    doc.querySelectorAll("script, style, noscript").forEach(node => node.remove())

    return (doc.body.textContent || "")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

function cleanReadableText(value: string) {
    const withoutHiddenPreview = Array.from(value)
        .filter(character => {
            const code = character.charCodeAt(0)

            return !(
                code === 0x034f ||
                code === 0x061c ||
                code === 0x115f ||
                code === 0x1160 ||
                code === 0x17b4 ||
                code === 0x17b5 ||
                code === 0x180e ||
                (code >= 0x200b && code <= 0x200f) ||
                (code >= 0x202a && code <= 0x202e) ||
                (code >= 0x2060 && code <= 0x206f) ||
                code === 0xfeff
            )
        })
        .join("")

    return withoutHiddenPreview
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

function normalizeReadableText(value: string) {
    return cleanReadableText(isProbablyHtml(value) ? htmlToReadableText(value) : value)
}

function isLinkedInFooterOnlyText(value: string) {
    const normalized = value.toLowerCase().replace(/\s+/g, " ")

    if (!normalized.trim()) return false

    const hasLinkedInFooter =
        normalized.includes("this email was intended for") &&
        normalized.includes("you are receiving linkedin notification emails")
    const hasRejectionDetail = [
        "will not be moving forward",
        "moved forward with other candidates",
        "no longer considering",
        "decided not to proceed",
        "not selected",
        "not be progressing",
        "seguimos com outro",
        "nao seguiremos",
        "não seguiremos",
        "nao avancara",
        "não avançará",
    ].some(phrase => normalized.includes(phrase))

    return hasLinkedInFooter && !hasRejectionDetail
}

function parseLinkedInApplicationSubject(subject: string) {
    const match = subject.match(/^your application to\s+(.+?)\s+at\s+(.+)$/i)

    if (!match) return undefined

    return {
        jobTitle: match[1].trim(),
        company: match[2].trim(),
    }
}

function buildLinkedInFallbackBody(
    email: Record<string, unknown>,
    body: string,
    jobTitle?: string,
    company?: string,
) {
    if (!isLinkedInFooterOnlyText(body)) return body

    const senderEmail = getFirstString(email, ["senderEmail", "sender_email"]) ?? ""
    const subject = asString(email.subject)
    const subjectDetails = parseLinkedInApplicationSubject(subject)
    const isLinkedInRejection =
        senderEmail.toLowerCase().includes("linkedin.com") &&
        (body.includes("email_jobs_application_rejected") ||
            subject.toLowerCase().startsWith("your application to "))

    if (!isLinkedInRejection) return body

    const resolvedJobTitle = jobTitle ?? subjectDetails?.jobTitle ?? "the role"
    const resolvedCompany = company ?? subjectDetails?.company ?? "the company"

    return [
        `LinkedIn rejection update`,
        ``,
        `Your application to ${resolvedJobTitle} at ${resolvedCompany} was marked as rejected by LinkedIn.`,
        ``,
        `LinkedIn only provided footer/security text in the stored email body, so no additional rejection details were available.`,
    ].join("\n")
}

async function handleJsonResponse<T>(
    response: Response,
    fallbackMessage: string,
): Promise<T> {
    let payload: unknown

    try {
        payload = await response.json()
    } catch {
        payload = null
    }

    if (!response.ok) {
        const message = isRecord(payload)
            ? asOptionalString(payload.error) ??
              asOptionalString(payload.message) ??
              fallbackMessage
            : fallbackMessage

        throw new Error(message)
    }

    return payload as T
}

function normalizeRejectionEmail(value: unknown): RejectionEmail {
    const email = isRecord(value) ? value : {}
    const id = asNumber(email.id)
    const body = getFirstString(email, ["bodyText", "body_text", "body", "text", "body_html"]) ?? ""
    const jobUrn =
        getFirstString(email, ["jobUrn", "job_urn", "urn"]) ??
        getFirstNestedString(email, [
            ["job", "urn"],
            ["linked_job", "urn"],
        ])
    const company =
        getFirstString(email, ["company", "company_name", "job_company"]) ??
        getFirstNestedString(email, [
            ["job", "company"],
            ["job", "company_name"],
            ["linked_job", "company"],
            ["linked_job", "company_name"],
        ])
    const jobTitle =
        getFirstString(email, ["jobTitle", "job_title", "title"]) ??
        getFirstNestedString(email, [
            ["job", "title"],
            ["linked_job", "title"],
        ])
    const jobDescription =
        getFirstString(email, [
            "jobDescription",
            "job_description",
            "description",
            "description_full",
        ]) ??
        getFirstNestedString(email, [
            ["job", "description"],
            ["job", "description_full"],
            ["job", "description_snippet"],
            ["linked_job", "description"],
            ["linked_job", "description_full"],
        ])
    const receivedAt =
        getFirstString(email, ["receivedAt", "received_at", "date", "created_at"]) ??
        new Date().toISOString()
    const createdAt =
        getFirstString(email, ["createdAt", "created_at", "receivedAt", "received_at"]) ??
        new Date().toISOString()

    return {
        id,
        threadId: getFirstString(email, ["threadId", "thread_id"]) ?? String(id),
        jobUrn,
        company,
        jobTitle,
        jobDescription: jobDescription ? normalizeReadableText(jobDescription) : undefined,
        competition: getFirstNumber(email, [
            "competition",
            "applicants",
            "applicants_count",
        ]) ?? getFirstNestedNumber(email, [
            ["job", "applicants"],
            ["linked_job", "applicants"],
        ]),
        folder: (asOptionalString(email.folder) ?? "Job fails") as RejectionEmail["folder"],
        category: (asOptionalString(email.category) ?? "rejection") as RejectionEmail["category"],
        sender: asString(email.sender, "Unknown sender"),
        senderEmail: getFirstString(email, ["senderEmail", "sender_email"]) ?? "",
        recipient: getFirstString(email, ["recipient", "to"]) ?? "",
        subject: asString(email.subject, "(No subject)"),
        snippet: normalizeReadableText(asString(email.snippet)),
        bodyText: normalizeReadableText(
            buildLinkedInFallbackBody(email, body, jobTitle, company),
        ),
        receivedAt,
        createdAt,
        isRead: Boolean(email.isRead ?? email.is_read ?? true),
    }
}

function getEmailItems(payload: unknown): unknown[] {
    if (Array.isArray(payload)) return payload

    if (!isRecord(payload)) return []

    if (Array.isArray(payload.data)) return payload.data
    if (Array.isArray(payload.emails)) return payload.emails

    return []
}

function normalizeEmailsResponse(
    payload: unknown,
    requestedPage: number,
    limit: number,
): FetchRejectionEmailsResult {
    const data = getEmailItems(payload).map(normalizeRejectionEmail)
    const response = isRecord(payload) ? payload : {}
    const total = asNumber(response.total, data.length)
    const page = asNumber(response.page, requestedPage)
    const totalPages = asNumber(
        response.totalPages ?? response.total_pages,
        Math.max(Math.ceil(total / limit), 1),
    )

    return {
        data,
        total,
        page,
        totalPages,
    }
}

function filterEmailsLocally(emails: RejectionEmail[], searchTerm: string) {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    if (!normalizedSearch) return emails

    return emails.filter(email =>
        [
            email.sender,
            email.senderEmail,
            email.subject,
            email.snippet,
            email.bodyText,
            email.company ?? "",
            email.jobTitle ?? "",
            email.jobDescription ?? "",
        ].some(value => value.toLowerCase().includes(normalizedSearch)),
    )
}

function normalizeSyncResponse(payload: unknown): SyncRejectionEmailsResult {
    if (!isRecord(payload)) return {newCount: 0}

    const countFromMessage = asOptionalString(payload.message)?.match(/\d+/)?.[0]

    return {
        ...payload,
        newCount: asNumber(
            payload.newCount ??
                payload.new_count ??
                payload.synced ??
                payload.synced_count ??
                countFromMessage,
        ),
    }
}

export async function fetchRejectionEmails({
    page,
    limit,
    searchTerm = "",
}: FetchRejectionEmailsParams): Promise<FetchRejectionEmailsResult> {
    const query = new URLSearchParams({
        folder: "Job fails",
        page: String(page),
        limit: String(limit),
    })

    const payload = await handleJsonResponse<unknown>(
        await fetch(`${API_BASE}/emails/?${query.toString()}`),
        "Failed to fetch rejection emails",
    )
    const result = normalizeEmailsResponse(payload, page, limit)
    const filteredData = filterEmailsLocally(result.data, searchTerm)

    if (!searchTerm.trim()) return result

    return {
        data: filteredData,
        total: filteredData.length,
        page: 1,
        totalPages: Math.max(Math.ceil(filteredData.length / limit), 1),
    }
}

export async function syncRejectionEmails(): Promise<SyncRejectionEmailsResult> {
    const payload = await handleJsonResponse<unknown>(
        await fetch(`${API_BASE}/emails/sync`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({label: "Job fails"}),
        }),
        "Failed to sync rejection emails",
    )

    return normalizeSyncResponse(payload)
}
