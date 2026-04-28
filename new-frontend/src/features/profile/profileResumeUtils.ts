import type {
    CareerProfile,
    ResumeDraft,
    ResumeExperience,
    ResumeLanguage,
    ResumeSkillMap,
} from "./profileService"

export type NormalizedResumePayload = {
    id: number
    resume_language: ResumeLanguage
    internal_name: string
    summary: string
    profile: {
        name: string
        contacts: ResumeDraft["contacts"]
    }
    contacts: ResumeDraft["contacts"]
    languages: Array<{ name: string; level: string }>
    skills: ResumeSkillMap
    experience: Array<{
        company: string
        role: string
        location: string
        start_date: string
        end_date: string
        highlights: string[]
        stack: string[]
    }>
    projects: ResumeDraft["projects"]
    education: Array<{
        institution: string
        degree: string
        location: string
        start_year: string
        end_year: string
        year: string
    }>
    meta: {
        language: string
        page: {
            font_size: number
            size: string
        }
    }
}

export type ExportFormat = "latex" | "json"

export function getResumeFlag(language: ResumeLanguage) {
    return language === "PTBR" ? "BR" : "US"
}

export function getLanguageLabel(language: ResumeLanguage) {
    return language === "PTBR" ? "pt-BR" : "en-US"
}

export function normalizeList(value: string) {
    return value
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
}

export function listToText(value: string[]) {
    return value.join(", ")
}

export function denormalizeResume(
    resume: ResumeDraft,
    profile: CareerProfile,
): NormalizedResumePayload {
    return {
        id: resume.id,
        resume_language: resume.language,
        internal_name: resume.internalName,
        summary: resume.summary,
        profile: {
            name: profile.name,
            contacts: resume.contacts,
        },
        contacts: resume.contacts,
        languages: resume.languages.map(item => ({
            name: item.name,
            level: item.level,
        })),
        skills: resume.skills,
        experience: sortExperiencesByTimeline(resume.experiences).map(item => ({
            company: item.company,
            role: item.role,
            location: item.location,
            start_date: item.startDate,
            end_date: item.endDate,
            highlights: item.highlights,
            stack: item.stack,
        })),
        projects: resume.projects,
        education: resume.education.map(item => ({
            institution: item.institution,
            degree: item.degree,
            location: item.location,
            start_year: item.startYear,
            end_year: item.endYear,
            year: item.year,
        })),
        meta: {
            language: resume.meta.language,
            page: {
                font_size: resume.meta.page.fontSize,
                size: resume.meta.page.size,
            },
        },
    }
}

function timelineValue(experience: ResumeExperience) {
    const end = experience.endDate.toLowerCase()
    if (["present", "presente", "atual"].includes(end)) return 999999

    const normalized = experience.endDate || experience.startDate
    const [year = "0", month = "1"] = normalized.split("-")

    return Number(year) * 100 + Number(month || "1")
}

export function sortExperiencesByTimeline(experiences: ResumeExperience[]) {
    return [...experiences].sort((a, b) => timelineValue(b) - timelineValue(a))
}

function escapeLatex(value: string | number | undefined) {
    if (value === undefined || value === null) return ""

    const specialChars: Record<string, string> = {
        "\\": "\\textbackslash{}",
        "&": "\\&",
        "%": "\\%",
        $: "\\$",
        "#": "\\#",
        "_": "\\_",
        "{": "\\{",
        "}": "\\}",
        "~": "\\textasciitilde{}",
        "^": "\\textasciicircum{}",
    }

    return String(value).replace(/[\\&%$#_{}~^]/g, char => specialChars[char])
}

function getLabels(language: ResumeLanguage) {
    const isEnglish = language === "EN"

    return {
        babel: isEnglish ? "english" : "brazilian",
        experience: isEnglish ? "Experience" : "Experiência Profissional",
        projects: isEnglish ? "Projects" : "Projetos",
        skills: isEnglish ? "Technical Skills" : "Competências Técnicas",
        education: isEnglish ? "Education" : "Formação Acadêmica",
        languages: isEnglish ? "Languages" : "Idiomas",
        present: isEnglish ? "Present" : "Presente",
        skillLabels: {
            languages: isEnglish ? "Languages" : "Linguagens",
            frameworks: "Frameworks",
            cloud_and_infra: isEnglish ? "Cloud and Infra" : "Cloud e Infra",
            databases: isEnglish ? "Databases" : "Banco de Dados",
            concepts: isEnglish ? "Concepts" : "Conceitos",
        },
    }
}

function formatDate(value: string, language: ResumeLanguage) {
    const labels = getLabels(language)
    const lower = value.toLowerCase()

    if (["present", "presente", "atual"].includes(lower)) return labels.present

    return escapeLatex(value)
}

export function generateLatex(
    resume: ResumeDraft,
    profile: CareerProfile,
    options: { includeAtsHiddenKeywords?: boolean } = {},
) {
    const labels = getLabels(resume.language)
    const sortedExperiences = sortExperiencesByTimeline(resume.experiences)
    const hasSkills = Object.values(resume.skills).some(items => items.length > 0)
    const hasProjects = resume.projects.length > 0
    const hasEducation = resume.education.length > 0
    const name = profile.name || resume.internalName

    const skillLines = (Object.keys(labels.skillLabels) as Array<keyof ResumeSkillMap>)
        .map(key => {
            const values = resume.skills[key]
            if (!values.length) return ""

            return `      \\textbf{${labels.skillLabels[key]}}{: ${escapeLatex(values.join(", "))}} \\\\`
        })
        .filter(Boolean)
        .join("\n")

    const experienceLines = sortedExperiences
        .map(experience => {
            const highlights = experience.highlights
                .filter(Boolean)
                .map(item => `        \\resumeItem{${escapeLatex(item)}}`)
                .join("\n")
            const stackLine = experience.stack.length
                ? `        \\resumeItem{\\textbf{Stack:} ${escapeLatex(experience.stack.join(", "))}}`
                : ""

            return `    \\resumeSubheading
      {${escapeLatex(experience.company)}}{${formatDate(experience.startDate, resume.language)} -- ${formatDate(experience.endDate, resume.language)}}
      {${escapeLatex(experience.role)}}{${escapeLatex(experience.location)}}
      \\resumeItemListStart
${highlights}
${stackLine}
      \\resumeItemListEnd`
        })
        .join("\n\n")

    const projectLines = resume.projects
        .map(project => {
            const link = project.links.website || project.links.github
            const linkText = link ? `\\href{${link}}{\\underline{Link}}` : ""

            return `      \\resumeProjectHeading
          {\\textbf{${escapeLatex(project.name)}} $|$ \\emph{${escapeLatex(project.stack.join(", "))}}}
          {${linkText}}
          \\resumeItemListStart
            \\resumeItem{${escapeLatex(project.description)}}
          \\resumeItemListEnd`
        })
        .join("\n\n")

    const educationLines = resume.education
        .map(education => {
            const dates = education.year || `${education.startYear} -- ${education.endYear}`

            return `    \\resumeSubheading
      {${escapeLatex(education.institution)}}{${escapeLatex(dates)}}
      {${escapeLatex(education.degree)}}{${escapeLatex(education.location)}}`
        })
        .join("\n")

    const languageLines = resume.languages
        .map(language => `\\textbf{${escapeLatex(language.name)}}{: ${escapeLatex(language.level)}}`)
        .join(" \\hspace{1cm}\n      ")

    const hiddenKeywordsPlaceholder = options.includeAtsHiddenKeywords
        ? "% === HIDDEN ATS KEYWORDS SECTION (dynamically added by the LLM per job) ==="
        : ""

    return `\\documentclass[11pt, a4paper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[${labels.babel}]{babel}
\\usepackage[a4paper, top=1.5cm, bottom=1.5cm, left=1.5cm, right=1.5cm]{geometry}
\\usepackage{enumitem}
\\usepackage{latexsym}
\\usepackage{titlesec}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage{tabularx}
\\usepackage{fontawesome5}
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
\\setlist[itemize]{label=-}
\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}
\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\raggedright\\large\\bfseries}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]
\\newcommand{\\resumeItem}[1]{\\item\\small{{#1 \\vspace{-2pt}}}}
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-5pt}
}
\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-5pt}
}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}\\vspace{0pt}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

\\begin{document}

\\begin{center}
    {\\Huge \\scshape ${escapeLatex(name)}} \\\\[3mm]
    \\small
    \\faPhone\\ ${escapeLatex(resume.contacts.phone)} \\hspace{10pt}
    \\href{mailto:${resume.contacts.email}}{\\faEnvelope\\ ${escapeLatex(resume.contacts.email)}} \\hspace{10pt}
    \\href{${resume.contacts.linkedin}}{\\faLinkedin\\ ${escapeLatex(resume.contacts.linkedin)}}

    \\href{${resume.contacts.github}}{\\faGithub\\ ${escapeLatex(resume.contacts.github)}}
    \\href{${resume.contacts.portfolio}}{\\faGlobe\\ ${escapeLatex(resume.contacts.portfolio)}}
\\end{center}

${
    resume.summary.trim()
        ? `\\section{${resume.language === "EN" ? "Summary" : "Resumo"}}
${escapeLatex(resume.summary)}
`
        : ""
}

\\section{${labels.experience}}
  \\resumeSubHeadingListStart
${experienceLines}
  \\resumeSubHeadingListEnd

${
    hasProjects
        ? `\\section{${labels.projects}}
    \\resumeSubHeadingListStart
${projectLines}
    \\resumeSubHeadingListEnd`
        : ""
}

${
    hasSkills
        ? `\\section{${labels.skills}}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
${skillLines}
    }}
 \\end{itemize}`
        : ""
}

${
    hasEducation
        ? `\\section{${labels.education}}
  \\resumeSubHeadingListStart
${educationLines}
  \\resumeSubHeadingListEnd`
        : ""
}

${
    resume.languages.length
        ? `\\section{${labels.languages}}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
      ${languageLines}
    }}
 \\end{itemize}`
        : ""
}

${hiddenKeywordsPlaceholder}

\\end{document}
`
}

const promptTemplates = {
    EN: String.raw`I am applying for a job and need you to adapt my resume in LaTeX to the job description below.

Operate in PATCH MODE: preserve the original LaTeX document and only edit the allowed text.

Output format:
1. First, write a brief change summary with 3-6 bullet points.
2. Then write the complete final LaTeX document.
3. The LaTeX document must start exactly with \documentclass and end exactly with \end{document}.
4. Do not return snippets, diffs, markdown fences, placeholders, or omitted sections.

Editing rules:
1. Rewrite only the summary, if present, and experience bullet points except Stack bullets.
2. Do not edit LaTeX structure, commands, packages, links, dates, company names, job titles, locations, education, languages, or technical skills.
3. Keep the same number of bullet points in each job.
4. Preserve concrete technical details and do not invent technologies, metrics, architecture, scope, or responsibilities.
5. Add job-description keywords only when they naturally match work already explicit in the resume.

Job Description:
{{JOB_DESCRIPTION}}

Current Resume (LaTeX):
{{RESUME_CONTENT}}`,
    PTBR: String.raw`Estou me candidatando a uma vaga e preciso que você adapte meu currículo em LaTeX para a descrição da vaga abaixo.

Trabalhe em MODO PATCH: preserve o documento LaTeX original e edite somente os textos permitidos.

Formato de saída:
1. Primeiro, escreva um resumo breve das mudanças com 3-6 bullet points.
2. Depois, escreva o documento LaTeX final completo.
3. O documento LaTeX deve começar exatamente com \documentclass e terminar exatamente com \end{document}.
4. Não retorne snippets, diffs, blocos markdown, placeholders ou seções omitidas.

Regras de edição:
1. Reescreva apenas o resumo, se existir, e bullet points de experiência, exceto bullets de Stack.
2. Não edite estrutura LaTeX, comandos, pacotes, links, datas, empresas, cargos, locais, educação, idiomas ou competências técnicas.
3. Mantenha o mesmo número de bullet points em cada experiência.
4. Preserve detalhes técnicos concretos e não invente tecnologias, métricas, arquitetura, escopo ou responsabilidades.
5. Use palavras-chave da vaga somente quando elas encaixarem naturalmente em algo já explícito no currículo.

Descrição da vaga:
{{JOB_DESCRIPTION}}

Currículo atual (LaTeX):
{{RESUME_CONTENT}}`,
}

export function getPromptTemplate(language: ResumeLanguage) {
    return promptTemplates[language]
}

export function generateResumeExport(
    resume: ResumeDraft,
    profile: CareerProfile,
    format: ExportFormat,
    includeAtsHiddenKeywords: boolean,
) {
    if (format === "json") {
        return JSON.stringify(denormalizeResume(resume, profile), null, 2)
    }

    return generateLatex(resume, profile, {includeAtsHiddenKeywords})
}

export function buildFinalPrompt({
                                     template,
                                     jobDescription,
                                     resumeContent,
                                 }: {
    template: string
    jobDescription: string
    resumeContent: string
}) {
    return template
        .replace("{{JOB_DESCRIPTION}}", jobDescription || "[PASTE JOB DESCRIPTION HERE]")
        .replace("{{RESUME_CONTENT}}", resumeContent)
}
