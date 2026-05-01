import {useEffect, useState, type FormEvent, type ReactNode} from "react"
import {
    Building2,
    ChevronDown,
    ChevronUp,
    Clock3,
    Database,
    Filter,
    MapPin,
    RefreshCw,
    Search,
    SlidersHorizontal,
    Sparkles,
    Target,
    Trash2,
    Users,
    X,
    XCircle,
} from "lucide-react"

export type SelectOption = {
    value: string
    label: string
}

export type VerificationFilter = "All" | "Verified" | "Unverified"

export type SortOption =
    | "relevance"
    | "keywordScore"
    | "pythonScore"
    | "recent"
    | "applicants"
    | "title"
    | "company"

type FilterSectionProps = {
    title: string
    icon: ReactNode
    count?: number
    accentClassName: string
    defaultOpen?: boolean
    children: ReactNode
}

type SearchJobsFiltersProps = {
    searchTerm: string
    onSearchTermChange: (value: string) => void

    verificationFilter: VerificationFilter
    onVerificationFilterChange: (value: VerificationFilter) => void

    sourceFilter: string
    onSourceFilterChange: (value: string) => void

    sortBy: SortOption
    onSortByChange: (value: SortOption) => void

    positiveKeywords: string[]
    newPositiveKeyword: string
    onNewPositiveKeywordChange: (value: string) => void
    onAddPositiveKeyword: (event: FormEvent<HTMLFormElement>) => void
    onRemovePositiveKeyword: (keyword: string) => void

    mustHaveKeywords: string[]
    newMustHaveKeyword: string
    onNewMustHaveKeywordChange: (value: string) => void
    onAddMustHaveKeyword: (event: FormEvent<HTMLFormElement>) => void
    onRemoveMustHaveKeyword: (keyword: string) => void

    negativeKeywords: string[]
    newNegativeKeyword: string
    onNewNegativeKeywordChange: (value: string) => void
    onAddNegativeKeyword: (event: FormEvent<HTMLFormElement>) => void
    onRemoveNegativeKeyword: (keyword: string) => void

    negativeCompanies: string[]
    onToggleNegativeCompany: (company: string) => void

    excludedWorkplaceTypes: string[]
    onToggleExcludedWorkplaceType: (workplaceType: string) => void

    maxApplicantsLimit: number
    maxPossibleApplicants: number
    onMaxApplicantsLimitChange: (value: number) => void

    maxJobAgeLimitDays: number
    maxPossibleJobAgeDays: number
    onMaxJobAgeLimitDaysChange: (value: number) => void

    showHiddenJobs: boolean
    onShowHiddenJobsChange: (value: boolean) => void

    sourceOptions: SelectOption[]
    companyOptions: SelectOption[]
    workplaceOptions: SelectOption[]

    cacheTimestamp: string | null
    loadedFromCache: boolean
    loading: boolean
    errorMessage: string | null
    onOpenFetchModal: () => void
    onClearCache: () => void

    filteredCount: number
    hiddenCount: number
    savedCount: number
    containerClassName?: string
    resultsSlot?: ReactNode
}

const formatCacheTimestamp = (value: string | null) => {
    if (!value) return "No cache"

    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value))
}

function FilterSelect({
                          value,
                          options,
                          onChange,
                      }: {
    value: string
    options: SelectOption[]
    onChange: (value: string) => void
}) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>

            <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
        </div>
    )
}

function FilterSection({
                           title,
                           icon,
                           count = 0,
                           accentClassName,
                           defaultOpen = false,
                           children,
                       }: FilterSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    return (
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/30">
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/50"
            >
                <div className="flex items-center gap-2">
                    <span className={accentClassName}>{icon}</span>
                    {title}

                    {count > 0 && (
                        <span
                            className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] ${accentClassName} bg-current/10`}
                        >
                            {count}
                        </span>
                    )}
                </div>

                {isOpen ? (
                    <ChevronUp size={16} className="text-slate-400"/>
                ) : (
                    <ChevronDown size={16} className="text-slate-400"/>
                )}
            </button>

            {isOpen && (
                <div className="space-y-3 border-t border-slate-700/50 p-3">
                    {children}
                </div>
            )}
        </div>
    )
}

function KeywordPill({
                         keyword,
                         tone,
                         onRemove,
                     }: {
    keyword: string
    tone: "amber" | "emerald" | "red"
    onRemove: (keyword: string) => void
}) {
    const toneClasses = {
        amber: "border-amber-900/50 bg-amber-950/30 text-amber-200",
        emerald: "border-emerald-900/50 bg-emerald-950/30 text-emerald-200",
        red: "border-red-900/50 bg-red-950/30 text-red-200",
    }

    const buttonClasses = {
        amber: "text-amber-400 hover:bg-amber-900/50 hover:text-amber-200",
        emerald:
            "text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-200",
        red: "text-red-400 hover:bg-red-900/50 hover:text-red-200",
    }

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${toneClasses[tone]}`}
        >
            {keyword}

            <button
                type="button"
                onClick={() => onRemove(keyword)}
                className={`rounded-full ${buttonClasses[tone]}`}
                aria-label={`Remove ${keyword}`}
            >
                <XCircle size={12}/>
            </button>
        </span>
    )
}

function CompanyFilterModal({
                                isOpen,
                                onClose,
                                companyOptions,
                                selectedCompanies,
                                onToggle,
                            }: {
    isOpen: boolean
    onClose: () => void
    companyOptions: SelectOption[]
    selectedCompanies: string[]
    onToggle: (company: string) => void
}) {
    const [search, setSearch] = useState("")

    useEffect(() => {
        if (!isOpen) return

        const previousOverflow = document.body.style.overflow
        const previousOverscrollBehavior = document.body.style.overscrollBehavior

        document.body.style.overflow = "hidden"
        document.body.style.overscrollBehavior = "contain"

        return () => {
            document.body.style.overflow = previousOverflow
            document.body.style.overscrollBehavior = previousOverscrollBehavior
        }
    }, [isOpen])

    if (!isOpen) return null

    const normalizedSearch = search.trim().toLowerCase()
    const filteredCompanies = companyOptions.filter((company) =>
        company.label.toLowerCase().includes(normalizedSearch),
    )

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onWheel={(event) => event.preventDefault()}
            onTouchMove={(event) => event.preventDefault()}
        >
            <div
                className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
                onWheel={(event) => event.stopPropagation()}
                onTouchMove={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-800 p-5">
                    <div>
                        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100">
                            <Building2 size={20} className="text-red-400"/>
                            Exclude Companies
                        </h2>

                        <p className="mt-1 text-xs text-slate-500">
                            {selectedCompanies.length} selected
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                        aria-label="Close company filter modal"
                    >
                        <X size={20}/>
                    </button>
                </div>

                <div className="border-b border-slate-800 p-4">
                    <div className="relative">
                        <Search
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                            type="text"
                            placeholder="Search companies to filter..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-red-500/50"
                        />
                    </div>
                </div>

                <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto p-2">
                    {filteredCompanies.length > 0 ? (
                        filteredCompanies.map((company) => {
                            const isSelected = selectedCompanies.includes(company.value)

                            return (
                                <label
                                    key={company.value}
                                    className="flex cursor-pointer items-center gap-3 rounded-lg p-3 transition hover:bg-slate-800/50"
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => onToggle(company.value)}
                                        className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-red-500"
                                    />

                                    <span className="text-sm font-medium text-slate-200">
                                        {company.label}
                                    </span>
                                </label>
                            )
                        })
                    ) : (
                        <div className="p-6 text-center text-sm text-slate-500">
                            No companies found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function SearchJobsFilters({
                                              searchTerm,
                                              onSearchTermChange,
                                              verificationFilter,
                                              onVerificationFilterChange,
                                              sourceFilter,
                                              onSourceFilterChange,
                                              sortBy,
                                              onSortByChange,
                                              positiveKeywords,
                                              newPositiveKeyword,
                                              onNewPositiveKeywordChange,
                                              onAddPositiveKeyword,
                                              onRemovePositiveKeyword,
                                              mustHaveKeywords,
                                              newMustHaveKeyword,
                                              onNewMustHaveKeywordChange,
                                              onAddMustHaveKeyword,
                                              onRemoveMustHaveKeyword,
                                              negativeKeywords,
                                              newNegativeKeyword,
                                              onNewNegativeKeywordChange,
                                              onAddNegativeKeyword,
                                              onRemoveNegativeKeyword,
                                              negativeCompanies,
                                              onToggleNegativeCompany,
                                              excludedWorkplaceTypes,
                                              onToggleExcludedWorkplaceType,
                                              maxApplicantsLimit,
                                              maxPossibleApplicants,
                                              onMaxApplicantsLimitChange,
                                              maxJobAgeLimitDays,
                                              maxPossibleJobAgeDays,
                                              onMaxJobAgeLimitDaysChange,
                                              showHiddenJobs,
                                              onShowHiddenJobsChange,
                                              sourceOptions,
                                              companyOptions,
                                              workplaceOptions,
                                              cacheTimestamp,
                                              loadedFromCache,
                                              loading,
                                              errorMessage,
                                              onOpenFetchModal,
                                              onClearCache,
                                              filteredCount,
                                              hiddenCount,
                                              savedCount,
                                              containerClassName = "max-h-[52%] shrink-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]",
                                              resultsSlot,
                                          }: SearchJobsFiltersProps) {
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)

    const activeGeneralFiltersCount = [
        verificationFilter !== "All",
        sourceFilter !== "All",
    ].filter(Boolean).length

    const negativeFiltersCount =
        (negativeKeywords.length > 0 ? 1 : 0) +
        (negativeCompanies.length > 0 ? 1 : 0) +
        (excludedWorkplaceTypes.length > 0 ? 1 : 0) +
        (maxApplicantsLimit !== Number.MAX_SAFE_INTEGER ? 1 : 0) +
        (maxJobAgeLimitDays !== Number.MAX_SAFE_INTEGER ? 1 : 0)

    const allFiltersCount =
        activeGeneralFiltersCount +
        mustHaveKeywords.length +
        positiveKeywords.length +
        negativeFiltersCount

    const cacheTone = !cacheTimestamp
        ? "border-slate-700 bg-slate-900/40 text-slate-400"
        : loadedFromCache
            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"

    return (
        <div
            className={`flex min-h-0 flex-col gap-4 border-b border-slate-800 p-4 ${containerClassName}`}
        >
            <CompanyFilterModal
                isOpen={isCompanyModalOpen}
                onClose={() => setIsCompanyModalOpen(false)}
                companyOptions={companyOptions}
                selectedCompanies={negativeCompanies}
                onToggle={onToggleNegativeCompany}
            />

            <div className="relative">
                <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => onSearchTermChange(event.target.value)}
                    placeholder="Search by title, company, stack or seniority..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-sky-500"
                />
            </div>

            <FilterSection
                title="All Filters"
                icon={<SlidersHorizontal size={15}/>}
                count={allFiltersCount}
                accentClassName="text-sky-400"
            >
                <FilterSection
                    title="General Filters"
                    icon={<SlidersHorizontal size={15}/>}
                    count={activeGeneralFiltersCount}
                    accentClassName="text-sky-400"
                >
                    <div className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex flex-wrap items-center gap-2">
                                <div
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-800/80">
                                    <Database size={14} className="text-sky-400"/>
                                </div>

                                <span className="text-sm font-medium text-slate-100">
                                    Cache
                                </span>

                                <span
                                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cacheTone}`}
                                >
                                    {formatCacheTimestamp(cacheTimestamp)}
                                </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onOpenFetchModal}
                                    disabled={loading}
                                    aria-label="Refresh cache"
                                    title="Refresh cache"
                                    className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-600 bg-slate-700/50 text-slate-200 transition hover:bg-slate-600 hover:text-white disabled:opacity-50"
                                >
                                    <RefreshCw
                                        size={14}
                                        className={loading ? "animate-spin" : ""}
                                    />
                                </button>

                                {cacheTimestamp && (
                                    <button
                                        type="button"
                                        onClick={onClearCache}
                                        aria-label="Clear cache"
                                        title="Clear cache"
                                        className="flex h-8 w-8 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-400 transition hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-300"
                                    >
                                        <Trash2 size={14}/>
                                    </button>
                                )}
                            </div>
                        </div>

                        {errorMessage && (
                            <p className="mt-2 text-xs text-red-300">{errorMessage}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <FilterSelect
                            value={verificationFilter}
                            onChange={(value) =>
                                onVerificationFilterChange(value as VerificationFilter)
                            }
                            options={[
                                {value: "All", label: "All Verification"},
                                {value: "Verified", label: "Verified"},
                                {value: "Unverified", label: "Unverified"},
                            ]}
                        />

                        <FilterSelect
                            value={sourceFilter}
                            onChange={onSourceFilterChange}
                            options={[
                                {value: "All", label: "All Sources"},
                                ...sourceOptions,
                            ]}
                        />
                    </div>
                </FilterSection>

                <FilterSection
                    title="Must-Have Keywords"
                    icon={<Target size={15}/>}
                    count={mustHaveKeywords.length}
                    accentClassName="text-amber-400"
                >
                    <form onSubmit={onAddMustHaveKeyword} className="flex gap-2">
                        <input
                            type="text"
                            value={newMustHaveKeyword}
                            onChange={(event) =>
                                onNewMustHaveKeywordChange(event.target.value)
                            }
                            placeholder="e.g., Python, SQL..."
                            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-500/50"
                        />

                        <button
                            type="submit"
                            disabled={!newMustHaveKeyword.trim()}
                            className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/30 disabled:opacity-50"
                        >
                            Add
                        </button>
                    </form>

                    {mustHaveKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {mustHaveKeywords.map((keyword) => (
                                <KeywordPill
                                    key={keyword}
                                    keyword={keyword}
                                    tone="amber"
                                    onRemove={onRemoveMustHaveKeyword}
                                />
                            ))}
                        </div>
                    )}

                    <p className="text-[11px] text-slate-400">
                        Jobs missing any of these will be marked negative.
                    </p>
                </FilterSection>

                <FilterSection
                    title="Positive Keywords"
                    icon={<Sparkles size={15}/>}
                    count={positiveKeywords.length}
                    accentClassName="text-emerald-400"
                >
                    <form onSubmit={onAddPositiveKeyword} className="flex gap-2">
                        <input
                            type="text"
                            value={newPositiveKeyword}
                            onChange={(event) =>
                                onNewPositiveKeywordChange(event.target.value)
                            }
                            placeholder="e.g., React, Node, AWS..."
                            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500/50"
                        />

                        <button
                            type="submit"
                            disabled={!newPositiveKeyword.trim()}
                            className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50"
                        >
                            Add
                        </button>
                    </form>

                    {positiveKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {positiveKeywords.map((keyword) => (
                                <KeywordPill
                                    key={keyword}
                                    keyword={keyword}
                                    tone="emerald"
                                    onRemove={onRemovePositiveKeyword}
                                />
                            ))}
                        </div>
                    )}

                    <p className="text-[11px] text-slate-400">
                        Each matched positive keyword adds +1 to the visible score.
                    </p>
                </FilterSection>

                <FilterSection
                    title="Negative Filters"
                    icon={<Filter size={15}/>}
                    count={negativeFiltersCount}
                    accentClassName="text-red-400"
                >
                    <form onSubmit={onAddNegativeKeyword} className="flex gap-2">
                        <input
                            type="text"
                            value={newNegativeKeyword}
                            onChange={(event) =>
                                onNewNegativeKeywordChange(event.target.value)
                            }
                            placeholder="e.g., Java, PHP..."
                            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-red-500/50"
                        />

                        <button
                            type="submit"
                            disabled={!newNegativeKeyword.trim()}
                            className="rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                        >
                            Add
                        </button>
                    </form>

                    {negativeKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {negativeKeywords.map((keyword) => (
                                <KeywordPill
                                    key={keyword}
                                    keyword={keyword}
                                    tone="red"
                                    onRemove={onRemoveNegativeKeyword}
                                />
                            ))}
                        </div>
                    )}

                    <div className="border-t border-slate-700/50 pt-3">
                        <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                            <Users size={14} className="text-slate-400"/>
                            Max Applicants
                        </label>

                        <div className="mb-2 flex justify-between text-xs text-slate-400">
                            <span>
                                {maxApplicantsLimit === Number.MAX_SAFE_INTEGER
                                    ? "Unlimited"
                                    : maxApplicantsLimit}
                            </span>
                            <span>{maxPossibleApplicants} max</span>
                        </div>

                        <input
                            type="range"
                            min="0"
                            max={maxPossibleApplicants}
                            value={
                                maxApplicantsLimit === Number.MAX_SAFE_INTEGER
                                    ? maxPossibleApplicants
                                    : maxApplicantsLimit
                            }
                            onChange={(event) =>
                                onMaxApplicantsLimitChange(Number(event.target.value))
                            }
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-red-500"
                        />
                    </div>

                    <div className="border-t border-slate-700/50 pt-3">
                        <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                            <Clock3 size={14} className="text-slate-400"/>
                            Max Job Age
                        </label>

                        <div className="mb-2 flex justify-between text-xs text-slate-400">
                            <span>
                                {maxJobAgeLimitDays === Number.MAX_SAFE_INTEGER
                                    ? "Unlimited"
                                    : `${maxJobAgeLimitDays}d`}
                            </span>
                            <span>{maxPossibleJobAgeDays}d max</span>
                        </div>

                        <input
                            type="range"
                            min="0"
                            max={maxPossibleJobAgeDays}
                            value={
                                maxJobAgeLimitDays === Number.MAX_SAFE_INTEGER
                                    ? maxPossibleJobAgeDays
                                    : maxJobAgeLimitDays
                            }
                            onChange={(event) =>
                                onMaxJobAgeLimitDaysChange(Number(event.target.value))
                            }
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-red-500"
                        />
                    </div>

                    <div className="border-t border-slate-700/50 pt-3">
                        <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                            <MapPin size={14} className="text-slate-400"/>
                            Workplace Type Exclusion
                        </label>

                        <div className="grid grid-cols-1 gap-2">
                            {workplaceOptions.map((option) => (
                                <label
                                    key={option.value}
                                    className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-700 bg-slate-900/50 px-2 py-2 text-xs font-medium text-slate-200 transition hover:border-red-500/50 hover:bg-slate-800"
                                >
                                    <input
                                        type="checkbox"
                                        checked={excludedWorkplaceTypes.includes(option.value)}
                                        onChange={() =>
                                            onToggleExcludedWorkplaceType(option.value)
                                        }
                                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-red-500"
                                    />
                                    <span>{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-slate-700/50 pt-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                                <Building2 size={14} className="text-slate-400"/>
                                Excluded Companies
                            </label>

                            <button
                                type="button"
                                onClick={() => setIsCompanyModalOpen(true)}
                                className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
                            >
                                Manage
                            </button>
                        </div>

                        {negativeCompanies.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {negativeCompanies.map((company) => (
                                    <KeywordPill
                                        key={company}
                                        keyword={company}
                                        tone="red"
                                        onRemove={onToggleNegativeCompany}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-500">
                                No companies excluded.
                            </p>
                        )}
                    </div>
                </FilterSection>
            </FilterSection>

            <div className="space-y-3">
                <FilterSelect
                    value={sortBy}
                    onChange={(value) => onSortByChange(value as SortOption)}
                    options={[
                        {value: "relevance", label: "Sort by: Relevance"},
                        {value: "keywordScore", label: "Sort by: Keyword Score"},
                        {value: "pythonScore", label: "Sort by: Python Score"},
                        {value: "recent", label: "Sort by: Most Recent"},
                        {value: "applicants", label: "Sort by: Applicants"},
                        {value: "title", label: "Sort by: Title"},
                        {value: "company", label: "Sort by: Company"},
                    ]}
                />

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
                    <span>{filteredCount} results</span>

                    <div className="flex items-center gap-2">
                        {hiddenCount > 0 && (
                            <button
                                type="button"
                                onClick={() => onShowHiddenJobsChange(!showHiddenJobs)}
                                className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                                    showHiddenJobs
                                        ? "border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                                        : "border-slate-700 bg-slate-800/60 text-red-400 hover:border-red-500/40 hover:bg-red-500/10"
                                }`}
                            >
                                {showHiddenJobs
                                    ? "Hide filtered"
                                    : `Show filtered (${hiddenCount})`}
                            </button>
                        )}

                        <span className="text-xs font-semibold text-emerald-300">
                            ({savedCount} saved)
                        </span>
                    </div>
                </div>
            </div>

            {resultsSlot && (
                <div className="min-h-0 flex-1 overflow-hidden border-t border-slate-800 pt-4">
                    {resultsSlot}
                </div>
            )}
        </div>
    )
}