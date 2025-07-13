// src/services/ResumeService.js

// Base API URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Parses a specific section from markdown text.
 * Handles '---' separators under headings.
 */
function parseSection(text, startHeading) {
    const lines = text.split('\n');
    let content = [];
    let inSection = false;

    for (const line of lines) {
        if (line.startsWith(startHeading)) {
            inSection = true;
            continue;
        }
        if (inSection && line.startsWith('## ')) {
            break;
        }
        if (inSection && line.trim() !== '' && !line.startsWith('---')) {
            content.push(line);
        }
    }
    return content;
}

/**
 * Extracts structured resume data from markdown text.
 */
export function parseResume(markdownText) {
    const nameMatch = markdownText.match(/^#\s+(.*)/);
    const name = nameMatch ? nameMatch[1].trim() : 'Could not load resume name';

    // Skills
    const skillsSection = parseSection(markdownText, '## Habilidades');
    const skills = skillsSection.flatMap(line => {
        const parts = line.split(':');
        if (parts.length > 1) {
            return parts[1].split(',').map(skill => skill.trim());
        }
        return [];
    });

    // Experiences
    const experienceSection = parseSection(markdownText, '## Experiências Profissionais');
    const experiences = [];
    let currentExperience = null;

    for (const line of experienceSection) {
        if (line.startsWith('###')) {
            if (currentExperience) experiences.push(currentExperience);
            const [title, date] = line.replace('###', '').split('(');
            currentExperience = {
                title: `${title.trim()}${date ? `(${date}` : ''}`,
                details: []
            };
        } else if (currentExperience && line.trim().startsWith('-')) {
            currentExperience.details.push(line.trim().substring(1).trim());
        }
    }
    if (currentExperience) experiences.push(currentExperience);

    // Education
    const educationSection = parseSection(markdownText, '## Educação');
    const educations = [];

    for (let i = 0; i < educationSection.length; i++) {
        const line = educationSection[i];
        if (line.startsWith('- **')) {
            const nextLine = educationSection[i + 1] || '';
            const [location, date] = nextLine.split('|');

            educations.push({
                degree:
                    line.replace('- **', '').split('**')[0].trim() +
                    ' ' + (line.split('–')[1] || '').trim(),
                date: date ? date.trim().replace(/\*/g, '') : '',
                details: [location ? location.trim().replace(/\*/g, '') : '']
            });
            i++;
        }
    }

    return { name, skills, experiences, educations };
}

/**
 * Reconstructs markdown content from structured resume data.
 */
export function reconstructMarkdown(data) {
    let markdown = `# ${data.name || 'New Resume'}\n\n`;

    // Skills section
    markdown += '## Habilidades\n---\n';
    if (data.skills && data.skills.length > 0) {
        markdown += `Tecnologias: ${data.skills.join(', ')}\n\n`;
    }

    // Experiences section
    markdown += '## Experiências Profissionais\n---\n';
    if (data.experiences) {
        data.experiences.forEach(exp => {
            markdown += `### ${exp.title}\n`;
            exp.details.forEach(detail => {
                markdown += `- ${detail}\n`;
            });
            markdown += '\n';
        });
    }

    // Education section
    markdown += '## Educação\n---\n';
    if (data.educations) {
        data.educations.forEach(edu => {
            markdown += `- **${edu.degree}**\n`;
            const detailsLine = [edu.details.join(' | '), edu.date]
                .filter(Boolean)
                .join(' | ');
            markdown += `  *${detailsLine}*\n\n`;
        });
    }

    return markdown;
}

/**
 * Fetches all resumes from the backend.
 */
export async function fetchResumes() {
    const response = await fetch(`${API_BASE}/jobs/`);
    if (!response.ok) throw new Error('Failed to fetch resumes');
    return response.json();
}

/**
 * Fetches a single resume by ID.
 */
export async function fetchResumeById(id) {
    const response = await fetch(`${API_BASE}/jobs/${id}`);
    if (!response.ok) throw new Error(`Failed to fetch resume ${id}`);
    return response.json();
}

/**
 * Creates a new resume.
 */
export async function createResume(payload) {
    const response = await fetch(`${API_BASE}/jobs/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP error! status: ${response.status}`);
    return result;
}

/**
 * Updates an existing resume.
 */
export async function updateResume(id, payload) {
    const response = await fetch(`${API_BASE}/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP error! status: ${response.status}`);
    return result;
}

/**
 * Deletes a resume.
 */
export async function deleteResume(id) {
    const response = await fetch(`${API_BASE}/jobs/${id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP error! status: ${response.status}`);
    return result;
}
