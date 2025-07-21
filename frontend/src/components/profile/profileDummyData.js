export const initialProfile = {
    id: 1,
    name: 'Alex Doe',
    email: 'alex.doe@example.com',
    phone: '555-123-4567',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/alexdoe',
    github: 'github.com/alexdoe',
    portfolio: 'alexdoe.dev',
    languages: ['English', 'Spanish'],
    positive_keywords: ['Proactive', 'Team Player', 'Detail-oriented'],
    negative_keywords: ['Micromanagement', 'Legacy Systems'],
};

export const initialResumes = [
    {
        id: 101,
        profile_id: 1,
        name: 'Software Engineer Resume',
        hard_skills: ['React', 'Node.js', 'Python', 'SQL', 'Docker', 'AWS'],
        professional_experience: [
            {
                id: 'exp1',
                title: 'Senior Frontend Developer',
                company: 'Tech Solutions Inc.',
                dates: 'Jan 2022 - Present',
                description: 'Led the development of a new client-facing dashboard using React, resulting in a 20% increase in user engagement. Mentored junior developers and established code review standards.'
            },
            {
                id: 'exp2',
                title: 'Software Engineer',
                company: 'Web Innovators',
                dates: 'Jun 2019 - Dec 2021',
                description: 'Built and maintained features for a large-scale e-commerce platform using Node.js and TypeScript. Optimized database queries, reducing page load times by 15%.'
            }
        ],
        education: [
            {
                id: 'edu1',
                degree: 'B.S. in Computer Science',
                school: 'University of Technology',
                dates: '2015 - 2019'
            }
        ]
    },
    {
        id: 102,
        profile_id: 1,
        name: 'Data Analyst Resume',
        hard_skills: ['Python', 'Pandas', 'SQL', 'Tableau', 'R', 'Scikit-learn'],
        professional_experience: [
            {
                id: 'exp3',
                title: 'Data Analyst',
                company: 'Data Insights LLC',
                dates: 'Jul 2020 - Present',
                description: 'Analyzed user data to provide actionable insights for the marketing team, leading to a 10% improvement in campaign ROI. Created automated reports using Tableau.'
            }
        ],
        education: [
            {
                id: 'edu2',
                degree: 'B.S. in Statistics',
                school: 'State University',
                dates: '2016 - 2020'
            }
        ]
    }
];