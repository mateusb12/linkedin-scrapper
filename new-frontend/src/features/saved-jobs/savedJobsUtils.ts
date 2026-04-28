import type {SavedJob} from "./savedJobsMockService.ts"

export function normalizeSavedJobsText(value: string) {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
}

export function buildSavedJobSearchText(job: SavedJob) {
    return normalizeSavedJobsText(
        [
            job.title,
            job.company.name,
            job.location,
            job.workplaceType,
            job.description,
            job.seniority,
            job.jobType,
            job.experienceYears,
            job.statusLabel,
            job.insight,
            ...job.keywords,
        ].join(" "),
    )
}

export function cleanJobDescription(description: string) {
    return description
        .replace(/\r/g, "")
        .replace(/([a-z])([A-Z])/g, "$1\n$2")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

export function getScoreTone(score: number) {
    if (score >= 80) return "border-emerald-400/50 text-emerald-200"
    if (score >= 50) return "border-amber-400/50 text-amber-200"
    if (score > 0) return "border-red-400/50 text-red-200"
    return "border-gray-700 text-gray-500"
}

export function getCompactJobPayload(job: SavedJob, score: number) {
    return {
        id: job.jobId,
        title: job.title,
        company: job.company.name,
        location: job.location,
        workplaceType: job.workplaceType,
        applicantsTotal: job.applicantsTotal,
        postedAt: job.postedAt,
        score,
        seniority: job.seniority,
        jobType: job.jobType,
        experienceYears: job.experienceYears,
        keywords: job.keywords,
        url: job.jobUrl,
        description: cleanJobDescription(job.description),
    }
}
