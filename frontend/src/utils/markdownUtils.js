// --- MARKDOWN GENERATION HELPERS (Adapted from UserProfile) ---

export const generateProfileHeaderMarkdown = (profileData) => {
    if (!profileData) return '';
    const { name, email, phone, location, linkedin, github } = profileData;
    const linkedInText = linkedin ? `[LinkedIn](${linkedin})` : '';
    const githubText = github ? `[GitHub](${github})` : '';
    const contacts = [location, phone, email, linkedInText, githubText].filter(Boolean).join(' | ');
    return `# ${name || 'Your Name'}\n${contacts}`;
};

export const generateHardSkillsMarkdown = (skills) => {
    if (!skills || skills.filter(s => s).length === 0) return '';
    return `## 🛠️ Hard Skills\n- ${skills.filter(s => s).join(', ')}`;
};

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