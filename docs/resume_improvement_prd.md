# Product Requirements Document (PRD) for Resume Scoring and Improvement System

## How does the improvement system should work?
- Parsing unstructured resume files (PDF, DOCX) and job descriptions into structured JSON data using a Large Language Model (LLM).
- Scoring the resume against a job by calculating the cosine similarity between their vector embeddings.
- Improving the resume by using an LLM to rewrite it, incorporating relevant keywords and experiences from the job description to increase the similarity score.

## How does the pipeline should work?
### API Endpoint and File Validation
- You send a POST request to the endpoint with your resume file
- The system first validates the file type, ensuring it is either a PDF or DOCX. It also checks that the file is not empty
### Content Conversion to Markdown
- The service uses the `MarkItDown` library to convert the binary content of your PDF or DOCX file into plain text `Markdown (md)` format. This extracts the raw text from the resume
### Storing the raw resume
- An unique ID (`resume_id`) is generated for your resume
- The converted Markdown text is saved to the database in the Resume table, along with the `resume_id` and `content type (md)`
### Structured Data Extraction
- The system uses a Large Language Model (LLM) to parse the Markdown text and extract structured data
- The service then calls `_extract_and_store_structured_resume` to begin parsing the raw text into a structured format
-  It commands the LLM to act as a JSON extraction engine and convert the resume text into a precise JSON schema, ensuring fields like dates are correctly formatted and no extra information is invented.
- The LLM returns a JSON object containing the structured data (personal info, experiences, skills, keywords, etc.)
- This JSON data is validated against the `StructuredResumeModel` Pydantic schema.
- The validated data is then stored in the ProcessedResume table in the database, linked by the same resume_id. Each section (like experiences, skills) is stored as a JSON object
### Scoring and Improvement Pipeline
- The service retrieves the raw content of the resume from the Resume table and its structured data from the ProcessedResume table.
- It performs the same action for the job, retrieving the raw job description (`Job` table) and the structured, processed data, including extracted_keywords (`ProcessedJob` table).
- The system uses an `EmbeddingManager` to convert text into numerical representations (vectors). It can use providers like `OllamaEmbeddingProvider` or `OpenAIEmbeddingProvider`.
- Two key pieces of text are embedded:
  - The entire raw text content of the original resume. 
  - The `"extracted_keywords"` from the processed job description.
- The `calculate_cosine_similarity` function then computes the similarity between these two embeddings. The formula is `fracAcdotB∣A∣∣B∣`, where A and B are the embedding vectors.
- This result is a float value representing the original score of how well the resume matches the job keywords.
- The core of the improvement logic is in the `improve_score_with_llm` method. This method attempts to rewrite the resume to get a better score
- It runs in a loop for a maximum of 5 retries (`max_retries`) to find an improved version
- The LLM returns a new, improved version of the resume as Markdown text.
- The system immediately generates a new embedding for this improved resume text
- A new cosine similarity score is calculated between the new resume embedding and the original job keyword embedding.
- If this new score is higher than the previous best score, the improved resume is kept, and the process concludes successfully, returning the updated_resume and updated_score.
- If the score is not better, the loop continues with the previous best version of the resume, trying again until max_retries is reached.
- The final output is a dictionary containing the original score, the new improved score, and the full text of the updated resume in HTML format (converted from Markdown).

