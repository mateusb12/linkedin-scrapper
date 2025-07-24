import json
import os
import re

import requests
from dotenv import load_dotenv

from services.base_llm_service import BaseLLMService
from services.constants.job_description_example import JOB_DESCRIPTION
from services.job_prompts import build_expand_job_prompt, build_tailor_resume_prompt


def structure_open_router_data(ai_response_text: str) -> dict:
    """
    Extracts and parses a JSON object from a string, handling markdown code blocks.
    This function is identical to your `structure_gemini_data`.
    """
    match = re.search(r"```(json)?\s*({.*?})\s*```", ai_response_text, re.DOTALL)
    if match:
        json_str = match.group(2)
    else:
        json_str = ai_response_text

    try:
        return json.loads(json_str.strip())
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON: {e}")


# ── Constants ────────────────────────────────────────────────────────────
class OpenRouterService(BaseLLMService):
    def __init__(self):
        api_key = os.getenv("OPENROUTER_API_KEY")
        endpoint = "https://openrouter.ai/api/v1/chat/completions"
        model_id = "google/gemini-2.0-flash-exp:free"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        super().__init__(api_key, endpoint, model_id, headers)

    def expand_job_data(self, job_description: str) -> dict:
        prompt = build_expand_job_prompt(job_description)
        response = self.generate_response([{"role": "user", "content": prompt}])
        if not response:
            return {"error": "No response from model."}
        try:
            return structure_open_router_data(response)
        except ValueError as e:
            return {"error": str(e), "raw": response}

    def tailor_resume_for_job(self, resume_md: str, job_description: str) -> dict:
        prompt = build_tailor_resume_prompt(resume_md, job_description)
        response = self.generate_response([{"role": "user", "content": prompt}])
        if not response:
            return {"error": "No response from model."}
        try:
            return structure_open_router_data(response)
        except ValueError as e:
            return {"error": str(e), "raw": response}

    def run_prompt(self, prompt: str) -> dict:
        response = self.generate_response([{"role": "user", "content": prompt}])
        if not response:
            return {"error": "No response from model."}
        return {"markdown": response.strip()}


# ── Example Usage ────────────────────────────────────────────────────────
if __name__ == "__main__":
    service = OpenRouterService()
    result = service.expand_job_data(JOB_DESCRIPTION)
    if result:
        print("✅ Model response:\n", json.dumps(result, indent=2, ensure_ascii=False))
