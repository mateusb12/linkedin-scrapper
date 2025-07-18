from services.gemini_service import GeminiService
from services.openrouter_service import OpenRouterService


class LLMOrchestrator:
    def __init__(self):
        self.model_pool = [GeminiService(), OpenRouterService()]

    def generate_response(self, prompt: str):
        response = ""
        for llm in self.model_pool:
            try:
                response = llm.expand_job_data(prompt)
                if response:
                    return response
            except Exception as e:
                print(f"Error with {llm.__class__.__name__}: {e}")
        return response
