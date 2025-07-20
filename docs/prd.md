# **Product Requirements Document: LinkedIn Job Management & Resume Tailoring Tool**

Author: Gemini  
Date: July 20, 2025  
Version: 1.0

## **1\. Introduction**

This document outlines the product requirements for a comprehensive job management and application tool. The system is designed to streamline the job search process by enabling users to fetch job listings directly from LinkedIn, enrich job data using AI, manage their professional resumes, and intelligently match their qualifications against open positions. The application consists of a React-based frontend for user interaction and a Python Flask backend that handles data processing, API interactions, and AI-powered enhancements.

The primary goal is to empower job seekers by providing a centralized platform to discover opportunities, analyze job requirements, and tailor their application materials effectively, thereby increasing their chances of securing a position.

## **2\. User Personas**

* **The Proactive Job Seeker:** This user is actively applying for jobs and needs an efficient way to manage listings, track applications, and customize their resume for each role. They are tech-savvy and comfortable using web applications to organize their job search.  
* **The Career Planner:** This user is exploring potential career moves but may not be actively applying. They are interested in understanding the skills required for different roles, identifying skill gaps, and seeing how their current resume matches up against various job descriptions.

## **3\. Existing Features (MVP)**

The application has a robust set of features that form a solid foundation for the product.

### **3.1. Backend (Flask API)**

* **LinkedIn Job Scraping & Fetching:**  
  * Securely stores and manages user-provided cURL commands for authenticating with LinkedIn's internal API.  
  * Fetches paginated lists of recommended job postings.  
  * Fetches detailed information for individual job postings.  
* **Database Management:**  
  * Utilizes a SQLite database with SQLAlchemy ORM to store Jobs, Companies, and Resumes.  
  * Populates the database with fetched job data, avoiding duplicate entries.  
* **AI-Powered Data Enrichment:**  
  * Integrates with multiple Large Language Models (LLMs) via an orchestrator (Gemini, ChatGPT, DeepSeek, OpenRouter) to ensure reliability.  
  * Analyzes raw job descriptions to extract structured data:  
    * Responsibilities  
    * Qualifications  
    * Keywords & Skills  
    * Programming Languages  
    * Job Type (Frontend, Backend, Full-stack)  
* **Resume Management (CRUD):**  
  * Provides API endpoints to create, retrieve, update, and delete user resumes.  
  * Stores resume data in a structured JSON format, including skills, experience, and education.  
* **AI-Powered Resume Tailoring:**  
  * An endpoint that accepts a user's resume (in Markdown) and a job description.  
  * Uses an LLM to analyze both texts and returns a tailored version of the resume's "Professional Experience" and "Hard Skills" sections in JSON format.

### **3.2. Frontend (React)**

* **Configuration Management:**  
  * A "Fetch Config" view where users can input and update the cURL/fetch commands needed for the backend to scrape LinkedIn data.  
  * Provides multiple views (JSON, cURL, Fetch) for user convenience.  
* **Automated Job Fetching:**  
  * A "Fetch Jobs" view that allows users to:  
    1. Query the backend to determine the total number of available job pages.  
    2. Specify a range of pages to fetch.  
    3. Initiate the fetching process and view real-time progress logs.  
* **Job Listings & Details View:**  
  * A dual-pane interface to browse all jobs stored in the database.  
  * A filterable and sortable list view of all jobs.  
  * A detailed view that displays comprehensive information about the selected job, including AI-enriched data like skills, responsibilities, and qualifications.  
* **Resume Parser & Manager:**  
  * An interface to upload, view, and edit resumes in Markdown format.  
  * An "Analyze" feature that parses the Markdown into a structured JSON format.  
  * Displays the structured data that will be sent to the backend.  
  * Allows users to create new resumes or update existing ones stored in the database.  
* **Job-Resume Matching:**  
  * A "Match" view where users can select one of their saved resumes.  
  * Calculates and displays a "match score" for each job in the database based on the overlap between the resume's skills and the job's required skills.  
  * Jobs are sorted from best to worst match.  
  * The detailed view highlights which skills matched and which were missing.  
* **AI Resume Adaptation:**  
  * Within the "Match" view, a feature to automatically tailor the selected resume for the selected job using the backend's AI tailoring service.  
  * Presents a "diff" view showing the original vs. AI-suggested changes, which the user can then edit and save.

## **4\. Future Roadmap**

### **Quarter 3 2025: Enhancing Core Functionality**

* **Feature: Application Status Tracking**  
  * **Description:** Allow users to update the status of each job application (e.g., "Applied," "Interviewing," "Offer," "Rejected"). The has\_applied field in the Job model will be expanded to support this.  
  * **User Story:** As a job seeker, I want to track the status of my applications so I can stay organized and know when to follow up.  
* **Feature: Advanced Job Filtering**  
  * **Description:** Implement more sophisticated filtering options in the "Job Listings" view, such as filtering by programming language, job type (Full-stack, etc.), and keywords.  
  * **User Story:** As a developer, I want to filter jobs by "Python" and "Remote" so I can quickly find the most relevant opportunities.  
* **Feature: UI/UX Overhaul for Mobile**  
  * **Description:** Ensure all components are fully responsive and provide a seamless experience on mobile devices. This includes collapsing the sidebar into a menu and optimizing the dual-pane views for smaller screens.  
  * **User Story:** As a user, I want to be able to check my job matches and update application statuses from my phone while on the go.

### **Quarter 4 2025: Expanding AI Capabilities**

* **Feature: Cover Letter Generation**  
  * **Description:** Add a feature that uses an LLM to generate a draft cover letter based on the user's selected resume and the details of a specific job.  
  * **User Story:** As a job seeker, I want to quickly generate a tailored cover letter so I can save time during the application process.  
* **Feature: Skill Gap Analysis**  
  * **Description:** Create a dashboard that analyzes all saved jobs and the user's primary resume to identify the most frequently required skills that the user is missing.  
  * **User Story:** As a career planner, I want to see which skills I need to learn to be a better candidate for the jobs I'm interested in.  
* **Feature: Automated Job Fetching (Scheduled)**  
  * **Description:** Allow users to schedule the backend to automatically fetch new jobs on a daily or weekly basis.  
  * **User Story:** As a proactive job seeker, I want the application to find new jobs for me automatically so I always have the latest listings.

### **Quarter 1 2026: Collaboration & Analytics**

* **Feature: User Accounts & Authentication**  
  * **Description:** Implement a full user authentication system to securely store individual user data (resumes, job lists, API keys).  
  * **User Story:** As a user, I want to create an account to securely save my job search progress and access it from different devices.  
* **Feature: Job Search Analytics Dashboard**  
  * **Description:** Provide users with visualizations and insights into their job search, such as applications per week, match score trends, and the most common skills in their targeted roles.  
  * **User Story:** As a data-driven job seeker, I want to see analytics about my application activity to understand what's working and where I can improve.