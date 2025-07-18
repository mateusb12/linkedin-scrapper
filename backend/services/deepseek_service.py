import os
from services.base_llm_service import BaseLLMService


def build_deepseek_chat_prompt(system_msg: str, user_msg: str) -> list:
    return [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg}
    ]


class DeepSeekService(BaseLLMService):
    def __init__(self):
        api_key = os.getenv("DEEPSEEK_API_KEY")
        endpoint = "https://api.deepseek.com/v1/chat/completions"
        model_id = "deepseek-chat"
        headers = {"Authorization": f"Bearer {api_key}"}
        super().__init__(api_key, endpoint, model_id, headers)

    def chat(self, system_msg: str, user_msg: str) -> str:
        messages = build_deepseek_chat_prompt(system_msg, user_msg)
        response = self.generate_response(messages)
        if not response:
            return ""
        return response
