export type ResumeLanguage = "PTBR" | "EN"

export type ResumeSkillMap = {
    languages: string[]
    frameworks: string[]
    cloud_and_infra: string[]
    databases: string[]
    concepts: string[]
}

export type ResumeExperience = {
    id: string
    company: string
    role: string
    location: string
    startDate: string
    endDate: string
    highlights: string[]
    stack: string[]
}

export type ResumeProject = {
    id: string
    name: string
    description: string
    stack: string[]
    links: {
        github: string
        website: string
    }
}

export type ResumeEducation = {
    id: string
    institution: string
    degree: string
    location: string
    startYear: string
    endYear: string
    year: string
}

export type ResumeLanguageItem = {
    id: string
    name: string
    level: string
}

export type CareerProfile = {
    id: number
    name: string
    email: string
    phone: string
    location: string
    linkedin: string
    github: string
    portfolio: string
    languages: string[]
    positiveKeywords: string[]
    negativeKeywords: string[]
    education: ResumeEducation[]
}

export type ResumeDraft = {
    id: number
    profileId: number
    internalName: string
    language: ResumeLanguage
    summary: string
    contacts: {
        email: string
        github: string
        phone: string
        linkedin: string
        portfolio: string
    }
    skills: ResumeSkillMap
    experiences: ResumeExperience[]
    projects: ResumeProject[]
    education: ResumeEducation[]
    languages: ResumeLanguageItem[]
    meta: {
        language: string
        page: {
            fontSize: number
            size: string
        }
    }
}

const PROFILE_STORAGE_KEY = "new-frontend.profile.mock.profile"
const RESUMES_STORAGE_KEY = "new-frontend.profile.mock.resumes"

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const seedEducation: ResumeEducation[] = [
    {
        id: "edu-unifor",
        institution: "Unifor",
        degree: "Bacharelado em Ciências da Computação",
        location: "Fortaleza",
        startYear: "2019",
        endYear: "2023",
        year: "",
    },
    {
        id: "edu-lublin",
        institution: "Politechnika Lubelska",
        degree: "Intercâmbio acadêmico",
        location: "Lublin, Polônia",
        startYear: "2022",
        endYear: "2022",
        year: "",
    },
]

export const seedProfile: CareerProfile = {
    id: 1,
    name: "Mateus Bessa Maurício",
    email: "matbessa12@gmail.com",
    phone: "5585999171902",
    location: "Fortaleza, Brazil",
    linkedin: "https://www.linkedin.com/in/mateus-bessa-m/",
    github: "https://github.com/mateusb12/",
    portfolio: "https://mateusb12.github.io/mateus_portfolio/",
    languages: [],
    positiveKeywords: [],
    negativeKeywords: [],
    education: seedEducation,
}

const commonContacts = {
    email: "matbessa12@gmail.com",
    github: "https://github.com/mateusb12",
    phone: "+5585999171902",
    linkedin: "https://www.linkedin.com/in/mateus-bessa-m/",
    portfolio: "https://mateusb12.github.io/mateus_portfolio/",
}

const commonSkillBase = {
    cloud_and_infra: [
        "AWS",
        "Google Cloud",
        "Azure",
        "Docker",
        "Kubernetes",
        "PM2",
        "APScheduler",
        "Crontabs",
        "RabbitMQ",
        "Github Actions",
        "TILT",
        "EAS (Expo)",
        "Linux",
    ],
    databases: ["PostgreSQL", "Mongo", "Supabase", "SQLite", "MySQL"],
    frameworks: ["NextJS", "React", "Flask", "FastAPI", "Django", "React Native"],
    languages: ["Python", "C#", "Typescript", "JS"],
}

export const seedResumes: ResumeDraft[] = [
    {
        id: 1,
        profileId: 1,
        internalName: "PTBR",
        language: "PTBR",
        summary: "",
        contacts: commonContacts,
        languages: [
            {id: "lang-pt-en", name: "Inglês", level: "C2"},
            {id: "lang-pt-de", name: "Alemão", level: "A2"},
        ],
        skills: {
            ...commonSkillBase,
            concepts: [
                "Testes unitários",
                "Testes de integração",
                "Scrum",
                "Agile",
                "Kanban",
                "JWT",
                "Swagger",
                "OAuth2",
                "Webhooks",
            ],
        },
        experiences: [
            {
                id: "pt-exp-rovester",
                company: "Rovester AI",
                role: "IoT & Full Stack Developer",
                location: "Fortaleza, Ceará, Brazil",
                startDate: "2025-08",
                endDate: "Present",
                highlights: [
                    "Atuei no desenvolvimento uma plataforma IoT baseada em drones Raspberry Pi (Linux) utilizada para automação do processo de alimentação de camarões.",
                    "Atuei em drones (raspberry), backend e aplicação mobile, contribuindo para maior confiabilidade dos fluxos de telemetria e operação em ambientes com conectividade intermitente.",
                    "Implementei serviços executados nos drones em Python, incluindo lógica de telemetria, rotinas agendadas (Cron/APScheduler) e coleta assíncrona de medições elétricas em background.",
                    "Reestruturei partes do código legado, introduzindo gerenciamento de dependências com Poetry e reorganizando o projeto para facilitar evolução segura e manutenção do sistema.",
                    "Modelei e implementei comunicação assíncrona com RabbitMQ entre farm-servers e drones, aumentando a resiliência em cenários de rede instável.",
                    "Colaborei entre as camadas de dispositivo, backend e mobile para melhorar a confiabilidade das operações em campo.",
                ],
                stack: [
                    "Python",
                    "FastAPI",
                    "RabbitMQ (AMQP)",
                    "MongoDB",
                    "APScheduler",
                    "Cron",
                    "Poetry",
                    "Docker",
                    "Linux (Raspberry Pi)",
                    "React Native (Expo)",
                    "REST APIs",
                    "background workers",
                    "pipelines de telemetria",
                ],
            },
            {
                id: "pt-exp-bm",
                company: "BM Energia",
                role: "Desenvolvedor full stack - Plataforma de Requisições de Compra",
                location: "Fortaleza, Ceará, Brazil",
                startDate: "2025-05",
                endDate: "Present",
                highlights: [
                    "Projetei e desenvolvi sozinho uma plataforma web interna para gestão de requisições de compra na BM Energia.",
                    "Fui responsável pela arquitetura, desenvolvimento e infraestrutura da solução.",
                    "Desenvolvi aplicação full-stack utilizando React (TypeScript) e Flask (Python) com arquitetura baseada em REST APIs.",
                    "Modelei workflow de aprovação multi-etapas com controle de acesso baseado em papéis (RBAC) e rastreabilidade completa das ações.",
                    "Implementei geração de PDFs, notificações por e-mail, importação de planilhas Excel e armazenamento de arquivos em cloud.",
                    "Estruturei deploy de serviços containerizados e infraestrutura de banco de dados, permitindo integração segura entre componentes via webhooks.",
                ],
                stack: [
                    "React",
                    "TypeScript",
                    "Flask",
                    "REST APIs",
                    "Poetry",
                    "Alembic",
                    "PostgreSQL",
                    "Supabase",
                    "Docker",
                    "Coolify",
                    "AWS EC2",
                    "AWS S3",
                    "NGINX",
                    "JWT",
                    "RBAC",
                    "CI/CD",
                ],
            },
            {
                id: "pt-exp-pontotel",
                company: "Pontotel",
                role: "Desenvolvedor backend",
                location: "Remote",
                startDate: "2024-06",
                endDate: "2025-06",
                highlights: [
                    "Implementei scripts executados via Google Cloud para processar importações urgentes de dados de clientes.",
                    "Refatorei módulos e validações de código legado aplicando conceitos de Domain-Driven Design (DDD), DTOs e camadas de validação.",
                    "Desenvolvi pipelines de importação de dados a partir de planilhas Excel com pré-validação, conversão de tipos e testes de integração.",
                    "Criei uma API REST interna para monitoramento de calendário e indicadores operacionais com padrão unit-of-work e cobertura de testes.",
                ],
                stack: [
                    "Python",
                    "FastAPI",
                    "Flask",
                    "MongoDB",
                    "DDD",
                    "DTOs",
                    "unit-of-work",
                    "pytest",
                    "Google Cloud",
                    "GitHub Actions",
                    "TILT",
                ],
            },
            {
                id: "pt-exp-omnichat",
                company: "Startup Omnichat",
                role: "Desenvolvedor backend",
                location: "Fortaleza, Ceará, Brazil",
                startDate: "2023-12",
                endDate: "2024-05",
                highlights: [
                    "Liderei o desenvolvimento do backend para os principais sistemas da startup Omnichat.",
                    "Realizei operações em bancos de dados, sistemas de autenticação JWT, conexão PostgreSQL, endpoints de API, documentação via Swagger, integração com a API do Meta e webhooks.",
                    "Garanti a integração dos componentes de backend com as interfaces do front-end.",
                ],
                stack: ["PostgreSQL", "React", "Python", "Poetry", "Flask"],
            },
            {
                id: "pt-exp-insane",
                company: "INSANE",
                role: "Estagiário",
                location: "Brasil",
                startDate: "2021-07",
                endDate: "2022-02",
                highlights: [
                    "Concluí um estágio rotativo na área de desenvolvimento de jogos com experiência prática em gameplay mechanics, engineering e tech art.",
                    "Desenvolvi mecânicas de gameplay em C# e Unity e criei um RPG do zero junto a equipes de game design e engineering.",
                    "Criei e animei assets usando Blender, gerenciando a pipeline de tech art desde a criação do asset até a importação final na Unity.",
                    "Colaborei com equipes multidisciplinares para garantir um produto final coeso e de alta qualidade.",
                ],
                stack: ["Blender", "Unity", "C#"],
            },
        ],
        education: seedEducation,
        projects: [],
        meta: {language: "pt-BR", page: {fontSize: 11, size: "letter"}},
    },
    {
        id: 2,
        profileId: 1,
        internalName: "EN",
        language: "EN",
        summary: "",
        contacts: commonContacts,
        languages: [
            {id: "lang-en-en", name: "English", level: "C2"},
            {id: "lang-en-de", name: "German", level: "A2"},
        ],
        skills: {
            ...commonSkillBase,
            concepts: [
                "Unit Tests",
                "Integration tests",
                "Scrum",
                "Agile",
                "Kanban",
                "JWT",
                "Swagger",
                "OAuth2",
            ],
        },
        experiences: [
            {
                id: "en-exp-rovester",
                company: "Rovester AI",
                role: "IoT & Full Stack Developer",
                location: "Fortaleza, Ceará, Brazil",
                startDate: "2025-08",
                endDate: "Present",
                highlights: [
                    "Worked on the development of an IoT platform based on Raspberry Pi (Linux) drones used to automate shrimp feeding operations.",
                    "Implemented Python services running on drones, including telemetry logic, scheduled jobs (Cron/APScheduler), and asynchronous background collection of electrical measurements.",
                    "Refactored legacy code, introducing dependency management with Poetry and reorganizing the project structure to enable safer system evolution and maintainability.",
                    "Designed and implemented asynchronous communication using RabbitMQ between farm servers and drones, improving resilience in unstable network conditions.",
                    "Maintained and extended backend APIs using FastAPI and MongoDB to orchestrate operational and telemetry data in distributed environments.",
                    "Contributed across edge devices, backend, and mobile application layers, improving telemetry reliability and system resilience in environments with intermittent connectivity.",
                ],
                stack: [
                    "Python",
                    "FastAPI",
                    "RabbitMQ (AMQP)",
                    "MongoDB",
                    "APScheduler",
                    "Cron",
                    "Poetry",
                    "Docker",
                    "Linux (Raspberry Pi)",
                    "React Native (Expo)",
                    "REST APIs",
                    "background workers",
                    "telemetry pipelines",
                ],
            },
            {
                id: "en-exp-bm",
                company: "BM Energia",
                role: "Full Stack Developer - Purchase Requisition Workflow System",
                location: "Fortaleza, Ceará, Brazil",
                startDate: "2025-05",
                endDate: "Present",
                highlights: [
                    "Designed and independently developed an internal web platform to manage purchase requests at BM Energia.",
                    "Owned the architecture, development, and infrastructure of the solution.",
                    "Built a full-stack application using React (TypeScript) and Flask (Python) following a REST API architecture.",
                    "Modeled a multi-step approval workflow with role-based access control (RBAC) and full action traceability.",
                    "Implemented PDF generation, email notifications, Excel import workflows, and cloud-based file storage.",
                    "Structured containerized deployment and database infrastructure, enabling secure integration between services via webhooks.",
                ],
                stack: [
                    "React",
                    "TypeScript",
                    "Flask",
                    "REST APIs",
                    "Poetry",
                    "Alembic",
                    "PostgreSQL",
                    "Supabase",
                    "Docker",
                    "Coolify",
                    "AWS EC2",
                    "AWS S3",
                    "NGINX",
                    "JWT",
                    "RBAC",
                    "CI/CD",
                ],
            },
            {
                id: "en-exp-pontotel",
                company: "Pontotel",
                role: "Backend developer",
                location: "Remote",
                startDate: "2024-06",
                endDate: "2025-06",
                highlights: [
                    "Implemented scripts executed via Google Cloud to process urgent client data imports without waiting for new features in the main system.",
                    "Refactored legacy modules and validation logic applying Domain-Driven Design (DDD), DTOs, and validation layers.",
                    "Developed Excel-based data import pipelines with pre-validation, type conversion, and integration tests.",
                    "Created an internal REST API for calendar monitoring and operational metrics using a unit-of-work pattern and test coverage.",
                ],
                stack: [
                    "Python",
                    "FastAPI",
                    "Flask ecosystem",
                    "MongoDB",
                    "DDD",
                    "DTOs",
                    "unit-of-work",
                    "pytest",
                    "Google Cloud",
                    "GitHub Actions",
                    "TILT",
                ],
            },
            {
                id: "en-exp-omnichat",
                company: "Omnichat startup",
                role: "Backend Lead",
                location: "Fortaleza, Ceará, Brazil",
                startDate: "2023-12",
                endDate: "2024-05",
                highlights: [
                    "Led backend development for Omnichat's core systems.",
                    "Implemented database operations, JWT authentication, PostgreSQL connections, API endpoints, Swagger documentation, Meta API integration, and webhook connections.",
                    "Integrated backend components with front-end interfaces.",
                ],
                stack: ["PostgreSQL", "React", "Python", "Poetry", "Flask"],
            },
            {
                id: "en-exp-insane",
                company: "INSANE",
                role: "Intern",
                location: "Brazil",
                startDate: "2021-07",
                endDate: "2022-02",
                highlights: [
                    "Completed a rotating internship program in game development with hands-on experience in gameplay programming, engineering, and tech art.",
                    "Used C# and Unity to create an RPG game from scratch with game design and engineering teams.",
                    "Developed gameplay mechanics while following company coding standards.",
                    "Created and animated assets using Blender, managing the tech art pipeline from asset creation to final import in Unity.",
                    "Collaborated with cross-functional teams to deliver a cohesive final product.",
                ],
                stack: ["Blender", "Unity"],
            },
        ],
        education: seedEducation,
        projects: [],
        meta: {language: "en-US", page: {fontSize: 11, size: "letter"}},
    },
]

function readStorage<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return clone(fallback)

    const raw = window.localStorage.getItem(key)
    if (!raw) return clone(fallback)

    try {
        return JSON.parse(raw) as T
    } catch {
        return clone(fallback)
    }
}

function writeStorage<T>(key: string, value: T) {
    if (typeof window === "undefined") return

    window.localStorage.setItem(key, JSON.stringify(value))
}

export async function fetchProfileMock() {
    return readStorage(PROFILE_STORAGE_KEY, seedProfile)
}

export async function saveProfileMock(profile: CareerProfile) {
    writeStorage(PROFILE_STORAGE_KEY, profile)
    return clone(profile)
}

export async function fetchResumesMock() {
    return readStorage(RESUMES_STORAGE_KEY, seedResumes)
}

export async function saveResumeMock(resume: ResumeDraft) {
    const resumes = readStorage(RESUMES_STORAGE_KEY, seedResumes)
    const next = resumes.some(item => item.id === resume.id)
        ? resumes.map(item => (item.id === resume.id ? resume : item))
        : [...resumes, resume]

    writeStorage(RESUMES_STORAGE_KEY, next)

    return clone(resume)
}

export async function deleteResumeMock(resumeId: number) {
    const resumes = readStorage(RESUMES_STORAGE_KEY, seedResumes)
    const next = resumes.filter(item => item.id !== resumeId)
    writeStorage(RESUMES_STORAGE_KEY, next)

    return clone(next)
}

export async function duplicateResumeMock(resumeId: number) {
    const resumes = readStorage(RESUMES_STORAGE_KEY, seedResumes)
    const source = resumes.find(item => item.id === resumeId) ?? resumes[0]
    const nextId = Math.max(0, ...resumes.map(item => item.id)) + 1
    const copy: ResumeDraft = {
        ...clone(source),
        id: nextId,
        internalName: `${source.internalName} Copy`,
    }
    const next = [...resumes, copy]
    writeStorage(RESUMES_STORAGE_KEY, next)

    return clone(copy)
}

export async function resetProfileMock() {
    writeStorage(PROFILE_STORAGE_KEY, seedProfile)
    writeStorage(RESUMES_STORAGE_KEY, seedResumes)

    return {
        profile: clone(seedProfile),
        resumes: clone(seedResumes),
    }
}
