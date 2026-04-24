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
    savedAt: string
}

export type ScraperConfigsData = Record<string, SavedScraperConfig | null>

export type GmailMockState = {
    status: "connected" | "not_configured"
    profileId: number
    profileEmail: string
    appPasswordPreview: string
}

export type FetchConfigMockData = {
    scraperConfigs: ScraperConfigMeta[]
    configsData: ScraperConfigsData
    gmail: GmailMockState
}

type FetchConfigMockStore = {
    configsData: ScraperConfigsData
    gmail: GmailMockState
}

const STORAGE_KEY = "new-frontend.fetch-config.mock.v1"

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

const DEFAULT_GMAIL: GmailMockState = {
    status: "connected",
    profileId: 1,
    profileEmail: "user@gmail.com",
    appPasswordPreview: "•••• •••• •••• ••••",
}

const delay = (milliseconds = 250) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds))

const createMockCurl = (
    config: ScraperConfigMeta,
    index: number,
): Record<string, unknown> => ({
    base_url: `https://www.linkedin.com/mock/${config.id}`,
    method: config.id === "ProfileMain" ? "GET" : "POST",
    network_filter: config.networkFilter,
    body: {
        queryId: `mock-query-${index + 1}`,
        apiType: config.apiType,
        variables: {
            start: config.apiType === "connections" ? "{START_INDEX}" : 0,
            count: 25,
            includeWebMetadata: true,
        },
    },
    headers: {
        Accept: "application/vnd.linkedin.normalized+json+2.1",
        "csrf-token": "ajax:mock-token",
    },
})

const createDefaultConfigsData = (): ScraperConfigsData =>
    SCRAPER_CONFIGS.reduce<ScraperConfigsData>((acc, config, index) => {
        acc[config.id] = {
            curl: createMockCurl(config, index),
            savedAt: new Date(Date.UTC(2026, 0, index + 1, 12, 0, 0)).toISOString(),
        }

        return acc
    }, {})

const createDefaultStore = (): FetchConfigMockStore => ({
    configsData: createDefaultConfigsData(),
    gmail: {...DEFAULT_GMAIL},
})

const getStorage = () => {
    if (typeof window === "undefined") return null

    try {
        return window.localStorage
    } catch {
        return null
    }
}

const readStore = (): FetchConfigMockStore => {
    const storage = getStorage()
    const defaultStore = createDefaultStore()

    if (!storage) return defaultStore

    const rawStore = storage.getItem(STORAGE_KEY)
    if (!rawStore) return defaultStore

    try {
        const parsedStore = JSON.parse(rawStore) as Partial<FetchConfigMockStore>

        return {
            configsData: {
                ...defaultStore.configsData,
                ...(parsedStore.configsData ?? {}),
            },
            gmail: {
                ...defaultStore.gmail,
                ...(parsedStore.gmail ?? {}),
            },
        }
    } catch {
        return defaultStore
    }
}

const writeStore = (store: FetchConfigMockStore) => {
    const storage = getStorage()
    if (!storage) return

    storage.setItem(STORAGE_KEY, JSON.stringify(store))
}

const processCurlForConfig = (config: ScraperConfigMeta, curl: string) => {
    if (config.apiType !== "connections") return curl

    return curl.replace(/"startIndex"\s*:\s*\d+/g, '"startIndex":{START_INDEX}')
}

const maskToken = (token: string) => {
    const cleanToken = token.replace(/\s+/g, "")
    const suffix = cleanToken.slice(-4)

    if (!suffix) return "•••• •••• •••• ••••"

    return `•••• •••• •••• ${suffix}`
}

export async function getFetchConfigMockData(): Promise<FetchConfigMockData> {
    await delay()

    const store = readStore()

    return {
        scraperConfigs: SCRAPER_CONFIGS,
        configsData: store.configsData,
        gmail: store.gmail,
    }
}

export async function saveScraperConfigMock(
    config: ScraperConfigMeta,
    curl: string,
): Promise<SavedScraperConfig> {
    await delay()

    const store = readStore()
    const savedConfig: SavedScraperConfig = {
        curl: processCurlForConfig(config, curl),
        savedAt: new Date().toISOString(),
    }

    store.configsData[config.id] = savedConfig
    writeStore(store)

    return savedConfig
}

export async function deleteScraperConfigMock(configId: string) {
    await delay()

    const store = readStore()
    store.configsData[configId] = null
    writeStore(store)
}

export async function saveGmailTokenMock(token: string): Promise<GmailMockState> {
    await delay()

    const store = readStore()
    store.gmail = {
        ...store.gmail,
        status: "connected",
        appPasswordPreview: maskToken(token),
    }

    writeStore(store)

    return store.gmail
}

export async function testGmailConnectionMock() {
    await delay(500)

    const store = readStore()

    if (store.gmail.status !== "connected") {
        throw new Error("Gmail SMTP is not configured.")
    }

    return "✅ Mock test email sent successfully."
}