import React, { useState, useEffect } from 'react';

const mockData = [
    {
        "job_id": "urn:li:fsd_jobPosting:4230148335",
        "title": "cc7c Desenvolvedor Pleno III - Python (Temporário)",
        "location": "Brazil (Remote)",
        "job_type": "Remote",
        "employment_type": "Full-time",
        "posting_date": "May 14, 2025",
        "apply_link": "https://extremegroup.inhire.app/vagas/77da1eac-16a3-41fe-81a1-10c74fb250f3/cc7c-desenvolvedor-pleno-iii-python-(temporário)",
        "description": "A Extreme Digital Solutions é uma empresa jovem...",
        "company_id": "urn:li:fsd_company:5273402",
        "company_name": "Extreme Digital Solutions",
        "linkedin_url": "https://www.linkedin.com/company/extreme-digital-solutions/",
        "followers": 5566,
        "company_size": "201-500 employees",
        "industry": "IT Services and IT Consulting"
    },
    {
        "job_id": "urn:li:fsd_jobPosting:4237482675",
        "title": "Pessoa Desenvolvedora Python/Golang",
        "location": "Brazil (Remote)",
        "job_type": "Remote",
        "employment_type": "Full-time",
        "posting_date": "May 30, 2025",
        "apply_link": "https://mjvcarreiras.gupy.io/jobs/9231998",
        "description": "Ser MJVer 🤝 é estar em um dos melhores lugares para trabalhar...",
        "company_id": "urn:li:fsd_company:83580",
        "company_name": "MJV Innovation",
        "linkedin_url": "https://www.linkedin.com/company/mjv-innovation/",
        "followers": 293396,
        "company_size": "1,001-5,000 employees",
        "industry": "IT Services and IT Consulting"
    },
    {
        "job_id": "urn:li:fsd_jobPosting:4255765625",
        "title": "Pessoa Desenvolvedora Backend Pleno (Shop)",
        "location": "Greater São Paulo Area (Remote)",
        "job_type": "Remote",
        "employment_type": "Full-time",
        "posting_date": "Jun 24, 2025",
        "apply_link": "https://apply.workable.com/nomadglobal/j/B40F96B0DD?utm_source=linkedin.com",
        "description": "Existimos para derrubar fronteiras...",
        "company_id": "urn:li:fsd_company:13061495",
        "company_name": "Nomad",
        "linkedin_url": "https://br.linkedin.com/company/nomadglobal",
        "followers": 108573,
        "company_size": "501-1,000 employees",
        "industry": "Financial Services"
    }
];

const Filter = ({ onFilterChange }) => {
    return (
        <div className="bg-white dark:bg-[#2d2d3d] p-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 mb-8">
            <input
                type="text"
                placeholder="Filter by job title..."
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                onChange={(e) => onFilterChange(e.target.value)}
            />
        </div>
    );
};

const JobCard = ({ job }) => {
    return (
        <div className="bg-white dark:bg-[#2d2d3d] p-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 mb-4">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-300">
                {job.title}
            </h3>
            <p className="text-md font-medium text-gray-600 dark:text-gray-400">
                {job.company_name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                {job.location}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-4">
                {job.description ? job.description.substring(0, 150) + '...' : 'No description available'}
            </p>
            <a
                href={job.apply_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-500 transition-colors"
            >
                Apply
            </a>
        </div>
    );
};


const JobList = () => {
    const [jobs, setJobs] = useState([]);
    const [filteredJobs, setFilteredJobs] = useState([]);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        // In a real application, you would fetch this data from an API
        setJobs(mockData);
        setFilteredJobs(mockData);
    }, []);

    useEffect(() => {
        setFilteredJobs(
            jobs.filter(job =>
                job.title.toLowerCase().includes(filter.toLowerCase())
            )
        );
    }, [filter, jobs]);

    return (
        <div className="p-8">
            <header>
                <h1 className="text-3xl font-bold border-b border-gray-300 dark:border-gray-700 pb-3 text-gray-900 dark:text-gray-100">
                    Job Listings
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2 mb-8">
                    Browse and filter through job opportunities.
                </p>
            </header>
            <Filter onFilterChange={setFilter} />
            <div>
                {filteredJobs.map(job => (
                    <JobCard key={job.job_id} job={job} />
                ))}
            </div>
        </div>
    );
};

export default JobList;