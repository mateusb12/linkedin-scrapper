import {useCallback, useEffect, useMemo, useState} from "react"
import {
    AlertCircle,
    Archive,
    ChevronLeft,
    ChevronRight,
    Inbox,
    Loader2,
    Mail,
    MailOpen,
    RefreshCw,
    Search,
    Tag,
} from "lucide-react"

import {
    type RejectionEmail,
    fetchRejectionEmails,
    syncRejectionEmails,
} from "./rejectionsMockService.ts"

const PAGE_SIZE = 8

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

function getSenderInitial(sender: string) {
    return sender.trim().charAt(0).toUpperCase() || "?"
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

    return (
        <button
            type="button"
            onClick={() => onSelect(email)}
            className={`grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-gray-800 px-4 py-3 text-left transition ${
                isSelected
                    ? "bg-red-500/10"
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
                {getSenderInitial(email.sender)}
            </div>

            <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                    {!email.isRead && <span className="size-2 rounded-full bg-red-400"/>}
                    <p
                        className={`truncate text-sm ${
                            email.isRead
                                ? "font-bold text-gray-300"
                                : "font-black text-white"
                        }`}
                    >
                        {email.sender}
                    </p>
                    {email.jobUrn && (
                        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-black text-blue-300">
                            linked
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

type EmailReaderProps = {
    email: RejectionEmail | null
}

function EmailReader({email}: EmailReaderProps) {
    if (!email) {
        return (
            <div className="flex h-full min-h-[520px] items-center justify-center bg-gray-950/30 px-6 text-center">
                <div>
                    <Mail size={44} className="mx-auto mb-4 text-gray-700"/>
                    <p className="text-lg font-black text-gray-300">Select an email</p>
                    <p className="mt-2 max-w-sm text-sm font-medium text-gray-500">
                        Pick a rejection message from the inbox to inspect the sender,
                        linked job and imported body.
                    </p>
                </div>
            </div>
        )
    }

    const {date, time} = formatDateTime(email.receivedAt)

    return (
        <article className="flex h-full min-h-[520px] flex-col bg-gray-950/30">
            <header className="border-b border-gray-800 p-5">
                <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-300">
                    <AlertCircle size={15}/>
                    Job fails
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px]">
                        rejection
                    </span>
                </div>

                <h2 className="text-2xl font-black leading-tight text-white">
                    {email.subject}
                </h2>

                <div className="mt-5 flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-red-500/15 text-sm font-black text-red-300">
                            {getSenderInitial(email.sender)}
                        </div>

                        <div className="min-w-0">
                            <p className="truncate text-sm font-black text-gray-100">
                                {email.sender}
                            </p>
                            <p className="truncate text-xs font-medium text-gray-500">
                                {email.senderEmail}
                            </p>
                            <p className="mt-1 truncate text-xs font-medium text-gray-600">
                                to {email.recipient}
                            </p>
                        </div>
                    </div>

                    <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-gray-300">{date}</p>
                        <p className="font-mono text-xs text-gray-500">{time}</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
                <div className="mb-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-black text-red-300">
                        <Tag size={13}/>
                        {email.folder}
                    </span>
                    {email.jobUrn && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-300">
                            Linked job {email.jobUrn}
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-xs font-black text-gray-400">
                        {email.isRead ? <MailOpen size={13}/> : <Mail size={13}/>}
                        {email.isRead ? "Read" : "Unread"}
                    </span>
                </div>

                <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-5">
                    <p className="whitespace-pre-wrap text-sm font-medium leading-7 text-gray-300">
                        {email.bodyText}
                    </p>
                </div>
            </div>
        </article>
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
    const [error, setError] = useState<string | null>(null)

    const unreadCount = useMemo(
        () => emails.filter(email => !email.isRead).length,
        [emails],
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
                if (current && result.data.some(email => email.id === current.id)) {
                    return current
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

            await syncRejectionEmails()
            await loadEmails()
        } catch (syncError) {
            console.error(syncError)
            setError("Could not sync rejection emails.")
        } finally {
            setIsSyncing(false)
        }
    }

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

                        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-black text-red-300">
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
                            className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSyncing ? (
                                <Loader2 size={16} className="animate-spin"/>
                            ) : (
                                <Archive size={16}/>
                            )}
                            Import Emails
                        </button>
                    </div>
                </div>
            </section>

            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
                    {error}
                </div>
            )}

            <section className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
                <div className="flex flex-col border-b border-gray-800 bg-gray-950/80 px-4 py-3 gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                    <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
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

                        <EmailReader email={selectedEmail}/>
                    </div>
                )}
            </section>
        </div>
    )
}
