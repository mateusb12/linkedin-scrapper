import React, { useState, useEffect } from "react";
import { X, Copy, Check, Sparkles, Settings } from "lucide-react";

import { denormalizeResume, generateLatex } from "./resumeJsonMapper.js";

const PROMPT_TEMPLATES = {
  en: String.raw`
I am applying for a job and need you to adapt my resume in LaTeX to the job description below.

Operate in PATCH MODE: preserve the original LaTeX document and only edit the allowed text.

Output format:
1. First, write a brief change summary with 3-6 bullet points.
2. Then write the complete final LaTeX document.
3. Use this exact structure:

CHANGE SUMMARY:
- ...

FINAL LATEX DOCUMENT:
\documentclass...

4. The LaTeX document must start exactly with \documentclass.
5. The LaTeX document must end exactly with \end{document}.
6. Do NOT return a snippet, excerpt, partial section, diff, markdown code fence, or placeholder.
7. Do NOT use ellipses such as "...", "% unchanged", "% omitted", "[rest unchanged]", or any placeholder.
8. Do NOT stop after one section. Continue until the full original document has been returned.

Editing rules:
1. Rewrite ONLY:
   - the summary, if present
   - experience bullet points, except Stack bullets
2. Do NOT edit:
   - LaTeX structure, commands, packages, formatting, links, dates, company names, job titles, locations, education, languages, technical skills
   - any bullet starting with \resumeItem{\textbf{Stack:}
3. Keep the EXACT SAME number of bullet points in each job.
4. Do NOT summarize, shorten, merge, split, or simplify bullets.
5. Preserve all concrete technical details already present in each bullet.
6. Do NOT remove technologies, tools, frameworks, databases, cloud services, patterns, protocols, or implementation details.
7. Do NOT invent technologies, responsibilities, metrics, tools, results, architecture, scale, or scope.
8. Do NOT infer architecture, scale, system topology, or technical complexity unless it is explicitly supported by the resume.
9. Add job-description keywords ONLY when they naturally match work already explicit in the resume.
10. If an original bullet is already strong and specific, keep it mostly unchanged.

Writing style:
- Use natural technical English commonly found in real software engineering resumes.
- Prefer concrete verbs such as: implemented, designed, modeled, refactored, developed, structured, integrated, optimized, maintained.
- Avoid generic or awkward phrases such as: "ensured seamless integration", "worked on edge components", "robust distributed environment", "leveraged", "dynamic solutions".
- Avoid literal translations and over-engineered jargon.
- Prefer direct, concrete, believable bullet points.
- Do not use first person.

Change summary rules:
- Be brief and concrete.
- Mention only the kinds of changes made.
- Do NOT list the full keyword extraction.
- Do NOT invent claims about the resume.
- Do NOT repeat the whole resume content.

Important:
The adapted resume must be at least as technically specific as the original.
Never replace specific details with generic summaries.
Use relevant technical keywords from the job description only when they already match the resume.
Do NOT output the keyword list separately.

Before returning, verify:
- The response has both CHANGE SUMMARY and FINAL LATEX DOCUMENT sections.
- The LaTeX document starts with \documentclass.
- The LaTeX document ends with \end{document}.
- No sections were omitted.
- No Stack bullets were changed.
- No non-allowed sections were changed.

Job Description:
{{JOB_DESCRIPTION}}

Current Resume (LaTeX):
{{RESUME_CONTENT}}
`,

  pt: String.raw`
Estou me candidatando a uma vaga e preciso que você adapte meu currículo em LaTeX para a descrição da vaga abaixo.

Trabalhe em MODO PATCH: preserve o documento LaTeX original e edite somente os textos permitidos.

Formato de saída:
1. Primeiro, escreva um resumo breve das mudanças com 3-6 bullet points.
2. Depois, escreva o documento LaTeX final completo.
3. Use exatamente esta estrutura:

RESUMO DAS MUDANÇAS:
- ...

DOCUMENTO LATEX FINAL:
\documentclass...

4. O documento LaTeX deve começar exatamente com \documentclass.
5. O documento LaTeX deve terminar exatamente com \end{document}.
6. NÃO retorne snippet, trecho parcial, seção isolada, diff, bloco markdown ou placeholder.
7. NÃO use reticências como "...", "% sem alterações", "% omitido", "[restante igual]" ou qualquer placeholder.
8. NÃO pare depois de uma seção. Continue até retornar o documento original inteiro.

Regras de edição:
1. Reescreva APENAS:
   - o resumo, se existir
   - os bullet points de experiência, exceto bullets de Stack
2. NÃO edite:
   - estrutura LaTeX, comandos, pacotes, formatação, links, datas, nomes de empresas, cargos, locais, formação, idiomas, competências técnicas
   - qualquer bullet que comece com \resumeItem{\textbf{Stack:}
3. Mantenha EXATAMENTE o mesmo número de bullet points em cada experiência.
4. NÃO resuma, encurte, junte, divida ou simplifique bullets.
5. Preserve todos os detalhes técnicos concretos já presentes em cada bullet.
6. NÃO remova tecnologias, ferramentas, frameworks, bancos de dados, serviços cloud, padrões, protocolos ou detalhes de implementação.
7. NÃO invente tecnologias, responsabilidades, métricas, ferramentas, resultados, arquitetura, escala ou escopo.
8. NÃO extrapole arquitetura, escala, topologia do sistema ou complexidade técnica sem evidência explícita no currículo.
9. Use palavras-chave da vaga SOMENTE quando elas encaixarem naturalmente em algo já explícito no currículo.
10. Se um bullet original já estiver forte e específico, mantenha-o quase intacto.

Estilo de escrita:
- Use português técnico natural de currículo brasileiro.
- Prefira verbos naturais em pt-BR, como: implementei, projetei, modelei, refatorei, desenvolvi, estruturei, integrei, otimizei, fiz manutenção em.
- Evite formulações pouco naturais como: "mantive e desenvolvi", "componentes de borda", "integração perfeitamente fluida", "soluções robustas", "alavanquei".
- Evite traduções literais e jargões pouco usados em currículo brasileiro.
- Prefira bullets diretos, concretos e críveis.
- Use primeira pessoa do passado.

Regras do resumo das mudanças:
- Seja breve e concreto.
- Mencione apenas os tipos de mudanças feitas.
- NÃO liste a extração completa de palavras-chave.
- NÃO invente afirmações sobre o currículo.
- NÃO repita o conteúdo inteiro do currículo.

Importante:
O currículo adaptado deve ser pelo menos tão específico tecnicamente quanto o original.
Nunca troque detalhes específicos por resumos genéricos.
Use palavras-chave técnicas relevantes da vaga somente quando elas já tiverem correspondência no currículo.
NÃO retorne a lista de palavras-chave separadamente.

Antes de retornar, verifique:
- A resposta tem as seções RESUMO DAS MUDANÇAS e DOCUMENTO LATEX FINAL.
- O documento LaTeX começa com \documentclass.
- O documento LaTeX termina com \end{document}.
- Nenhuma seção foi omitida.
- Nenhum bullet de Stack foi alterado.
- Nenhuma seção não permitida foi alterada.

Descrição da vaga:
{{JOB_DESCRIPTION}}

Currículo atual (LaTeX):
{{RESUME_CONTENT}}
`,
};

const ATS_HIDDEN_KEYWORD_SECTIONS = {
  en: `=== ATS HIDDEN KEYWORDS ===

At the VERY END of the LaTeX document (immediately before \\end{document}), add this exact line (replacing any previous hidden keywords line if it exists):

\\color{white}\\tiny{KEYWORD1, KEYWORD2, KEYWORD3, ...}

Use only commas, no trailing spaces, no quotes, no extra commentary.`,

  pt: `=== KEYWORDS OCULTAS (ATS) ===

No FINAL do documento LaTeX (imediatamente antes de \\end{document}), adicione exatamente esta linha (substituindo qualquer linha de keywords ocultas anterior, se existir):

\\color{white}\\tiny{PALAVRA1, PALAVRA2, PALAVRA3, ...}

Use apenas vírgulas, sem espaços extras no final, sem aspas e sem nenhum texto ou comentário extra.`,
};

const JOB_DESCRIPTION_HEADERS = {
  en: "=== JOB DESCRIPTION ===",
  pt: "=== DESCRIÇÃO DA VAGA ===",
};

const injectAtsHiddenKeywordsSection = (template, langKey, enabled) => {
  if (!enabled) return template;

  const section =
    ATS_HIDDEN_KEYWORD_SECTIONS[langKey] || ATS_HIDDEN_KEYWORD_SECTIONS.en;
  const header = JOB_DESCRIPTION_HEADERS[langKey] || JOB_DESCRIPTION_HEADERS.en;

  if (template.includes(section)) return template;

  const headerIndex = template.indexOf(header);
  if (headerIndex === -1) {
    return `${template.trimEnd()}\n\n${section}`;
  }

  return `${template.slice(0, headerIndex).trimEnd()}\n\n${section}\n\n${template
    .slice(headerIndex)
    .trimStart()}`;
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
  defaultIncludeAtsHiddenKeywords = false,
}) => {
  const langKey = getResumeLangKey(resume);
  const [format, setFormat] = useState("latex");
  const [resumeContent, setResumeContent] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [includeAtsHiddenKeywords, setIncludeAtsHiddenKeywords] = useState(
    defaultIncludeAtsHiddenKeywords,
  );
  const [copied, setCopied] = useState(false);

  const [resumeCopied, setResumeCopied] = useState(false);

  useEffect(() => {
    if (!resume) return;

    if (format === "json") {
      const jsonPayload = denormalizeResume(resume);
      setResumeContent(JSON.stringify(jsonPayload, null, 2));
    } else {
      const latexContent = generateLatex(resume, {
        includeAtsHiddenKeywords,
      });
      setResumeContent(latexContent);
    }
  }, [resume, format, includeAtsHiddenKeywords]);

  useEffect(() => {
    setPromptTemplate(PROMPT_TEMPLATES[langKey]);
  }, [resume?.id, langKey]);

  const finalPromptTemplate = injectAtsHiddenKeywordsSection(
    promptTemplate,
    langKey,
    includeAtsHiddenKeywords,
  );

  const finalOutput = finalPromptTemplate
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

            <label className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-bold text-gray-300 shadow-sm">
              <input
                type="checkbox"
                checked={includeAtsHiddenKeywords}
                onChange={(e) => setIncludeAtsHiddenKeywords(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-950 text-purple-500 focus:ring-purple-500"
              />
              ATS Hidden Keywords
            </label>
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
