/**
 * @file resumeUtils.js
 * This file contains utility functions for parsing and reconstructing resume markdown.
 */

/**
 * Parses a specific section from markdown text.
 * It now correctly handles '---' separators under headings.
 * @param {string} text - The full markdown text.
 * @param {string} startHeading - The heading to start parsing from (e.g., '## Habilidades').
 * @returns {Array<string>} An array of lines belonging to the section.
 */
const parseSection = (text, startHeading) => {
    const lines = text.split('\n');
    let content = [];
    let inSection = false;
    for (const line of lines) {
        if (line.startsWith(startHeading)) {
            inSection = true;
            continue;
        }
        // Only break when a new H2-level section starts.
        if (inSection && line.startsWith('## ')) {
            break;
        }
        // Add content if we are in the section, it's not empty, and it's not a separator.
        if (inSection && line.trim() !== '' && !line.startsWith('---')) {
            content.push(line);
        }
    }
    return content;
};

/**
 * Main parser function to extract all relevant information from markdown.
 * @param {string} markdownText - The resume content in markdown format.
 * @returns {Object} An object containing the extracted resume data.
 */
export const parseResume = (markdownText) => {
    const nameMatch = markdownText.match(/^#\s+(.*)/);
    const name = nameMatch ? nameMatch[1].trim() : 'Could not load resume name';

    const skillsSection = parseSection(markdownText, '## Habilidades');
    const skills = skillsSection.flatMap(line => {
        const parts = line.split(':');
        if (parts.length > 1) {
            return parts[1].split(',').map(skill => skill.trim());
        }
        return [];
    });

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

    const educationSection = parseSection(markdownText, '## Educação');
    const educations = [];
    for (let i = 0; i < educationSection.length; i++) {
        const line = educationSection[i];
        if (line.startsWith('- **')) {
            const nextLine = educationSection[i + 1] || '';
            const [location, date] = nextLine.split('|');

            educations.push({
                degree: line.replace('- **', '').split('**')[0].trim() + ' ' + (line.split('–')[1] || '').trim(),
                date: date ? date.trim().replace(/\*/g, '') : '',
                details: [location ? location.trim().replace(/\*/g, '') : '']
            });
            i++;
        }
    }

    return { name, skills, experiences, educations };
};

/**
 * Helper function to reconstruct markdown from JSON data.
 * @param {Object} data - The structured resume data.
 * @returns {string} The reconstructed markdown string.
 */
export const reconstructMarkdown = (data) => {
    let markdown = `# ${data.name || 'New Resume'}\n\n`;

    markdown += "## Habilidades\n---\n";
    if (data.skills && data.skills.length > 0) {
        markdown += `Tecnologias: ${data.skills.join(', ')}\n\n`;
    }

    markdown += "## Experiências Profissionais\n---\n";
    if (data.experiences) {
        data.experiences.forEach(exp => {
            markdown += `### ${exp.title}\n`;
            exp.details.forEach(detail => {
                markdown += `- ${detail}\n`;
            });
            markdown += '\n';
        });
    }

    markdown += "## Educação\n---\n";
    if (data.educations) {
        data.educations.forEach(edu => {
            markdown += `- **${edu.degree}**\n`;
            const detailsLine = [edu.details.join(' | '), edu.date].filter(Boolean).join(' | ');
            markdown += `  *${detailsLine}*\n\n`;
        });
    }

    return markdown;
};