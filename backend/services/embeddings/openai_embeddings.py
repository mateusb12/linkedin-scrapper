import os
import json
import hashlib
import openai
import numpy as np
from dotenv import load_dotenv

from path.path_reference import get_embeddings_folder_path


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _cosine_similarity(a, b):
    a, b = np.array(a), np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


class EmbeddingSimilarityCalculator:
    def __init__(self, cache_path=None, model="text-embedding-3-small"):
        load_dotenv()
        self.api_key = os.getenv("OPENAI_API_KEY")
        openai.api_key = self.api_key

        if not self.api_key:
            raise ValueError("❌ Missing OPENAI_API_KEY in environment.")

        print("Using OpenAI API Key:", self.api_key[:6] + "...")

        self.model = model

        folder_path = cache_path or get_embeddings_folder_path()
        os.makedirs(folder_path, exist_ok=True)
        self.cache_path = os.path.join(folder_path, "cache.json")

        self.cache = self._load_cache()

    def _load_cache(self):
        if os.path.exists(self.cache_path):
            with open(self.cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def _save_cache(self):
        with open(self.cache_path, "w", encoding="utf-8") as f:
            json.dump(self.cache, f)

    def _get_embedding(self, text: str):
        key = _hash_text(text)
        if key in self.cache:
            return self.cache[key]

        print(f"🧑‍🧠 Fetching new embedding for hash {key[:8]}...")
        response = openai.embeddings.create(
            model=self.model,
            input=[text]
        )
        embedding = response.data[0].embedding
        self.cache[key] = embedding
        self._save_cache()
        return embedding

    def compute_similarity(self, resume_text: str, job_text: str) -> float:
        resume_vec = self._get_embedding(resume_text)
        job_vec = self._get_embedding(job_text)
        return _cosine_similarity(resume_vec, job_vec)


def main():
    resume_text = """Experienced backend developer with expertise in Python, Flask, PostgreSQL, and RESTful API design..."""
    job_text = """We are looking for a backend engineer with strong skills in Python, Django, and PostgreSQL..."""

    calculator = EmbeddingSimilarityCalculator()
    similarity = calculator.compute_similarity(resume_text, job_text)
    print(f"🔍 Similarity Score: {round(similarity * 100, 2)}%")


if __name__ == "__main__":
    main()
