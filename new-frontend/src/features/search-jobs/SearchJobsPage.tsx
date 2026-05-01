import {
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type FormEvent,
    type SetStateAction,
} from "react"
import {Briefcase} from "lucide-react"

import SearchJobsFilters, {
    type SelectOption,
    type SortOption,
    type VerificationFilter,
} from "./SearchJobsFilters.tsx"

import {
    clearJobsCache,
    type SearchJobsProgress,
    getInitialSearchJobsData,
    readJobsCache,
    readSavedJobIds,
    scoreJobsBatch,
    type SearchJob,
    type SearchJobsMeta,
    streamGraphqlJobsWithMeta,
    toggleSavedJob,
    writeJobsCache,
    type StreamBackendError,
} from "./searchJobsService.ts"

import {
    FetchJobsModal,
    JobListInsideFilters,
    PrefilterAuditPanel,
    SelectedJobPreview,
    type JobView,
} from "./SearchJobsParts.tsx"


const DEFAULT_POSITIVE_KEYWORDS = [
    "python",
    "sql",
    "flask",
    "fastapi",
    "postgresql",
    "django",
    "backend",
]

const DEFAULT_MUST_HAVE_KEYWORDS = ["python"]
const DEFAULT_NEGATIVE_KEYWORDS = ["php"]
const DEFAULT_LINKEDIN_EXCLUDED_KEYWORDS = [
    "estágio",
    "estagio",
    "junior",
    "júnior",
    "senior",
    "sênior",
]

type SearchJobsFilterCache = {
    positiveKeywords?: string[]
    mustHaveKeywords?: string[]
    negativeKeywords?: string[]
    negativeCompanies?: string[]
    excludedWorkplaceTypes?: string[]
    maxApplicantsLimit?: number
    showHiddenJobs?: boolean
}

const SEARCH_JOBS_FILTER_CACHE_KEY = "new-frontend.search-jobs.filters.v1"

const readSearchJobsFilterCache = (): SearchJobsFilterCache => {
    try {
        const raw = window.localStorage.getItem(SEARCH_JOBS_FILTER_CACHE_KEY)
        if (!raw) return {}

        const parsed = JSON.parse(raw) as SearchJobsFilterCache
        return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
        return {}
    }
}

const writeSearchJobsFilterCache = (value: SearchJobsFilterCache) => {
    try {
        window.localStorage.setItem(
            SEARCH_JOBS_FILTER_CACHE_KEY,
            JSON.stringify(value),
        )
    } catch (error) {
        console.warn("Failed to write search jobs filter cache.", error)
    }
}

const getCachedStringArray = (
    value: unknown,
    fallback: string[] = [],
    useFallbackWhenEmpty = false,
) => {
    if (!Array.isArray(value)) return fallback

    const cleaned = unique(
        value.filter((item): item is string => typeof item === "string"),
    )

    return cleaned.length > 0 || !useFallbackWhenEmpty ? cleaned : fallback
}

const normalizeText = (value: string) =>
    value
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")

const unique = (values: string[]) =>
    [...new Set(values.map((value) => value.trim()).filter(Boolean))]

const buildSearchableText = (job: SearchJob) =>
    normalizeText(
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
        ].join(" "),
    )


const normalizeMatchText = (value: string) =>
    normalizeText(value).replace(/\s+/g, " ").trim()

const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const keywordMatchesText = (text: string, keyword: string) => {
    const normalizedText = normalizeMatchText(text)
    const normalizedKeyword = normalizeMatchText(keyword)

    if (!normalizedKeyword) return false

    const pattern = new RegExp(
        `(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}(?=$|[^a-z0-9])`,
        "i",
    )

    return pattern.test(normalizedText)
}

const buildStrictKeywordText = (job: SearchJob) =>
    [
        job.title,
        job.description,
        job.description_full,
        job.description_snippet,
        job.premium_title,
        job.premium_description,
        ...(Array.isArray(job.raw?.qualifications) ? job.raw.qualifications : []),
        ...(Array.isArray(job.raw?.responsibilities) ? job.raw.responsibilities : []),
        ...(Array.isArray(job.raw?.programming_languages)
            ? job.raw.programming_languages
            : []),
    ]
        .filter((item): item is string => typeof item === "string")
        .join(" ")

const buildUniqueOptions = (
    values: Array<{ value: string; label: string }>,
): SelectOption[] => {
    const map = new Map<string, string>()

    values.forEach((option) => {
        if (!map.has(option.value)) {
            map.set(option.value, option.label)
        }
    })

    return [...map.entries()]
        .map(([value, label]) => ({value, label}))
        .sort((a, b) => a.label.localeCompare(b.label))
}

type EvaluateSearchJobsInput = {
    jobs: SearchJob[]
    searchTerm: string
    verificationFilter: VerificationFilter
    sourceFilter: string
    positiveKeywords: string[]
    negativeKeywords: string[]
    mustHaveKeywords: string[]
    negativeCompanies: string[]
    excludedWorkplaceTypes: string[]
    maxApplicantsLimit: number
    savedIds: string[]
}

const evaluateSearchJobs = ({
                                jobs,
                                searchTerm,
                                verificationFilter,
                                sourceFilter,
                                positiveKeywords,
                                negativeKeywords,
                                mustHaveKeywords,
                                negativeCompanies,
                                excludedWorkplaceTypes,
                                maxApplicantsLimit,
                                savedIds,
                            }: EvaluateSearchJobsInput): JobView[] => {
    const normalizedSearchTerm = normalizeText(searchTerm.trim())
    const savedIdSet = new Set(savedIds)
    const negativeCompanySet = new Set(negativeCompanies)
    const excludedWorkplaceSet = new Set(excludedWorkplaceTypes)

    return jobs
        .map((job) => {
            const searchableText = buildSearchableText(job)
            const strictKeywordText = buildStrictKeywordText(job)

            const matchesSearch =
                !normalizedSearchTerm || searchableText.includes(normalizedSearchTerm)

            const matchesVerification =
                verificationFilter === "All" ||
                (verificationFilter === "Verified" && job.verified) ||
                (verificationFilter === "Unverified" && !job.verified)

            const matchesSource =
                sourceFilter === "All" || job.sourceKey === sourceFilter

            if (!matchesSearch || !matchesVerification || !matchesSource) {
                return null
            }

            const matchedPositiveKeywords = unique(
                positiveKeywords.filter((keyword) =>
                    keywordMatchesText(searchableText, keyword),
                ),
            )

            const matchedNegativeKeywords = unique(
                negativeKeywords.filter((keyword) =>
                    keywordMatchesText(strictKeywordText, keyword),
                ),
            )

            const missingMustHaveKeywords = unique(
                mustHaveKeywords.filter(
                    (keyword) => !keywordMatchesText(strictKeywordText, keyword),
                ),
            )

            const hiddenReasons: string[] = []

            if (missingMustHaveKeywords.length > 0) {
                hiddenReasons.push(`Missing: ${missingMustHaveKeywords.join(", ")}`)
            }

            if (matchedNegativeKeywords.length > 0) {
                hiddenReasons.push(`Negative: ${matchedNegativeKeywords.join(", ")}`)
            }

            if (negativeCompanySet.has(job.company.name)) {
                hiddenReasons.push("Company excluded")
            }

            if (excludedWorkplaceSet.has(job.workplaceType)) {
                hiddenReasons.push("Workplace excluded")
            }

            if (
                maxApplicantsLimit !== Number.MAX_SAFE_INTEGER &&
                job.applicantsTotal != null &&
                job.applicantsTotal > maxApplicantsLimit
            ) {
                hiddenReasons.push(`>${maxApplicantsLimit} applicants`)
            }

            const visibleScore = Math.max(
                0,
                Math.min(
                    100,
                    Math.round(
                        job.pythonScore +
                        matchedPositiveKeywords.length * 2 -
                        matchedNegativeKeywords.length * 8 -
                        missingMustHaveKeywords.length * 12,
                    ),
                ),
            )

            return {
                ...job,
                isSaved: savedIdSet.has(job.jobId),
                visibleScore,
                isHidden: hiddenReasons.length > 0,
                hiddenReasons,
                matchedPositiveKeywords,
                matchedNegativeKeywords,
                missingMustHaveKeywords,
            }
        })
        .filter((job): job is JobView => Boolean(job))
}

const sortSearchJobs = (jobs: JobView[], sortBy: SortOption) => {
    const sortableJobs = [...jobs]

    sortableJobs.sort((a, b) => {
        switch (sortBy) {
            case "keywordScore":
                return b.keywords.length - a.keywords.length
            case "pythonScore":
                return b.pythonScore - a.pythonScore
            case "recent":
                return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
            case "applicants":
                return (
                    (a.applicantsTotal ?? Number.MAX_SAFE_INTEGER) -
                    (b.applicantsTotal ?? Number.MAX_SAFE_INTEGER)
                )
            case "title":
                return a.title.localeCompare(b.title)
            case "company":
                return a.company.name.localeCompare(b.company.name)
            case "relevance":
            default:
                return (
                    b.visibleScore - a.visibleScore ||
                    new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
                )
        }
    })

    return sortableJobs
}

type StringListSetter = Dispatch<SetStateAction<string[]>>

const updateKeywordList = (
    event: FormEvent<HTMLFormElement>,
    keyword: string,
    setKeyword: (value: string) => void,
    setKeywords: StringListSetter,
) => {
    event.preventDefault()

    const normalizedKeyword = normalizeText(keyword.trim())
    if (!normalizedKeyword) return

    setKeywords((current) => unique([...current, normalizedKeyword]))
    setKeyword("")
}

const toggleStringInList = (
    setItems: StringListSetter,
    value: string,
) => {
    setItems((current) =>
        current.includes(value)
            ? current.filter((item) => item !== value)
            : [...current, value],
    )
}

const removeStringFromList = (
    setItems: StringListSetter,
    value: string,
) => {
    setItems((current) => current.filter((item) => item !== value))
}

const buildLinkedInSearchParams = (
    fetchQuery: string,
    mustHaveKeywords: string[],
    negativeKeywords: string[],
) => {
    const keywords = fetchQuery.trim() || unique(mustHaveKeywords).join(" ") || "python"
    const excludedKeywordList = unique([
        ...DEFAULT_LINKEDIN_EXCLUDED_KEYWORDS,
        ...negativeKeywords,
    ])

    return {
        keywords,
        excludedKeywordList,
        excludedKeywords: excludedKeywordList.join(","),
    }
}

export default function SearchJobsPage() {
    const [jobs, setJobs] = useState<SearchJob[]>([])
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
    const [filterCache] = useState(() => readSearchJobsFilterCache())

    const [searchTerm, setSearchTerm] = useState("")
    const [verificationFilter, setVerificationFilter] =
        useState<VerificationFilter>("All")
    const [sourceFilter, setSourceFilter] = useState("All")
    const [sortBy, setSortBy] = useState<SortOption>("relevance")

    const [positiveKeywords, setPositiveKeywords] = useState(() =>
        getCachedStringArray(
            filterCache.positiveKeywords,
            DEFAULT_POSITIVE_KEYWORDS,
            true,
        ),
    )
    const [newPositiveKeyword, setNewPositiveKeyword] = useState("")

    const [mustHaveKeywords, setMustHaveKeywords] = useState(() =>
        getCachedStringArray(
            filterCache.mustHaveKeywords,
            DEFAULT_MUST_HAVE_KEYWORDS,
            true,
        ),
    )
    const [newMustHaveKeyword, setNewMustHaveKeyword] = useState("")

    const [negativeKeywords, setNegativeKeywords] = useState(() =>
        getCachedStringArray(
            filterCache.negativeKeywords,
            DEFAULT_NEGATIVE_KEYWORDS,
            true,
        ),
    )
    const [newNegativeKeyword, setNewNegativeKeyword] = useState("")

    const [negativeCompanies, setNegativeCompanies] = useState<string[]>(() =>
        getCachedStringArray(filterCache.negativeCompanies),
    )
    const [excludedWorkplaceTypes, setExcludedWorkplaceTypes] = useState<string[]>(() =>
        getCachedStringArray(filterCache.excludedWorkplaceTypes),
    )
    const [maxApplicantsLimit, setMaxApplicantsLimit] = useState(() =>
        typeof filterCache.maxApplicantsLimit === "number"
            ? filterCache.maxApplicantsLimit
            : Number.MAX_SAFE_INTEGER,
    )
    const [showHiddenJobs, setShowHiddenJobs] = useState(() =>
        typeof filterCache.showHiddenJobs === "boolean"
            ? filterCache.showHiddenJobs
            : false,
    )

    const [savedIds, setSavedIds] = useState<string[]>(() => readSavedJobIds())

    const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null)
    const [searchMeta, setSearchMeta] = useState<SearchJobsMeta | null>(null)
    const [loadedFromCache, setLoadedFromCache] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const [isFetchModalOpen, setIsFetchModalOpen] = useState(false)
    const [fetchCount, setFetchCount] = useState(75)
    const [fetchQuery, setFetchQuery] = useState("")
    const [fetchProgress, setFetchProgress] = useState<SearchJobsProgress | null>(null)

    useEffect(() => {
        let isMounted = true

        async function loadInitialJobs() {
            setLoading(true)
            setErrorMessage(null)

            try {
                const result = getInitialSearchJobsData()

                if (!isMounted) return

                setJobs(result.jobs)
                setCacheTimestamp(result.cachedAt)
                setSearchMeta(result.meta)
                setLoadedFromCache(result.loadedFromCache)
            } catch (error) {
                if (!isMounted) return

                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Could not load cached jobs.",
                )
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        void loadInitialJobs()

        return () => {
            isMounted = false
        }
    }, [])

    useEffect(() => {
        writeSearchJobsFilterCache({
            positiveKeywords,
            mustHaveKeywords,
            negativeKeywords,
            negativeCompanies,
            excludedWorkplaceTypes,
            maxApplicantsLimit,
            showHiddenJobs,
        })
    }, [
        positiveKeywords,
        mustHaveKeywords,
        negativeKeywords,
        negativeCompanies,
        excludedWorkplaceTypes,
        maxApplicantsLimit,
        showHiddenJobs,
    ])

    const maxPossibleApplicants = useMemo(() => {
        const applicants = jobs
            .map((job) => job.applicantsTotal ?? 0)
            .filter((value) => Number.isFinite(value))

        return Math.max(0, ...applicants)
    }, [jobs])

    const sourceOptions = useMemo(
        () =>
            buildUniqueOptions(
                jobs.map((job) => ({
                    value: job.sourceKey,
                    label: job.sourceLabel,
                })),
            ),
        [jobs],
    )

    const companyOptions = useMemo(
        () =>
            buildUniqueOptions(
                jobs.map((job) => ({
                    value: job.company.name,
                    label: job.company.name,
                })),
            ),
        [jobs],
    )

    const workplaceOptions = useMemo(
        () =>
            buildUniqueOptions(
                jobs.map((job) => ({
                    value: job.workplaceType,
                    label: job.workplaceType,
                })),
            ),
        [jobs],
    )

    const evaluatedJobs = useMemo<JobView[]>(
        () =>
            evaluateSearchJobs({
                jobs,
                searchTerm,
                verificationFilter,
                sourceFilter,
                positiveKeywords,
                negativeKeywords,
                mustHaveKeywords,
                negativeCompanies,
                excludedWorkplaceTypes,
                maxApplicantsLimit,
                savedIds,
            }),
        [
            jobs,
            searchTerm,
            verificationFilter,
            sourceFilter,
            positiveKeywords,
            negativeKeywords,
            mustHaveKeywords,
            negativeCompanies,
            excludedWorkplaceTypes,
            maxApplicantsLimit,
            savedIds,
        ],
    )

    const sortedJobs = useMemo(
        () => sortSearchJobs(evaluatedJobs, sortBy),
        [evaluatedJobs, sortBy],
    )

    const visibleJobs = useMemo(
        () => (showHiddenJobs ? sortedJobs : sortedJobs.filter((job) => !job.isHidden)),
        [showHiddenJobs, sortedJobs],
    )

    const hiddenCount = useMemo(
        () => sortedJobs.filter((job) => job.isHidden).length,
        [sortedJobs],
    )

    const savedCount = useMemo(
        () => jobs.filter((job) => savedIds.includes(job.jobId)).length,
        [jobs, savedIds],
    )

    const selectedJob = useMemo(
        () =>
            visibleJobs.find((job) => job.id === selectedJobId) ??
            visibleJobs[0] ??
            null,
        [selectedJobId, visibleJobs],
    )

    const fetchRequestPreview = useMemo(() => {
        const searchParams = buildLinkedInSearchParams(
            fetchQuery,
            mustHaveKeywords,
            negativeKeywords,
        )
        const backendNegativeKeywords = unique([
            ...DEFAULT_LINKEDIN_EXCLUDED_KEYWORDS,
            ...negativeKeywords,
        ])

        return {
            linkedinKeywords: searchParams.keywords,
            linkedinExcludedKeywords: searchParams.excludedKeywordList,
            effectiveLinkedinQuery: [
                searchParams.keywords,
                ...searchParams.excludedKeywordList.map((keyword) => `NOT ${keyword}`),
            ].join(" "),
            prefilterMustHaveKeywords: mustHaveKeywords,
            prefilterNegativeKeywords: backendNegativeKeywords,
            prefilterNegativeCompanies: negativeCompanies,
            geoId: "106057199",
            distance: 25,
            dropPrefiltered: true,
        }
    }, [fetchQuery, mustHaveKeywords, negativeKeywords, negativeCompanies])

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            if (!selectedJob) {
                setSelectedJobId(null)
                return
            }

            if (selectedJob.id !== selectedJobId) {
                setSelectedJobId(selectedJob.id)
            }
        }, 0)

        return () => window.clearTimeout(timeoutId)
    }, [selectedJob, selectedJobId])

    const handleClearCache = () => {
        clearJobsCache()
        setJobs([])
        setSelectedJobId(null)
        setCacheTimestamp(null)
        setSearchMeta(null)
        setLoadedFromCache(false)
        setFetchProgress(null)
    }

    const handleFetchJobs = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        setLoading(true)
        setErrorMessage(null)
        setFetchProgress(null)

        try {
            const searchParams = buildLinkedInSearchParams(
                fetchQuery,
                mustHaveKeywords,
                negativeKeywords,
            )
            const response = await streamGraphqlJobsWithMeta(
                {
                    count: fetchCount,
                    keywords: searchParams.keywords,
                    excluded_keywords: searchParams.excludedKeywords,
                    must_have_keywords: mustHaveKeywords,
                    negative_keywords: unique([
                        ...DEFAULT_LINKEDIN_EXCLUDED_KEYWORDS,
                        ...negativeKeywords,
                    ]),
                    drop_prefiltered: true,
                    prefilter_enabled: true,
                    geo_id: "106057199",
                    distance: 25,
                    blacklist: negativeCompanies,
                },
                setFetchProgress,
            )
            const data = response.jobs

            const scoreMap = await scoreJobsBatch(data)

            const enrichedJobs = data.map((job) => {
                const score = scoreMap.get(String(job.id))

                if (!score) return job

                const totalScore = score.total_score ?? 0
                const archetype = score.archetype || score.metadata?.archetype || null
                const scoreBreakdown = score.score_breakdown || null

                return {
                    ...job,
                    aiScore: totalScore,
                    pythonScore: totalScore,
                    pythonSignalScore: score.category_scores?.python_primary ?? 0,
                    aiCategoryScores: score.category_scores || null,
                    aiScoreBreakdown: scoreBreakdown,
                    aiArchetype: archetype,
                    aiSignals: score.metadata?.archetype_signals || null,
                    aiMatchedKeywords: score.matched_keywords || null,
                    aiBonusReasons: score.bonus_reasons || [],
                    aiPenaltyReasons: score.penalty_reasons || [],
                    aiEvidence: score.evidence || [],
                    aiSuspicious: Boolean(score.suspicious),
                    aiSuspiciousReasons: score.suspicious_reasons || [],
                    archetype: archetype || job.archetype,
                    scoreBreakdown: {
                        positive: scoreBreakdown?.positive || [],
                        negative: scoreBreakdown?.negative || [],
                        categoryTotals:
                            scoreBreakdown?.category_totals || score.category_scores || {},
                    },
                }
            })

            const cachedAt = writeJobsCache(enrichedJobs, response.meta)

            setJobs(enrichedJobs)
            setCacheTimestamp(cachedAt)
            setSearchMeta(response.meta)
            setLoadedFromCache(false)
            setIsFetchModalOpen(false)
        } catch (error) {
            const streamError = error as StreamBackendError
            const isBackendEnrichmentError =
                streamError.code === "PREMIUM_APPLICANTS_ENRICHMENT_FAILED" ||
                streamError.details?.type === "enrichment_error"
            const cached = readJobsCache()

            if (cached?.jobs?.length && !isBackendEnrichmentError) {
                setJobs(cached.jobs)
                setCacheTimestamp(cached.cachedAt)
                setSearchMeta(cached.meta ?? null)
                setLoadedFromCache(true)
                setErrorMessage(
                    "Backend fetch failed. Showing the latest cached jobs instead.",
                )
                return
            }

            setJobs([])
            setSelectedJobId(null)
            setCacheTimestamp(null)
            setSearchMeta(null)
            setLoadedFromCache(false)
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Could not fetch jobs from backend.",
            )
        } finally {
            setLoading(false)
        }
    }

    const handleToggleSaved = (job: JobView) => {
        setSavedIds(toggleSavedJob(job.jobId))
    }

    const handleOpenApply = (job: JobView) => {
        window.open(job.jobUrl, "_blank", "noopener,noreferrer")
    }

    return (
        <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden bg-[#09111f] text-slate-100 xl:grid-cols-[430px_minmax(0,1fr)]">
            <SearchJobsFilters
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                verificationFilter={verificationFilter}
                onVerificationFilterChange={setVerificationFilter}
                sourceFilter={sourceFilter}
                onSourceFilterChange={setSourceFilter}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                positiveKeywords={positiveKeywords}
                newPositiveKeyword={newPositiveKeyword}
                onNewPositiveKeywordChange={setNewPositiveKeyword}
                onAddPositiveKeyword={(event) =>
                    updateKeywordList(
                        event,
                        newPositiveKeyword,
                        setNewPositiveKeyword,
                        setPositiveKeywords,
                    )
                }
                onRemovePositiveKeyword={(keyword) =>
                    removeStringFromList(setPositiveKeywords, keyword)
                }
                mustHaveKeywords={mustHaveKeywords}
                newMustHaveKeyword={newMustHaveKeyword}
                onNewMustHaveKeywordChange={setNewMustHaveKeyword}
                onAddMustHaveKeyword={(event) =>
                    updateKeywordList(
                        event,
                        newMustHaveKeyword,
                        setNewMustHaveKeyword,
                        setMustHaveKeywords,
                    )
                }
                onRemoveMustHaveKeyword={(keyword) =>
                    removeStringFromList(setMustHaveKeywords, keyword)
                }
                negativeKeywords={negativeKeywords}
                newNegativeKeyword={newNegativeKeyword}
                onNewNegativeKeywordChange={setNewNegativeKeyword}
                onAddNegativeKeyword={(event) =>
                    updateKeywordList(
                        event,
                        newNegativeKeyword,
                        setNewNegativeKeyword,
                        setNegativeKeywords,
                    )
                }
                onRemoveNegativeKeyword={(keyword) =>
                    removeStringFromList(setNegativeKeywords, keyword)
                }
                negativeCompanies={negativeCompanies}
                onToggleNegativeCompany={(company) =>
                    toggleStringInList(setNegativeCompanies, company)
                }
                excludedWorkplaceTypes={excludedWorkplaceTypes}
                onToggleExcludedWorkplaceType={(workplaceType) =>
                    toggleStringInList(setExcludedWorkplaceTypes, workplaceType)
                }
                maxApplicantsLimit={maxApplicantsLimit}
                maxPossibleApplicants={maxPossibleApplicants}
                onMaxApplicantsLimitChange={(value) =>
                    setMaxApplicantsLimit(
                        value >= maxPossibleApplicants
                            ? Number.MAX_SAFE_INTEGER
                            : value,
                    )
                }
                showHiddenJobs={showHiddenJobs}
                onShowHiddenJobsChange={setShowHiddenJobs}
                sourceOptions={sourceOptions}
                companyOptions={companyOptions}
                workplaceOptions={workplaceOptions}
                cacheTimestamp={cacheTimestamp}
                loadedFromCache={loadedFromCache}
                loading={loading}
                errorMessage={errorMessage}
                onOpenFetchModal={() => setIsFetchModalOpen(true)}
                onClearCache={handleClearCache}
                filteredCount={visibleJobs.length}
                hiddenCount={hiddenCount}
                savedCount={savedCount}
                containerClassName="h-full min-h-0 overflow-hidden border-b-0 border-r border-slate-800"
                resultsSlot={
                    <JobListInsideFilters
                        jobs={visibleJobs}
                        selectedJobId={selectedJobId}
                        onSelectJob={setSelectedJobId}
                        loading={loading}
                        sortBy={sortBy}
                    />
                }
            />

            <section className="flex min-h-0 flex-col overflow-hidden bg-slate-950">
                <div className="min-h-0 flex-1 overflow-hidden">
                    {selectedJob ? (
                        <SelectedJobPreview
                            job={selectedJob}
                            onToggleSaved={() => handleToggleSaved(selectedJob)}
                            onOpenApply={() => handleOpenApply(selectedJob)}
                        />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                            <Briefcase size={34} className="text-slate-600"/>

                            <p className="mt-4 text-sm font-extrabold text-slate-300">
                                Select a job
                            </p>

                            <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">
                                Pick one job from the existing filter/list panel to preview its details here.
                            </p>
                        </div>
                    )}
                </div>

                <PrefilterAuditPanel meta={searchMeta}/>
            </section>

            {isFetchModalOpen && (
                <FetchJobsModal
                    fetchCount={fetchCount}
                    setFetchCount={setFetchCount}
                    fetchQuery={fetchQuery}
                    setFetchQuery={setFetchQuery}
                    loading={loading}
                    progress={fetchProgress}
                    requestPreview={fetchRequestPreview}
                    onClose={() => setIsFetchModalOpen(false)}
                    onSubmit={handleFetchJobs}
                />
            )}
        </div>
    )
}
