import {MOCKED_JOBS} from "../mock-jobs/MOCKED_JOBS"
import type {SearchJob} from "../search-jobs/searchJobsService.ts"

export type SavedJobsTab = "saved" | "applied" | "in_progress" | "archived"

export type SavedJob = SearchJob & {
    tab: SavedJobsTab
    statusLabel: string
    insight: string
    savedAt: string
}

export type SavedJobScoreMap = Record<string, number>

export type MockResume = {
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

const SAVED_JOBS_SCORE_KEY = "linkedin_job_scores"
const SAVED_JOBS_CACHE_PREFIX = "new-frontend.saved-jobs.tab"

const wait = (milliseconds: number) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds))

function getCacheKey(tab: SavedJobsTab) {
    return `${SAVED_JOBS_CACHE_PREFIX}.${tab}.v1`
}

function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = window.localStorage.getItem(key)
        return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
        return fallback
    }
}

function writeJson<T>(key: string, value: T) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
        // Mock service only. Ignore storage failures.
    }
}

function withTab(job: SearchJob, tab: SavedJobsTab, index: number): SavedJob {
    const statusByTab: Record<SavedJobsTab, string> = {
        saved: index % 3 === 0 ? "Recently saved" : "Saved for review",
        applied: index % 2 === 0 ? "Applied" : "Recruiter viewed",
        in_progress: index % 2 === 0 ? "Interview loop" : "Take-home pending",
        archived: index % 2 === 0 ? "No longer active" : "Archived locally",
    }

    const insightByTab: Record<SavedJobsTab, string> = {
        saved: "Good candidate for score review before applying.",
        applied: "Application submitted from saved jobs workflow.",
        in_progress: "Process is active; compare against resume context.",
        archived: "Kept for historical comparison and prompt examples.",
    }

    return {
        ...job,
        id: `${tab}-${job.id}`,
        jobId: job.jobId,
        tab,
        statusLabel: statusByTab[tab],
        insight: insightByTab[tab],
        savedAt: new Date(Date.now() - (index + 1) * 7_200_000).toISOString(),
    }
}

function buildTabJobs(tab: SavedJobsTab) {
    const sourceJobs = MOCKED_JOBS as SearchJob[]
    const offsetByTab: Record<SavedJobsTab, number> = {
        saved: 0,
        applied: 2,
        in_progress: 4,
        archived: 6,
    }

    const countByTab: Record<SavedJobsTab, number> = {
        saved: 9,
        applied: 6,
        in_progress: 5,
        archived: 5,
    }

    const offset = offsetByTab[tab]
    const count = countByTab[tab]

    return Array.from({length: count}, (_, index) => {
        const sourceIndex = (offset + index) % sourceJobs.length
        return withTab(sourceJobs[sourceIndex], tab, index)
    })
}

export async function fetchSavedJobsMock(tab: SavedJobsTab): Promise<SavedJob[]> {
    await wait(180)

    const cachedJobs = readJson<SavedJob[] | null>(getCacheKey(tab), null)
    if (cachedJobs) return cachedJobs

    const jobs = buildTabJobs(tab)
    writeJson(getCacheKey(tab), jobs)

    return jobs
}

export async function refreshSavedJobsMock(tab: SavedJobsTab): Promise<SavedJob[]> {
    await wait(260)

    const jobs = buildTabJobs(tab)
    writeJson(getCacheKey(tab), jobs)

    return jobs
}

export function clearSavedJobsCacheMock(tab: SavedJobsTab) {
    try {
        window.localStorage.removeItem(getCacheKey(tab))
    } catch {
        // Mock service only. Ignore storage failures.
    }
}

export function readSavedJobScoresMock(): SavedJobScoreMap {
    return readJson<SavedJobScoreMap>(SAVED_JOBS_SCORE_KEY, {})
}

export function saveSavedJobScoreMock(jobId: string, score: number): SavedJobScoreMap {
    const scores = readSavedJobScoresMock()
    const nextScores = {
        ...scores,
        [jobId]: Math.max(0, Math.min(100, Math.round(score))),
    }

    writeJson(SAVED_JOBS_SCORE_KEY, nextScores)

    return nextScores
}

export async function fetchMockResumes(): Promise<MockResume[]> {
    await wait(120)

    return [
        {
            id: 1,
            name: "Backend Python Resume",
            language: "en",
            headline: "Python backend engineer focused on APIs, data workflows and production systems.",
            content: {
                summary:
                    "Backend software engineer with hands-on experience building Python services, REST APIs, SQL-backed applications, automations and integrations for production workflows.",
                skills: [
                    "Python",
                    "FastAPI",
                    "Flask",
                    "Django",
                    "SQL",
                    "PostgreSQL",
                    "Docker",
                    "AWS",
                    "REST APIs",
                    "Async workers",
                ],
                experience: [
                    {
                        role: "Python Backend Developer",
                        company: "Independent projects",
                        period: "2022 - 2026",
                        highlights: [
                            "Built backend services and automation tools with Python, SQL and external APIs.",
                            "Designed data parsing, enrichment and reporting workflows for real business operations.",
                            "Worked with containerized local environments and production-oriented debugging.",
                        ],
                    },
                ],
                education: ["Software engineering and continuous backend systems practice."],
            },
        },
        {
            id: 2,
            name: "Curriculo Backend PT",
            language: "pt",
            headline: "Desenvolvedor backend Python com foco em APIs, SQL e automacoes.",
            content: {
                summary:
                    "Desenvolvedor de software backend com experiencia pratica em servicos Python, APIs REST, bancos SQL, automacoes e integracoes para fluxos em producao.",
                skills: [
                    "Python",
                    "FastAPI",
                    "Flask",
                    "Django",
                    "SQL",
                    "PostgreSQL",
                    "Docker",
                    "AWS",
                    "APIs REST",
                    "Workers async",
                ],
                experience: [
                    {
                        role: "Desenvolvedor Backend Python",
                        company: "Projetos independentes",
                        period: "2022 - 2026",
                        highlights: [
                            "Construiu servicos backend e ferramentas de automacao com Python, SQL e APIs externas.",
                            "Desenhou fluxos de parsing, enriquecimento e relatorios para operacoes reais.",
                            "Trabalhou com ambientes conteinerizados e debugging orientado a producao.",
                        ],
                    },
                ],
                education: ["Engenharia de software e pratica continua em sistemas backend."],
            },
        },
    ]
}
