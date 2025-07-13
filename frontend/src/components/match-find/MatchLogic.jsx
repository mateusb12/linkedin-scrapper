/**
 * Normalizes a skill string for comparison by converting to lowercase and trimming whitespace.
 * This is less destructive than the previous version, preserving special characters.
 * e.g., " Mongo DB " -> "mongo db"
 * @param {string} skill The skill string to normalize.
 * @returns {string} The normalized skill string.
 */
export const normalizeSkill = (skill) => {
    if (typeof skill !== 'string') return '';
    return skill.toLowerCase().trim();
};

/**
 * Calculates the Jaro-Winkler similarity between two strings.
 * Returns a value between 0 (no similarity) and 1 (exact match).
 * @param {string} s1 The first string.
 * @param {string} s2 The second string.
 * @returns {number} The Jaro-Winkler similarity score.
 */
export const jaroWinkler = (s1, s2) => {
    let m = 0;

    // Exit early if either string is empty
    if (s1.length === 0 || s2.length === 0) {
        return 0;
    }

    // Ensure s1 is the shorter string
    if (s1.length > s2.length) {
        [s1, s2] = [s2, s1];
    }

    const maxDist = Math.floor(s2.length / 2) - 1;
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);

    for (let i = 0; i < s1.length; i++) {
        const start = Math.max(0, i - maxDist);
        const end = Math.min(i + maxDist + 1, s2.length);
        for (let j = start; j < end; j++) {
            if (!s2Matches[j] && s1[i] === s2[j]) {
                s1Matches[i] = true;
                s2Matches[j] = true;
                m++;
                break;
            }
        }
    }

    if (m === 0) {
        return 0;
    }

    let t = 0;
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
        if (s1Matches[i]) {
            while (!s2Matches[k]) {
                k++;
            }
            if (s1[i] !== s2[k]) {
                t++;
            }
            k++;
        }
    }

    const jaro = (m / s1.length + m / s2.length + (m - t / 2) / m) / 3;

    // Winkler modification
    let p = 0.1;
    let l = 0;
    const limit = Math.min(4, s1.length);
    while (l < limit && s1[l] === s2[l]) {
        l++;
    }

    return jaro + l * p * (1 - jaro);
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
            // It's common for skills to be stored as a JSON string array
            const parsed = JSON.parse(skillsData);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            // Fallback for comma-separated strings
            return skillsData.split(',').map(s => s.trim()).filter(Boolean);
        }
    }
    return [];
};


/**
 * Filters for complete jobs, calculates match scores based on semantic skill similarity, and sorts them.
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
    const resumeSkills = resume.hard_skills.map(normalizeSkill).filter(Boolean);

    // 3. Score each complete job based on skill overlap using Jaro-Winkler similarity
    const scoredJobs = completeJobs.map(job => {
        const jobSkills = getSkillsArray(job.keywords || job.skills);
        const normalizedJobSkills = jobSkills.map(normalizeSkill).filter(Boolean);

        let matchingSkillsCount = 0;
        const matchedResumeSkills = new Set(); // To avoid matching the same resume skill multiple times

        // For each job skill, find the best matching resume skill
        normalizedJobSkills.forEach(jobSkill => {
            let bestMatchScore = 0;
            let bestMatch = null;

            resumeSkills.forEach(resumeSkill => {
                const score = jaroWinkler(jobSkill, resumeSkill);
                if (score > bestMatchScore) {
                    bestMatchScore = score;
                    bestMatch = resumeSkill;
                }
            });

            // Consider it a match if the similarity is above a threshold (e.g., 0.8)
            // and the resume skill hasn't been used for another match yet
            if (bestMatchScore > 0.8 && !matchedResumeSkills.has(bestMatch)) {
                matchingSkillsCount++;
                matchedResumeSkills.add(bestMatch);
            }
        });

        // Calculate score based on the proportion of matched skills
        const matchScore = normalizedJobSkills.length > 0 ? (matchingSkillsCount / normalizedJobSkills.length) * 100 : 0;

        return { ...job, matchScore };
    });

    // 4. Sort jobs by the calculated match score in descending order
    return scoredJobs.sort((a, b) => b.matchScore - a.matchScore);
};