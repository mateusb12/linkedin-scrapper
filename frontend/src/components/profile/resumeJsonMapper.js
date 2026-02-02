const makeId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

// Função auxiliar para escapar caracteres reservados do LaTeX
const escapeLatex = (str) => {
  if (!str) return "";
  // Converte para string caso seja número, depois substitui caracteres especiais
  return String(str)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
};

export const normalizeResume = (apiData) => {
  const safe = apiData || {};

  return {
    id: safe.id,

    internal_name: safe.internal_name || safe.name || "Untitled Resume",
    summary: safe.summary || "",

    contacts: safe.contacts ||
      safe.profile?.contacts || {
        phone: "",
        email: "",
        linkedin: "",
        github: "",
        portfolio: "",
      },

    skills: safe.skills || {
      languages: [],
      frameworks: [],
      cloud_and_infra: [],
      databases: [],
      concepts: [],
    },

    languages: Array.isArray(safe.languages) ? safe.languages : [],

    experience: (safe.experience || []).map((exp) => ({
      id: exp.id || makeId("exp"),
      role: exp.role || exp.title || "",
      company: exp.company || "",
      location: exp.location || "",
      start_date: exp.start_date || "",
      end_date: exp.end_date || "",
      highlights: exp.highlights || exp.description || [],
      stack: exp.stack || [],
    })),

    projects: (safe.projects || []).map((proj) => ({
      id: proj.id || makeId("proj"),
      name: proj.name || proj.title || "",
      description: proj.description || "",
      stack: proj.stack || [],
      links: proj.links || { github: "", website: "" },
    })),

    education: (safe.education || []).map((edu) => ({
      id: edu.id || makeId("edu"),
      institution: edu.institution || "",
      degree: edu.degree || "",
      location: edu.location || "",
      start_year: edu.start_year || "",
      end_year: edu.end_year || "",
      year: edu.year || "",
    })),

    meta: safe.meta || {
      language: "pt-BR",
      page: { size: "letter", font_size: 11 },
    },
  };
};

export const denormalizeResume = (uiState) => {
  const safe = uiState || {};

  return {
    id: safe.id,
    internal_name: safe.internal_name,
    summary: safe.summary,

    profile: {
      name: safe.internal_name,
      contacts: safe.contacts,
    },

    contacts: safe.contacts,
    languages: safe.languages,

    skills: safe.skills,

    experience: (safe.experience || []).map((exp) => ({
      company: exp.company,
      role: exp.role,
      location: exp.location,
      start_date: exp.start_date,
      end_date: exp.end_date,
      highlights: exp.highlights,
      stack: exp.stack,
    })),

    projects: (safe.projects || []).map((proj) => ({
      name: proj.name,
      description: proj.description,
      stack: proj.stack,
      links: proj.links,
    })),

    education: (safe.education || []).map((edu) => ({
      institution: edu.institution,
      degree: edu.degree,
      location: edu.location,
      start_year: edu.start_year,
      end_year: edu.end_year,
      year: edu.year,
    })),

    meta: safe.meta,
  };
};

export const generateLatex = (resume) => {
  // Trabalhamos com a versão desnormalizada para garantir a estrutura limpa
  const r = denormalizeResume(resume);

  // --- HELPERS INTERNOS PARA FORMATAÇÃO ---

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const lower = dateStr.toLowerCase();
    if (lower === "present" || lower === "presente" || lower === "atual") return "Presente";
    return escapeLatex(dateStr);
  };

  const renderSkills = () => {
    // Mapeamento das chaves do JSON para os Títulos em Português no LaTeX
    const skillMap = {
      languages: "Linguagens",
      databases: "Banco de Dados",
      frameworks: "Frameworks",
      cloud_and_infra: "Cloud & Infra",
      concepts: "Conceitos"
    };

    const lines = [];
    Object.entries(r.skills || {}).forEach(([key, values]) => {
      // Verifica se existe a chave no mapa e se há valores para mostrar
      if (skillMap[key] && values && values.length > 0) {
        const valueStr = Array.isArray(values) ? values.join(", ") : values;
        lines.push(`      \\textbf{${skillMap[key]}}{: ${escapeLatex(valueStr)}} \\\\`);
      }
    });
    return lines.join("\n");
  };

  const renderExperience = () => {
    return (r.experience || []).map(exp => {
      const highlights = (exp.highlights || []).map(h => `        \\resumeItem{${escapeLatex(h)}}`).join("\n");

      const stackStr = Array.isArray(exp.stack) ? exp.stack.join(", ") : exp.stack;
      const stackLine = stackStr
        ? `        \\resumeItem{\\textbf{Stack:} ${escapeLatex(stackStr)}}`
        : "";

      return `    \\resumeSubheading
      {${escapeLatex(exp.company)}}{${formatDate(exp.start_date)} -- ${formatDate(exp.end_date)}}
      {${escapeLatex(exp.role)}}{${escapeLatex(exp.location)}}
      \\resumeItemListStart
${highlights}
${stackLine}
      \\resumeItemListEnd`;
    }).join("\n\n");
  };

  const renderProjects = () => {
    return (r.projects || []).map(proj => {
      let linkText = "";
      if (proj.links?.website) {
        linkText = `\\href{${proj.links.website}}{\\underline{Website}}`;
      } else if (proj.links?.github) {
        linkText = `\\href{${proj.links.github}}{\\underline{GitHub}}`;
      }

      const stackList = Array.isArray(proj.stack) ? proj.stack.join(", ") : proj.stack;

      return `      \\resumeProjectHeading
          {\\textbf{${escapeLatex(proj.name)}} $|$ \\emph{${escapeLatex(stackList)}}}
          {${linkText}}
          \\resumeItemListStart
            \\resumeItem{${escapeLatex(proj.description)}}
          \\resumeItemListEnd`;
    }).join("\n\n");
  };

  const renderEducation = () => {
    return (r.education || []).map(edu => {
      // Prioriza o campo 'year' se existir, senão usa start -- end
      let dates = edu.year ? edu.year : `${edu.start_year} -- ${edu.end_year}`;
      return `    \\resumeSubheading
      {${escapeLatex(edu.institution)}}{${escapeLatex(dates)}}
      {${escapeLatex(edu.degree)}}{${escapeLatex(edu.location)}}`;
    }).join("\n");
  };

  const renderLanguages = () => {
    if (!r.languages || r.languages.length === 0) return "";

    const langs = r.languages
      .map(l => `\\textbf{${escapeLatex(l.name)}}{: ${escapeLatex(l.level)}}`)
      .join(" \\hspace{1cm}\n      ");

    return `%-----------LANGUAGES-----------
\\section{Idiomas}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
      ${langs}
    }}
 \\end{itemize}`;
  };

  // --- MONTAGEM DO TEMPLATE COMPLETO ---

  return `\\documentclass[11pt, a4paper]{article}

% --- PACKAGES ---
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[brazilian]{babel}
\\usepackage[a4paper, top=1.5cm, bottom=1.5cm, left=1.5cm, right=1.5cm]{geometry}
\\usepackage{enumitem}
\\usepackage{latexsym}
\\usepackage{titlesec}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage{tabularx}
\\usepackage{multicol}

% --- ICONS PACKAGE ---
\\usepackage{fontawesome5}

% --- FONT (Standard Helvetica) ---
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}

\\setlist[itemize]{label=-}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\urlstyle{same}

\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% --- SECTION FORMATTING ---
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large\\bfseries
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

% --- CUSTOM COMMANDS ---
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

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

%----------HEADING----------
\\begin{center}
    {\\Huge \\scshape ${escapeLatex(r.profile?.name || r.internal_name)}} \\\\[3mm]
    \\small
    % Line 1: Phone | Email | LinkedIn
    \\faPhone\\ ${escapeLatex(r.contacts?.phone)} \\hspace{10pt}
    \\href{mailto:${r.contacts?.email}}{\\faEnvelope\\ ${escapeLatex(r.contacts?.email)}} \\hspace{10pt}
    \\href{${r.contacts?.linkedin}}{\\faLinkedin\\ LinkedIn} \\\\[2mm]

    % Line 2: GitHub | Portfolio
    \\href{${r.contacts?.github}}{\\faGithub\\ GitHub} \\hspace{10pt}
    \\href{${r.contacts?.portfolio}}{\\faGlobe\\ Portfolio}
\\end{center}

%-----------EXPERIENCE-----------
\\section{Experiência Profissional}
  \\resumeSubHeadingListStart
${renderExperience()}
  \\resumeSubHeadingListEnd

%-----------PROJECTS-----------
\\section{Projetos}
    \\resumeSubHeadingListStart
${renderProjects()}
    \\resumeSubHeadingListEnd

%-----------TECHNICAL SKILLS-----------
\\section{Competências Técnicas}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
${renderSkills()}
    }}
 \\end{itemize}

%-----------EDUCATION-----------
\\section{Formação Acadêmica}
  \\resumeSubHeadingListStart
${renderEducation()}
  \\resumeSubHeadingListEnd

${renderLanguages()}

\\end{document}
`;
};