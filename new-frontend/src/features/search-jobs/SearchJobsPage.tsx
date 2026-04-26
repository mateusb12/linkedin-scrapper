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
    clearJobsCacheMock,
    fetchJobsMock,
    type FetchJobsProgress,
    getInitialSearchJobsMockData,
    readSavedJobIdsMock,
    type SearchJob,
    toggleSavedJobMock,
} from "./searchJobsMockService.ts"

import {
    FetchJobsModal,
    JobListInsideFilters,
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
                    searchableText.includes(normalizeText(keyword)),
                ),
            )

            const matchedNegativeKeywords = unique(
                negativeKeywords.filter((keyword) =>
                    searchableText.includes(normalizeText(keyword)),
                ),
            )

            const missingMustHaveKeywords = unique(
                mustHaveKeywords.filter(
                    (keyword) => !searchableText.includes(normalizeText(keyword)),
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

export default function SearchJobsPage() {
    const [jobs, setJobs] = useState<SearchJob[]>([])
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

    const [searchTerm, setSearchTerm] = useState("")
    const [verificationFilter, setVerificationFilter] =
        useState<VerificationFilter>("All")
    const [sourceFilter, setSourceFilter] = useState("All")
    const [sortBy, setSortBy] = useState<SortOption>("relevance")

    const [positiveKeywords, setPositiveKeywords] = useState(DEFAULT_POSITIVE_KEYWORDS)
    const [newPositiveKeyword, setNewPositiveKeyword] = useState("")

    const [mustHaveKeywords, setMustHaveKeywords] = useState(DEFAULT_MUST_HAVE_KEYWORDS)
    const [newMustHaveKeyword, setNewMustHaveKeyword] = useState("")

    const [negativeKeywords, setNegativeKeywords] = useState(DEFAULT_NEGATIVE_KEYWORDS)
    const [newNegativeKeyword, setNewNegativeKeyword] = useState("")

    const [negativeCompanies, setNegativeCompanies] = useState<string[]>([])
    const [excludedWorkplaceTypes, setExcludedWorkplaceTypes] = useState<string[]>([])
    const [maxApplicantsLimit, setMaxApplicantsLimit] = useState(Number.MAX_SAFE_INTEGER)
    const [showHiddenJobs, setShowHiddenJobs] = useState(false)

    const [savedIds, setSavedIds] = useState<string[]>(() => readSavedJobIdsMock())

    const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null)
    const [loadedFromCache, setLoadedFromCache] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const [isFetchModalOpen, setIsFetchModalOpen] = useState(false)
    const [fetchCount, setFetchCount] = useState(75)
    const [fetchQuery, setFetchQuery] = useState("")
    const [fetchProgress, setFetchProgress] = useState<FetchJobsProgress | null>(null)

    useEffect(() => {
        let isMounted = true

        async function loadInitialJobs() {
            setLoading(true)
            setErrorMessage(null)

            try {
                const result = await getInitialSearchJobsMockData()

                if (!isMounted) return

                setJobs(result.jobs)
                setCacheTimestamp(result.cachedAt)
                setLoadedFromCache(result.loadedFromCache)
            } catch (error) {
                if (!isMounted) return

                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Could not load mock jobs.",
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

    useEffect(() => {
        if (!selectedJob) {
            setSelectedJobId(null)
            return
        }

        if (selectedJob.id !== selectedJobId) {
            setSelectedJobId(selectedJob.id)
        }
    }, [selectedJob, selectedJobId])

    const handleClearCache = () => {
        clearJobsCacheMock()
        setJobs([])
        setSelectedJobId(null)
        setCacheTimestamp(null)
        setLoadedFromCache(false)
        setFetchProgress(null)
    }

    const handleFetchJobs = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        setLoading(true)
        setErrorMessage(null)
        setFetchProgress(null)

        try {
            const result = await fetchJobsMock({
                count: fetchCount,
                query: fetchQuery,
                onProgress: setFetchProgress,
            })

            setJobs(result.jobs)
            setCacheTimestamp(result.cachedAt)
            setLoadedFromCache(result.loadedFromCache)
            setIsFetchModalOpen(false)
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Could not fetch mock jobs.",
            )
        } finally {
            setLoading(false)
        }
    }

    const handleToggleSaved = (job: JobView) => {
        setSavedIds(toggleSavedJobMock(job.jobId))
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

            <section className="min-h-0 overflow-hidden bg-slate-950">
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
            </section>

            {isFetchModalOpen && (
                <FetchJobsModal
                    fetchCount={fetchCount}
                    setFetchCount={setFetchCount}
                    fetchQuery={fetchQuery}
                    setFetchQuery={setFetchQuery}
                    loading={loading}
                    progress={fetchProgress}
                    onClose={() => setIsFetchModalOpen(false)}
                    onSubmit={handleFetchJobs}
                />
            )}
        </div>
    )
}
