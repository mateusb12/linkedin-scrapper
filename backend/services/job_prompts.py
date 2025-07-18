"""
Prompt templates for job data operations.
"""


def build_expand_job_prompt(job_description: str) -> str:
    return f"""
You are an expert in extracting meaningful information from job descriptions.

Expand the following job description into a detailed JSON object with:
- responsibilities: List[string]
- qualifications: List[string]
- keywords: List[string]
- programming_languages: List[string]
- job_type: single string (only three options - Frontend, Backend or Full-stack)

Ensure the output language matches the input.

Job Description:
{job_description}
"""


def build_tailor_resume_prompt(resume_md: str, job_description: str) -> str:
    return f"""
You are a career coach specializing in technical resumes.

**Job Description:**
```{job_description}```
**Original Resume (Markdown):**
```{resume_md}```

Tailor the "Professional Experience" and generate a list of "hard_skills".
Output EXACTLY one JSON object with keys:
- professional_experience: [{title: string, details: [string] }]
- hard_skills: [string]
```json

"""
