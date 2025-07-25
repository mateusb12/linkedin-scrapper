from collections import defaultdict, deque

import requests

from services.llms.chatgpt_service import ChatGPTService
from services.llms.deepseek_service import DeepSeekService
from services.llms.gemini_service import GeminiService
from services.llms.openrouter_service import OpenRouterService


class AllLLMsFailed(RuntimeError):
    """Raised when every model in the pool has failed for a call."""


class LLMOrchestrator:
    def __init__(self, progress=None):
        self.progress = progress
        self.model_pool = [ChatGPTService(), DeepSeekService(), GeminiService(), OpenRouterService()]
        self.error_log = defaultdict(lambda: deque(maxlen=10))

    def expand_job(self, job_description: str) -> dict:
        return self._invoke("expand_job_data", job_description)

    def tailor_resume(self, resume_md: str, job_description: str) -> dict:
        return self._invoke("tailor_resume_for_job", resume_md, job_description)

    def run_prompt(self, prompt: str) -> dict:
        return self._invoke("run_prompt", prompt)

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
            if self.progress:
                self.progress.set_status(f"trying {name}")
            try:
                method = getattr(model, method_name)
            except AttributeError:
                self.error_log[name].append(1)
                print(f"❌ {name} does not support method {method_name}")
                if self.progress:
                    self.progress.set_status(f"{name} missing {method_name}")
                continue

            try:
                result = method(*args)
                if not result or (isinstance(result, dict) and "error" in result):
                    self.error_log[name].append(1)
                    if self.progress:
                        self.progress.set_status(f"{name} returned error")
                    print(f"❌ {name} returned error: {result}")
                    continue
                self.error_log[name].append(0)
                return result  # ✅ success
            except Exception as exc:
                if self.progress:
                    self.progress.set_status(f"{name} error: {exc.__class__.__name__}")
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
