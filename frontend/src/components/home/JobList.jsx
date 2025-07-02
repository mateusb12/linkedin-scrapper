import React, { useState, useEffect } from 'react';
import { Briefcase, MapPin, Building, Clock } from 'lucide-react';

// Mock data representing job listings. In a real app, this would come from an API.
const mockData = [
    {
        "urn": "urn:li:fsd_jobPosting:4230148335",
        "title": "Desenvolvedor Pleno III - Python (Temporário)",
        "company": {
            "name": "Extreme Digital Solutions - EDS",
            "logo_url": "https://media.licdn.com/dms/image/v2/D4D0BAQGlkyJOKvz6WQ/company-logo_200_200/company-logo_200_200/0/1718300941618/extremedigitalsolutions_logo?e=1756944000&v=beta&t=oI-7S3m9HjhFU3FHTjeRlK5dJgYvYkpREgESPnEDubI",
        },
        "location": "Brazil (Remote)",
        "posted_on": "May 14, 2025",
        "employment_type": "Full-time",
        "workplace_type": "Remote",
        "job_url": "https://extremegroup.inhire.app/vagas/77da1eac-16a3-41fe-81a1-10c74fb250f3/cc7c-desenvolvedor-pleno-iii-python-(temporário)",
        "description_full": "A Extreme Digital Solutions é uma empresa jovem, fundada em 2014, antenada nas mais modernas tendências e tecnologias do mercado, que busca sempre a excelência na entrega de seus projetos e a satisfação de seus clientes e colaboradores.\n\nResponsabilidades:\n- Desenvolver e manter aplicações web de alta qualidade;\n- Colaborar com as equipes de front-end e back-end para projetar e lançar novos recursos;\n- Participar de todo o ciclo de vida do desenvolvimento de software."
    },
    {
        "urn": "urn:li:fsd_jobPosting:4237482675",
        "title": "Pessoa Desenvolvedora Python/Golang",
        "company": {
            "name": "MJV Technology & Innovation",
            "logo_url": "https://media.licdn.com/dms/image/v2/D4D0BAQGlEIHzx81JxQ/company-logo_200_200/B4DZd_pzPSGkAM-/0/1750193354321/mjv_tech_and_innovation_logo?e=1756944000&v=beta&t=xR0LnBf7cjDPrMdJHVK3ij8oYNuFSuOmwBYOZXlY67A",
        },
        "location": "Brazil (Remote)",
        "posted_on": "May 30, 2025",
        "employment_type": "Full-time",
        "workplace_type": "Remote",
        "job_url": "https://mjvcarreiras.gupy.io/jobs/9231998",
        "description_full": "Descrição da vaga: Ser MJVer é estar em um dos melhores lugares para trabalhar, segundo o GPTW. É fazer parte de um time global e diverso, com mais de 5 mil colaboradores, que tem a inovação no DNA e que acredita na transformação de negócios por meio da tecnologia, design e dados.\n\nQualificações:\n- Experiência com desenvolvimento em Python e/ou GoLang;\n- Conhecimento em APIs REST;\n- Familiaridade com bancos de dados relacionais e não relacionais."
    },
    {
        "urn": "urn:li:fsd_jobPosting:4255765625",
        "title": "Pessoa Desenvolvedora Backend Pleno (Shop)",
        "company": {
            "name": "Nomad",
            "logo_url": "https://media.licdn.com/dms/image/v2/C4D0BAQE9GGFNNqIm9A/company-logo_200_200/company-logo_200_200/0/1630494318628/nomadglobalapp_logo?e=1756944000&v=beta&t=kR0UJsgyKN0m-gWqXLkF2oRHupun_9r3KViH0ewQs20",
        },
        "location": "Greater São Paulo Area (Remote)",
        "posted_on": "Jun 24, 2025",
        "employment_type": "Full-time",
        "workplace_type": "Remote",
        "job_url": "https://apply.workable.com/nomadglobal/j/B40F96B0DD?utm_source=linkedin.com",
        "description_full": "Description: Existimos para derrubar fronteiras e fazer o seu dinheiro “falar” inglês pelo mundo. Somos a primeira e única plataforma que permite que brasileiros tenham uma vida financeira global, sem burocracia, de forma transparente e segura.\n\nSuas responsabilidades serão:\n- Projetar, desenvolver e manter APIs e serviços de back-end escaláveis;\n- Trabalhar em estreita colaboração com as equipes de produto e front-end;\n- Garantir a qualidade e o desempenho do código."
    }
];


/**
 * A compact card for the job list on the left.
 * @param {object} props - The component props.
 * @param {object} props.job - The job data.
 * @param {function} props.onSelect - Function to call when the card is clicked.
 * @param {boolean} props.isSelected - Whether this card is the currently selected one.
 */
const JobListItem = ({ job, onSelect, isSelected }) => {
    const baseClasses = "p-4 border-l-4 cursor-pointer transition-colors duration-200";
    const selectedClasses = "bg-sky-100 dark:bg-sky-900/30 border-sky-500";
    const unselectedClasses = "border-transparent hover:bg-gray-100 dark:hover:bg-gray-800";

    return (
        <div
            onClick={() => onSelect(job)}
            className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}
        >
            <h3 className="font-bold text-gray-800 dark:text-gray-100">{job.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{job.company.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{job.location}</p>
        </div>
    );
};

/**
 * A detailed view of a single job.
 * @param {object} props - The component props.
 * @param {object|null} props.job - The job to display.
 */
const JobDetailView = ({ job }) => {
    if (!job) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <p>Select a job to see the details</p>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto">
            <div className="flex items-start mb-6">
                <img
                    src={job.company.logo_url}
                    alt={`${job.company.name} logo`}
                    className="w-16 h-16 rounded-lg mr-6 object-contain border border-gray-200 dark:border-gray-700"
                    onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/64x64/e2e8f0/4a5568?text=${job.company.name.charAt(0)}`; }}
                />
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{job.title}</h2>
                    <p className="text-lg text-gray-700 dark:text-gray-300">{job.company.name}</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
                <a
                    href={job.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all duration-200 text-center"
                >
                    Apply Now
                </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 text-sm">
                <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                    <MapPin size={18} className="mr-2 text-gray-500" /> {job.location}
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                    <Briefcase size={18} className="mr-2 text-gray-500" /> {job.employment_type}
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                    <Clock size={18} className="mr-2 text-gray-500" /> Posted: {job.posted_on}
                </div>
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-300">
                <h3 className="text-xl font-semibold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">About the job</h3>
                {/* Using whitespace-pre-wrap to respect newlines from the description */}
                <p style={{ whiteSpace: 'pre-wrap' }}>{job.description_full}</p>
            </div>
        </div>
    );
};


/**
 * The main component for the job listings page.
 */
const App = () => {
    const [jobs, setJobs] = useState([]);
    const [filteredJobs, setFilteredJobs] = useState([]);
    const [filter, setFilter] = useState('');
    const [selectedJob, setSelectedJob] = useState(null);

    // Effect to load initial data
    useEffect(() => {
        setJobs(mockData);
        setFilteredJobs(mockData);
        if (mockData.length > 0) {
            setSelectedJob(mockData[0]); // Select the first job by default
        }
    }, []);

    // Effect to handle filtering logic
    useEffect(() => {
        const newFilteredJobs = jobs.filter(job =>
            job.title.toLowerCase().includes(filter.toLowerCase()) ||
            job.company.name.toLowerCase().includes(filter.toLowerCase())
        );
        setFilteredJobs(newFilteredJobs);

        // If the currently selected job is not in the new filtered list,
        // either select the first of the new list or clear the selection.
        if (selectedJob && !newFilteredJobs.some(job => job.urn === selectedJob.urn)) {
            setSelectedJob(newFilteredJobs.length > 0 ? newFilteredJobs[0] : null);
        }

    }, [filter, jobs, selectedJob]);

    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            <div className="flex flex-col md:flex-row h-screen">
                {/* Left Column: Job List */}
                <div className="w-full md:w-1/3 lg:w-2/5 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <input
                            type="text"
                            placeholder="Filter by title or company..."
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            onChange={(e) => setFilter(e.target.value)}
                            value={filter}
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 pl-1">{filteredJobs.length} results</p>
                    </div>
                    <div className="flex-grow overflow-y-auto">
                        {filteredJobs.length > 0 ? (
                            filteredJobs.map(job => (
                                <JobListItem
                                    key={job.urn}
                                    job={job}
                                    onSelect={setSelectedJob}
                                    isSelected={selectedJob?.urn === job.urn}
                                />
                            ))
                        ) : (
                            <p className="p-4 text-center text-gray-500">No jobs found.</p>
                        )}
                    </div>
                </div>

                {/* Right Column: Job Details */}
                <main className="w-full md:w-2/3 lg:w-3/5 flex-grow">
                    <JobDetailView job={selectedJob} />
                </main>
            </div>
        </div>
    );
};

export default App;
