/**
 * Normalizes a skill string for comparison.
 * Converts to lowercase and removes all non-alphanumeric characters.
 * e.g., "Back-end" -> "backend", "Node.js" -> "nodejs"
 * @param {string} skill The skill string to normalize.
 * @returns {string} The normalized skill string.
 */
export const normalizeSkill = (skill) => {
    if (typeof skill !== 'string') return '';
    return skill.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Parses skills data from various formats into a string array.
 * @param {any} skillsData The skills data to parse.
 * @returns {string[]} An array of skill strings.
 */
export const getSkillsArray = (skillsData) => {
    if (!skillsData) return [];
    if (Array.isArray(skillsData)) return skillsData;
    if (typeof skillsData === 'string') {
        try {
            const parsed = JSON.parse(skillsData);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            // Handle non-JSON strings if necessary
            return [];
        }
    }
    return [];
};

/**
 * Filters for complete jobs, calculates match scores based on skills, and sorts them.
 * @param {Array<Object>} jobs - The list of all jobs to be processed.
 * @param {Object} resume - The selected resume object with a `hard_skills` array.
 * @returns {Array<Object>} A new array of jobs, sorted by match score in descending order.
 */
export const findBestMatches = (jobs, resume) => {
    if (!resume || !resume.hard_skills || !Array.isArray(jobs)) {
        return [];
    }

    // 1. Filter for jobs that have all the required information
    const completeJobs = jobs.filter(job => {
        const hasResponsibilities = job.responsibilities && job.responsibilities.length > 0;
        const hasQualifications = job.qualifications && job.qualifications.length > 0;
        const skillsList = getSkillsArray(job.keywords || job.skills);
        const hasKeywords = skillsList.length > 0;
        return hasResponsibilities && hasQualifications && hasKeywords;
    });

    // 2. Normalize resume skills once for efficient comparison
    const normalizedResumeSkills = resume.hard_skills.map(normalizeSkill);

    // 3. Score each complete job based on skill overlap
    const scoredJobs = completeJobs.map(job => {
        const jobSkills = getSkillsArray(job.keywords || job.skills);
        const normalizedJobSkills = jobSkills.map(normalizeSkill);

        // Find how many of the job's required skills are in the resume
        const matchingSkills = normalizedJobSkills.filter(skill => normalizedResumeSkills.includes(skill));

        // Calculate score based on the proportion of matched skills
        const matchScore = jobSkills.length > 0 ? (matchingSkills.length / jobSkills.length) * 100 : 0;

        return { ...job, matchScore };
    });

    // 4. Sort jobs by the calculated match score in descending order
    return scoredJobs.sort((a, b) => b.matchScore - a.matchScore);
};