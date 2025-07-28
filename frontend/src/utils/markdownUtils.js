// --- MARKDOWN GENERATION HELPERS (Adapted from UserProfile) ---

export const generateProfileHeaderMarkdown = (profileData) => {
    if (!profileData) return '';
    const {name, email, phone, location, linkedin, github} = profileData;
    const linkedInText = linkedin ? `[LinkedIn](${linkedin})` : '';
    const githubText = github ? `[GitHub](${github})` : '';
    const contacts = [location, phone, email, linkedInText, githubText].filter(Boolean).join(' | ');
    return `# ${name || 'Your Name'}\n${contacts}`;
};

export const generateHardSkillsMarkdown = (skills, heading) => {
    if (!skills || skills.filter(s => s).length === 0) return '';
    return `${heading}\n- ${skills.filter(s => s).join(', ')}`;
};

export function extractSummary(markdown) {
    const match = markdown.match(
        /##\s*(?:🎯\s*)?Summary\s*\n([\s\S]*?)(?:\n-{3,}|^\s*##|\n##)/m
    );
    return match ? match[1].trim() : '';
}

export const generateExperienceMarkdown = (experiences, heading) => {
    if (!experiences || experiences.length === 0) return '';
    let content = experiences.map(exp => {
        if (!exp.title || !exp.company || !exp.dates) return '';
        let expStr = `### ${exp.title}\n**${exp.company}** | *${exp.dates}*`;
        const points = (exp.description || []).filter(Boolean).map(p => `- ${p}`).join('\n');
        if (points) expStr += `\n${points}`;
        return expStr;
    }).filter(Boolean).join('\n\n');
    return content
        ? `${heading}\n\n${content}`
        : '';
};

export const generateEducationMarkdown = (educations, heading) => {
    if (!educations || educations.length === 0) return '';
    let content = educations.map(edu => {
        if (!edu.degree || !edu.school || !edu.dates) return '';
        return `### ${edu.degree}\n**${edu.school}** | *${edu.dates}*`;
    }).filter(Boolean).join('\n\n');
    return content
        ? `${heading}\n\n${content}`
        : '';
};

export const generateProjectsMarkdown = (projects, heading) => {
    if (!projects || projects.length === 0) return '';
    let content = projects.map(project => {
        if (!project.title || !project.link) return '';
        let projStr = `### [${project.title}](${project.link})`;
        const points = (project.description || []).filter(Boolean).map(p => `- ${p}`).join('\n');
        if (points) projStr += `\n${points}`;
        return projStr;
    }).filter(Boolean).join('\n\n');
    return content
        ? `${heading}\n\n${content}`
        : '';
};

export const markdownHeadings = {
    en: {
        summary: "## 🎯 Summary",
        hard_skills: "## 🛠️ Hard Skills",
        professional_experience: "## 💼 Professional Experience",
        projects: "## 💡 Projects",
        education: "## 🎓 Education",
    },
    pt: {
        summary: "## 🎯 Resumo",
        hard_skills: "## 🛠️ Habilidades",
        professional_experience: "## 💼 Experiência Profissional",
        projects: "## 💡 Projetos",
        education: "## 🎓 Formação",
    }
};

export const generateFullResumeMarkdown = (profile, resume, headings) => {
    if (!profile || !resume) return 'No profile or resume data available to generate markdown.';

    // Create a temporary resume object with field names expected by generators (e.g., 'description').
    // This handles the 'details' field used within the AdaptJobSection component.
    const resumeForMarkdown = {
        ...resume,
        professional_experience: (resume.professional_experience || []).map(exp => ({
            ...exp,
            description: exp.details || exp.description || []
        })),
        projects: (resume.projects || []).map(proj => ({
            ...proj,
            description: proj.details || proj.description || []
        }))
    };

    const header = generateProfileHeaderMarkdown(profile);
    const summary   = resumeForMarkdown.summary ? `${headings.summary}\n\n${resumeForMarkdown.summary}` : '';
    const skills    = generateHardSkillsMarkdown(resumeForMarkdown.hard_skills, headings.hard_skills);
    const experience= generateExperienceMarkdown(resumeForMarkdown.professional_experience, headings.professional_experience);
    const education = generateEducationMarkdown(resumeForMarkdown.education, headings.education);
    const projects  = generateProjectsMarkdown(resumeForMarkdown.projects, headings.projects);

    return [header, summary, skills, experience, education, projects].filter(Boolean).join('\n\n---\n\n');
};

const escapeRegex = (str) => {
    if (!str) return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

function headingAlternatives(primary, fallbacks = []) {
    const all = new Set(
        [primary, ...fallbacks].filter(Boolean).map(h => h.trim())
    );
    return Array.from(all)
        .map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
}

export const parseMarkdownToResume = (markdown, headings = {}) => {
    const resume = {
        summary: '',
        professional_experience: [],
        projects: [],
        // Extend if needed: hard_skills, education, etc.
    };

    if (!markdown) return resume;

    // Accept multiple heading possibilities for robustness
    const SUMMARY_HEADING = headingAlternatives(
        headings.summary,
        ['Resumo', 'Sumário', 'Summary']
    );
    const EXP_HEADING = headingAlternatives(
        headings.professional_experience,
        ['Experiência Profissional', 'Professional Experience', 'Experiência']
    );
    const PROJ_HEADING = headingAlternatives(
        headings.projects,
        ['Projetos', 'Projects']
    );

    // --- Parse Summary ---
    const summaryMatch = markdown.match(
        new RegExp(
            `##\\s*(?:🎯\\s*)?(${SUMMARY_HEADING})\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n-{3,}|\\r?\\n##|\\r?\\n$)`,
            'mi'
        )
    );
    if (summaryMatch && summaryMatch[2]) {
        resume.summary = summaryMatch[2].trim();
    }

    // --- Parse Professional Experience ---
    const expBlockMatch = markdown.match(
        new RegExp(
            `##\\s*(?:💼\\s*)?(${EXP_HEADING})\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##|\\r?\\n$)`,
            'i'
        )
    );

    if (expBlockMatch && expBlockMatch[2]) {
        const experienceEntries = expBlockMatch[2]
            .split(/\r?\n###\s+/)
            .filter(Boolean);

        experienceEntries.forEach(entry => {
            const lines = entry.trim().replace(/\r/g, '').split('\n');

            const title = lines.shift()?.trim() || '';

            let metaLine = '';
            if (/^\*\*.*\*\*\s*\|/.test(title)) {
                metaLine = title;
            } else {
                metaLine = lines.shift()?.trim() || '';
            }

            const metaMatch = metaLine.match(/\*\*(.+?)\*\*\s*\|\s*\*(.+?)\*/);
            const details = lines
                .map(l => l.replace(/^- /, '').trim())
                .filter(Boolean);

            if (metaMatch) {
                resume.professional_experience.push({
                    title,
                    company: metaMatch[1].trim(),
                    dates: metaMatch[2].trim(),
                    details,
                    description: details,
                });
            }
        });
    }

    // --- Parse Projects ---
    const projBlockMatch = markdown.match(
        new RegExp(
            `##\\s*(?:💡\\s*)?(${PROJ_HEADING})\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##|\\r?\\n$)`,
            'i'
        )
    );

    if (projBlockMatch && projBlockMatch[2]) {
        const projectEntries = projBlockMatch[2]
            .split(/\r?\n###\s+/)
            .filter(Boolean);

        projectEntries.forEach(entry => {
            const lines = entry.trim().replace(/\r/g, '').split('\n');

            const titleLine = lines.shift()?.trim() || '';
            const linkMatch = titleLine.match(/\[([^\]]+)]\(([^)]+)\)/);
            const title = linkMatch ? linkMatch[1] : titleLine;
            const link = linkMatch ? linkMatch[2] : '';

            const details = lines
                .map(l => l.replace(/^- /, '').trim())
                .filter(Boolean);

            resume.projects.push({
                title,
                link,
                details,
                description: details,
            });
        });
    }

    return resume;
};

export const isParsedResumeEmpty = (parsed) => {
    if (!parsed) return true;
    const isEmptySummary = !parsed.summary || parsed.summary.trim() === '';
    const isEmptyProjects = !parsed.projects || parsed.projects.length === 0;
    const isEmptyExperience = !parsed.professional_experience || parsed.professional_experience.length === 0;
    return isEmptySummary && isEmptyProjects && isEmptyExperience;
};