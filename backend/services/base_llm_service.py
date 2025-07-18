import os
import requests
from typing import List, Dict


class BaseLLMService:
    """
    Generic LLM client to handle API requests, independent of prompt logic.
    """

    def __init__(
            self,
            api_key: str,
            endpoint: str,
            model_id: str,
            headers: Dict[str, str] = None,
            timeout: int = 60
    ):
        self.api_key = api_key
        self.endpoint = endpoint
        self.model_id = model_id
        self.headers = headers or {"Content-Type": "application/json"}
        self.timeout = timeout

    def generate_response(self, messages: List[Dict[str, str]]) -> str:
        payload = {"model": self.model_id, "messages": messages}
        try:
            response = requests.post(
                self.endpoint,
                headers=self.headers,
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except requests.exceptions.RequestException as e:
            # Centralized error handling
            print(f"❌ Request failed: {e}")
            return ""
