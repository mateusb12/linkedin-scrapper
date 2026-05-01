import {useEffect, useMemo, useState} from "react"
import {Check, Copy, FileJson, FileText, RefreshCw, Sparkles} from "lucide-react"
import type {ReactNode} from "react"

import {
    fetchProfile,
    fetchResumes,
    type CareerProfile,
    type ResumeDraft,
} from "./profileService"
import {
    buildFinalPrompt,
    type ExportFormat,
    generateResumeExport,
    getLanguageLabel,
    getPromptTemplate,
    getResumeFlag,
} from "./profileResumeUtils"

const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-[#101827] dark:text-slate-100"

const textareaClass = `${inputClass} min-h-24 resize-y font-normal leading-6`

function TextareaField({
                           label,
                           value,
                           onChange,
                           rows = 4,
                           placeholder,
                       }: {
    label: string
    value: string
    onChange: (value: string) => void
    rows?: number
    placeholder?: string
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
            </span>
            <textarea
                value={value}
                onChange={event => onChange(event.target.value)}
                rows={rows}
                placeholder={placeholder}
                className={textareaClass}
            />
        </label>
    )
}

function IconButton({
                        label,
                        onClick,
                        children,
                        tone = "slate",
                        disabled = false,
                    }: {
    label: string
    onClick: () => void
    children: ReactNode
    tone?: "slate" | "blue"
    disabled?: boolean
}) {
    const tones = {
        slate:
            "border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
        blue: "border-blue-500 bg-blue-600 text-white hover:bg-blue-700",
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
        >
            {children}
        </button>
    )
}

export default function AdaptResumePage() {
    const [profile, setProfile] = useState<CareerProfile | null>(null)
    const [resumes, setResumes] = useState<ResumeDraft[]>([])
    const [activeResumeId, setActiveResumeId] = useState<number | null>(null)
    const [format, setFormat] = useState<ExportFormat>("json")
    const [jobDescription, setJobDescription] = useState("")
    const [includeAtsHiddenKeywords, setIncludeAtsHiddenKeywords] = useState(false)
    const [promptTemplate, setPromptTemplate] = useState(getPromptTemplate("PTBR", "json"))
    const [copied, setCopied] = useState<"resume" | "prompt" | null>(null)
    const [status, setStatus] = useState("Backend SQLite")
    const [loadError, setLoadError] = useState("")

    async function loadProfileData() {
        try {
            const nextProfile = await fetchProfile()
            const nextResumes = await fetchResumes(nextProfile)
            const firstResume = nextResumes[0] ?? null

            setProfile(nextProfile)
            setResumes(nextResumes)
            setActiveResumeId(firstResume?.id ?? null)
            setPromptTemplate(getPromptTemplate(firstResume?.language ?? "PTBR", "json"))
            setStatus("Backend SQLite")
            setLoadError("")
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load profile data"
            setLoadError(message)
            setStatus("Backend unavailable")
        }
    }

    useEffect(() => {
        void loadProfileData()
    }, [])

    const activeResume = resumes.find(resume => resume.id === activeResumeId) ?? null

    useEffect(() => {
        if (!activeResume) return

        setPromptTemplate(getPromptTemplate(activeResume.language, format))
    }, [activeResume?.id, activeResume?.language, format])

    const resumeExport = useMemo(() => {
        if (!activeResume || !profile) return ""

        return generateResumeExport(activeResume, profile, format, includeAtsHiddenKeywords)
    }, [activeResume, format, includeAtsHiddenKeywords, profile])

    const finalPrompt = useMemo(
        () =>
            buildFinalPrompt({
                template: promptTemplate,
                jobDescription,
                resumeContent: resumeExport,
                language: activeResume?.language ?? "PTBR",
                format,
                includeAtsHiddenKeywords,
            }),
        [
            activeResume?.language,
            format,
            includeAtsHiddenKeywords,
            jobDescription,
            promptTemplate,
            resumeExport,
        ],
    )

    const handleCopy = async (kind: "resume" | "prompt", value: string) => {
        await navigator.clipboard.writeText(value)
        setCopied(kind)
        window.setTimeout(() => setCopied(null), 1400)
    }

    if (loadError) {
        return (
            <main className="min-h-svh bg-slate-100 p-8 text-slate-900 dark:bg-[#101827] dark:text-slate-50">
                <section
                    className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-white p-5 shadow-sm dark:border-red-900/70 dark:bg-[#172033]">
                    <p className="text-sm font-black uppercase tracking-wide text-red-500">Backend error</p>
                    <h1 className="mt-2 text-2xl font-black">Profile data could not be loaded</h1>
                    <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{loadError}</p>
                    <button
                        type="button"
                        onClick={() => void loadProfileData()}
                        className="mt-4 rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-black text-white"
                    >
                        Retry
                    </button>
                </section>
            </main>
        )
    }

    if (!profile || !activeResume) {
        return (
            <main className="min-h-svh bg-slate-100 p-8 text-slate-900 dark:bg-[#101827] dark:text-slate-50">
                Loading resume adapter...
            </main>
        )
    }

    return (
        <main className="min-h-svh bg-slate-100 text-slate-900 dark:bg-[#101827] dark:text-slate-50">
            <header className="border-b border-slate-800 bg-[#0f172a] px-5 py-5 text-white">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-blue-300">
                            Context Builder
                        </p>
                        <h1 className="mt-1 text-3xl font-black tracking-normal">
                            Adapt Resume
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={activeResume.id}
                            onChange={event => {
                                const nextId = Number(event.target.value)
                                setActiveResumeId(nextId)
                            }}
                            className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-black text-white outline-none focus:border-blue-400"
                        >
                            {resumes.map(resume => (
                                <option key={resume.id} value={resume.id}>
                                    {getResumeFlag(resume.language)} {resume.internalName} ({getLanguageLabel(resume.language)})
                                </option>
                            ))}
                        </select>

                        <IconButton label="Reload resumes" onClick={() => void loadProfileData()}>
                            <RefreshCw size={16}/>
                        </IconButton>
                    </div>
                </div>
            </header>

            <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 xl:grid-cols-[280px_minmax(0,1fr)]">
                <aside
                    className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-5 dark:border-slate-800 dark:bg-[#172033]">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-50">
                        <FileText className="size-5 text-blue-500"/>
                        Resume
                    </div>
                    <div className="mt-4 grid gap-2">
                        {resumes.map(resume => {
                            const isActive = resume.id === activeResume.id

                            return (
                                <button
                                    key={resume.id}
                                    type="button"
                                    onClick={() => setActiveResumeId(resume.id)}
                                    className={`rounded-lg border px-3 py-2 text-left text-sm font-black transition ${isActive ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                                >
                                    {getResumeFlag(resume.language)} {resume.internalName}
                                </button>
                            )
                        })}
                    </div>
                </aside>

                <section
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#172033]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="flex items-center gap-2 text-lg font-black">
                            <Sparkles className="size-5 text-blue-500"/>
                            Context Builder
                        </h2>
                        <span
                            className="rounded-full border border-slate-300 px-2 py-1 text-xs font-black text-slate-500 dark:border-slate-700">
                            {status}
                        </span>
                    </div>

                    <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormat("json")
                                        setPromptTemplate(getPromptTemplate(activeResume.language, "json"))
                                    }}
                                    className={`rounded-lg border px-3 py-2 text-sm font-black transition ${format === "json" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
                                >
                                    JSON Patch
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormat("latex")
                                        setPromptTemplate(getPromptTemplate(activeResume.language, "latex"))
                                    }}
                                    className={`rounded-lg border px-3 py-2 text-sm font-black transition ${format === "latex" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
                                >
                                    LaTeX Legacy
                                </button>
                            </div>

                            <label
                                className="mt-3 flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={includeAtsHiddenKeywords}
                                    onChange={event => setIncludeAtsHiddenKeywords(event.target.checked)}
                                    className="size-4"
                                />
                                ATS keywords
                            </label>

                            <div className="mt-4">
                                <TextareaField
                                    label="Prompt template"
                                    value={promptTemplate}
                                    onChange={setPromptTemplate}
                                    rows={8}
                                />
                            </div>

                            <div className="mt-4">
                                <TextareaField
                                    label="Job description"
                                    value={jobDescription}
                                    onChange={setJobDescription}
                                    rows={10}
                                    placeholder="Paste the job description here..."
                                />
                            </div>
                        </div>

                        <div>
                            <div>
                                <div className="mb-1 flex items-center justify-between">
                                    <span
                                        className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Resume source
                                    </span>
                                    <IconButton
                                        label="Copy resume source"
                                        onClick={() => void handleCopy("resume", resumeExport)}
                                    >
                                        {copied === "resume" ? (
                                            <Check size={16}/>
                                        ) : format === "json" ? (
                                            <FileJson size={16}/>
                                        ) : (
                                            <Copy size={16}/>
                                        )}
                                    </IconButton>
                                </div>
                                <textarea
                                    readOnly
                                    value={resumeExport}
                                    rows={12}
                                    className={`${textareaClass} font-mono text-xs`}
                                />
                            </div>

                            <div className="mt-4">
                                <div className="mb-1 flex items-center justify-between">
                                    <span
                                        className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Final prompt
                                    </span>
                                    <IconButton
                                        label="Copy final prompt"
                                        onClick={() => void handleCopy("prompt", finalPrompt)}
                                        tone="blue"
                                    >
                                        {copied === "prompt" ? <Check size={16}/> : <Copy size={16}/>}
                                    </IconButton>
                                </div>
                                <textarea
                                    readOnly
                                    value={finalPrompt}
                                    rows={14}
                                    className={`${textareaClass} font-mono text-xs`}
                                />
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}