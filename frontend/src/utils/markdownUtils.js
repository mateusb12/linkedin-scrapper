// frontend/src/utils/markdownUtils.js

// --- MARKDOWN GENERATION HELPERS (Adapted from UserProfile) ---

import { remark } from 'remark';
import remarkParse from 'remark-parse';
import {unified} from "unified";

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
    // Create a proper markdown list by mapping each skill to a new line with a hyphen.
    const skillList = skills.filter(s => s).map(skill => `- ${skill}`).join('\n');
    return `${heading}\n${skillList}`;
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

const getNodeText = (node) => {
    if (node.type === 'text') {
        return node.value;
    }
    if (node.children) {
        return node.children.map(getNodeText).join('');
    }
    return '';
};

export const parseMarkdownToResume = (markdown) => {
    const sanitizedMarkdown = markdown
        .replace(/^```md\s*/, '') // remove opening triple backticks + optional language
        .replace(/```$/, '');     // remove closing triple backticks

    const tree = remark().parse(sanitizedMarkdown);

    const resume = {
        summary: '',
        hard_skills: [], // Changed from 'skills'
        professional_experience: [],
        education: [],
        projects: [],
    };

    let currentSectionKey = null;
    let currentItem = null;

    tree.children.forEach(node => {
        // Detect a new top-level section (H2 headings)
        if (node.type === 'heading' && node.depth === 2) {
            currentItem = null; // Reset any in-progress item
            const headingText = getNodeText(node).toLowerCase();

            if (headingText.includes('summary') || headingText.includes('resumo')) currentSectionKey = 'summary';
            else if (headingText.includes('skills') || headingText.includes('habilidades')) currentSectionKey = 'hard_skills';
            else if (headingText.includes('professional experience') || headingText.includes('experiência profissional')) currentSectionKey = 'professional_experience';
            else if (headingText.includes('education') || headingText.includes('formação')) currentSectionKey = 'education';
            else if (headingText.includes('projects') || headingText.includes('projetos')) currentSectionKey = 'projects';
            else currentSectionKey = null;
            return;
        }

        if (!currentSectionKey) return;

        switch (currentSectionKey) {
            case 'summary':
                if (node.type === 'paragraph') {
                    resume.summary = (resume.summary ? resume.summary + '\n' : '') + getNodeText(node);
                }
                break;

            case 'hard_skills':
                if (node.type === 'list' && node.children) {
                    // CORRECTED LOGIC:
                    // 1. Iterate over each list item ('<li>') to avoid mashing text together.
                    // 2. Split items that might be comma-separated (e.g., "- Python, Go, Java").
                    // 3. Use flatMap to create a single clean array of skills.
                    const skillsFromList = node.children.flatMap(listItem => {
                        const text = getNodeText(listItem);
                        return text.split(',').map(skill => skill.trim());
                    });
                    // 4. Filter out any empty strings and add to the resume object.
                    resume.hard_skills.push(...skillsFromList.filter(Boolean));
                }
                break;

            case 'professional_experience':
                if (node.type === 'heading' && node.depth === 3) {
                    currentItem = { title: getNodeText(node), company: '', dates: '', details: [] };
                    resume.professional_experience.push(currentItem);
                } else if (currentItem && node.type === 'paragraph') {
                    // Be more robust to missing dates
                    const parts = getNodeText(node).split('|').map(s => s.replace(/\*/g, '').trim());
                    currentItem.company = parts[0] || '';
                    currentItem.dates = parts[1] || '';
                } else if (currentItem && node.type === 'list') {
                    currentItem.details = node.children.map(listItem => getNodeText(listItem));
                }
                break;

            case 'education':
                if (node.type === 'heading' && node.depth === 3) {
                    currentItem = { degree: getNodeText(node), school: '', dates: '' };
                    resume.education.push(currentItem);
                } else if (currentItem && node.type === 'paragraph') {
                    const parts = getNodeText(node).split('|').map(s => s.replace(/\*/g, '').trim());
                    currentItem.school = parts[0] || '';
                    currentItem.dates = parts[1] || '';
                }
                break;

            case 'projects':
                if (node.type === 'heading' && node.depth === 3) {
                    const linkNode = node.children.find(child => child.type === 'link');
                    const title = linkNode ? linkNode.children[0].value : getNodeText(node);
                    const url = linkNode ? linkNode.url : '';
                    currentItem = { title: title, link: url, details: [] };
                    resume.projects.push(currentItem);
                } else if (currentItem && node.type === 'list') {
                    currentItem.details = node.children.map(listItem => getNodeText(listItem));
                }
                break;
        }
    });

    return resume;
};

export const isParsedResumeEmpty = (parsed) => {
    if (!parsed) return true;
    const isEmptySummary = !parsed.summary || parsed.summary.trim() === '';
    const isEmptyProjects = !parsed.projects || parsed.projects.length === 0;
    const isEmptyExperience = !parsed.professional_experience || parsed.professional_experience.length === 0;
    return isEmptySummary && isEmptyProjects && isEmptyExperience;
};