import {useState} from "react"
import {Check, Copy, FileText, Hash, Sparkles, X} from "lucide-react"

import type {ResumeForSavedJobs, SavedJob} from "./savedJobsService.ts"
import {getCompactJobPayload} from "./savedJobsUtils.ts"

const JOB_PROMPT_TEMPLATES = {
    en: `First, analyze my full resume in depth.

Only after fully understanding my skills, technologies, seniority, and experience, evaluate the jobs listed below.

Before scoring, apply this quick filter:

=== NON-TRADITIONAL SWE FILTER ===
If a job is mainly about evaluating, ranking, labeling, annotating, prompting, correcting AI/model outputs, creating training data, rubrics, reference answers, or vague online task work, and is NOT mainly about building, maintaining, deploying, debugging, scaling, or owning software systems in production, classify it as NON_TRADITIONAL_SWE.

Jobs classified as NON_TRADITIONAL_SWE must be excluded from the ranking, listed separately with a short reason, and not receive a final weighted score.

Use only these criteria for the remaining jobs:
1. Technical keyword match (60%): compare required technologies directly with my resume. Do not invent skills.
2. Seniority compatibility (25%): compare required level and years with my resume.
3. Competition estimation (15%): use applicant count when present; otherwise estimate from seniority.

All scores must be integers from 0 to 100.

Output:
1. Jobs classified as NON_TRADITIONAL_SWE with reasons.
2. A table for the remaining jobs with title, final score, criterion scores, and a short justification that starts with the score in brackets.
3. Ranking from highest to lowest score.`,
    pt: `Primeiro, analise o meu curriculo COMPLETO em profundidade.

Somente depois de entender minhas habilidades, tecnologias, senioridade e experiencia, avalie as vagas listadas abaixo.

Antes de pontuar, aplique este filtro rapido:

=== FILTRO DE VAGAS NAO TRADICIONAIS DE SWE ===
Se a vaga for principalmente sobre avaliar, ranquear, rotular, anotar, criar prompts, corrigir respostas de IA/modelos, criar training data, rubricas, respostas de referencia ou trabalho vago de tarefas online, e NAO for principalmente sobre construir, manter, publicar, debugar, escalar ou ser responsavel por sistemas de software em producao, classifique como NON_TRADITIONAL_SWE.

Vagas classificadas como NON_TRADITIONAL_SWE devem ser excluidas do ranking, listadas separadamente com uma razao curta, e nao receber score final ponderado.

Use apenas estes criterios para as vagas restantes:
1. Match tecnico por keywords (60%): compare tecnologias exigidas diretamente com meu curriculo. Nao invente skills.
2. Compatibilidade de senioridade (25%): compare nivel exigido e anos com meu curriculo.
3. Concorrencia estimada (15%): use numero de candidatos quando existir; caso contrario estime pela senioridade.

Todos os scores devem ser inteiros de 0 a 100.

Saida:
1. Vagas classificadas como NON_TRADITIONAL_SWE com razoes.
2. Uma tabela das vagas restantes com titulo, score final, notas por criterio e justificativa curta que comece com o score entre colchetes.
3. Ranking da maior para a menor nota.`,
}

type SavedJobContextBuilderProps = {
    isOpen: boolean
    jobs: Array<{job: SavedJob; score: number}>
    resumes: ResumeForSavedJobs[]
    selectedResumeId: number | null
    onResumeChange: (resumeId: number) => void
    onClose: () => void
}

export default function SavedJobContextBuilder({
    isOpen,
    jobs,
    resumes,
    selectedResumeId,
    onResumeChange,
    onClose,
}: SavedJobContextBuilderProps) {
    const selectedResume = resumes.find((resume) => resume.id === selectedResumeId)
    const selectedLanguage = selectedResume?.language ?? "en"
    const [promptByLanguage, setPromptByLanguage] = useState(JOB_PROMPT_TEMPLATES)
    const [jobCount, setJobCount] = useState<number | null>(null)
    const [copied, setCopied] = useState(false)
    const prompt = promptByLanguage[selectedLanguage]
    const effectiveJobCount = jobs.length === 0 ? 0 : Math.min(jobCount ?? 5, jobs.length)

    const selectedJobs = jobs
        .slice(0, effectiveJobCount)
        .map(({job, score}) => getCompactJobPayload(job, score))
    const selectedJobsContent = JSON.stringify(selectedJobs, null, 2)
    const resumeContent = selectedResume
        ? JSON.stringify(selectedResume.content, null, 2)
        : ""

    const finalOutput = `${prompt}

=== MEU CURRICULO / MY RESUME ===
${resumeContent}

=== VAGAS SELECIONADAS / SELECTED JOBS (${effectiveJobCount}) ===
${selectedJobsContent}`

    async function handleCopy() {
        await navigator.clipboard.writeText(finalOutput)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
            <div className="flex h-[94vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
                <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-3">
                    <h2 className="flex items-center gap-2 text-lg font-black text-white">
                        <Sparkles size={20} className="text-emerald-300"/>
                        Job & Resume Matcher
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close builder"
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-red-500/15 hover:text-red-200"
                    >
                        <X size={20}/>
                    </button>
                </header>

                <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr_34%]">
                    <section className="border-b border-gray-800 bg-gray-900 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <label className="text-xs font-black uppercase text-emerald-300">
                                1. Prompt Instructions
                            </label>
                            <span className="font-mono text-[11px] text-gray-500">
                                Language:{" "}
                                <span className="text-gray-200">
                                    {selectedLanguage.toUpperCase()}
                                </span>
                            </span>
                        </div>
                        <textarea
                            value={prompt}
                            onChange={(event) =>
                                setPromptByLanguage((current) => ({
                                    ...current,
                                    [selectedLanguage]: event.target.value,
                                }))
                            }
                            className="h-28 w-full resize-none rounded-lg border border-gray-700 bg-gray-950 p-3 font-mono text-xs text-gray-200 outline-none focus:border-emerald-500"
                        />
                    </section>

                    <section className="grid min-h-0 grid-cols-1 divide-y divide-gray-800 md:grid-cols-2 md:divide-x md:divide-y-0">
                        <div className="flex min-h-0 flex-col bg-gray-900/80 p-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <label className="flex items-center gap-2 text-xs font-black uppercase text-sky-300">
                                    <Hash size={14}/>
                                    2. Ranked Jobs
                                </label>
                                <div className="flex items-center gap-2 rounded border border-gray-800 bg-gray-950 px-2 py-1">
                                    <input
                                        type="range"
                                        min="0"
                                        max={jobs.length || 1}
                                        value={effectiveJobCount}
                                        onChange={(event) => setJobCount(Number(event.target.value))}
                                        className="w-28 accent-sky-500"
                                    />
                                    <span className="w-8 text-center font-mono text-xs font-black text-white">
                                        {effectiveJobCount}
                                    </span>
                                </div>
                            </div>
                            <textarea
                                readOnly
                                value={selectedJobsContent}
                                className="min-h-0 flex-1 resize-none rounded-lg border border-gray-800 bg-gray-950 p-3 font-mono text-[11px] text-gray-400 outline-none"
                            />
                        </div>

                        <div className="flex min-h-0 flex-col bg-gray-900/80 p-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <label className="flex items-center gap-2 text-xs font-black uppercase text-violet-300">
                                    <FileText size={14}/>
                                    3. Resume
                                </label>
                                <select
                                    value={selectedResumeId ?? ""}
                                    onChange={(event) => onResumeChange(Number(event.target.value))}
                                    className="max-w-56 rounded border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs font-bold text-gray-200 outline-none focus:border-emerald-500"
                                >
                                    {resumes.map((resume) => (
                                        <option key={resume.id} value={resume.id}>
                                            {resume.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <textarea
                                readOnly
                                value={resumeContent}
                                className="min-h-0 flex-1 resize-none rounded-lg border border-gray-800 bg-gray-950 p-3 font-mono text-[11px] text-gray-400 outline-none"
                            />
                        </div>
                    </section>

                    <section className="flex min-h-0 flex-col border-t border-gray-800 bg-gray-950 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <label className="text-xs font-black uppercase text-gray-300">
                                4. Final Context
                            </label>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black transition ${
                                    copied
                                        ? "bg-emerald-600 text-white"
                                        : "bg-emerald-500 text-gray-950 hover:bg-emerald-400"
                                }`}
                            >
                                {copied ? <Check size={14}/> : <Copy size={14}/>}
                                {copied ? "Copied" : "Copy final context"}
                            </button>
                        </div>
                        <textarea
                            readOnly
                            value={finalOutput}
                            className="min-h-0 flex-1 resize-none rounded-lg border border-gray-700 bg-black/30 p-3 font-mono text-xs text-gray-300 outline-none"
                        />
                    </section>
                </div>
            </div>
        </div>
    )
}
