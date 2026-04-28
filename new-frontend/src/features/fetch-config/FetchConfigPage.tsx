import {useCallback, useEffect, useState} from "react"
import {
    deleteScraperConfig,
    getFetchConfigData,
    saveGmailToken,
    saveScraperConfig,
    testGmailConnection,
    type GmailState,
    type SavedScraperConfig,
    type ScraperConfigMeta,
    type ScraperConfigsData,
} from "./fetchConfigService"

type ColorTheme = {
    preview: string
    textarea: string
    saveButton: string
    focusRing: string
}

const colorThemes: Record<string, ColorTheme> = {
    blue: {
        preview:
            "border-blue-400/20 bg-blue-50 text-slate-700 dark:border-blue-400/20 dark:bg-blue-950/30 dark:text-slate-200",
        textarea: "focus:border-blue-400",
        saveButton: "bg-blue-600 hover:bg-blue-700",
        focusRing: "focus:ring-blue-500/40",
    },
    purple: {
        preview:
            "border-purple-400/20 bg-purple-50 text-slate-700 dark:border-purple-400/20 dark:bg-purple-950/30 dark:text-slate-200",
        textarea: "focus:border-purple-400",
        saveButton: "bg-purple-600 hover:bg-purple-700",
        focusRing: "focus:ring-purple-500/40",
    },
    green: {
        preview:
            "border-green-400/20 bg-green-50 text-slate-700 dark:border-green-400/20 dark:bg-green-950/30 dark:text-slate-200",
        textarea: "focus:border-green-400",
        saveButton: "bg-green-600 hover:bg-green-700",
        focusRing: "focus:ring-green-500/40",
    },
    orange: {
        preview:
            "border-orange-400/20 bg-orange-50 text-slate-700 dark:border-orange-400/20 dark:bg-orange-950/30 dark:text-slate-200",
        textarea: "focus:border-orange-400",
        saveButton: "bg-orange-600 hover:bg-orange-700",
        focusRing: "focus:ring-orange-500/40",
    },
    teal: {
        preview:
            "border-teal-400/20 bg-teal-50 text-slate-700 dark:border-teal-400/20 dark:bg-teal-950/30 dark:text-slate-200",
        textarea: "focus:border-teal-400",
        saveButton: "bg-teal-600 hover:bg-teal-700",
        focusRing: "focus:ring-teal-500/40",
    },
    rose: {
        preview:
            "border-rose-400/20 bg-rose-50 text-slate-700 dark:border-rose-400/20 dark:bg-rose-950/30 dark:text-slate-200",
        textarea: "focus:border-rose-400",
        saveButton: "bg-rose-600 hover:bg-rose-700",
        focusRing: "focus:ring-rose-500/40",
    },
}

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message
    return "Unexpected error."
}

function CopyableCodeBlock({label, text}: { label: string; text: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
    }

    return (
        <div className="mb-3">
            <p className="mb-1 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
            </p>

            <div
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-[#101827]">
                <code className="min-w-0 flex-1 truncate font-mono text-sm text-slate-800 dark:text-slate-200">
                    {text}
                </code>

                <button
                    type="button"
                    onClick={handleCopy}
                    className="grid size-8 place-items-center rounded-md border border-slate-300 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                    aria-label="Copy network filter"
                >
                    {copied ? "✓" : "⧉"}
                </button>
            </div>
        </div>
    )
}

function ConfigCard({
                        config,
                        savedData,
                        onSave,
                        onDelete,
                    }: {
    config: ScraperConfigMeta
    savedData: SavedScraperConfig | null | undefined
    onSave: (config: ScraperConfigMeta, curl: string) => Promise<void>
    onDelete: (config: ScraperConfigMeta) => Promise<void>
}) {
    const [input, setInput] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const theme = colorThemes[config.colorClass] ?? colorThemes.blue

    const displayContent = savedData
        ? typeof savedData.curl === "string"
            ? savedData.curl
            : JSON.stringify(savedData.curl, null, 2)
        : ""

    const handleSave = async () => {
        if (!input.trim()) return

        setIsSaving(true)

        try {
            await onSave(config, input)
            setInput("")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        const shouldDelete = window.confirm(
            "Are you sure you want to delete this configuration?",
        )

        if (!shouldDelete) return

        setIsDeleting(true)

        try {
            await onDelete(config)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <article
            className="flex min-h-[420px] flex-col rounded-xl border border-slate-200/90 bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700/90 dark:bg-[#172033]/90">
            <div>
                <h2 className="text-xl font-black text-[#172033] dark:text-slate-50">
                    {config.title}
                </h2>

                <p className="mt-2 min-h-10 text-sm font-medium leading-5 text-slate-500 dark:text-slate-400">
                    {config.description}
                </p>

                <CopyableCodeBlock label="Network Filter" text={config.networkFilter}/>
            </div>

            <div className="mt-auto">
                {savedData ? (
                    <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-sm font-black text-emerald-500">
                                ✅ Configured
                            </span>

                            <span className="text-xs font-bold text-slate-400">
                                Backend config
                            </span>
                        </div>

                        <div
                            className={`mb-4 max-h-48 overflow-auto rounded-lg border p-3 ${theme.preview}`}
                        >
                            <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-5">
                                {displayContent}
                            </pre>
                        </div>

                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-3 text-sm font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <span>🗑</span>
                            {isDeleting ? "Deleting..." : "Delete Configuration"}
                        </button>
                    </div>
                ) : (
                    <div>
                        <textarea
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            rows={7}
                            placeholder={config.placeholder}
                            className={`mb-4 w-full resize-none rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-800 outline-none transition focus:ring-4 dark:border-slate-700 dark:bg-[#101827] dark:text-slate-200 ${theme.textarea} ${theme.focusRing}`}
                        />

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!input.trim() || isSaving}
                            className={`w-full rounded-lg px-4 py-3 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${theme.saveButton}`}
                        >
                            {isSaving ? "Saving..." : "Save Configuration"}
                        </button>
                    </div>
                )}
            </div>
        </article>
    )
}

function GmailIntegrationCard({
                                  gmail,
                                  profileId,
                                  onSaveToken,
                                  onTestConnection,
                              }: {
    gmail: GmailState | null
    profileId: number | null
    onSaveToken: (token: string) => Promise<void>
    onTestConnection: () => Promise<void>
}) {
    const [token, setToken] = useState("")
    const [showToken, setShowToken] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isTesting, setIsTesting] = useState(false)

    const isConnected = gmail?.status === "connected"
    const hasProfile = profileId !== null

    const handleSave = async () => {
        if (!token.trim() || !hasProfile) return

        setIsSaving(true)

        try {
            await onSaveToken(token)
            setToken("")
        } finally {
            setIsSaving(false)
        }
    }

    const handleTest = async () => {
        setIsTesting(true)

        try {
            await onTestConnection()
        } finally {
            setIsTesting(false)
        }
    }

    return (
        <article
            className="relative overflow-hidden rounded-xl border border-slate-200/90 bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700/90 dark:bg-[#172033]/90">
            <div
                className={`absolute left-0 top-0 h-1 w-full ${
                    isConnected ? "bg-emerald-500" : "bg-red-500"
                }`}
            />

            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-black text-[#172033] dark:text-slate-50">
                        <span>📧</span>
                        Gmail SMTP
                    </h2>

                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                        Used to send email notifications for new job matches.
                    </p>
                </div>

                <span
                    className={`rounded-md px-3 py-1 text-xs font-black uppercase tracking-wide ${
                        isConnected
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                >
                    {isConnected ? "Connected" : "Not Configured"}
                </span>
            </div>

            <label className="mb-2 block text-xs font-black text-slate-500 dark:text-slate-400">
                App Password (Not your Google Password)
            </label>

            <div className="relative mb-4">
                <input
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder={gmail?.appPasswordPreview ?? "•••• •••• •••• ••••"}
                    disabled={!hasProfile}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 pr-12 font-mono text-sm text-slate-800 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-500/30 dark:border-slate-700 dark:bg-[#101827] dark:text-slate-200"
                />

                <button
                    type="button"
                    onClick={() => setShowToken((current) => !current)}
                    disabled={!hasProfile}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-900 dark:hover:text-white"
                    aria-label="Toggle token visibility"
                >
                    {showToken ? "🙈" : "👁"}
                </button>
            </div>

            {!hasProfile && (
                <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    No profile found. Create a profile first.
                </p>
            )}

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!hasProfile || !token.trim() || isSaving}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSaving ? "Saving..." : "Save Token"}
                </button>

                <button
                    type="button"
                    onClick={handleTest}
                    disabled={!hasProfile || isTesting}
                    className="rounded-lg bg-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                    {isTesting ? "Testing..." : "Test"}
                </button>
            </div>
        </article>
    )
}

export default function FetchConfigPage() {
    const [scraperConfigs, setScraperConfigs] = useState<ScraperConfigMeta[]>([])
    const [configsData, setConfigsData] = useState<ScraperConfigsData>({})
    const [gmail, setGmail] = useState<GmailState | null>(null)
    const [profileId, setProfileId] = useState<number | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)

    const flashStatus = useCallback((message: string) => {
        setStatusMessage(message)
        window.setTimeout(() => setStatusMessage(null), 3500)
    }, [])

    const loadData = useCallback(async () => {
        setIsLoading(true)

        try {
            const data = await getFetchConfigData()

            setScraperConfigs(data.scraperConfigs)
            setConfigsData(data.configsData)
            setGmail(data.gmail)
            setProfileId(data.profileId)
        } catch (error) {
            flashStatus(`❌ ${getErrorMessage(error)}`)
        } finally {
            setIsLoading(false)
        }
    }, [flashStatus])

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadData()
        }, 0)

        return () => window.clearTimeout(timeoutId)
    }, [loadData])

    const handleSaveConfig = async (config: ScraperConfigMeta, curl: string) => {
        setStatusMessage(`Saving ${config.title}...`)

        try {
            const savedConfig = await saveScraperConfig(config, curl)

            setConfigsData((current) => ({
                ...current,
                [config.id]: savedConfig,
            }))

            flashStatus(`✅ ${config.title} updated.`)
        } catch (error) {
            flashStatus(`❌ ${getErrorMessage(error)}`)
        }
    }

    const handleDeleteConfig = async (config: ScraperConfigMeta) => {
        setStatusMessage(`Deleting ${config.title}...`)

        try {
            await deleteScraperConfig(config)

            setConfigsData((current) => ({
                ...current,
                [config.id]: null,
            }))

            flashStatus(`🗑️ ${config.title} deleted.`)
        } catch (error) {
            flashStatus(`❌ ${getErrorMessage(error)}`)
        }
    }

    const handleSaveGmailToken = async (token: string) => {
        if (profileId === null) {
            flashStatus("❌ No profile found. Create a profile first.")
            return
        }

        setStatusMessage("Saving Gmail token...")

        try {
            const updatedGmail = await saveGmailToken(profileId, token)

            setGmail((current) => ({
                ...updatedGmail,
                profileEmail: current?.profileEmail ?? "",
            }))
            flashStatus("✅ Gmail token saved securely.")
        } catch (error) {
            flashStatus(`❌ ${getErrorMessage(error)}`)
        }
    }

    const handleTestGmailConnection = async () => {
        if (profileId === null) {
            flashStatus("❌ No profile found. Create a profile first.")
            return
        }

        setStatusMessage("Testing Gmail connection...")

        try {
            const message = await testGmailConnection(profileId)
            flashStatus(message)
        } catch (error) {
            flashStatus(`❌ ${getErrorMessage(error)}`)
        }
    }

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
            <section className="border-b border-slate-200 pb-4 dark:border-slate-700">
                <h1 className="m-0 text-4xl font-black tracking-tight text-[#172033] dark:text-slate-50">
                    Fetch Configuration
                </h1>

                <p className="m-0 mt-3 max-w-2xl text-base font-medium leading-6 text-slate-600 dark:text-slate-300">
                    Manage scraper settings and external integrations backed by the
                    local backend service.
                </p>
            </section>

            {statusMessage && (
                <div
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-black text-blue-800 shadow-sm dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                    {statusMessage}
                </div>
            )}

            <section>
                <h2 className="mb-5 flex items-center gap-2 text-2xl font-black text-[#172033] dark:text-slate-50">
                    <span>🗃️</span>
                    Scraper Configuration
                </h2>

                {isLoading ? (
                    <div
                        className="rounded-xl border border-slate-200 bg-white/80 p-8 text-center text-sm font-black text-slate-500 dark:border-slate-700 dark:bg-[#172033]/80 dark:text-slate-300">
                        Loading configurations...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                        {scraperConfigs.map((config) => (
                            <ConfigCard
                                key={config.id}
                                config={config}
                                savedData={configsData[config.id]}
                                onSave={handleSaveConfig}
                                onDelete={handleDeleteConfig}
                            />
                        ))}
                    </div>
                )}
            </section>

            <section>
                <h2 className="mb-5 flex items-center gap-2 text-2xl font-black text-[#172033] dark:text-slate-50">
                    <span>⚡</span>
                    Integrations
                </h2>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <GmailIntegrationCard
                        gmail={gmail}
                        profileId={profileId}
                        onSaveToken={handleSaveGmailToken}
                        onTestConnection={handleTestGmailConnection}
                    />

                    <div
                        className="flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white/40 p-6 text-slate-400 dark:border-slate-700 dark:bg-[#172033]/40 dark:text-slate-500">
                        <span className="text-5xl">＋</span>
                        <span className="mt-3 text-sm font-black">Add New Integration</span>
                    </div>
                </div>
            </section>
        </div>
    )
}
