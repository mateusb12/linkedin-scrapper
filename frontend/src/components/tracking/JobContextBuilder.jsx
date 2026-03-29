import React, { useState, useEffect, useMemo } from "react";
import { X, Copy, Check, Sparkles, Hash, FileText } from "lucide-react";
import { denormalizeResume } from "../profile/resumeJsonMapper";

import {
  ResumeSelector,
  getResumeLangKey,
} from "../profile/ResumeContextBuilder";

const JOB_PROMPT_TEMPLATES = {
  en: `
First, analyze my full resume in depth.

Only after fully understanding my skills, technologies, seniority, and experience,
evaluate the jobs listed below.

Before scoring, apply this quick filter:

=== NON-TRADITIONAL SWE FILTER ===
If a job is mainly about:
- evaluating, ranking, labeling, annotating, prompting, or correcting AI/model outputs
- creating training data, rubrics, reference answers, or feedback for model improvement
- vague online task work that does not involve building or owning software systems

and is NOT mainly about:
- building, maintaining, deploying, debugging, scaling, or owning software systems in production

then classify it as:
NON_TRADITIONAL_SWE

Jobs classified as NON_TRADITIONAL_SWE must:
- be excluded from the ranking
- be listed separately with a short reason
- not receive a final weighted score

Use ONLY the criteria below to evaluate the remaining jobs:

=== CRITERIA ===
1. Technical keyword match (weight 60%)
   - Compare the job's required technologies directly with my resume.
   - Do NOT invent skills that are not present in my resume.

2. Seniority compatibility (weight 25%)
   - Compare the job's required experience level (junior/mid/senior) with mine.
   - Penalize jobs requiring significantly more years of experience than I have.

3. Competition estimation (weight 15%)
   - If the job listing includes number of applicants, use it.
   - If not, estimate:
       junior = high competition
       mid-level = medium
       senior = low competition

=== SCORING ===
Final score (0–100) =
(keywords * 0.60) + (seniority * 0.25) + (competition * 0.15)

Each criterion must also be scored individually (0–100 before weighting).

=== OUTPUT ===
1. First, list all jobs classified as NON_TRADITIONAL_SWE with a short reason.
2. Then provide a table listing only the remaining jobs:
   - job title
   - final score
   - individual criterion scores
   - short justification
3. Ranking of the remaining jobs from highest to lowest score.

Wait for me to send the jobs and my resume.
`,

  pt: `
Primeiro, analise o meu currículo COMPLETO em profundidade.

Somente depois de entender minhas habilidades, tecnologias, senioridade e experiência,
avalie as vagas listadas abaixo.

Antes de pontuar, aplique este filtro rápido:

=== FILTRO DE VAGAS NÃO TRADICIONAIS DE SWE ===
Se a vaga for principalmente sobre:
- avaliar, ranquear, rotular, anotar, criar prompts ou corrigir respostas de IA/modelos
- criar training data, rubricas, respostas de referência ou feedback para melhorar modelos
- trabalho vago de tarefas online sem construção ou ownership de sistemas de software

e NÃO for principalmente sobre:
- construir, manter, publicar, debugar, escalar ou ser responsável por sistemas de software em produção

então classifique a vaga como:
NON_TRADITIONAL_SWE

Vagas classificadas como NON_TRADITIONAL_SWE devem:
- ser excluídas do ranking
- ser listadas separadamente com uma razão curta
- não receber score final ponderado

Use APENAS os critérios abaixo para avaliar as vagas restantes:

=== CRITÉRIOS ===
1. Match técnico por keywords (peso 60%)
   - Compare diretamente as tecnologias pedidas com meu currículo.
   - NÃO invente skills que não estão listadas no meu currículo.

2. Compatibilidade de senioridade (peso 25%)
   - Compare o nível exigido (júnior/pleno/sênior) com o meu.
   - Penalize vagas que pedem muito mais tempo de experiência do que eu tenho.

3. Concorrência estimada (peso 15%)
   - Se a vaga mostra número de candidatos, use esse valor.
   - Se não mostra, estime:
       júnior = concorrência alta
       pleno = média
       sênior = baixa

=== PONTUAÇÃO ===
Score final (0–100) =
(keywords * 0.60) + (senioridade * 0.25) + (concorrencia * 0.15)

Cada critério também deve ter nota individual (0–100 antes do peso).

=== SAÍDA ===
1. Primeiro, liste todas as vagas classificadas como NON_TRADITIONAL_SWE com uma razão curta.
2. Depois, forneça uma tabela contendo apenas as vagas restantes:
   - título da vaga
   - score final
   - notas por critério
   - justificativa curta
3. Ranking das vagas restantes da maior para a menor.

Aguarde eu enviar as vagas e meu currículo.
`,
};

const JobContextBuilder = ({
  isOpen,
  onClose,
  jobs = [],
  resumes = [],
  selectedResumeId,
  handleResumeChange,
}) => {
  const [prompt, setPrompt] = useState("");
  const [jobCount, setJobCount] = useState(5);
  const [copied, setCopied] = useState(false);

  const selectedResume = resumes.find((r) => r.id === selectedResumeId);

  useEffect(() => {
    const lang = getResumeLangKey(selectedResume);
    setPrompt(JOB_PROMPT_TEMPLATES[lang] || JOB_PROMPT_TEMPLATES.en);
  }, [selectedResume?.id]);

  const maxJobs = jobs.length;

  useEffect(() => {
    if (maxJobs > 0 && jobCount > maxJobs) setJobCount(maxJobs);
    if (maxJobs > 0 && jobCount === 0) setJobCount(1);
  }, [maxJobs]);

  const selectedJobsContent = useMemo(() => {
    const sliced = jobs.slice(0, jobCount);

    return JSON.stringify(sliced, null, 2);
  }, [jobs, jobCount]);

  const resumeContent = useMemo(() => {
    if (!selectedResume) return "";
    return JSON.stringify(denormalizeResume(selectedResume), null, 2);
  }, [selectedResume]);

  const finalOutput = `${prompt}

=== MEU CURRÍCULO ===
${resumeContent}

=== VAGAS SELECIONADAS (${jobCount}) ===
${selectedJobsContent}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(finalOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 animate-in fade-in backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-[95vw] h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-700 bg-gray-800 shrink-0">
          <h3 className="text-white font-bold font-mono text-lg flex items-center gap-2">
            <Sparkles className="text-emerald-400" size={20} />
            Job & Resume Matcher
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-red-500/20 p-2 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="p-4 bg-gray-900 border-b border-gray-700 shrink-0">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs uppercase font-bold text-emerald-500 block">
                1. Prompt Instruction
              </label>
              <span className="text-[10px] text-gray-500 font-mono">
                Detected Language:{" "}
                <span className="text-white">
                  {getResumeLangKey(selectedResume).toUpperCase()}
                </span>
              </span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-24 bg-gray-950 border border-gray-700 rounded-lg p-3 text-gray-200 text-xs font-mono focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
              placeholder="Prompt instructions..."
            />
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-700 min-h-0">
            <div className="p-4 flex flex-col min-h-0 bg-gray-900/50">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs uppercase font-bold text-blue-400 flex items-center gap-2">
                  <Hash size={14} /> 2. Saved Jobs Source
                </label>
                <div className="flex items-center gap-2 bg-gray-800 px-2 py-1 rounded border border-gray-700">
                  <input
                    type="range"
                    min="1"
                    max={maxJobs || 1}
                    value={jobCount}
                    onChange={(e) => setJobCount(Number(e.target.value))}
                    className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-xs font-mono font-bold text-white w-6 text-center">
                    {jobCount}
                  </span>
                </div>
              </div>
              <textarea
                readOnly
                value={selectedJobsContent}
                className="flex-1 w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-gray-500 text-[10px] font-mono resize-none focus:outline-none"
              />
            </div>

            <div className="p-4 flex flex-col min-h-0 bg-gray-900/50">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs uppercase font-bold text-purple-400 flex items-center gap-2">
                  <FileText size={14} /> 3. Select Resume
                </label>
                <ResumeSelector
                  resumes={resumes}
                  selectedResumeId={selectedResumeId}
                  handleResumeChange={handleResumeChange}
                  className="scale-90 origin-right"
                />
              </div>
              <textarea
                readOnly
                value={resumeContent}
                className="flex-1 w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-gray-500 text-[10px] font-mono resize-none focus:outline-none"
              />
            </div>
          </div>

          <div className="h-1/3 p-4 bg-gray-800 border-t border-gray-700 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs uppercase font-bold text-gray-300">
                4. Final Context (Auto-Generated)
              </label>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  copied
                    ? "bg-green-600 text-white"
                    : "bg-emerald-600 text-white hover:bg-emerald-500"
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "COPIED TO CLIPBOARD" : "COPY FINAL CONTEXT"}
              </button>
            </div>
            <textarea
              readOnly
              value={finalOutput}
              className="flex-1 w-full bg-black/50 border border-gray-600 rounded-lg p-3 text-gray-300 text-xs font-mono resize-none focus:ring-1 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobContextBuilder;
