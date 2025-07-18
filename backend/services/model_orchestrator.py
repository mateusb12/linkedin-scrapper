from collections import defaultdict, deque

import requests

from services.gemini_service import GeminiService
from services.openrouter_service import OpenRouterService


class LLMOrchestrator:
    def __init__(self):
        self.model_pool = [GeminiService(), OpenRouterService()]
        self.error_log = defaultdict(lambda: deque(maxlen=10))

    def generate_response(self, prompt: str) -> dict:
        # Sort models by ascending error count (less errors = higher priority)
        sorted_models = sorted(
            self.model_pool,
            key=lambda m: sum(self.error_log[m.__class__.__name__])
        )

        for model in sorted_models:
            model_name = model.__class__.__name__
            print(f"🔍 Trying {model_name}...")

            try:
                result = model.expand_job_data(prompt)

                if not result:
                    print(f"⚠️ {model_name} returned empty result.")
                    self.error_log[model_name].append(1)
                    continue

                if isinstance(result, dict) and "error" in result:
                    print(f"⚠️ {model_name} failed: {result['error']}")
                    self.error_log[model_name].append(1)
                    continue

                self.error_log[model_name].append(0)  # Success
                return result

            except requests.exceptions.Timeout:
                print(f"⏱️ Timeout using {model_name}, deprioritizing...")
                self.error_log[model_name].append(1)
                continue

            except Exception as e:
                print(f"❌ Error with {model_name}: {e}")
                self.error_log[model_name].append(1)
                continue

        return {"error": "All LLMs failed to expand the job data."}