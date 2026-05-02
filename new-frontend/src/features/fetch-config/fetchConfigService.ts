export type ScraperApiType =
    | "pagination"
    | "individual"
    | "experience"
    | "connections"
    | "generic"

export type ScraperConfigColor =
    | "blue"
    | "purple"
    | "green"
    | "orange"
    | "teal"
    | "rose"

export type ScraperConfigMeta = {
    id: string
    title: string
    description: string
    networkFilter: string
    placeholder: string
    colorClass: ScraperConfigColor
    apiType: ScraperApiType
}

export type SavedScraperConfig = {
    curl: string | Record<string, unknown>
    savedAt?: string
}

export type ScraperConfigsData = Record<string, SavedScraperConfig | null>

export type GmailState = {
    status: "connected" | "not_configured"
    profileId: number | null
    profileEmail: string
    appPasswordPreview: string
}

export type FetchConfigData = {
    scraperConfigs: ScraperConfigMeta[]
    configsData: ScraperConfigsData
    gmail: GmailState
    profileId: number | null
}

export type LinkedInAuthDiagnosticCheck = {
    name: string
    ok: boolean
    details?: string
}

export type LinkedInAuthDiagnostic = {
    ok: boolean
    status: string
    identityConfig: string
    referenceConfig: string
    refreshConfig: string
    networkFilter: string
    message: string
    httpStatus?: number
    contentType?: string
    jsonCandidateCount?: number
    regexIdCount?: number
    checks: LinkedInAuthDiagnosticCheck[]
}

type ApiProfile = {
    id?: number
    email?: string
    email_app_password?: string
}

type ApiErrorBody = {
    description?: string
    error?: string
    message?: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000"
const CONFIG_URL = `${API_BASE_URL}/config`
const PROFILES_URL = `${API_BASE_URL}/profiles`

export const SCRAPER_CONFIGS = [
    {
        id: "pagination",
        title: "📄 Pagination Request",
        description: "Controls how we traverse the job list pages.",
        networkFilter: "jobCollectionSlug:recommended",
        placeholder: "Paste cURL with 'jobCollectionSlug' here...",
        colorClass: "blue",
        apiType: "pagination",
    },
    {
        id: "individual",
        title: "💼 Individual Job Request",
        description: "Controls how we fetch details for a single job card.",
        networkFilter: "jobPostingDetailDescription_start",
        placeholder: "Paste cURL with 'jobPostingDetailDescription' here...",
        colorClass: "purple",
        apiType: "individual",
    },
    {
        id: "experience",
        title: "🧩 Experience Request",
        description: "Controls how we fetch profile experience sections.",
        networkFilter: "sdui.pagers.profile.details.experience",
        placeholder: "Paste POST cURL with profile experience here...",
        colorClass: "green",
        apiType: "experience",
    },
    {
        id: "ProfileMain",
        title: "👤 Profile Main Request",
        description: "Base request used to load profile header and skills.",
        networkFilter: "/in/monicasbusatta/",
        placeholder: "Paste the profile base page GET cURL here...",
        colorClass: "orange",
        apiType: "generic",
    },
    {
        id: "ProfileAboveActivity",
        title: "⬆️ Profile Above Activity",
        description: "Loads About and profile summary data.",
        networkFilter: "profileCardsAboveActivity",
        placeholder: "Paste cURL containing 'profileCardsAboveActivity'...",
        colorClass: "teal",
        apiType: "generic",
    },
    {
        id: "ProfileBelowActivity",
        title: "⬇️ Profile Below Activity",
        description: "Loads experience, education, and licenses.",
        networkFilter: "profileCardsBelowActivityPart1",
        placeholder: "Paste cURL containing 'profileCardsBelowActivityPart1'...",
        colorClass: "rose",
        apiType: "generic",
    },
    {
        id: "Connections",
        title: "🤝 Connections Request",
        description: "Loads the paginated connections list.",
        networkFilter: "sdui.pagers.mynetwork.connectionsList",
        placeholder: "Paste the connectionsList POST cURL here...",
        colorClass: "purple",
        apiType: "connections",
    },
    {
        id: "SavedJobs",
        title: "📌 Saved Jobs Request",
        description: "Loads saved or applied jobs for the job tracker.",
        networkFilter: "/jobs-tracker/?stage=saved",
        placeholder: "Paste cURL containing '/jobs-tracker/?stage=saved'...",
        colorClass: "blue",
        apiType: "generic",
    },
    {
        id: "PremiumInsights",
        title: "💎 Premium Insights Request",
        description: "Loads premium applicant comparison insights.",
        networkFilter:
            "com.linkedin.sdui.generated.premium.dsl.impl.premiumApplicantInsights",
        placeholder: "Paste cURL containing 'premiumApplicantInsights'...",
        colorClass: "orange",
        apiType: "generic",
    },
    {
        id: "Notifications",
        title: "🔔 Notifications Request",
        description: "Loads notification cards for applications and networking.",
        networkFilter: "voyagerIdentityDashNotificationCards",
        placeholder: "Paste cURL containing 'voyagerIdentityDashNotificationCards'...",
        colorClass: "rose",
        apiType: "generic",
    },
    {
        id: "JobCardsLite",
        title: "⚡ Job Cards Lite Prefetch",
        description:
            "Captures nearby job card prefetch requests with lightweight metadata.",
        networkFilter: "voyagerJobsDashJobCards",
        placeholder: "Paste cURL containing 'voyagerJobsDashJobCards'...",
        colorClass: "teal",
        apiType: "generic",
    },
] satisfies ScraperConfigMeta[]

async function getApiErrorMessage(response: Response, fallback: string) {
    const contentType = response.headers.get("content-type") ?? ""

    if (contentType.includes("application/json")) {
        const body = await response.json().catch(() => null) as ApiErrorBody | null
        return body?.description ?? body?.error ?? body?.message ?? fallback
    }

    const text = await response.text().catch(() => "")
    return text || fallback
}

async function request<T>(url: string, options?: RequestInit, fallback = "Request failed"): Promise<T> {
    const response = await fetch(url, options)

    if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, fallback))
    }

    if (response.status === 204) return undefined as T

    const contentType = response.headers.get("content-type") ?? ""
    const text = await response.text()
    if (!text) return undefined as T

    if (contentType.includes("application/json")) {
        return JSON.parse(text) as T
    }

    return text as T
}

function normalizeConfigData(data: unknown): SavedScraperConfig | null {
    if (data == null) return null
    if (typeof data === "string") return {curl: data}

    if (typeof data === "object") {
        const record = data as Record<string, unknown>

        if ("curl" in record) {
            const curl = record.curl

            if (typeof curl === "string" || isRecord(curl)) {
                return {
                    curl,
                    savedAt: typeof record.savedAt === "string" ? record.savedAt : undefined,
                }
            }
        }

        return {curl: record}
    }

    return {curl: String(data)}
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function loadConfigSafe(config: ScraperConfigMeta): Promise<SavedScraperConfig | null> {
    try {
        return normalizeConfigData(await getScraperConfig(config))
    } catch {
        return null
    }
}

function getConfigPath(config: ScraperConfigMeta) {
    if (config.apiType === "pagination") return `${CONFIG_URL}/pagination-curl`
    if (config.apiType === "individual") return `${CONFIG_URL}/individual-job-curl`
    if (config.apiType === "experience") return `${CONFIG_URL}/experience`
    return `${CONFIG_URL}/curl/${config.id}`
}

async function getScraperConfig(config: ScraperConfigMeta) {
    return request<unknown>(getConfigPath(config), undefined, `Failed to load ${config.title}`)
}

function processCurlForConfig(config: ScraperConfigMeta, curl: string) {
    if (config.apiType !== "connections") return curl

    return curl.replace(/"startIndex"\s*:\s*\d+/g, '"startIndex":{START_INDEX}')
}

function maskToken(token: string) {
    const cleanToken = token.replace(/\s+/g, "")
    const suffix = cleanToken.slice(-4)

    if (!suffix) return "•••• •••• •••• ••••"

    return `•••• •••• •••• ${suffix}`
}

async function getProfiles() {
    return request<ApiProfile[]>(`${PROFILES_URL}/`, undefined, "Failed to fetch profiles")
}

export async function getFetchConfigData(): Promise<FetchConfigData> {
    const configsData: ScraperConfigsData = {}

    await Promise.all(
        SCRAPER_CONFIGS.map(async (config) => {
            configsData[config.id] = await loadConfigSafe(config)
        }),
    )

    const profiles = await getProfiles()
    const activeProfile = profiles[0]
    const profileId = activeProfile?.id ?? null
    const hasGmailToken = Boolean(activeProfile?.email_app_password)
    const gmail: GmailState = {
        status: hasGmailToken ? "connected" : "not_configured",
        profileId,
        profileEmail: activeProfile?.email ?? "",
        appPasswordPreview: hasGmailToken
            ? maskToken(activeProfile.email_app_password ?? "")
            : "•••• •••• •••• ••••",
    }

    return {
        scraperConfigs: SCRAPER_CONFIGS,
        configsData,
        gmail,
        profileId,
    }
}

export async function saveScraperConfig(
    config: ScraperConfigMeta,
    curl: string,
): Promise<SavedScraperConfig> {
    const processedCurl = processCurlForConfig(config, curl)

    if (
        config.apiType === "pagination" ||
        config.apiType === "individual" ||
        config.apiType === "experience"
    ) {
        await request<void>(
            getConfigPath(config),
            {
                method: "PUT",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({curl: processedCurl}),
            },
            `Failed to save ${config.title}`,
        )
    } else {
        await request<void>(
            getConfigPath(config),
            {
                method: "PUT",
                headers: {"Content-Type": "text/plain"},
                body: processedCurl,
            },
            `Failed to save ${config.title}`,
        )
    }

    return {
        curl: processedCurl,
        savedAt: new Date().toISOString(),
    }
}

export async function deleteScraperConfig(config: ScraperConfigMeta) {
    await request<void>(
        getConfigPath(config),
        {method: "DELETE"},
        `Failed to delete ${config.title}`,
    )
}

export async function saveGmailToken(profileId: number, token: string): Promise<GmailState> {
    await request<void>(
        `${PROFILES_URL}/${profileId}/smtp-password`,
        {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({email_app_password: token}),
        },
        "Failed to save Gmail token",
    )

    return {
        status: "connected",
        profileId,
        profileEmail: "",
        appPasswordPreview: maskToken(token),
    }
}

export async function testGmailConnection(profileId: number) {
    await request<void>(
        `${PROFILES_URL}/${profileId}/test-smtp`,
        {method: "POST"},
        "Failed to test Gmail connection",
    )

    return "✅ Test email sent. Check your inbox."
}

export async function diagnoseLinkedInAuth(): Promise<LinkedInAuthDiagnostic> {
    return request<LinkedInAuthDiagnostic>(
        `${CONFIG_URL}/linkedin-auth/diagnostics`,
        undefined,
        "Failed to run LinkedIn auth diagnostics",
    )
}
