export type ApplicationStatus = "Waiting" | "Applied" | "Accepted" | "Refused"

export type LastEmail = {
    subject: string
    receivedAt: string
}

export type AppliedJob = {
    urn: string
    title: string
    company: string
    location: string
    workRemoteAllowed: boolean
    appliedAt: string
    postedAt?: string
    applicants: number
    applicantsVelocity: number
    applicationStatus: ApplicationStatus
    description: string
    lastEmail?: LastEmail
}

export type FetchAppliedJobsResult = {
    jobs: AppliedJob[]
}

export type SmartSyncResult = {
    syncedCount: number
}

export type BackfillProgressPayload = {
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
    inserted: number
    reason?: string
}

type BackfillStreamOptions = {
    from: string
    onProgress: (data: BackfillProgressPayload) => void
    onFinish: (data: BackfillFinishPayload) => void
    onError: (error: unknown) => void
}

function wait(ms: number) {
    return new Promise(resolve => {
        window.setTimeout(resolve, ms)
    })
}

function isoDaysAgo(days: number, hour = 12, minute = 0) {
    const date = new Date()
    date.setDate(date.getDate() - days)
    date.setHours(hour, minute, 0, 0)
    return date.toISOString()
}

let appliedJobs: AppliedJob[] = [
    {
        urn: "mock-applied-001",
        title: "Python Developer",
        company: "Vortigo Digital",
        location: "Brazil",
        workRemoteAllowed: true,
        appliedAt: isoDaysAgo(1, 13, 53),
        postedAt: isoDaysAgo(9, 9, 0),
        applicants: 1237,
        applicantsVelocity: 42,
        applicationStatus: "Waiting",
        description:
            "Python Developer position requiring Python, FastAPI, MongoDB, SQL and backend API development experience.",
    },
    {
        urn: "mock-applied-002",
        title: "Desenvolvedor(a) Full Stack (React + Python) - Pleno - 100% home office",
        company: "Motivus",
        location: "Brazil",
        workRemoteAllowed: true,
        appliedAt: isoDaysAgo(1, 12, 24),
        postedAt: isoDaysAgo(12, 10, 30),
        applicants: 1092,
        applicantsVelocity: 28,
        applicationStatus: "Waiting",
        description:
            "Pleno Full Stack role with 4 anos de experiência using Python, Django, FastAPI, React, TypeScript, Docker and REST APIs.",
    },
    {
        urn: "mock-applied-003",
        title: "Engenheiro de software",
        company: "BIX Tecnologia",
        location: "Brazil",
        workRemoteAllowed: true,
        appliedAt: isoDaysAgo(2, 19, 44),
        postedAt: isoDaysAgo(3, 8, 0),
        applicants: 454,
        applicantsVelocity: 16,
        applicationStatus: "Waiting",
        description:
            "Software engineering opportunity using Python, JavaScript, TypeScript, SQL, data integrations and web application development.",
    },
    {
        urn: "mock-applied-004",
        title: "Full Stack Engineer",
        company: "Sigma Software Group",
        location: "Brasília, Brazil",
        workRemoteAllowed: true,
        appliedAt: isoDaysAgo(2, 19, 43),
        postedAt: isoDaysAgo(25, 14, 0),
        applicants: 120,
        applicantsVelocity: 4,
        applicationStatus: "Refused",
        description:
            "Senior Full Stack Engineer role requiring 5+ years with Python, JavaScript, TypeScript, React, FastAPI, PostgreSQL, Docker and cloud services.",
        lastEmail: {
            subject: "Thank you for your interest in Sigma Software",
            receivedAt: isoDaysAgo(0, 9, 18),
        },
    },
    {
        urn: "mock-applied-005",
        title: "Python Developer - Work from home - Talent Connection",
        company: "Nortal",
        location: "Brazil",
        workRemoteAllowed: true,
        appliedAt: isoDaysAgo(2, 19, 39),
        postedAt: isoDaysAgo(3, 13, 0),
        applicants: 25,
        applicantsVelocity: 2,
        applicationStatus: "Waiting",
        description:
            "Senior Python Developer position with Django, SQL, PostgreSQL, APIs, integrations and backend services. 5+ anos de experiência.",
    },
    {
        urn: "mock-applied-006",
        title: "Backend Python Engineer",
        company: "Quik Hire Staffing",
        location: "Remote",
        workRemoteAllowed: true,
        appliedAt: isoDaysAgo(3, 15, 5),
        postedAt: isoDaysAgo(2, 11, 0),
        applicants: 87,
        applicantsVelocity: 9,
        applicationStatus: "Applied",
        description:
            "Backend Python Engineer role focused on Python, FastAPI, PostgreSQL, Docker, REST APIs, background jobs and integration workflows.",
    },
    {
        urn: "mock-applied-007",
        title: "React Native + Python Developer",
        company: "Blue Ocean Systems",
        location: "São Paulo, Brazil",
        workRemoteAllowed: true,
        appliedAt: isoDaysAgo(4, 10, 12),
        postedAt: isoDaysAgo(16, 9, 0),
        applicants: 311,
        applicantsVelocity: 7,
        applicationStatus: "Waiting",
        description:
            "Full Stack Developer role with React Native, React, Python, Django, TypeScript, mobile applications and REST API integrations.",
    },
    {
        urn: "mock-applied-008",
        title: "Software Developer",
        company: "DataForge Labs",
        location: "Remote",
        workRemoteAllowed: true,
        appliedAt: isoDaysAgo(6, 17, 31),
        postedAt: isoDaysAgo(41, 9, 0),
        applicants: 63,
        applicantsVelocity: 0,
        applicationStatus: "Accepted",
        description:
            "Software Developer role using Python, Node.js, TypeScript, MongoDB, PostgreSQL, Docker and cloud-based application development.",
        lastEmail: {
            subject: "Next steps for your application",
            receivedAt: isoDaysAgo(1, 16, 20),
        },
    },
]

export async function fetchAppliedJobs(): Promise<FetchAppliedJobsResult> {
    await wait(350)

    return {
        jobs: [...appliedJobs].sort(
            (a, b) =>
                new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
        ),
    }
}

export async function syncAppliedSmart(): Promise<SmartSyncResult> {
    await wait(900)

    const alreadyExists = appliedJobs.some(job => job.urn === "mock-smart-sync-001")

    if (alreadyExists) {
        return {
            syncedCount: 0,
        }
    }

    appliedJobs = [
        {
            urn: "mock-smart-sync-001",
            title: "Python Full Stack Engineer",
            company: "Mock Sync Company",
            location: "Remote",
            workRemoteAllowed: true,
            appliedAt: new Date().toISOString(),
            postedAt: isoDaysAgo(1, 9, 30),
            applicants: 34,
            applicantsVelocity: 11,
            applicationStatus: "Waiting",
            description:
                "Python Full Stack Engineer role with FastAPI, React, TypeScript, PostgreSQL, Docker and API integrations. Pleno position.",
        },
        ...appliedJobs,
    ]

    return {
        syncedCount: 1,
    }
}

export function syncAppliedBackfillStream({
                                              from,
                                              onProgress,
                                              onFinish,
                                              onError,
                                          }: BackfillStreamOptions) {
    const mockProgress: BackfillProgressPayload[] = [
        {
            processed: 1,
            company: "Vortigo Digital",
            title: "Python Developer",
            diff: {
                applicants: {
                    from: 1201,
                    to: 1237,
                    delta: 36,
                },
            },
        },
        {
            processed: 2,
            company: "Motivus",
            title: "Full Stack React + Python",
            diff: {
                applicants: {
                    from: 1044,
                    to: 1092,
                    delta: 48,
                },
            },
        },
        {
            processed: 3,
            company: "Sigma Software Group",
            title: "Full Stack Engineer",
            diff: {
                jobState: {
                    from: "active",
                    to: "reviewed",
                },
            },
        },
    ]

    let index = 0

    try {
        const intervalId = window.setInterval(() => {
            const payload = mockProgress[index]

            if (!payload) {
                window.clearInterval(intervalId)

                appliedJobs = [
                    ...appliedJobs,
                    {
                        urn: `mock-backfill-${Date.now()}`,
                        title: "Backfilled Python API Developer",
                        company: "Historical Mock Company",
                        location: "Remote",
                        workRemoteAllowed: true,
                        appliedAt: isoDaysAgo(18, 11, 10),
                        postedAt: isoDaysAgo(22, 8, 0),
                        applicants: 76,
                        applicantsVelocity: 0,
                        applicationStatus: "Waiting",
                        description: `Backfilled from ${from}. Python API Developer role with FastAPI, SQL, Docker and backend integrations.`,
                    },
                ]

                onFinish({
                    inserted: 1,
                    reason: `mock cutoff ${from}`,
                })

                return
            }

            onProgress(payload)
            index += 1
        }, 700)
    } catch (error) {
        onError(error)
    }
}

export function formatDateBR(value: string) {
    const date = new Date(value)

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
    const date = new Date(value)

    const hour = String(date.getHours()).padStart(2, "0")
    const minute = String(date.getMinutes()).padStart(2, "0")

    return `${hour}:${minute}`
}

export function calculateJobAge(postedAt: string) {
    const posted = new Date(postedAt)
    const now = new Date()

    const diffMs = now.getTime() - posted.getTime()
    const days = Math.floor(diffMs / 86_400_000)

    return Math.max(days, 0)
}

export function formatTimeAgo(value: string) {
    const date = new Date(value)
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