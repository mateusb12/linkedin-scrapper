import json
import os
import re

import requests
from dotenv import load_dotenv

from services.job_description_example import JOB_DESCRIPTION

# ── Constants ────────────────────────────────────────────────────────────
load_dotenv()
# Note: Ensure OPENROUTER_API_KEY is set in your .env file
API_KEY = os.getenv("OPENROUTER_API_KEY")

MODEL_ID = "google/gemini-2.0-flash-exp:free"

ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


# ── Core Functions ───────────────────────────────────────────────────────
def generate_openrouter_response(prompt: str) -> str:
    """Sends a prompt to the OpenRouter API and returns the text response."""
    payload = {
        "model": MODEL_ID,
        "messages": [
            {"role": "user", "content": prompt}
        ],
    }

    try:
        if not API_KEY:
            raise ValueError("❌ OPENROUTER_API_KEY environment variable not set.")

        response = requests.post(ENDPOINT, headers=HEADERS, json=payload, timeout=60)
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP error: {e.response.status_code} {e.response.text}")
        return ""
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return ""
    except ValueError as e:
        print(e)
        return ""

    data = response.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError):
        print(f"❌ Invalid response structure from API: {data}")
        return ""


def structure_ai_data(ai_response_text: str) -> dict:
    """
    Extracts and parses a JSON object from a string, handling markdown code blocks.
    This function is identical to your `structure_gemini_data`.
    """
    # Find the JSON block using a regular expression
    match = re.search(r"```(json)?\s*({.*?})\s*```", ai_response_text, re.DOTALL)
    if match:
        json_str = match.group(2)
    else:
        # If no markdown block is found, assume the whole string is JSON
        json_str = ai_response_text

    try:
        # Strip whitespace that might surround the JSON object
        return json.loads(json_str.strip())
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON: {e}")


# ── Feature Functions ────────────────────────────────────────────────────
def expand_job_data(job_description: str) -> dict:
    """
    Uses an AI model via OpenRouter to expand a job description into a structured JSON format.
    """
    # This prompt is identical to the one in your Gemini service
    prompt = f"""
    You are an expert in extracting meaningful information from job descriptions.
    Please expand the following job description into a detailed format, including:
    - Responsibilities
    - Qualifications
    - Keywords
    - Job type (frontend/backend/fullstack)
    - Job languages (e.g., Python, JavaScript, C#, etc. It can be more than 1)
    - Job description Language: PTBR or EN based on the input
    Try to respect the input language. If input language is portuguese, output should be in portuguese.
    If input language is english, output should be in english.
    Output should be in json format. Try to stick to a list of strings with short sentences
    Here is the job description:
    {job_description}
    """
    response_text = generate_openrouter_response(prompt)

    if not response_text:
        return {"error": "Failed to get a valid response from the model."}

    try:
        return structure_ai_data(response_text)
    except ValueError as e:
        print(f"❌ Failed to parse JSON from AI response: {e}")
        print(f"   Raw response snippet: {response_text[:500]}...")
        return {"error": "AI response was not valid JSON.", "raw_response": response_text}


def tailor_resume_for_job(resume_markdown: str, job_description: str) -> dict:
    """
    Uses OpenRouter to tailor a resume's experience and skills to a job description.
    """
    # This prompt is identical to the one in your Gemini service
    prompt = f"""
    You are an expert career coach and resume writer specializing in the tech industry. Your task is to tailor a resume's professional experience and skills section to perfectly match a specific job description.

    **Instructions:**
    1.  **Analyze:** Carefully read both the original resume and the job description.
    2.  **Rewrite Experience:** Go through each bullet point in the "Professional Experience" section of the resume. Rewrite them using strong, quantifiable action verbs. Emphasize accomplishments and skills that are directly relevant to the requirements listed in the job description.
    3.  **Generate Skills:** Based on the newly tailored experience and the job description, create a comprehensive list of "hard_skills".
    4.  **Preserve Facts:** Ensure the rewritten experience remains truthful and is based *only* on the information provided in the original resume. Do not invent or exaggerate experiences. Maintain the original job titles, companies, and employment dates.
    5.  **Maintain Language:** Match the output language to the input language of the job description (e.g., Portuguese for a Portuguese job description).

    **Output Format:**
    You MUST return a single, valid JSON object.
    The JSON object must have exactly two keys:
    - `professional_experience`: An array of objects. Each object must have a `title` (string) and `details` (an array of strings).
    - `hard_skills`: An array of strings.

    ---
    **Job Description:**
    ```
    {job_description}
    ```
    ---
    **Original Resume (Markdown):**
    ```
    {resume_markdown}
    ```
    ---
    **Tailored Resume (JSON Output):**
    """
    response_text = generate_openrouter_response(prompt)
    if not response_text:
        return {"error": "Failed to get a valid response from the AI model."}

    try:
        return structure_ai_data(response_text)
    except ValueError as e:
        print(f"❌ Error parsing structured JSON response: {e}")
        print(f"Raw response was: {response_text}")
        return {"error": "Failed to parse the AI model's JSON response.", "raw_response": response_text}


# ── Example Usage ────────────────────────────────────────────────────────
if __name__ == "__main__":
    result = expand_job_data(JOB_DESCRIPTION)
    if result:
        print("✅ Model response:\n", json.dumps(result, indent=2, ensure_ascii=False))