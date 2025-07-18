from collections import defaultdict, deque

import requests

from services.deepseek_service import DeepSeekService
from services.gemini_service import GeminiService
from services.openrouter_service import OpenRouterService


class LLMOrchestrator:
    def __init__(self):
        self.model_pool = [DeepSeekService(), GeminiService(), OpenRouterService()]
        self.error_log = defaultdict(lambda: deque(maxlen=10))

    def expand_job(self, job_description: str) -> dict:
        return self._invoke("expand_job_data", job_description)

    def tailor_resume(self, resume_md: str, job_description: str) -> dict:
        # tailor_resume_for_job unified across services
        return self._invoke("tailor_resume_for_job", resume_md, job_description)

    def chat(self, system_msg: str, user_msg: str) -> str:
        # Use DeepSeekService for generic chat
        return self._invoke_single("chat", system_msg, user_msg)

    def _invoke(self, method_name: str, *args) -> dict:
        # Sort models by ascending error count to prioritize successful ones
        sorted_models = sorted(
            self.model_pool,
            key=lambda m: sum(self.error_log[m.__class__.__name__])
        )
        for model in sorted_models:
            model_name = model.__class__.__name__
            try:
                method = getattr(model, method_name)
                result = method(*args)
                if not result or (isinstance(result, dict) and "error" in result):
                    self.error_log[model_name].append(1)
                    continue
                self.error_log[model_name].append(0)
                return result
            except Exception as e:
                self.error_log[model_name].append(1)
                continue
        return {"error": f"All LLMs failed invoking {method_name}"}

    def _invoke_single(self, method_name: str, *args) -> str:
        # For chat-style single-string responses
        # Here we only use DeepSeekService by default
        model = DeepSeekService()
        try:
            return getattr(model, method_name)(*args)
        except Exception:
            return ""
