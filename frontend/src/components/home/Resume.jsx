import React from "react";

// Mock data from backend_resume.md for initial display
const mockResumeContent = `
# Mateus Bessa
**Desenvolvedor de software**  
📬 [matbessa12@gmail.com](mailto:matbessa12@gmail.com)  
📞 +55 85 99917 1902  
🔗 [LinkedIn](https://www.linkedin.com/in/mateus-bessa-m)  
🔗 [Portfólio](https://tinyurl.com/mateus-pfl)

---

## Resumo
Desenvolvedor de Software Full-stack com foco em backend, especializado em Python, Flask, C# e plataformas em cloud. Experiente na construção de sistemas robustos e escaláveis nos setores de fintech, edtech e desenvolvimento de jogos. Tenho experiência com liderança de equipes, práticas de clean code e na entrega de soluções que alinham tecnologia aos objetivos do produto.

---

## Habilidades

### Desenvolvimento
- **Linguagens**: Python, C#, Javascript  
- **Frontend**: NextJS, ReactNative, React  
- **Fundamentos**: SQL, HTML, CSS  
- **Testes**: Unit tests, Integration tests  
- **Metodologias**: Scrum, Agile, Kanban  
- **Documentação**: Swagger  

### Infraestrutura
- **Cloud**: AWS, Google Cloud, Azure  
- **Containers**: Docker, Kubernetes  
- **CI/CD**: TILT, Github Actions  
- **OS**: Linux  

### Tecnologia
- **Frameworks**: Flask, Django, NodeJS  
- **Databases**: Postgres, Mongo, Supabase  
- **Segurança**: JWT, OAuth2  
- **Versionamento**: Github, Gitlab  

---

## Experiências Profissionais

### Pontotel – Backend Developer (Mar/2025 - Jun/2025)
- Coordenei os sprints da equipe de backend e distribuí tarefas utilizando Scrum.
- Mentoria e code review de membros da equipe, melhorando a eficiência.
- Desenvolvi APIs RESTful com Flask, microsserviços e autenticação JWT.
- Modelei e otimizei banco de dados PostgreSQL com ORM.
- Adotei Clean Code, Design Patterns e documentação via Swagger.
- Configurei webhooks e integração com frontend React para sincronização de chatbot.

### Omnichat – Backend Lead (Aug/2024 - Jan/2025)
- Implementei scripts via Google Cloud para atender demandas urgentes.
- Refatorei código legado com DTOs e validações modernas.
- Desenvolvi importadores de dados com pré-validação e testes.
- Criei API interna para métricas de calendário com MongoDB.
- Trabalhei com Flask, Celery, FastAPI, Pytest, TILT, Alembic, Poetry, Docker e Kubernetes.

### Insane Games – Intern (Feb/2024 - Jun/2024)
- Desenvolvi sistemas backend para jogos Unity com C#.
- Colaborei com equipes de Game Design e Áudio.
- Gerenciei produção de assets em Tech Art com Blender.
- Fiz mapeamento UV e shaders, garantindo qualidade dos produtos.

---

## Projetos

### AM Finance  
🔗 [amfinance.com.br](https://www.amfinance.com.br)  
- Plataforma de organização financeira com criptografia e análise de dados.
- Construído com NextJS, Supabase, PWA.
- Categoriza gastos automaticamente e emite alertas mensais.

### Farlink  
🔗 [tinyurl.com/farlink-m](https://tinyurl.com/farlink-m)  
- Rede social educacional com vídeos curtos e quizzes.
- Construído com React Native, NodeJS, MongoDB e Azure.
- Backend com API Gateway e CDN para vídeos.

### Book Analyzer  
🔗 [tinyurl.com/farlink-m](https://tinyurl.com/farlink-m)  
- Converte livros em grafos no estilo de redes sociais.
- Construído com Django, ReactJS, Numpy, Pandas, Spacy, GraphViz.
- Suporte a .txt e web scraping de wikis públicas.

### Flight Scrapper  
🔗 [tinyurl.com/travl-s](https://tinyurl.com/travl-s)  
- Alerta de queda de preço em passagens aéreas via Telegram.
- Construído com Flask, Firebase, Pandas, Matplotlib, Selenium.
- Usa API Kiwi Tequila para verificação diária de preços.

### Valorant Impact  
🔗 [tinyurl.com/val-imp](https://tinyurl.com/val-imp)  
- Análise do impacto das jogadas no jogo Valorant.
- Construído com Flask, Optuna, Pandas, LightGBM, Scipy, Seaborn.
- Modelo LightGBM para prever vitória com base em decisões táticas.

---

## Educação

- **Universidade de Fortaleza** – Bacharelado em Ciências da Computação  
  *Fortaleza, Brazil | 2019–2023*  

- **Politechnika Lubelska** – Intercâmbio acadêmico  
  *Lublin, Polônia | 2022*

---

## Idiomas
- **Português**: C2 (Nativo)  
- **Inglês**: C2 (Fluente)  
- **Espanhol**: A1 (Básico)
...
`;


// Helper function to parse a specific section from the resume markdown
const parseSection = (text, startHeading) => {
    const lines = text.split('\n');
    let content = [];
    let inSection = false;
    for (const line of lines) {
        if (line.startsWith(startHeading)) {
            inSection = true;
            continue;
        }
        if (inSection && (line.startsWith('---') || line.startsWith('## '))) {
            break;
        }
        if (inSection && line.trim() !== '') {
            content.push(line);
        }
    }
    return content;
};

// Main parser function to extract all relevant information
const parseResume = (markdownText) => {
    const skillsSection = parseSection(markdownText, '## 🛠 Hard Skills');
    const skills = skillsSection.flatMap(line => {
        const parts = line.split(':');
        if (parts.length > 1) {
            return parts[1].split(',').map(skill => skill.trim());
        }
        return [];
    });

    const experienceSection = parseSection(markdownText, '## 💼 Professional Experiences');
    const experiences = [];
    let currentExperience = null;
    for (const line of experienceSection) {
        if (line.startsWith('###')) {
            if (currentExperience) experiences.push(currentExperience);
            currentExperience = {
                title: line.replace('###', '').split('*')[0].trim().replace(/\*\*/g, ''),
                details: []
            };
        } else if (currentExperience && line.trim().startsWith('-')) {
            currentExperience.details.push(line.trim());
        } else if (currentExperience) {
            // Append to title if it's part of it
            currentExperience.title += ` ${line.trim()}`;
        }
    }
    if (currentExperience) experiences.push(currentExperience);

    const educationSection = parseSection(markdownText, '## 🎓 Education');
    const educations = [];
    let currentEducation = null;
    for(const line of educationSection) {
        if(line.trim() === '') continue;
        if(!line.startsWith('Universidade') && !line.startsWith('Politechnika')) {
            if(currentEducation) educations.push(currentEducation);
            currentEducation = {
                degree: line.split('|')[0].trim().replace(/\*\*/g, ''),
                date: line.split('|')[1]?.trim().replace(/\*/g, ''),
                details: []
            };
        } else if (currentEducation) {
            currentEducation.details.push(line.trim());
        }
    }
    if(currentEducation) educations.push(currentEducation);


    return { skills, experiences, educations };
};


// Icons for UI
const UploadCloudIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
        <path d="M12 12v9" />
        <path d="m16 16-4-4-4 4" />
    </svg>
);

const FileTextIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
);

const BriefcaseIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
);

const GraduationCapIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
);

const BotIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
    </svg>
);


function ResumeParser() {
    const [resumeContent, setResumeContent] = React.useState(mockResumeContent);
    const [fileName, setFileName] = React.useState("backend_resume.md");
    const [isParsing, setIsParsing] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [extractedData, setExtractedData] = React.useState(null);

    const fileInputRef = React.useRef(null);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.name.endsWith('.md')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    setResumeContent(e.target.result);
                    setFileName(file.name);
                    setError(null);
                    setExtractedData(null); // Reset extracted data on new file
                };
                reader.readAsText(file);
            } else {
                setError("Please upload a Markdown (.md) file.");
            }
        }
    };

    const handleAnalyze = () => {
        if (!resumeContent) {
            setError("Please upload a resume first.");
            return;
        }
        setIsParsing(true);
        setError(null);
        // Simulate parsing delay
        setTimeout(() => {
            try {
                const data = parseResume(resumeContent);
                setExtractedData(data);
            } catch (err) {
                setError("Failed to parse the resume. Please check the format.");
                console.error(err);
            } finally {
                setIsParsing(false);
            }
        }, 1000);
    };

    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-center text-cyan-400">Resume Analyzer</h1>
                    <p className="text-center text-gray-400 mt-2">
                        Upload your Markdown resume to extract key information for job matching.
                    </p>
                </header>

                <div className="max-w-4xl mx-auto flex flex-col gap-8">
                    {/* Section 1: Upload and Control */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2">Upload Your Resume</h2>

                        <div
                            className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-cyan-400 hover:bg-gray-700/50 transition-all duration-300"
                            onClick={handleUploadClick}
                        >
                            <UploadCloudIcon className="mx-auto h-12 w-12 text-gray-500" />
                            <p className="mt-4 text-gray-400">
                                <span className="font-semibold text-cyan-400">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Markdown (.md) files only</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".md"
                            />
                        </div>

                        {fileName && (
                            <div className="mt-4 bg-gray-700 p-3 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileTextIcon className="h-5 w-5 text-cyan-400" />
                                    <span className="text-gray-300">{fileName}</span>
                                </div>
                            </div>
                        )}

                        <div className="mt-6 flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={handleAnalyze}
                                disabled={isParsing || !resumeContent}
                                className="w-full flex-1 bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-cyan-600 transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isParsing ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Analyzing...
                                    </>
                                ) : (
                                    <> <BotIcon className="h-5 w-5"/> Analyze Resume </>
                                )}
                            </button>
                            <button
                                disabled
                                className="w-full flex-1 bg-gray-700 text-gray-400 font-bold py-3 px-4 rounded-lg cursor-not-allowed"
                            >
                                Upload PDF (Unavailable)
                            </button>
                        </div>
                        {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
                    </div>

                    {/* Section 2: Extracted Data */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2">Extracted Information</h2>
                        {!extractedData && !isParsing && (
                            <div className="text-center text-gray-500 py-16">
                                <BotIcon className="mx-auto h-16 w-16 text-gray-600"/>
                                <p className="mt-4">Analysis results will appear here.</p>
                            </div>
                        )}
                        {isParsing && (
                            <div className="text-center text-gray-500 pt-16">
                                <svg className="animate-spin mx-auto h-12 w-12 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <p className="mt-4">Parsing your resume...</p>
                            </div>
                        )}
                        {extractedData && (
                            <div className="space-y-6">
                                {/* Skills */}
                                <div>
                                    <h3 className="text-xl font-semibold text-cyan-400 mb-3">🛠 Hard Skills</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {extractedData.skills.map((skill, index) => (
                                            <span key={index} className="bg-gray-700 text-cyan-300 text-sm font-medium px-3 py-1 rounded-full">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Professional Experience */}
                                <div>
                                    <h3 className="text-xl font-semibold text-cyan-400 mb-3 flex items-center gap-2"><BriefcaseIcon/> Professional Experience</h3>
                                    <div className="space-y-4">
                                        {extractedData.experiences.map((exp, index) => (
                                            <div key={index} className="bg-gray-700/50 p-4 rounded-lg">
                                                <h4 className="font-bold text-gray-200">{exp.title}</h4>
                                                {exp.details.map((detail, i) => (
                                                    <p key={i} className="text-gray-400 text-sm ml-2">{detail}</p>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Education */}
                                <div>
                                    <h3 className="text-xl font-semibold text-cyan-400 mb-3 flex items-center gap-2"><GraduationCapIcon/> Education</h3>
                                    <div className="space-y-4">
                                        {extractedData.educations.map((edu, index) => (
                                            <div key={index} className="bg-gray-700/50 p-4 rounded-lg">
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-bold text-gray-200">{edu.degree}</h4>
                                                    <span className="text-sm text-gray-500">{edu.date}</span>
                                                </div>
                                                {edu.details.map((detail, i) => (
                                                    <p key={i} className="text-gray-400 text-sm">{detail}</p>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ResumeParser;
