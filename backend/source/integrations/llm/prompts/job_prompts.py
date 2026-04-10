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


def build_tailor_resume_prompt(
        raw_job_description: str,
        raw_resume: str,
        extracted_job_keywords: list[str],
        extracted_resume_keywords: list[str],
        current_cosine_similarity: float
) -> str:
    return f"""
You are an expert resume editor and talent acquisition specialist. Your task is to revise the following resume so that it aligns as closely as possible with the provided job description and extracted job keywords, in order to maximize the cosine similarity between the resume and the job keywords.

Instructions:
- Carefully review the job description and the list of extracted job keywords.
- Update the candidate's resume by:
  - Emphasizing and naturally incorporating relevant skills, experiences, and keywords from the job description and keyword list.
  - Where appropriate, naturally weave the extracted job keywords into the resume content.
  - Rewriting, adding, or removing resume content as needed to better match the job requirements.
  - Maintaining a natural, professional tone and avoiding keyword stuffing.
  - Where possible, use quantifiable achievements and action verbs.
  - The current cosine similarity score is {current_cosine_similarity:.4f}. Revise the resume to further increase this score.
- ONLY output the improved updated resume. Do not include any explanations, commentary, or formatting outside of the resume itself.

Job Description:
```md
{raw_job_description}
```

Extracted Job Keywords:
```md
{', '.join(extracted_job_keywords)}
```

Original Resume:
```md
{raw_resume}
```

Extracted Resume Keywords:
```md
{', '.join(extracted_resume_keywords)}
```

NOTE: ONLY OUTPUT THE IMPROVED UPDATED RESUME IN MARKDOWN FORMAT.
"""
