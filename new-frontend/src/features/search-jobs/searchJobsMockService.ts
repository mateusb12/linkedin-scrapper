import { MOCKED_JOBS } from "./MOCKED_JOBS"
export type WorkplaceType = "Remote" | "Hybrid" | "On-site" | "Not specified"

export type JobCompany = {
    name: string
    logoUrl: string
    pageUrl: string
    websiteUrl?: string
}

export type ScoreSignal = {
    label: string
    points: number
    source: string
}

export type SearchJob = {
    id: string
    jobId: string
    title: string
    company: JobCompany
    location: string
    workplaceType: WorkplaceType
    postedAt: string
    applicantsTotal: number | null
    verified: boolean
    reposted: boolean
    sourceKey: string
    sourceLabel: string
    jobUrl: string
    description: string
    keywords: string[]
    seniority: string
    jobType: string
    experienceYears: string
    pythonScore: number
    aiScore: number
    archetype: string
    scoreBreakdown: {
        positive: ScoreSignal[]
        negative: ScoreSignal[]
        categoryTotals: Record<string, number>
    }
}

export type FetchJobsProgress = {
    step: "fetching" | "parsing" | "enriching" | "done"
    message: string
    current: number
    total: number
}

export type FetchJobsMockResult = {
    jobs: SearchJob[]
    cachedAt: string
    loadedFromCache: boolean
}

type JobsCachePayload = {
    jobs: SearchJob[]
    cachedAt: string
}

const JOBS_CACHE_KEY = "new-frontend.search-jobs.jobs.v1"
const SAVED_JOBS_CACHE_KEY = "new-frontend.search-jobs.saved.v1"

const wait = (milliseconds: number) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds))

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

const createCompany = (
    name: string,
    pageSlug: string,
    websiteUrl?: string,
): JobCompany => ({
    name,
    logoUrl: placeholderLogo(name),
    pageUrl: `https://www.linkedin.com/company/${pageSlug}/`,
    websiteUrl,
})

export const MOCK_SEARCH_JOBS: SearchJob[] = [
    {
        id: "job-001",
        jobId: "4405013761",
        title: "Senior Python Engineer",
        company: createCompany("ScrumLaunch", "scrumlaunch", "https://scrumlaunch.com"),
        location: "Brazil",
        workplaceType: "Remote",
        postedAt: "2026-04-23T14:36:00.000Z",
        applicantsTotal: 35,
        verified: true,
        reposted: false,
        sourceKey: "linkedin_search",
        sourceLabel: "LinkedIn Search",
        jobUrl: "https://www.linkedin.com/jobs/view/4405013761/",
        description:
            "We are looking for a Senior Python Engineer to build backend services, APIs, async workers and integrations. The role uses Python, Flask, FastAPI, Docker, PostgreSQL and SQL. Experience with clean architecture, production debugging and distributed integrations is welcome.",
        keywords: [
            "python",
            "flask",
            "fastapi",
            "docker",
            "postgresql",
            "sql",
            "backend",
            "api",
        ],
        seniority: "Sênior",
        jobType: "Backend",
        experienceYears: "6+ years",
        pythonScore: 80,
        aiScore: 80,
        archetype: "backend_python_pure",
        scoreBreakdown: {
            positive: [
                {
                    label: "Python is the core backend language",
                    points: 35,
                    source: "Title and description mention Python backend work.",
                },
                {
                    label: "Strong API and worker overlap",
                    points: 20,
                    source: "Description mentions APIs, async workers and integrations.",
                },
                {
                    label: "Relevant infrastructure stack",
                    points: 15,
                    source: "Docker, PostgreSQL and SQL are present.",
                },
            ],
            negative: [],
            categoryTotals: {
                python_primary: 35,
                backend_api: 20,
                database: 15,
                infrastructure: 10,
            },
        },
    },
    {
        id: "job-002",
        jobId: "4405013762",
        title: "Backend Python Developer",
        company: createCompany("DataForge Labs", "dataforge-labs", "https://example.com"),
        location: "São Paulo, Brazil",
        workplaceType: "Remote",
        postedAt: "2026-04-22T11:20:00.000Z",
        applicantsTotal: 18,
        verified: true,
        reposted: true,
        sourceKey: "saved_jobs",
        sourceLabel: "Saved Jobs",
        jobUrl: "https://www.linkedin.com/jobs/view/4405013762/",
        description:
            "Backend role focused on Python services, REST APIs, PostgreSQL, Redis, Celery and Docker. You will maintain data processing jobs, improve observability and work with product teams.",
        keywords: [
            "python",
            "postgresql",
            "redis",
            "celery",
            "docker",
            "rest",
            "observability",
        ],
        seniority: "Pleno/Sênior",
        jobType: "Backend",
        experienceYears: "4+ years",
        pythonScore: 74,
        aiScore: 74,
        archetype: "backend_python_with_minor_cross_functional_signals",
        scoreBreakdown: {
            positive: [
                {
                    label: "Python backend services",
                    points: 30,
                    source: "Role is explicitly focused on Python services.",
                },
                {
                    label: "Good database and async processing match",
                    points: 18,
                    source: "PostgreSQL, Redis and Celery are listed.",
                },
            ],
            negative: [
                {
                    label: "Some product-facing ambiguity",
                    points: -4,
                    source: "Description is not fully specific about ownership scope.",
                },
            ],
            categoryTotals: {
                python_primary: 30,
                backend_api: 18,
                async_processing: 16,
                observability: 10,
            },
        },
    },
    {
        id: "job-003",
        jobId: "4405013763",
        title: "Full Stack Engineer React + Python",
        company: createCompany("CloudBridge", "cloudbridge-tech", "https://example.com"),
        location: "Brazil",
        workplaceType: "Hybrid",
        postedAt: "2026-04-21T09:00:00.000Z",
        applicantsTotal: 62,
        verified: false,
        reposted: false,
        sourceKey: "linkedin_search",
        sourceLabel: "LinkedIn Search",
        jobUrl: "https://www.linkedin.com/jobs/view/4405013763/",
        description:
            "Full-stack role building React dashboards and Python APIs. Stack includes TypeScript, React, Python, FastAPI, PostgreSQL, Docker and CI/CD pipelines.",
        keywords: [
            "react",
            "typescript",
            "python",
            "fastapi",
            "postgresql",
            "docker",
            "ci/cd",
        ],
        seniority: "Sênior",
        jobType: "Full Stack",
        experienceYears: "5+ years",
        pythonScore: 66,
        aiScore: 66,
        archetype: "backend_python_fullstack",
        scoreBreakdown: {
            positive: [
                {
                    label: "Python API work exists",
                    points: 22,
                    source: "Description mentions Python APIs and FastAPI.",
                },
                {
                    label: "Frontend stack also matches",
                    points: 10,
                    source: "React and TypeScript are present.",
                },
            ],
            negative: [
                {
                    label: "Less backend-focused than pure backend roles",
                    points: -8,
                    source: "The role splits time with frontend dashboard work.",
                },
            ],
            categoryTotals: {
                python_primary: 22,
                frontend: 10,
                backend_api: 18,
                database: 10,
            },
        },
    },
    {
        id: "job-004",
        jobId: "4405013764",
        title: "Python Platform Engineer",
        company: createCompany("OpsLayer", "opslayer", "https://example.com"),
        location: "Brazil",
        workplaceType: "Remote",
        postedAt: "2026-04-20T18:10:00.000Z",
        applicantsTotal: 24,
        verified: true,
        reposted: false,
        sourceKey: "recommended",
        sourceLabel: "Recommended",
        jobUrl: "https://www.linkedin.com/jobs/view/4405013764/",
        description:
            "Platform engineering role using Python, Docker, Linux, observability, queues and internal tooling. You will improve reliability, debugging flows and developer experience.",
        keywords: [
            "python",
            "docker",
            "linux",
            "observability",
            "queues",
            "internal tools",
            "platform",
        ],
        seniority: "Sênior",
        jobType: "Platform",
        experienceYears: "5+ years",
        pythonScore: 70,
        aiScore: 70,
        archetype: "platform_or_internal_systems_python",
        scoreBreakdown: {
            positive: [
                {
                    label: "Python used for platform tooling",
                    points: 24,
                    source: "Description mentions Python and internal tooling.",
                },
                {
                    label: "Strong debugging and observability match",
                    points: 16,
                    source: "Reliability, debugging and observability are explicit.",
                },
            ],
            negative: [
                {
                    label: "Not a pure product backend role",
                    points: -5,
                    source: "Platform work may be more infra-heavy.",
                },
            ],
            categoryTotals: {
                python_primary: 24,
                platform: 18,
                observability: 16,
                infrastructure: 12,
            },
        },
    },
    {
        id: "job-005",
        jobId: "4405013765",
        title: "Senior PHP Laravel Developer",
        company: createCompany("LegacySoft", "legacysoft", "https://example.com"),
        location: "Brazil",
        workplaceType: "Remote",
        postedAt: "2026-04-19T13:45:00.000Z",
        applicantsTotal: 12,
        verified: false,
        reposted: true,
        sourceKey: "linkedin_search",
        sourceLabel: "LinkedIn Search",
        jobUrl: "https://www.linkedin.com/jobs/view/4405013765/",
        description:
            "Backend developer role focused on PHP, Laravel, MySQL and legacy maintenance. Some scripts may use Python occasionally, but the main stack is PHP.",
        keywords: ["php", "laravel", "mysql", "legacy", "backend"],
        seniority: "Sênior",
        jobType: "Backend",
        experienceYears: "6+ years",
        pythonScore: 18,
        aiScore: 18,
        archetype: "generic_backend_non_python",
        scoreBreakdown: {
            positive: [
                {
                    label: "Backend experience overlap",
                    points: 8,
                    source: "Backend maintenance is mentioned.",
                },
            ],
            negative: [
                {
                    label: "Primary stack is PHP/Laravel",
                    points: -30,
                    source: "Python is not the main technology.",
                },
            ],
            categoryTotals: {
                backend_api: 8,
                non_python_penalty: -30,
            },
        },
    },
    {
        id: "job-006",
        jobId: "4405013766",
        title: "AI Backend Engineer",
        company: createCompany("PromptWorks", "promptworks-ai", "https://example.com"),
        location: "Portugal",
        workplaceType: "Remote",
        postedAt: "2026-04-18T16:15:00.000Z",
        applicantsTotal: 91,
        verified: true,
        reposted: false,
        sourceKey: "recommended",
        sourceLabel: "Recommended",
        jobUrl: "https://www.linkedin.com/jobs/view/4405013766/",
        description:
            "Backend engineer working with Python, LLM APIs, queues, Postgres and evaluation pipelines. The role is still software engineering focused, not annotation work.",
        keywords: [
            "python",
            "llm",
            "backend",
            "postgres",
            "queues",
            "evaluation",
            "apis",
        ],
        seniority: "Sênior",
        jobType: "Backend / AI",
        experienceYears: "5+ years",
        pythonScore: 72,
        aiScore: 72,
        archetype: "ai_or_llm_python",
        scoreBreakdown: {
            positive: [
                {
                    label: "Python backend plus LLM APIs",
                    points: 28,
                    source: "Description mentions Python, backend and LLM APIs.",
                },
                {
                    label: "Software engineering ownership remains clear",
                    points: 12,
                    source: "Role says backend engineering, not annotation.",
                },
            ],
            negative: [
                {
                    label: "Evaluation pipeline wording needs review",
                    points: -3,
                    source: "Could drift toward AI evaluation depending on team.",
                },
            ],
            categoryTotals: {
                python_primary: 28,
                backend_api: 18,
                ai_llm: 16,
                database: 10,
            },
        },
    },
    {
        id: "job-007",
        jobId: "4405013767",
        title: "Junior Java Developer",
        company: createCompany("Enterprise Core", "enterprise-core", "https://example.com"),
        location: "Fortaleza, Brazil",
        workplaceType: "On-site",
        postedAt: "2026-04-17T10:05:00.000Z",
        applicantsTotal: 8,
        verified: false,
        reposted: false,
        sourceKey: "linkedin_search",
        sourceLabel: "LinkedIn Search",
        jobUrl: "https://www.linkedin.com/jobs/view/4405013767/",
        description:
            "Junior Java developer role focused on Spring Boot, Oracle databases and on-site support. No meaningful Python usage.",
        keywords: ["java", "spring", "oracle", "junior", "on-site"],
        seniority: "Júnior",
        jobType: "Backend",
        experienceYears: "1+ year",
        pythonScore: 8,
        aiScore: 8,
        archetype: "non_python_junior",
        scoreBreakdown: {
            positive: [],
            negative: [
                {
                    label: "Junior non-Python role",
                    points: -35,
                    source: "Title and stack are Java/Spring and junior-level.",
                },
            ],
            categoryTotals: {
                non_python_penalty: -25,
                seniority_penalty: -10,
            },
        },
    },
    {
        id: "job-008",
        jobId: "4405013768",
        title: "Python QA Automation Engineer",
        company: createCompany("QualityHub", "qualityhub", "https://example.com"),
        location: "Brazil",
        workplaceType: "Remote",
        postedAt: "2026-04-16T08:50:00.000Z",
        applicantsTotal: 41,
        verified: true,
        reposted: true,
        sourceKey: "saved_jobs",
        sourceLabel: "Saved Jobs",
        jobUrl: "https://www.linkedin.com/jobs/view/4405013768/",
        description:
            "Automation role using Python, pytest, Playwright, CI pipelines and API testing. Good Python usage, but the focus is QA automation rather than backend ownership.",
        keywords: ["python", "pytest", "playwright", "ci/cd", "api testing", "qa"],
        seniority: "Pleno",
        jobType: "QA Automation",
        experienceYears: "3+ years",
        pythonScore: 52,
        aiScore: 52,
        archetype: "qa_python",
        scoreBreakdown: {
            positive: [
                {
                    label: "Python automation stack",
                    points: 22,
                    source: "Python, pytest and Playwright are listed.",
                },
            ],
            negative: [
                {
                    label: "QA focus rather than backend product work",
                    points: -10,
                    source: "Role is centered on test automation.",
                },
            ],
            categoryTotals: {
                python_primary: 22,
                qa_automation: 18,
                backend_penalty: -10,
            },
        },
    },
]

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
    } catch {
        // Mock service only. Ignore storage failures.
    }
}

const readJobsCache = (): JobsCachePayload | null =>
    readJson<JobsCachePayload | null>(JOBS_CACHE_KEY, null)

const writeJobsCache = (jobs: SearchJob[]) => {
    const cachedAt = new Date().toISOString()
    writeJson(JOBS_CACHE_KEY, {jobs, cachedAt})

    return cachedAt
}

const buildSearchableText = (job: SearchJob) =>
    [
        job.title,
        job.company.name,
        job.location,
        job.workplaceType,
        job.sourceLabel,
        job.description,
        job.seniority,
        job.jobType,
        job.experienceYears,
        job.archetype,
        ...job.keywords,
    ]
        .join(" ")
        .toLowerCase()

const createGeneratedJob = (baseJob: SearchJob, index: number): SearchJob => {
    const postedAt = new Date(baseJob.postedAt)
    postedAt.setDate(postedAt.getDate() - index)

    const applicantsTotal =
        baseJob.applicantsTotal == null
            ? null
            : Math.max(3, baseJob.applicantsTotal + ((index * 7) % 45) - 12)

    return {
        ...baseJob,
        company: {...baseJob.company},
        id: `${baseJob.id}-mock-${index}`,
        jobId: `${baseJob.jobId}${index}`,
        title: `${baseJob.title} Mock ${index}`,
        postedAt: postedAt.toISOString(),
        applicantsTotal,
        pythonScore: Math.max(5, baseJob.pythonScore - (index % 12)),
        aiScore: Math.max(5, baseJob.aiScore - (index % 12)),
        reposted: index % 3 === 0 ? !baseJob.reposted : baseJob.reposted,
    }
}

const buildJobPool = (count: number, query: string) => {
    const targetCount = Math.max(count, MOCKED_JOBS.length)

    const pool = Array.from({length: targetCount}, (_, index) => {
        if (index < MOCKED_JOBS.length) return MOCKED_JOBS[index]

        const baseJob = MOCKED_JOBS[index % MOCKED_JOBS.length]
        return createGeneratedJob(baseJob, index - MOCKED_JOBS.length + 1)
    })

    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) return pool.slice(0, count)

    const filtered = pool.filter((job) =>
        buildSearchableText(job).includes(normalizedQuery),
    )

    return (filtered.length > 0 ? filtered : pool).slice(0, count)
}

export async function getInitialSearchJobsMockData(): Promise<FetchJobsMockResult> {
    await wait(180)

    const cached = readJobsCache()

    if (cached?.jobs?.length) {
        return {
            jobs: cached.jobs,
            cachedAt: cached.cachedAt,
            loadedFromCache: true,
        }
    }

    const jobs = MOCKED_JOBS
    const cachedAt = writeJobsCache(jobs)

    return {
        jobs,
        cachedAt,
        loadedFromCache: false,
    }
}

export async function fetchJobsMock({
                                        count,
                                        query,
                                        onProgress,
                                    }: {
    count: number
    query: string
    onProgress?: (progress: FetchJobsProgress) => void
}): Promise<FetchJobsMockResult> {
    const safeCount = Math.max(1, Math.min(count, 100))

    onProgress?.({
        step: "fetching",
        message: "Fetching mock LinkedIn jobs...",
        current: 0,
        total: safeCount,
    })

    await wait(350)

    onProgress?.({
        step: "parsing",
        message: "Parsing mock GraphQL payload...",
        current: 0,
        total: safeCount,
    })

    await wait(300)

    const jobs = buildJobPool(safeCount, query)

    for (let index = 0; index < jobs.length; index += 1) {
        onProgress?.({
            step: "enriching",
            message: "Scoring and enriching mock jobs...",
            current: index + 1,
            total: jobs.length,
        })

        await wait(25)
    }

    onProgress?.({
        step: "done",
        message: "Mock jobs loaded.",
        current: jobs.length,
        total: jobs.length,
    })

    const cachedAt = writeJobsCache(jobs)

    return {
        jobs,
        cachedAt,
        loadedFromCache: false,
    }
}

export function clearJobsCacheMock() {
    try {
        window.localStorage.removeItem(JOBS_CACHE_KEY)
    } catch {
        // Mock service only. Ignore storage failures.
    }
}

export function readSavedJobIdsMock() {
    return readJson<string[]>(SAVED_JOBS_CACHE_KEY, [])
}

export function toggleSavedJobMock(jobId: string) {
    const current = new Set(readSavedJobIdsMock())

    if (current.has(jobId)) {
        current.delete(jobId)
    } else {
        current.add(jobId)
    }

    const updated = [...current]
    writeJson(SAVED_JOBS_CACHE_KEY, updated)

    return updated
}