from collections import defaultdict, deque

import requests

from services.deepseek_service import DeepSeekService
from services.gemini_service import GeminiService
from services.openrouter_service import OpenRouterService


class AllLLMsFailed(RuntimeError):
    """Raised when every model in the pool has failed for a call."""


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

    def _invoke(self, method_name: str, *args):
        last_exc = None
        sorted_models = sorted(
            self.model_pool,
            key=lambda m: sum(self.error_log[m.__class__.__name__])
        )

        for model in sorted_models:
            name = model.__class__.__name__
            try:
                method = getattr(model, method_name)
            except AttributeError:
                # model doesn't implement this call → count as failure
                self.error_log[name].append(1)
                continue

            try:
                result = method(*args)
                if not result or (isinstance(result, dict) and "error" in result):
                    self.error_log[name].append(1)
                    continue
                self.error_log[name].append(0)
                return result  # ✅ success
            except Exception as exc:
                self.error_log[name].append(1)
                last_exc = exc  # keep the last real stack‑trace
                continue

        # nothing worked → bail out _hard_
        raise AllLLMsFailed(
            f"All LLMs failed invoking “{method_name}”. "
            f"Last error: {last_exc!r}"
        )

    def _invoke_single(self, method_name: str, *args) -> str:
        # For chat-style single-string responses
        # Here we only use DeepSeekService by default
        model = DeepSeekService()
        try:
            return getattr(model, method_name)(*args)
        except Exception:
            return ""
