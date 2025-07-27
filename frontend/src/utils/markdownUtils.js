// --- MARKDOWN GENERATION HELPERS (Adapted from UserProfile) ---

export const generateProfileHeaderMarkdown = (profileData) => {
    if (!profileData) return '';
    const {name, email, phone, location, linkedin, github} = profileData;
    const linkedInText = linkedin ? `[LinkedIn](${linkedin})` : '';
    const githubText = github ? `[GitHub](${github})` : '';
    const contacts = [location, phone, email, linkedInText, githubText].filter(Boolean).join(' | ');
    return `# ${name || 'Your Name'}\n${contacts}`;
};

export const generateHardSkillsMarkdown = (skills) => {
    if (!skills || skills.filter(s => s).length === 0) return '';
    return `## 🛠️ Hard Skills\n- ${skills.filter(s => s).join(', ')}`;
};

export function extractSummary(markdown) {
    const match = markdown.match(
        /##\s*(?:🎯\s*)?Summary\s*\n([\s\S]*?)(?:\n-{3,}|^\s*##|\n##)/m
    );
    return match ? match[1].trim() : '';
}

export const generateExperienceMarkdown = (experiences) => {
    if (!experiences || experiences.length === 0) return '';
    let content = experiences.map(exp => {
        if (!exp.title || !exp.company || !exp.dates) return '';
        let expStr = `### ${exp.title}\n**${exp.company}** | *${exp.dates}*`;
        const points = (exp.description || []).filter(Boolean).map(p => `- ${p}`).join('\n');
        if (points) expStr += `\n${points}`;
        return expStr;
    }).filter(Boolean).join('\n\n');
    return content ? `## 💼 Professional Experience\n\n${content}` : '';
};

export const generateEducationMarkdown = (educations) => {
    if (!educations || educations.length === 0) return '';
    let content = educations.map(edu => {
        if (!edu.degree || !edu.school || !edu.dates) return '';
        return `### ${edu.degree}\n**${edu.school}** | *${edu.dates}*`;
    }).filter(Boolean).join('\n\n');
    return content ? `## 🎓 Education\n\n${content}` : '';
};

export const generateProjectsMarkdown = (projects) => {
    if (!projects || projects.length === 0) return '';
    let content = projects.map(project => {
        if (!project.title || !project.link) return '';
        let projStr = `### [${project.title}](${project.link})`;
        const points = (project.description || []).filter(Boolean).map(p => `- ${p}`).join('\n');
        if (points) projStr += `\n${points}`;
        return projStr;
    }).filter(Boolean).join('\n\n');
    return content ? `## 🧪 Projects\n\n${content}` : '';
};

export const generateFullResumeMarkdown = (profile, resume) => {
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
    const summary = resumeForMarkdown.summary ? `## 🎯 Summary\n\n${resumeForMarkdown.summary}` : '';
    const skills = generateHardSkillsMarkdown(resumeForMarkdown.hard_skills);
    const experience = generateExperienceMarkdown(resumeForMarkdown.professional_experience);
    const education = generateEducationMarkdown(resumeForMarkdown.education);
    const projects = generateProjectsMarkdown(resumeForMarkdown.projects);

    return [header, summary, skills, experience, education, projects].filter(Boolean).join('\n\n---\n\n');
};

export const parseMarkdownToResume = (markdown) => {
    const resume = {
        summary: '',
        professional_experience: [],
        projects: [],
        // Extend if needed: hard_skills, education, etc.
    };

    if (!markdown) return resume;

    // --- Parse Summary ---
    const summaryMatch = markdown.match(
        /##\s*(?:🎯\s*)?Summary\s*\r?\n([\s\S]*?)(?=\r?\n-{3,}|\r?\n##|\r?\n$)/m
    );
    if (summaryMatch && summaryMatch[1]) {
        resume.summary = summaryMatch[1].trim();
    }

    // --- Parse Professional Experience ---
    const expBlockMatch = markdown.match(
        /##\s*(?:💼\s*)?Professional Experience\r?\n([\s\S]*?)(?=\r?\n## |\r?\n$)/i
    );

    if (expBlockMatch && expBlockMatch[1]) {
        const experienceEntries = expBlockMatch[1]
            .split(/\r?\n###\s+/)
            .filter(Boolean);

        experienceEntries.forEach(entry => {
            const lines = entry.trim().replace(/\r/g, '').split('\n');

            // 1. Try to extract title
            const title = lines.shift()?.trim() || '';

            // 2. Handle metadata line
            let metaLine = '';
            if (/^\*\*.*\*\*\s*\|/.test(title)) {
                metaLine = title; // case where title and meta are on the same line
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
        /##\s*(?:🧪\s*)?Projects\r?\n([\s\S]*?)(?=\r?\n## |\r?\n$)/i
    );

    if (projBlockMatch && projBlockMatch[1]) {
        const projectEntries = projBlockMatch[1]
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