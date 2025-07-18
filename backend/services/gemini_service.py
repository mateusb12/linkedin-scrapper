import json
import os
import re

import requests
from dotenv import load_dotenv

from services.base_llm_service import BaseLLMService
from services.job_prompts import build_tailor_resume_prompt, build_expand_job_prompt


# ── Constants ────────────────────────────────────────────────────────────

def structure_gemini_data(expanded_description_text: str) -> dict:
    """Extract and parse JSON from markdown-style code block inside a string."""

    # Find the JSON block using a regular expression
    match = re.search(r"```(json)?\s*({.*?})\s*```", expanded_description_text, re.DOTALL)
    if match:
        json_str = match.group(2)
    else:
        # If no markdown block is found, assume the whole string is JSON
        json_str = expanded_description_text

    try:
        # It's a good practice to strip any whitespace that might be surrounding the JSON object
        return json.loads(json_str.strip())
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON: {e}")


class GeminiService(BaseLLMService):
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        endpoint = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={api_key}"
        model_id = "gemini-1.5-flash"
        super().__init__(api_key, endpoint, model_id)

    def expand_job_data(self, job_description: str) -> dict:
        prompt = build_expand_job_prompt(job_description)
        response = self.generate_response([{"role": "user", "content": prompt}])
        if not response:
            return {"error": "No response from model."}
        try:
            return structure_gemini_data(response)
        except ValueError as e:
            return {"error": str(e), "raw": response}

    def tailor_resume_for_job(self, resume_md: str, job_description: str) -> dict:
        prompt = build_tailor_resume_prompt(resume_md, job_description)
        response = self.generate_response([{"role": "user", "content": prompt}])
        if not response:
            return {"error": "No response from model."}
        try:
            return structure_gemini_data(response)
        except ValueError as e:
            return {"error": str(e), "raw": response}
