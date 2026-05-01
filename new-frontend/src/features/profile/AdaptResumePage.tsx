import {useEffect, useMemo, useState} from "react"
import {Check, Copy, RefreshCw, Settings, Sparkles} from "lucide-react"
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
    "w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm font-semibold text-gray-200 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"

const textareaClass = `${inputClass} resize-none font-mono text-xs font-normal leading-relaxed`

const labelClass =
    "mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400"

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
        <label className="flex min-h-0 flex-1 flex-col">
            <span className={labelClass}>
                {label}
            </span>
            <textarea
                value={value}
                onChange={event => onChange(event.target.value)}
                rows={rows}
                placeholder={placeholder}
                className={`${textareaClass} min-h-0 flex-1`}
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
        slate: "border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800 hover:text-white",
        blue: "border-purple-500 bg-purple-600 text-white hover:bg-purple-500",
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
        >
            {children}
        </button>
    )
}

export default function AdaptResumePage() {
    const [profile, setProfile] = useState<CareerProfile | null>(null)
    const [resumes, setResumes] = useState<ResumeDraft[]>([])
    const [activeResumeId, setActiveResumeId] = useState<number | null>(null)
    const [format, setFormat] = useState<ExportFormat>("latex")
    const [jobDescription, setJobDescription] = useState("")
    const [includeAtsHiddenKeywords, setIncludeAtsHiddenKeywords] = useState(false)
    const [promptTemplate, setPromptTemplate] = useState(getPromptTemplate("PTBR", "latex"))
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
            setFormat("latex")
            setPromptTemplate(getPromptTemplate(firstResume?.language ?? "PTBR", "latex"))
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
            <main className="min-h-svh bg-gray-950 p-8 text-gray-100">
                <section className="mx-auto max-w-2xl rounded-xl border border-red-900/70 bg-gray-900 p-5 shadow-sm">
                    <p className="text-sm font-black uppercase tracking-wide text-red-400">Backend error</p>
                    <h1 className="mt-2 text-2xl font-black">Profile data could not be loaded</h1>
                    <p className="mt-2 text-sm font-semibold text-gray-300">{loadError}</p>
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
            <main className="min-h-svh bg-gray-950 p-8 text-gray-100">
                Loading resume adapter...
            </main>
        )
    }

    return (
        <main className="min-h-svh bg-black/95 p-4 text-gray-100">
            <section className="flex h-[calc(100svh-2rem)] flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-800 shadow-2xl">
                <header className="flex shrink-0 flex-col gap-3 border-b border-gray-700 bg-gray-800 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-4">
                        <h1 className="flex items-center gap-2 font-mono text-lg font-bold text-white">
                            <Sparkles className="text-purple-400" size={20}/>
                            LLM Context Builder
                        </h1>

                        <div className="flex rounded-lg border border-gray-700 bg-gray-900 p-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setFormat("latex")
                                    setPromptTemplate(getPromptTemplate(activeResume.language, "latex"))
                                }}
                                className={`rounded-md px-3 py-1 text-xs font-bold transition ${format === "latex" ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                            >
                                LaTeX
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setFormat("json")
                                    setPromptTemplate(getPromptTemplate(activeResume.language, "json"))
                                }}
                                className={`rounded-md px-3 py-1 text-xs font-bold transition ${format === "json" ? "bg-emerald-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                            >
                                JSON
                            </button>
                        </div>

                        <div className="hidden h-6 w-px bg-gray-600 md:block"/>

                        <div className="flex items-center gap-2">
                            <span className="select-none text-xl" title="Language detected">
                                {getResumeFlag(activeResume.language)}
                            </span>
                            <select
                                value={activeResume.id}
                                onChange={event => setActiveResumeId(Number(event.target.value))}
                                className="min-w-[150px] max-w-[260px] rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 shadow-sm outline-none transition focus:ring-2 focus:ring-emerald-500"
                            >
                                {resumes.map(resume => (
                                    <option key={resume.id} value={resume.id}>
                                        {resume.internalName} ({getLanguageLabel(resume.language)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <label className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-bold text-gray-300 shadow-sm">
                            <input
                                type="checkbox"
                                checked={includeAtsHiddenKeywords}
                                onChange={event => setIncludeAtsHiddenKeywords(event.target.checked)}
                                className="h-4 w-4 rounded border-gray-600 bg-gray-950 text-purple-500 focus:ring-purple-500"
                            />
                            ATS Hidden Keywords
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            {status}
                        </span>
                        <IconButton label="Reload resumes" onClick={() => void loadProfileData()}>
                            <RefreshCw size={14}/>
                        </IconButton>
                    </div>
                </header>

                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex h-1/3 min-h-0 flex-col border-b border-gray-700 bg-gray-900 p-4">
                        <div className="mb-1 flex items-center justify-between">
                            <span className={labelClass}>
                                <Settings size={12}/>
                                1. Prompt Instructions (Editable)
                            </span>
                            <span className="font-mono text-[10px] text-gray-500">
                                Variables: <span className="text-yellow-500">{"{{JOB_DESCRIPTION}}"}</span>,{" "}
                                <span className="text-emerald-500">{"{{RESUME_CONTENT}}"}</span>
                            </span>
                        </div>
                        <textarea
                            value={promptTemplate}
                            onChange={event => setPromptTemplate(event.target.value)}
                            spellCheck={false}
                            className={`${textareaClass} min-h-0 flex-1 border-dashed border-gray-600 text-gray-300`}
                        />
                    </div>

                    <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-gray-700 bg-gray-900 md:grid-cols-3 md:divide-x md:divide-y-0">
                        <div className="flex min-h-0 flex-col p-4">
                            <TextareaField
                                label="2. Variable: Job Description"
                                value={jobDescription}
                                onChange={setJobDescription}
                                placeholder="Paste job description here..."
                            />
                        </div>

                        <div className="flex min-h-0 flex-col bg-gray-900/50 p-4">
                            <div className="mb-1 flex items-center justify-between">
                                <span className={`${labelClass} text-emerald-500`}>
                                    3. Variable: Resume Content
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] text-gray-600">
                                        {format.toUpperCase()}
                                    </span>
                                    <IconButton
                                        label="Copy resume content"
                                        onClick={() => void handleCopy("resume", resumeExport)}
                                    >
                                        {copied === "resume" ? <Check size={12}/> : <Copy size={12}/>}
                                        {copied === "resume" ? "COPIED" : "COPY"}
                                    </IconButton>
                                </div>
                            </div>
                            <textarea
                                readOnly
                                value={resumeExport}
                                className={`${textareaClass} min-h-0 flex-1 cursor-text opacity-70`}
                            />
                        </div>

                        <div className="flex min-h-0 flex-col bg-gray-800/30 p-4">
                            <div className="mb-1 flex items-center justify-between">
                                <span className={`${labelClass} text-purple-400`}>
                                    4. Final Result (Auto-Generated)
                                </span>
                                <button
                                    type="button"
                                    onClick={() => void handleCopy("prompt", finalPrompt)}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-purple-600 px-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-purple-500"
                                >
                                    {copied === "prompt" ? <Check size={12}/> : <Copy size={12}/>}
                                    {copied === "prompt" ? "COPIED!" : "COPY FINAL"}
                                </button>
                            </div>
                            <textarea
                                readOnly
                                value={finalPrompt}
                                className={`${textareaClass} min-h-0 flex-1 border-purple-500/30 text-gray-300 focus:ring-purple-500`}
                            />
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}
