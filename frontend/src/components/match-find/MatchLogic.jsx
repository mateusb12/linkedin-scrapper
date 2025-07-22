export const API_BASE = "http://localhost:5000";

// Mock data as a fallback in case the API fails
export const MOCK_RESUMES = [{
    "education": [{ "date": "2019–2023 - Politechnika Lubelska – Intercâmbio acadêmico", "degree": "Universidade de Fortaleza Bacharelado em Ciências da Computação ", "details": ["Fortaleza, Brazil"] }],
    "hard_skills": ["Python", "C#", "Javascript", "NextJS", "ReactNative", "React", "SQL", "HTML", "CSS", "Unit tests", "Integration tests", "Scrum", "Agile", "Kanban", "Swagger", "AWS", "Google Cloud", "Azure", "Docker", "Kubernetes", "TILT", "Github Actions", "Linux", "Flask", "Django", "NodeJS", "Postgres", "Mongo", "Supabase", "JWT", "OAuth2", "Github", "Gitlab", "Backend", "Frontend", "Fullstack", "Firebase", "Typescript", "GIT", "JSON", "REST", "Desenvolvimento de Software", "DevOps", "CI/CD", "NoSQL", "Software Engineering", "Cloud Computing", "Clean Code", "Clean Architecture"],
    "id": 1,
    "name": "Backend python",
    "professional_experience": [{ "details": ["Coordenei os sprints da equipe de backend e distribuí tarefas utilizando Scrum.", "Mentoria e code review de membros da equipe, melhorando a eficiência.", "Desenvolvi APIs RESTful com Flask, microsserviços e autenticação JWT.", "Modelei e otimizei banco de dados PostgreSQL com ORM.", "Adotei Clean Code, Design Patterns e documentação via Swagger.", "Configurei webhooks e integração com frontend React para sincronização de chatbot."], "title": "Pontotel – Backend Developer(Mar/2025 - Jun/2025)" }, { "details": ["Implementei scripts via Google Cloud para atender demandas urgentes.", "Refatorei código legado com DTOs e validações modernas.", "Desenvolvi importadores de dados com pré-validação e testes.", "Criei API interna para métricas de calendário com MongoDB.", "Trabalhei com Flask, Celery, FastAPI, Pytest, TILT, Alembic, Poetry, Docker e Kubernetes."], "title": "Omnichat – Backend Lead(Aug/2024 - Jan/2025)" }, { "details": ["Desenvolvi sistemas backend para jogos Unity com C#.", "Colaborei com equipes de Game Design e Áudio.", "Gerenciei produção de assets em Tech Art com Blender.", "Fiz mapeamento UV e shaders, garantindo qualidade dos produtos."], "title": "Insane Games – Intern(Feb/2024 - Jun/2024)" }]
}];

export const MOCK_JOBS = [
    { applicants: 5, company: { name: "Innovatech Solutions", logo_url: "https://placehold.co/64x64/3b82f6/ffffff?text=IS" }, job_url: "#", location: "San Francisco, CA", posted_on: "2025-07-10T12:00:00Z", title: "Senior Frontend Developer", urn: "urn:li:job:1", workplace_type: "On-site", employment_type: "Full-time", responsibilities: ["Develop new user-facing features for our flagship product.", "Build reusable code and libraries for future use.", "Ensure the technical feasibility of UI/UX designs.", "Optimize application for maximum speed and scalability."], qualifications: ["5+ years of experience with React and the modern JavaScript ecosystem.", "Strong proficiency in JavaScript, TypeScript, HTML5, and CSS3.", "Experience with state management libraries like Redux or Zustand.", "Familiarity with RESTful APIs and modern authorization mechanisms."], keywords: "React,TypeScript,Next.js,JavaScript,CSS,HTML,Frontend,UI,UX", easy_apply: true, applied_on: null, description_full: "Join our dynamic frontend team to build the next generation of user interfaces. You will be a key player in driving the technical direction of our products." },
    { applicants: 12, company: { name: "Auramind.ai", logo_url: "https://placehold.co/64x64/8b5cf6/ffffff?text=A" }, job_url: "#", location: "Goiânia, Brazil (Remote)", posted_on: "2025-07-12T12:00:00Z", title: "Backend Developer - Python", urn: "urn:li:job:2", workplace_type: "Remote", employment_type: "Full-time", responsibilities: ["Design and implement scalable and secure RESTful APIs using Python.", "Maintain and improve database performance and reliability (PostgreSQL).", "Write clean, maintainable, and well-tested code.", "Collaborate with frontend developers and product managers to deliver high-quality features."], qualifications: ["Proven experience as a Python Developer.", "Strong experience with Django or Flask frameworks.", "Solid understanding of database design, SQL, and ORMs.", "Experience with containerization (Docker) and CI/CD pipelines."], keywords: "Python,Django,Flask,PostgreSQL,Docker,Backend,RESTful APIs,SQL,CI/CD", easy_apply: true, applied_on: null, description_full: "Auramind.ai is seeking a talented Python Backend Developer to join our fully remote team. You will be responsible for building the core infrastructure that powers our AI-driven platform." },
];

export const getColorFromScore = (score) => {
    const capped = Math.min(Math.max(score, 0), 100);
    const hue = Math.round((capped / 100) * 120);
    return `hsl(${hue}, 70%, 45%)`;
};

export const handleResponse = async (response, defaultErrorMsg) => {
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
        throw new Error(errorBody.error || defaultErrorMsg);
    }
    return response.json();
};

export const fetchResumes = async () => {
    try {
        const response = await fetch(`${API_BASE}/jobs/`);
        return handleResponse(response, 'Failed to fetch resumes');
    } catch (error) {
        console.warn("API fetch for resumes failed, using mock data as a fallback.", error);
        return Promise.resolve(MOCK_RESUMES);
    }
};

export const fetchResumeById = async (id) => {
    try {
        const response = await fetch(`${API_BASE}/jobs/${id}`);
        return handleResponse(response, `Failed to fetch resume with ID ${id}`);
    } catch (error) {
        console.warn(`API fetch for resume ${id} failed, using mock data as a fallback.`, error);
        const resume = MOCK_RESUMES.find(r => r.id == id);
        if (resume) return Promise.resolve(resume);
        return Promise.reject(new Error(`Resume with ID ${id} not found in mock data.`));
    }
};

export const fetchAllJobs = async () => {
    try {
        const response = await fetch(`${API_BASE}/jobs/all`);
        return handleResponse(response, 'Failed to fetch all jobs');
    } catch (error) {
        console.warn("API fetch for all jobs failed, using mock data as a fallback.", error);
        return Promise.resolve(MOCK_JOBS);
    }
};

export const markJobAsApplied = async (jobUrn) => {
    const response = await fetch(`${API_BASE}/jobs/${jobUrn}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applied_on: new Date().toISOString() }),
    });
    return handleResponse(response, 'Failed to mark job as applied');
};

export const getSkillsArray = (keywords) => {
    if (!keywords) return [];
    if (Array.isArray(keywords)) return keywords;
    return keywords.split(',').map(k => k.trim()).filter(Boolean);
};

export const normalizeKeyword = (str) => str.toLowerCase().trim();

export const findBestMatches = (jobs, profile) => {
    // Use positive_keywords from the profile for matching.
    const userKeywords = new Set((profile?.positive_keywords || []).map(normalizeKeyword));

    // If the user has no keywords, all scores are 0.
    if (userKeywords.size === 0) {
        return jobs.map(j => ({ ...j, matchScore: 0, matchedSkillsSet: new Set() }));
    }

    return jobs.map(job => {
        const jobKeywords = getSkillsArray(job.keywords);
        // If the job has no keywords, its score is 0.
        if (jobKeywords.length === 0) {
            return { ...job, matchScore: 0, matchedSkillsSet: new Set() };
        }

        const matchedSkillsSet = new Set();
        jobKeywords.forEach(keyword => {
            // Check if the normalized job keyword exists in the user's keyword set.
            if (userKeywords.has(normalizeKeyword(keyword))) {
                matchedSkillsSet.add(keyword);
            }
        });

        // Calculate score as the percentage of required keywords that the user has.
        const matchScore = (matchedSkillsSet.size / jobKeywords.length) * 100;
        return { ...job, matchScore, matchedSkillsSet };
    }).sort((a, b) => b.matchScore - a.matchScore);
};