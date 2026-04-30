import {type ReactNode, useEffect, useMemo, useState} from "react"
import {
    AlertCircle,
    Check,
    Clock,
    Copy,
    FileText,
    Lightbulb,
    Mail,
    MailOpen,
    Sparkles,
    Tag,
} from "lucide-react"

import type {RejectionEmail} from "./rejectionsMockService.ts"

const STORAGE_PREFIX = "rejection-improvement"

const DEFAULT_PROMPT_TEMPLATE = `Vou te passar uma rejeicao de vaga que estou usando como backlog de melhoria.

Sua tarefa e adicionar UMA nova entry para a empresa abaixo, mantendo o mesmo estilo da tabela.

Empresa: {{COMPANY}}

Email de rejeicao:
"{{REJECTION_EMAIL}}"

Descricao da vaga:
{{JOB_DESCRIPTION}}

Curriculo usado:
{{RESUME_CONTENT}}

Criterios:

- Compare a vaga com o curriculo.
- Nao invente lacunas genericas.
- Nao diga que faltou algo que ja esta bem evidenciado no curriculo.
- Se algo existe no curriculo, mas esta mal apresentado, escreva como "melhorar evidencia/apresentacao de X".
- Separe mentalmente:
    1. gap tecnico controlavel;
    2. evidencia fraca no curriculo;
    3. filtro fora do controle;
    4. bom match, mas possivel concorrencia/timing.
- Priorize pontos que eu posso estudar, praticar ou melhorar no curriculo.
- Se a rejeicao parecer mais causada por filtro fora do controle, deixe isso explicito.
- Seja criterioso e nao apenas concorde comigo.

Responda apenas com a nova linha da tabela, neste formato:

| Empresa | Email | O que faltou? |
| --- | --- | --- |
| [Empresa] | [Resumo curto do email, com o cargo e o trecho "will not be moving forward" ou equivalente] | * ponto 1<br>* ponto 2<br>* ponto 3 |`

function getSenderInitial(sender: string) {
    return sender.trim().charAt(0).toUpperCase() || "?"
}

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

function formatRelativeDuration(fromValue?: string, toValue?: string) {
    const fromDate = getDateTime(fromValue)
    const toDate = getDateTime(toValue)

    if (!fromDate || !toDate) return null

    const diffMs = toDate.getTime() - fromDate.getTime()
    const isBefore = diffMs >= 0
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

    return `${label} ${isBefore ? "before rejection" : "after rejection"}`
}

function storageKey(emailId: number, field: string) {
    return `${STORAGE_PREFIX}:${emailId}:${field}`
}

function readCachedValue(emailId: number, field: string, fallback = "") {
    if (typeof window === "undefined") return fallback

    return window.localStorage.getItem(storageKey(emailId, field)) ?? fallback
}

function writeCachedValue(emailId: number, field: string, value: string) {
    if (typeof window === "undefined") return

    window.localStorage.setItem(storageKey(emailId, field), value)
}

type TextPanelProps = {
    icon: ReactNode
    label: string
    value: string
    onChange?: (value: string) => void
    placeholder?: string
    readOnly?: boolean
    hint?: string
    minHeightClass?: string
}

function TextPanel({
    icon,
    label,
    value,
    onChange,
    placeholder,
    readOnly = false,
    hint,
    minHeightClass = "min-h-64",
}: TextPanelProps) {
    return (
        <section className="flex min-h-0 flex-col rounded-xl border border-gray-800 bg-gray-900/70">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400">
                    {icon}
                    {label}
                </div>
                {hint && (
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-300">
                        {hint}
                    </span>
                )}
            </div>

            <textarea
                readOnly={readOnly}
                value={value}
                onChange={event => onChange?.(event.target.value)}
                placeholder={placeholder}
                spellCheck={false}
                className={`${minHeightClass} flex-1 resize-none rounded-b-xl border-0 bg-transparent p-4 text-sm font-medium leading-7 text-gray-300 outline-none placeholder:text-gray-600 focus:ring-2 focus:ring-red-500/20 ${
                    readOnly ? "cursor-text bg-gray-950/20" : ""
                }`}
            />
        </section>
    )
}

type RejectionImprovementBuilderProps = {
    email: RejectionEmail | null
}

type RejectionImprovementContentProps = {
    email: RejectionEmail
}

function RejectionImprovementContent({email}: RejectionImprovementContentProps) {
    const hasLinkedJob = Boolean(email.jobUrn)
    const linkedJobDescription = email.jobDescription ?? ""
    const linkedJobDescriptionMissingMessage =
        "Linked job found, but no job description was returned by the backend."
    const [jobDescription, setJobDescription] = useState(() =>
        hasLinkedJob
            ? linkedJobDescription
            : readCachedValue(email.id, "job-description", email.jobDescription ?? ""),
    )
    const [resumeContent, setResumeContent] = useState(() =>
        readCachedValue(email.id, "resume-content"),
    )
    const [improvement, setImprovement] = useState(() =>
        readCachedValue(email.id, "improvement"),
    )
    const [promptTemplate, setPromptTemplate] = useState(() =>
        readCachedValue(email.id, "prompt-template", DEFAULT_PROMPT_TEMPLATE),
    )
    const [copied, setCopied] = useState(false)
    const effectiveJobDescription = hasLinkedJob ? linkedJobDescription : jobDescription

    useEffect(() => {
        if (hasLinkedJob) return

        writeCachedValue(email.id, "job-description", jobDescription)
    }, [email, hasLinkedJob, jobDescription])

    useEffect(() => {
        writeCachedValue(email.id, "resume-content", resumeContent)
    }, [email, resumeContent])

    useEffect(() => {
        writeCachedValue(email.id, "improvement", improvement)
    }, [email, improvement])

    useEffect(() => {
        writeCachedValue(email.id, "prompt-template", promptTemplate)
    }, [email, promptTemplate])

    const finalPrompt = useMemo(() => {
        if (!email) return ""

        const promptJobDescription =
            hasLinkedJob && !linkedJobDescription
                ? "[DESCRICAO DA VAGA VINCULADA NAO RETORNADA PELO BACKEND]"
                : effectiveJobDescription || "[COLE A DESCRICAO DA VAGA AQUI]"

        return promptTemplate
            .replaceAll("{{COMPANY}}", email.company ?? email.sender)
            .replaceAll("{{REJECTION_EMAIL}}", email.bodyText)
            .replaceAll("{{JOB_DESCRIPTION}}", promptJobDescription)
            .replaceAll(
                "{{RESUME_CONTENT}}",
                resumeContent || "[COLE OU ANEXE O CURRICULO AQUI]",
            )
    }, [
        email,
        effectiveJobDescription,
        hasLinkedJob,
        linkedJobDescription,
        promptTemplate,
        resumeContent,
    ])

    async function handleCopyPrompt() {
        await navigator.clipboard.writeText(finalPrompt)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
    }

    const {date, time} = formatDateTime(email.receivedAt)
    const appliedDateTime = email.appliedAt ? formatDateTime(email.appliedAt) : null
    const appliedDelta = formatRelativeDuration(email.appliedAt, email.receivedAt)

    return (
        <article className="flex h-full min-h-[620px] flex-col bg-gray-950/30">
            <header className="border-b border-gray-800 p-5">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider text-red-300">
                    <AlertCircle size={15}/>
                    Job fails
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px]">
                        rejection
                    </span>
                    {improvement.trim() && (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                            cached improvement
                        </span>
                    )}
                </div>

                <h2 className="text-2xl font-black leading-tight text-white">
                    {email.jobTitle ?? email.subject}
                </h2>

                <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-red-500/15 text-sm font-black text-red-300">
                            {getSenderInitial(email.sender)}
                        </div>

                        <div className="min-w-0">
                            <p className="truncate text-sm font-black text-gray-100">
                                {email.company ?? email.sender}
                            </p>
                            <p className="truncate text-xs font-medium text-gray-500">
                                {email.senderEmail}
                            </p>
                            <p className="mt-1 truncate text-xs font-medium text-gray-600">
                                to {email.recipient}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-black text-red-300">
                            <Tag size={13}/>
                            {email.folder}
                        </span>
                        {email.competition !== undefined && (
                            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-300">
                                {email.competition.toLocaleString("en-US")} competitors
                            </span>
                        )}
                        {email.jobUrn && (
                            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-300">
                                Linked job {email.jobUrn}
                            </span>
                        )}
                        {appliedDateTime && appliedDelta && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-300">
                                <Clock size={13}/>
                                Applied {appliedDateTime.date} {appliedDateTime.time} · {appliedDelta}
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-xs font-black text-gray-400">
                            {email.isRead ? <MailOpen size={13}/> : <Mail size={13}/>}
                            {email.isRead ? "Read" : "Unread"}
                        </span>
                        <span className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 font-mono text-xs font-bold text-gray-400">
                            {date} {time}
                        </span>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
                <div className="grid gap-4 xl:grid-cols-3">
                    <TextPanel
                        icon={<Mail size={15}/>}
                        label="1. Rejection email"
                        value={email.bodyText}
                        readOnly
                    />

                    <TextPanel
                        icon={<FileText size={15}/>}
                        label="2. Job description"
                        value={
                            hasLinkedJob && !linkedJobDescription
                                ? linkedJobDescriptionMissingMessage
                                : effectiveJobDescription
                        }
                        onChange={hasLinkedJob ? undefined : setJobDescription}
                        placeholder={
                            hasLinkedJob
                                ? undefined
                                : "Paste or adjust the job description for this rejection..."
                        }
                        readOnly={hasLinkedJob}
                        hint={
                            hasLinkedJob && linkedJobDescription
                                ? "Loaded from linked job"
                                : hasLinkedJob
                                  ? "Linked job missing description"
                                : undefined
                        }
                    />

                    <TextPanel
                        icon={<Lightbulb size={15}/>}
                        label="3. Improvement backlog"
                        value={improvement}
                        onChange={setImprovement}
                        placeholder="Write the curriculum/study improvements here. This is saved in browser cache."
                    />
                </div>

                <section className="mt-4 rounded-xl border border-gray-800 bg-gray-900/70">
                    <div className="flex flex-col gap-3 border-b border-gray-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-300">
                            <Sparkles size={15}/>
                            Prompt builder
                        </div>

                        <button
                            type="button"
                            onClick={() => void handleCopyPrompt()}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs font-black text-white transition hover:bg-purple-500"
                        >
                            {copied ? <Check size={15}/> : <Copy size={15}/>}
                            {copied ? "Copied" : "Copy prompt"}
                        </button>
                    </div>

                    <div className="grid gap-4 p-4 xl:grid-cols-3">
                        <TextPanel
                            icon={<Sparkles size={15}/>}
                            label="Instructions"
                            value={promptTemplate}
                            onChange={setPromptTemplate}
                            minHeightClass="min-h-72"
                        />

                        <TextPanel
                            icon={<FileText size={15}/>}
                            label="Resume used"
                            value={resumeContent}
                            onChange={setResumeContent}
                            placeholder="Paste the resume used for this application..."
                            minHeightClass="min-h-72"
                        />

                        <TextPanel
                            icon={<Copy size={15}/>}
                            label="Final prompt"
                            value={finalPrompt}
                            readOnly
                            minHeightClass="min-h-72"
                        />
                    </div>
                </section>
            </div>
        </article>
    )
}

export default function RejectionImprovementBuilder({
    email,
}: RejectionImprovementBuilderProps) {
    if (!email) {
        return (
            <div className="flex h-full min-h-[620px] items-center justify-center bg-gray-950/30 px-6 text-center">
                <div>
                    <Mail size={44} className="mx-auto mb-4 text-gray-700"/>
                    <p className="text-lg font-black text-gray-300">Select an email</p>
                    <p className="mt-2 max-w-sm text-sm font-medium text-gray-500">
                        Pick a rejection message to inspect the email, job description
                        and improvement backlog.
                    </p>
                </div>
            </div>
        )
    }

    return <RejectionImprovementContent key={email.id} email={email}/>
}
