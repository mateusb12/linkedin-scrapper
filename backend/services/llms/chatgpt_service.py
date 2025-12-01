import json
import os
import re

from dotenv import load_dotenv

from services.base_llm_service import BaseLLMService
from services.constants.job_description_example import JOB_DESCRIPTION
from services.job_prompts import build_expand_job_prompt, build_tailor_resume_prompt

def sanitize_json_string(text: str) -> str:
    """
    Cleans JSON-like output so it can be parsed safely:
    - Removes JS-style comments (// ...)
    - Removes C-style block comments (/* ... */)
    - Removes trailing commas in objects and arrays
    - Extracts ONLY the first {...} block if text contains extra content
    """
    # 1. Remove inline // comments
    text = re.sub(r"//.*?$", "", text, flags=re.MULTILINE)

    # 2. Remove /* block comments */
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)

    # 3. Extract the first complete JSON object { ... }
    obj_match = re.search(r"{.*}", text, flags=re.DOTALL)
    if obj_match:
        text = obj_match.group(0)

    # 4. Remove trailing commas before } or ]
    text = re.sub(r",\s*([\]}])", r"\1", text)

    return text.strip()


def structure_chatgpt_data(ai_response_text: str) -> dict:
    """
    Extracts and parses a JSON object from the AI output.
    Safely cleans the JSON to prevent parse errors.
    """
    # Extract fenced code block first if present
    match = re.search(r"```(json)?\s*(\{.*?\})\s*```", ai_response_text, re.DOTALL)
    if match:
        json_str = match.group(2)
    else:
        json_str = ai_response_text

    # Clean JSON before parsing
    cleaned = sanitize_json_string(json_str)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON: {e}")



class ChatGPTService(BaseLLMService):
    def __init__(self):
        load_dotenv()
        api_key = os.getenv("OPENAI_API_KEY")
        endpoint = "https://api.openai.com/v1/chat/completions"
        model_id = "gpt-4o-mini"
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
            return structure_chatgpt_data(response)
        except ValueError as e:
            return {"error": str(e), "raw": response}

    def run_prompt(self, prompt: str) -> dict:
        response = self.generate_response([{"role": "user", "content": prompt}])
        if not response:
            return {"error": "No response from model."}
        return {"markdown": response.strip()}

    def chat(self, system_msg: str, user_msg: str) -> str:
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg}
        ]
        response = self.generate_response(messages)
        return response or ""


def main():
    service = ChatGPTService()
    expanded = service.expand_job_data(JOB_DESCRIPTION)
    print(json.dumps(expanded, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
