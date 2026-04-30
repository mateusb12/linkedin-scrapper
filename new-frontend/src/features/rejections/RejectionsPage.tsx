import {useCallback, useEffect, useMemo, useState} from "react"
import {
    Archive,
    ChevronLeft,
    ChevronRight,
    Clock,
    Inbox,
    Loader2,
    Mail,
    RefreshCw,
    Search,
} from "lucide-react"

import RejectionImprovementBuilder from "./RejectionImprovementBuilder.tsx"
import {
    type RejectionEmail,
    fetchRejectionEmails,
    syncRejectionEmails,
} from "./rejectionsMockService.ts"

const PAGE_SIZE = 8
const SYNC_PHASES = [
    {
        seconds: 0,
        percent: 8,
        label: "Connecting to Gmail",
        detail: "Opening the Gmail label on the backend.",
    },
    {
        seconds: 6,
        percent: 28,
        label: "Reading email messages",
        detail: "The backend is fetching messages from the Job fails label.",
    },
    {
        seconds: 18,
        percent: 52,
        label: "Saving imported emails",
        detail: "New messages are being normalized and stored locally.",
    },
    {
        seconds: 35,
        percent: 76,
        label: "Reconciling jobs",
        detail: "Rejection emails are being matched against applied jobs.",
    },
    {
        seconds: 60,
        percent: 90,
        label: "Waiting for backend response",
        detail: "The request is still open; check backend logs if this does not finish.",
    },
] as const

function formatDateTime(value: string) {
    const date = new Date(value)

    return {
        date: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        }),
        time: date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        }),
    }
}

function getDateTime(value?: string) {
    if (!value) return null

    const date = new Date(value)

    return Number.isNaN(date.getTime()) ? null : date
}

function formatResponseTime(fromValue?: string, toValue?: string) {
    const fromDate = getDateTime(fromValue)
    const toDate = getDateTime(toValue)

    if (!fromDate || !toDate) return null

    const diffMs = toDate.getTime() - fromDate.getTime()
    const hasChronologicalMismatch = diffMs < 0
    const absoluteMinutes = Math.max(Math.round(Math.abs(diffMs) / 60000), 1)
    const absoluteHours = Math.round(absoluteMinutes / 60)
    const absoluteDays = Math.round(absoluteHours / 24)
    const absoluteWeeks = Math.round(absoluteDays / 7)
    const absoluteMonths = Math.round(absoluteDays / 30)

    let label: string

    if (absoluteMinutes < 90) {
        label = `${absoluteMinutes}m`
    } else if (absoluteHours < 36) {
        label = `${Math.max(absoluteHours, 1)}h`
    } else if (absoluteDays < 14) {
        label = `${Math.max(absoluteDays, 1)}d`
    } else if (absoluteWeeks < 9) {
        label = `${Math.max(absoluteWeeks, 1)}w`
    } else {
        label = `${Math.max(absoluteMonths, 1)}mo`
    }

    return hasChronologicalMismatch
        ? `date mismatch: ${label}`
        : `response time: ${label}`
}

function getSenderInitial(sender: string) {
    return sender.trim().charAt(0).toUpperCase() || "?"
}

function formatElapsedTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    if (minutes === 0) return `${seconds}s`

    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`
}

function getEstimatedSyncProgress(
    elapsedSeconds: number,
    isRefreshingInbox: boolean,
    syncedCount: number | null,
) {
    if (isRefreshingInbox) {
        return {
            percent: 96,
            label: "Refreshing inbox",
            detail:
                syncedCount === null
                    ? "The sync finished; loading the updated rejection inbox."
                    : `The sync finished with ${syncedCount} imported or repaired emails.`,
        }
    }

    const activePhase = [...SYNC_PHASES]
        .reverse()
        .find(phase => elapsedSeconds >= phase.seconds) ?? SYNC_PHASES[0]
    const nextPhase = SYNC_PHASES.find(phase => phase.seconds > activePhase.seconds)

    if (!nextPhase) {
        const extraSeconds = Math.max(elapsedSeconds - activePhase.seconds, 0)

        return {
            ...activePhase,
            percent: Math.min(activePhase.percent + Math.floor(extraSeconds / 20), 94),
        }
    }

    const phaseSpan = Math.max(nextPhase.seconds - activePhase.seconds, 1)
    const phaseElapsed = Math.max(elapsedSeconds - activePhase.seconds, 0)
    const phaseProgress = Math.min(phaseElapsed / phaseSpan, 1)
    const percent =
        activePhase.percent +
        Math.round((nextPhase.percent - activePhase.percent) * phaseProgress)

    return {
        ...activePhase,
        percent,
    }
}

type PaginationControlsProps = {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
}

function PaginationControls({
                                page,
                                totalPages,
                                onPageChange,
                            }: PaginationControlsProps) {
    const canGoBack = page > 1
    const canGoForward = page < totalPages

    return (
        <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="font-mono text-xs">
                Page {page} of {totalPages}
            </span>

            <button
                type="button"
                onClick={() => onPageChange(page - 1)}
                disabled={!canGoBack}
                className="rounded-full p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
            >
                <ChevronLeft size={18}/>
            </button>

            <button
                type="button"
                onClick={() => onPageChange(page + 1)}
                disabled={!canGoForward}
                className="rounded-full p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
            >
                <ChevronRight size={18}/>
            </button>
        </div>
    )
}

type EmailListItemProps = {
    email: RejectionEmail
    isSelected: boolean
    onSelect: (email: RejectionEmail) => void
}

function EmailListItem({email, isSelected, onSelect}: EmailListItemProps) {
    const {date, time} = formatDateTime(email.receivedAt)
    const responseTime = formatResponseTime(email.appliedAt, email.receivedAt)
    const displayCompany = email.company ?? email.sender
    const displaySender = email.senderEmail || email.sender
    const hasImprovementBacklog = Boolean(email.improvementBacklog?.trim())

    return (
        <button
            type="button"
            onClick={() => onSelect(email)}
            className={`grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-gray-800 px-4 py-3 text-left transition ${
                isSelected
                    ? hasImprovementBacklog
                        ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/25"
                        : "bg-red-500/10"
                    : hasImprovementBacklog
                        ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                        : email.isRead
                            ? "bg-gray-900/40 hover:bg-gray-800/60"
                            : "bg-gray-900 hover:bg-gray-800/80"
            }`}
        >
            <div
                className={`grid size-10 place-items-center rounded-full text-sm font-black ${
                    email.isRead
                        ? "bg-gray-800 text-gray-400"
                        : "bg-red-500/15 text-red-300"
                }`}
            >
                {getSenderInitial(displayCompany)}
            </div>

            <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {!email.isRead && <span className="size-2 rounded-full bg-red-400"/>}
                    <p
                        className={`truncate text-sm ${
                            email.isRead
                                ? "font-bold text-gray-300"
                                : "font-black text-white"
                        }`}
                    >
                        {displayCompany}
                    </p>
                    <span className="truncate text-[11px] font-semibold text-gray-500">
                        {displaySender}
                    </span>
                    {email.jobUrn ? (
                        <span
                            className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-black text-blue-300">
        linked
    </span>
                    ) : (
                        <span
                            className="rounded-full border border-red-400/50 bg-red-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-200 shadow-sm shadow-red-950/40">
        not linked
    </span>
                    )}
                    {responseTime && (
                        <span
                            className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-300">
        <Clock size={11}/>
                            {responseTime}
    </span>
                    )}
                </div>

                <p
                    className={`mt-1 truncate text-sm ${
                        email.isRead ? "font-semibold text-gray-300" : "font-black text-white"
                    }`}
                >
                    {email.subject}
                </p>

                <p className="mt-1 line-clamp-1 text-xs font-medium text-gray-500">
                    {email.snippet}
                </p>
            </div>

            <div className="shrink-0 text-right">
                <p className="text-xs font-bold text-gray-400">{date}</p>
                <p className="mt-1 font-mono text-[10px] text-gray-600">{time}</p>
            </div>
        </button>
    )
}

export default function RejectionsPage() {
    const [emails, setEmails] = useState<RejectionEmail[]>([])
    const [selectedEmail, setSelectedEmail] = useState<RejectionEmail | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [isLoading, setIsLoading] = useState(true)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isRefreshingAfterSync, setIsRefreshingAfterSync] = useState(false)
    const [syncStartedAt, setSyncStartedAt] = useState<number | null>(null)
    const [syncNow, setSyncNow] = useState(0)
    const [syncedCount, setSyncedCount] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)

    const unreadCount = useMemo(
        () => emails.filter(email => !email.isRead).length,
        [emails],
    )
    const syncElapsedSeconds = syncStartedAt
        ? Math.max(Math.floor((syncNow - syncStartedAt) / 1000), 0)
        : 0
    const syncProgress = getEstimatedSyncProgress(
        syncElapsedSeconds,
        isRefreshingAfterSync,
        syncedCount,
    )

    const loadEmails = useCallback(async function loadEmails() {
        try {
            setError(null)
            setIsLoading(true)

            const result = await fetchRejectionEmails({
                page,
                limit: PAGE_SIZE,
                searchTerm,
            })

            setEmails(result.data)
            setTotal(result.total)
            setTotalPages(result.totalPages)

            setSelectedEmail(current => {
                if (current) {
                    const refreshedEmail = result.data.find(email => email.id === current.id)

                    if (refreshedEmail) return refreshedEmail
                }

                return result.data[0] ?? null
            })
        } catch (loadError) {
            console.error(loadError)
            setError("Could not load rejection emails.")
        } finally {
            setIsLoading(false)
        }
    }, [page, searchTerm])

    async function handleSync() {
        try {
            setError(null)
            setIsSyncing(true)
            setIsRefreshingAfterSync(false)
            setSyncStartedAt(Date.now())
            setSyncNow(Date.now())
            setSyncedCount(null)

            const result = await syncRejectionEmails()
            setSyncedCount(result.newCount)
            setIsRefreshingAfterSync(true)
            await loadEmails()
        } catch (syncError) {
            console.error(syncError)
            setError("Could not sync rejection emails.")
        } finally {
            setIsSyncing(false)
            setIsRefreshingAfterSync(false)
            setSyncStartedAt(null)
        }
    }

    useEffect(() => {
        if (!isSyncing) return

        const intervalId = window.setInterval(() => {
            setSyncNow(Date.now())
        }, 1000)

        return () => window.clearInterval(intervalId)
    }, [isSyncing])

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadEmails()
        }, 0)

        return () => window.clearTimeout(timeoutId)
    }, [loadEmails])

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            <section className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-red-500/10 p-3">
                            <Inbox className="text-red-400" size={28}/>
                        </div>

                        <div>
                            <h1 className="m-0 text-4xl font-black tracking-tight text-white">
                                Rejections
                            </h1>
                            <p className="m-0 mt-2 text-sm font-medium text-gray-400">
                                Gmail-style inbox for emails tagged{" "}
                                <span className="font-black text-red-300">Job fails</span>
                            </p>
                        </div>

                        <span
                            className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-black text-red-300">
                            {total} emails
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => void loadEmails()}
                            disabled={isLoading || isSyncing}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-200 transition hover:border-gray-500 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""}/>
                            Refresh
                        </button>

                        <button
                            type="button"
                            onClick={() => void handleSync()}
                            disabled={isLoading || isSyncing}
                            className="relative inline-flex min-w-40 items-center justify-center gap-2 overflow-hidden rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-80"
                        >
                            {isSyncing ? (
                                <Loader2 size={16} className="animate-spin"/>
                            ) : (
                                <Archive size={16}/>
                            )}
                            <span>{isSyncing ? `${syncProgress.percent}%` : "Import Emails"}</span>
                            {isSyncing && (
                                <span
                                    className="absolute inset-x-0 bottom-0 h-1 bg-red-400 transition-all duration-500"
                                    style={{width: `${syncProgress.percent}%`}}
                                />
                            )}
                        </button>
                    </div>
                </div>

                {isSyncing && (
                    <div className="mt-5 rounded-lg border border-red-500/20 bg-gray-950/50 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-black text-red-200">
                                    {syncProgress.label}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-gray-400">
                                    {syncProgress.detail}
                                </p>
                            </div>

                            <div className="shrink-0 font-mono text-xs font-bold text-gray-400">
                                {formatElapsedTime(syncElapsedSeconds)}
                            </div>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-900">
                            <div
                                className="h-full rounded-full bg-red-400 transition-all duration-500"
                                style={{width: `${syncProgress.percent}%`}}
                            />
                        </div>
                    </div>
                )}
            </section>

            {error && (
                <div
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
                    {error}
                </div>
            )}

            <section className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
                <div
                    className="flex flex-col border-b border-gray-800 bg-gray-950/80 px-4 py-3 gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <Mail className="text-gray-500" size={19}/>
                        <span className="text-sm font-black text-gray-200">Inbox</span>
                        {unreadCount > 0 && (
                            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                                {unreadCount} unread
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative w-full sm:w-80">
                            <Search
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                            />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={event => {
                                    setSearchTerm(event.target.value)
                                    setPage(1)
                                }}
                                placeholder="Search sender, subject or snippet..."
                                className="w-full rounded-full border border-gray-700 bg-gray-900 py-2 pl-9 pr-4 text-sm font-semibold text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                            />
                        </div>

                        <PaginationControls
                            page={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex min-h-80 items-center justify-center">
                        <div className="flex items-center gap-3 text-sm font-bold text-gray-300">
                            <Loader2 className="animate-spin text-red-400" size={20}/>
                            Loading rejection inbox...
                        </div>
                    </div>
                ) : (
                    <div
                        className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[minmax(340px,0.72fr)_minmax(0,1.28fr)]">
                        <div className="border-r border-gray-800">
                            {emails.length > 0 ? (
                                emails.map(email => (
                                    <EmailListItem
                                        key={email.id}
                                        email={email}
                                        isSelected={selectedEmail?.id === email.id}
                                        onSelect={setSelectedEmail}
                                    />
                                ))
                            ) : (
                                <div className="flex min-h-[520px] items-center justify-center px-6 text-center">
                                    <div>
                                        <Mail size={34} className="mx-auto mb-3 text-gray-700"/>
                                        <p className="text-base font-black text-gray-300">
                                            No rejection emails found.
                                        </p>
                                        <p className="mt-2 text-sm font-medium text-gray-500">
                                            Try another search term or import the Gmail label again.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <RejectionImprovementBuilder email={selectedEmail}/>
                    </div>
                )}
            </section>
        </div>
    )
}
