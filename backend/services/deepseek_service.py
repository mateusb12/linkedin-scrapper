import json
import os
import re

from services.base_llm_service import BaseLLMService
from services.job_prompts import build_expand_job_prompt, build_tailor_resume_prompt


def structure_deepseek_data(ai_response_text: str) -> dict:
    """
    Extracts and parses a JSON object from a string, handling markdown code blocks.
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


class DeepSeekService(BaseLLMService):
    def __init__(self):
        api_key = os.getenv("DEEPSEEK_API_KEY")
        endpoint = "https://api.deepseek.com/v1/chat/completions"
        model_id = "deepseek-chat"
        # Ensure Content-Type header for JSON payloads
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        super().__init__(api_key, endpoint, model_id, headers)

    def expand_job_data(self, job_description: str) -> dict:
        prompt = build_expand_job_prompt(job_description)
        response = self.generate_response([{"role": "user", "content": prompt}])
        if not response:
            return {"error": "No response from model."}
        try:
            return structure_deepseek_data(response)
        except ValueError as e:
            return {"error": str(e), "raw": response}

    def tailor_resume_for_job(self, resume_md: str, job_description: str) -> dict:
        prompt = build_tailor_resume_prompt(resume_md, job_description)
        response = self.generate_response([{"role": "user", "content": prompt}])
        if not response:
            return {"error": "No response from model."}
        try:
            return structure_deepseek_data(response)
        except ValueError as e:
            return {"error": str(e), "raw": response}

    def chat(self, system_msg: str, user_msg: str) -> str:
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg}
        ]
        response = self.generate_response(messages)
        return response or ""
