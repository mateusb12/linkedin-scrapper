import React, { useState, useEffect } from "react";
import { X, Copy, Check, Sparkles, Settings } from "lucide-react";

import { denormalizeResume, generateLatex } from "./resumeJsonMapper.js";

const PROMPT_TEMPLATES = {
  en: `
I am applying for a job and I need you to adapt my resume (in LaTeX format) to fit the Job Description provided below.

=== STRICT INSTRUCTIONS ===
1. Analyze the Job Description and extract the most relevant technical keywords.
2. Rewrite ONLY:
   - the summary (if present)
   - the experience bullet points
   using first-person past tense ("implemented", "designed", "modeled", "architected", etc.)
3. Give STRONG emphasis to the job's keywords by naturally incorporating them into the bullet points.
4. Do NOT invent skills or technologies that are not already present in my current resume.
5. Extract 15-25 of the MOST relevant technical keywords, tools, frameworks, concepts and acronyms from the Job Description that are already covered in my resume (skills, experience, projects, etc.).

=== WRITING QUALITY RULES ===

Improve writing quality using these guidelines:

- Use natural technical English commonly found in real resumes
- Avoid literal translations or awkward phrasing
- Keep bullet points concise (max ~30 words)
- Avoid repeating phrases like "full stack", "in production", "based on" excessively
- Start bullet points with strong action verbs such as:
  designed, implemented, modeled, architected, refactored, optimized, integrated, orchestrated, improved, automated, built
- Prefer concise phrasing:
  "using" instead of "based on"
  "cloud storage" instead of "storage in cloud environment"
  "mobile app" instead of "mobile frontend application"
- Remove redundancy while preserving technical depth
- Emphasize technical impact when possible:
  reliability, scalability, observability, resilience, maintainability, performance
- Maintain consistent terminology across the resume
- Avoid sentences that sound AI-generated or translated literally
- Avoid repeating combinations such as:
  "full stack" + "based on" + "in production" in the same bullet

Ideal bullet structure:
[action verb] + [what was built] + [technologies] + [technical impact]

Example:
"Designed multi-step approval workflow with RBAC and validation layers, improving traceability and system security."

=== ATS HIDDEN KEYWORDS ===

At the VERY END of the LaTeX document (immediately before \\end{document}), add this exact line (replacing any previous hidden keywords line if it exists):

\\color{white}\\tiny{KEYWORD1, KEYWORD2, KEYWORD3, ...}

Use only commas, no trailing spaces, no quotes, no extra commentary.

=== JOB DESCRIPTION ===
{{JOB_DESCRIPTION}}

=== CURRENT RESUME (LATEX) ===
{{RESUME_CONTENT}}
`,

  pt: `
Estou me candidatando a uma vaga e preciso que você adapte meu currículo (em LaTeX) para se adequar à Descrição da Vaga fornecida abaixo.

=== INSTRUÇÕES RÍGIDAS ===
1. Analise a Descrição da Vaga e extraia as palavras-chave técnicas mais relevantes.
2. Reescreva APENAS:
   - o resumo (se existir)
   - os bullet points de experiência
   usando primeira pessoa do passado ("implementei", "projetei", "modelei", "estruturei", etc.)
3. Dê MUITA ÊNFASE às keywords da vaga, incorporando-as naturalmente nos bullet points.
4. NÃO invente tecnologias ou habilidades que não existam no meu currículo atual.
5. Extraia 15-25 das palavras-chave técnicas MAIS relevantes da Descrição da Vaga que já estão presentes no meu currículo (habilidades, experiência ou projetos).

=== WRITING QUALITY RULES ===

Melhore a qualidade do texto aplicando estas diretrizes:

- Use português técnico natural (evite traduções literais do inglês)
- Prefira frases diretas e objetivas (máx. ~30 palavras por bullet)
- Evite repetição excessiva de termos como "full stack", "em produção", "baseado em"
- Use verbos fortes no início das frases:
  projetei, modelei, estruturei, implementei, refatorei, mantive, evoluí, integrei, otimizei, desenvolvi, construí
- Prefira linguagem comum em currículos técnicos brasileiros:
  "na nuvem" em vez de "em cloud"
  "com Raspberry Pi" em vez de "baseado em Raspberry Pi"
  "aplicação mobile" em vez de "mobile frontend"
  "armazenamento na nuvem" em vez de "cloud storage"
- Remova redundâncias sem perder densidade técnica
- Destaque impacto técnico quando possível:
  confiabilidade, escalabilidade, observabilidade, resiliência, manutenção, performance
- Mantenha consistência de terminologia ao longo do documento
- Evite frases que soem traduzidas literalmente do inglês
- Evite repetir simultaneamente:
  "full stack" + "baseado em" + "em produção" no mesmo bullet

Estrutura ideal de bullet:
[verbo forte] + [o que foi feito] + [tecnologias] + [impacto técnico]

Exemplo:
"Modelei workflow de aprovação multi-etapas com RBAC e validação de dados, aumentando a rastreabilidade e segurança do sistema."

=== KEYWORDS OCULTAS (ATS) ===

No FINAL do documento LaTeX (imediatamente antes de \\end{document}), adicione exatamente esta linha (substituindo qualquer linha de keywords ocultas anterior, se existir):

\\color{white}\\tiny{PALAVRA1, PALAVRA2, PALAVRA3, ...}

Use apenas vírgulas, sem espaços extras no final, sem aspas e sem nenhum texto ou comentário extra.

=== DESCRIÇÃO DA VAGA ===
{{JOB_DESCRIPTION}}

=== MEU CURRÍCULO ATUAL (LATEX) ===
{{RESUME_CONTENT}}
`,
};

export const getResumeFlag = (resume) => {
  if (!resume) return "";
  const explicit = resume.resume_language;
  const metaLang = resume.meta?.language;
  const lang = (explicit || metaLang || "").toLowerCase();

  if (["pt", "ptbr", "pt-br"].includes(lang)) return "🇧🇷";
  if (["en", "eng", "en-us"].includes(lang)) return "🇺🇸";
  return "⚠️";
};

export const getResumeLangKey = (resume) => {
  if (!resume) return "en";
  const explicit = resume.resume_language;
  const metaLang = resume.meta?.language;
  const lang = (explicit || metaLang || "").toLowerCase();

  if (["pt", "ptbr", "pt-br"].includes(lang)) return "pt";
  return "en";
};

const palette = {
  bg: {
    previewTextarea: "bg-gray-950",
  },
  text: {
    primary: "text-gray-200",
  },
  border: {
    previewTextarea: "border-gray-700",
  },
};

const styleguide = {
  previewTextarea: `${palette.bg.previewTextarea} ${palette.border.previewTextarea} border ${palette.text.primary} font-mono text-xs leading-relaxed w-full rounded-md p-3 transition outline-none focus:ring-1 focus:ring-blue-500 resize-none`,
  label:
    "text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1 block flex items-center gap-2",
};

export const ResumeSelector = ({
  resumes,
  selectedResumeId,
  handleResumeChange,
  className = "",
}) => {
  const selectedResume = resumes.find((r) => r.id === selectedResumeId);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {selectedResume && (
        <span className="text-xl select-none" title="Language detected">
          {getResumeFlag(selectedResume)}
        </span>
      )}

      <select
        onChange={handleResumeChange}
        value={selectedResumeId || ""}
        className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm min-w-[150px] max-w-[250px]"
      >
        {resumes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.internal_name}
          </option>
        ))}

        <option disabled>──────────</option>
        <option
          value="create_copy"
          className="font-bold text-emerald-400 bg-gray-800"
        >
          ➕ Create Copy of Current
        </option>
      </select>
    </div>
  );
};

const ResumeContextBuilder = ({
  isOpen,
  onClose,
  resume,
  resumes,
  selectedResumeId,
  handleResumeChange,
}) => {
  const [format, setFormat] = useState("latex");
  const [resumeContent, setResumeContent] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [copied, setCopied] = useState(false);

  const [resumeCopied, setResumeCopied] = useState(false);

  useEffect(() => {
    if (!resume) return;

    if (format === "json") {
      const jsonPayload = denormalizeResume(resume);
      setResumeContent(JSON.stringify(jsonPayload, null, 2));
    } else {
      const latexContent = generateLatex(resume);
      setResumeContent(latexContent);
    }
  }, [resume, format]);

  useEffect(() => {
    const langKey = getResumeLangKey(resume);
    setPromptTemplate(PROMPT_TEMPLATES[langKey]);
  }, [resume?.id]);

  const finalOutput = promptTemplate
    .replace(
      "{{JOB_DESCRIPTION}}",
      jobDescription || "[PASTE JOB DESCRIPTION HERE]",
    )
    .replace("{{RESUME_CONTENT}}", resumeContent);

  const handleCopy = () => {
    navigator.clipboard.writeText(finalOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyResume = () => {
    navigator.clipboard.writeText(resumeContent);
    setResumeCopied(true);
    setTimeout(() => setResumeCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 animate-in fade-in backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-[90vw] h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center px-4 py-3 border-b border-gray-700 bg-gray-800 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-white font-bold font-mono text-lg flex items-center gap-2">
              <Sparkles className="text-purple-400" size={20} />
              LLM Context Builder
            </h3>

            <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700 ml-4">
              <button
                onClick={() => setFormat("latex")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                  format === "latex"
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                LaTeX
              </button>
              <button
                onClick={() => setFormat("json")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                  format === "json"
                    ? "bg-emerald-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                JSON
              </button>
            </div>

            <div className="hidden md:block w-px h-6 bg-gray-600 mx-2"></div>
            <ResumeSelector
              resumes={resumes}
              selectedResumeId={selectedResumeId}
              handleResumeChange={handleResumeChange}
            />
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 p-2 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="h-1/3 p-4 bg-gray-900 border-b border-gray-700 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-1">
              <label className={styleguide.label}>
                <Settings size={12} />
                1. Prompt Instructions (Editable)
              </label>
              <span className="text-[10px] text-gray-500 font-mono">
                Variables:{" "}
                <span className="text-yellow-500">{"{{JOB_DESCRIPTION}}"}</span>
                ,{" "}
                <span className="text-emerald-500">{"{{RESUME_CONTENT}}"}</span>
              </span>
            </div>
            <textarea
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              className={`${styleguide.previewTextarea} flex-1 border-dashed border-gray-600 text-gray-300`}
              spellCheck={false}
            />
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-700 bg-gray-900 min-h-0">
            <div className="flex flex-col p-4 min-h-0">
              <label className={`${styleguide.label} text-yellow-500`}>
                2. Variable: Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste job description here..."
                className={`${styleguide.previewTextarea} flex-1 focus:border-yellow-500/50`}
              />
            </div>

            <div className="flex flex-col p-4 min-h-0 bg-gray-900/50">
              <div className="flex justify-between items-center mb-1">
                <label className={`${styleguide.label} text-emerald-500`}>
                  3. Variable: Resume Content
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 font-mono">
                    {format.toUpperCase()}
                  </span>
                  <button
                    onClick={handleCopyResume}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition shadow-lg"
                  >
                    {resumeCopied ? <Check size={12} /> : <Copy size={12} />}
                    {resumeCopied ? "COPIED" : "COPY"}
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                value={resumeContent}
                className={`${styleguide.previewTextarea} flex-1 opacity-60 cursor-text`}
              />
            </div>

            <div className="flex flex-col p-4 min-h-0 bg-gray-800/30">
              <div className="flex justify-between items-center mb-1">
                <label className={`${styleguide.label} text-purple-400`}>
                  4. Final Result (Auto-Generated)
                </label>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition shadow-lg"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "COPIED!" : "COPY FINAL"}
                </button>
              </div>
              <textarea
                readOnly
                value={finalOutput}
                className={`${styleguide.previewTextarea} flex-1 border-purple-500/30 focus:ring-purple-500 text-gray-300`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeContextBuilder;
