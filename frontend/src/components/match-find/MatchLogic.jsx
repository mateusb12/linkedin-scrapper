export const normalizeSkill = (skill) => {
    if (typeof skill !== 'string') return '';
    return skill.toLowerCase().trim().replace(/\s+/g, '');
};

/**
 * Calculates the cosine similarity between two strings based on their character n-grams.
 * (Unchanged from previous version)
 * @param {string} s1 The first string.
 * @param {string} s2 The second string.
 * @returns {number} The cosine similarity score.
 */
export const cosineSimilarity = (s1, s2, n = 2) => {
    if (typeof s1 !== 'string' || typeof s2 !== 'string') return 0;

    const stringToNgramMap = (str, n) => {
        const ngrams = new Map();
        if (!str || str.length < n) return ngrams;
        for (let i = 0; i <= str.length - n; i++) {
            const ngram = str.slice(i, i + n);
            ngrams.set(ngram, (ngrams.get(ngram) || 0) + 1);
        }
        return ngrams;
    };

    const vec1 = stringToNgramMap(s1, n);
    const vec2 = stringToNgramMap(s2, n);

    if (vec1.size === 0 || vec2.size === 0) return 0;

    const allNgrams = new Set([...vec1.keys(), ...vec2.keys()]);

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (const ngram of allNgrams) {
        const count1 = vec1.get(ngram) || 0;
        const count2 = vec2.get(ngram) || 0;
        dotProduct += count1 * count2;
        mag1 += count1 * count1;
        mag2 += count2 * count2;
    }

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
};

/**
 * Parses skills data from various formats into a string array.
 * (Unchanged from previous version)
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
            return skillsData.split(',').map(s => s.trim()).filter(Boolean);
        }
    }
    return [];
};


/**
 * Filters jobs, calculates match scores, and IDENTIFIES MATCHED SKILLS.
 * @param {Array<Object>} jobs - The list of all jobs to be processed.
 * @param {Object} resume - The selected resume object with a `hard_skills` array.
 * @returns {Array<Object>} A new array of jobs, sorted by score, with an added `matchedSkillsSet` property.
 */
export const findBestMatches = (jobs, resume) => {
    if (!resume || !resume.hard_skills || !Array.isArray(jobs)) {
        return [];
    }

    const completeJobs = jobs.filter(job => {
        const hasResponsibilities = job.responsibilities && job.responsibilities.length > 0;
        const hasQualifications = job.qualifications && job.qualifications.length > 0;
        const skillsList = getSkillsArray(job.keywords || job.skills);
        const hasKeywords = skillsList.length > 0;
        return hasResponsibilities && hasQualifications && hasKeywords;
    });

    const resumeSkills = resume.hard_skills.map(normalizeSkill).filter(Boolean);

    const scoredJobs = completeJobs.map(job => {
        const originalJobSkills = getSkillsArray(job.keywords || job.skills);

        const jobSkillsWithOriginals = originalJobSkills.map(skill => ({
            original: skill,
            normalized: normalizeSkill(skill)
        })).filter(s => s.normalized);

        let totalScore = 0;
        const matchedSkillsSet = new Set();
        const usedNormalizedJobSkills = new Set();

        resumeSkills.forEach(resumeSkill => {
            let bestMatchScore = 0;
            let bestMatch = null;

            jobSkillsWithOriginals.forEach(jobSkillInfo => {
                if (usedNormalizedJobSkills.has(jobSkillInfo.normalized)) {
                    return;
                }

                // ✨ UPDATED: Prioritize prefix/exact matches before using cosine similarity
                let score = 0;
                const normResumeSkill = resumeSkill;
                const normJobSkill = jobSkillInfo.normalized;

                if (normJobSkill.startsWith(normResumeSkill) || normResumeSkill.startsWith(normJobSkill)) {
                    score = 1.0; // Perfect match for abbreviations like mongo/mongodb
                } else {
                    score = cosineSimilarity(normResumeSkill, normJobSkill);
                }

                if (score > bestMatchScore) {
                    bestMatchScore = score;
                    bestMatch = jobSkillInfo;
                }
            });

            const SIMILARITY_THRESHOLD = 0.6; // Threshold remains for cosine similarity cases
            if (bestMatch && bestMatchScore >= SIMILARITY_THRESHOLD) {
                totalScore += bestMatchScore;
                matchedSkillsSet.add(bestMatch.original);
                usedNormalizedJobSkills.add(bestMatch.normalized);
            }
        });

        const matchScore = jobSkillsWithOriginals.length > 0
            ? (totalScore / jobSkillsWithOriginals.length) * 100
            : 0;

        return { ...job, matchScore, matchedSkillsSet };
    });

    return scoredJobs.sort((a, b) => b.matchScore - a.matchScore);
};