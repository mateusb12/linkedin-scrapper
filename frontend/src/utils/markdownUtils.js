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
        projects: []
        // Add other sections like 'hard_skills' if your AI returns them
    };

    if (!markdown) return resume;

    resume.summary = extractSummary(markdown);

    // --- Parse Summary ---
    const summaryMatch = markdown.match(/##\s*(?:🎯\s*)?Summary\s*\n([\s\S]*?)(?:\n-{3,}|^\s*##|\n##)/m);
    if (summaryMatch && summaryMatch[1]) {
        resume.summary = summaryMatch[1].trim();
    }

    // --- Parse Professional Experience ---
    const expBlockMatch = markdown.match(/## Professional Experience\n([\s\S]*?)(?=\n## |$)/);
    if (expBlockMatch && expBlockMatch[1]) {
        const experienceBlock = expBlockMatch[1];
        // Regex to capture each job entry
        const experienceEntries = experienceBlock.split('### ').slice(1);

        experienceEntries.forEach(entry => {
            const lines = entry.trim().split('\n');
            const titleLine = lines.shift() || '';
            const details = lines.map(line => line.replace(/^- /, '').trim()).filter(Boolean);

            // Regex to capture Title, Company, and Dates from the title line
            const titleMatch = titleLine.match(/(.*) @ (.*) \((.*)\)/);

            if (titleMatch) {
                resume.professional_experience.push({
                    title: titleMatch[1].trim(),
                    company: titleMatch[2].trim(),
                    dates: titleMatch[3].trim(),
                    details: details, // In your component, this maps to 'description'
                    description: details,
                });
            }
        });
    }

    // --- Parse Projects (if needed) ---
    const projBlockMatch = markdown.match(/## Projects\n([\s\S]*?)(?=\n## |$)/);
    if (projBlockMatch && projBlockMatch[1]) {
        const projectBlock = projBlockMatch[1];
        const projectEntries = projectBlock.split('### ').slice(1);

        projectEntries.forEach(entry => {
            const lines = entry.trim().split('\n');
            const title = lines.shift() || '';
            const details = lines.map(line => line.replace(/^- /, '').trim()).filter(Boolean);

            resume.projects.push({
                title: title.trim(),
                details: details,
                description: details,
                link: '' // The parser can't guess the link, so it's left empty
            });
        });
    }

    return resume;
};