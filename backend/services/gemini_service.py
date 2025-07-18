import json
import os
import re

import requests
from dotenv import load_dotenv


# ── Constants ────────────────────────────────────────────────────────────

def structure_gemini_data(expanded_description_text: str) -> dict:
    """Extract and parse JSON from markdown-style code block inside a string."""

    # Find the JSON block using a regular expression
    match = re.search(r"```(json)?\s*({.*?})\s*```", expanded_description_text, re.DOTALL)
    if match:
        json_str = match.group(2)
    else:
        # If no markdown block is found, assume the whole string is JSON
        json_str = expanded_description_text

    try:
        # It's a good practice to strip any whitespace that might be surrounding the JSON object
        return json.loads(json_str.strip())
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON: {e}")


class GeminiService:
    def __init__(self):
        load_dotenv()
        self.API_KEY = os.getenv("GOOGLE_API_KEY")
        self.MODEL_ID = "gemini-1.5-flash"
        self.ENDPOINT = (f"https://generativelanguage.googleapis.com/v1/models/{self.MODEL_ID}"
                         f":generateContent?key={self.API_KEY}")
        self.HEADERS = {"Content-Type": "application/json"}

    def generate_gemini_response(self, prompt: str) -> str:
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ]
        }

        try:
            response = requests.post(self.ENDPOINT, headers=self.HEADERS, json=payload, timeout=30)
            response.raise_for_status()
        except requests.exceptions.HTTPError as e:
            print("❌ HTTP error:", e.response.text)
            return ""
        except requests.exceptions.RequestException as e:
            print("❌ Request failed:", e)
            return ""

        data = response.json()
        return (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
            .strip()
        )

    def expand_job_data(self, job_description: str) -> dict:
        prompt = f"""
        You are an expert in extracting meaningful information from job descriptions.
        Please expand the following job description into a detailed format, including:
        - Responsibilities
        - Qualifications
        - Keywords
        - Job type (frontend/backend/fullstack)
        - Job languages (e.g., Python, JavaScript, C#, etc. It can be more than 1)
        - Job description Language: PTBR or EN based on the input
        Try to respect the input language. If input language is portuguese, output should be in portuguese.
        If input language is english, output should be in english.
        Output should be in json format. Try to stick to a list of strings with short sentences
        Here is the job description:
        {job_description}
        """
        response_text = self.generate_gemini_response(prompt)

        if not response_text:
            return {"error": "Failed to get a valid response from the model."}

        try:
            return structure_gemini_data(response_text)
        except ValueError as e:
            print(f"❌ Failed to parse JSON from AI response: {e}")
            # Log the first 500 characters of the raw response for debugging
            print(f"   Raw response snippet: {response_text[:500]}...")
            return {"error": "AI response was not valid JSON.", "raw_response": response_text}

    def tailor_resume_for_job(self, resume_markdown: str, job_description: str) -> dict:
        """
        Uses Gemini to tailor a resume's experience and skills to a job description.

        Args:
            resume_markdown: The original resume content in markdown format.
            job_description: The target job description.

        Returns:
            A dictionary containing the tailored 'professional_experience' and 'hard_skills'.
        """
        prompt = f"""
        You are an expert career coach and resume writer specializing in the tech industry. Your task is to tailor a resume's professional experience and skills section to perfectly match a specific job description.

        **Instructions:**
        1.  **Analyze:** Carefully read both the original resume and the job description.
        2.  **Rewrite Experience:** Go through each bullet point in the "Professional Experience" section of the resume. Rewrite them using strong, quantifiable action verbs. Emphasize accomplishments and skills that are directly relevant to the requirements listed in the job description.
        3.  **Generate Skills:** Based on the newly tailored experience and the job description, create a comprehensive list of "hard_skills".
        4.  **Preserve Facts:** Ensure the rewritten experience remains truthful and is based *only* on the information provided in the original resume. Do not invent or exaggerate experiences. Maintain the original job titles, companies, and employment dates.
        5.  **Maintain Language:** Match the output language to the input language of the job description (e.g., Portuguese for a Portuguese job description).

        **Output Format:**
        You MUST return a single, valid JSON object.
        The JSON object must have exactly two keys:
        - `professional_experience`: An array of objects. Each object must have a `title` (string) and `details` (an array of strings).
        - `hard_skills`: An array of strings.

        ---
        **Job Description:**
        ```
        {job_description}
        ```
        ---
        **Original Resume (Markdown):**
        ```
        {resume_markdown}
        ```
        ---
        **Tailored Resume (JSON Output):**
        """
        response_text = self.generate_gemini_response(prompt)
        if not response_text:
            return {"error": "Failed to get a valid response from the AI model."}

        try:
            # Use the existing structuring function to safely parse the JSON
            return structure_gemini_data(response_text)
        except ValueError as e:
            print(f"❌ Error parsing structured JSON response: {e}")
            print(f"Raw response was: {response_text}")
            return {"error": "Failed to parse the AI model's JSON response.", "raw_response": response_text}

# ── Example Usage ────────────────────────────────────────────────────────
if __name__ == "__main__":
    JOB_DESCRIPTION = """
    O que procuramos?

    Atribuições Principais

    Programar, codificar e testar sistemas na linguagem, transitando entre projetos de desenvolvimento Front-End e Back-End;

    Executar o desenvolvimento das funcionalidades complexas;

    Manter os padrões de projeto existentes e sugerir melhorias;

    Validar as novas funcionalidades das aplicações;

    Executar a manutenção dos sistemas, fazendo possíveis alterações, atendendo às necessidades dos usuários;

    Desenvolver trabalhos de montagem, depuração e testes de programas, executar serviços de manutenção nos programas já desenvolvidos;

    Utilização como melhores práticas de desenvolvimento.

    Requisitos

    Experiência sólida com Python e framework Django;

    Conhecimento prático de Vue.js ou similar (React, Angular);

    Proficiência em PostgreSQL e modelagem de dados relacionais;

    Experiência com AWS (Lambda, SQS, S3, Cognito);

    Vivência com sistemas de mensageria como Kafka e/ou Redis;

    Conhecimentos em boas práticas de desenvolvimento seguro, escalável e manutenível;

    Familiaridade com versionamento (Git), integração contínua e metodologias ágeis.

    Localidade da posição: 100% remota

    Por que construir sua carreira na Meta?

    Oferecemos autonomia, metas claras e um ambiente dinâmico e desafiador, onde os profissionais têm oportunidade de interagir com diferentes tecnologias, participar de todos os tipos de projetos, trazer novas ideias e trabalhar de qualquer lugar do Brasil e (por que não?) do mundo. Além disso, somos uma das melhores empresas para se trabalhar no Brasil segundo o Great Place to Work e uma das 10 empresas que mais crescem no país há 3 anos consecutivos, segundo o Anuário Informática Hoje.

    Quais são nossos valores?

     Somos pessoas servindo pessoas Pensamos e agimos como donos Temos gana por performance Crescemos e aprendemos juntos Buscamos excelência e a simplicidade Temos inovação e criatividade no nosso DNA

    Todas as pessoas são bem-vindas independentemente de sua condição, deficiência, etnia, crença religiosa, orientação sexual, aparência, idade ou afins. Queremos que você cresça conosco em um ambiente acolhedor e repleto de oportunidades.

    Se identificou? Então, #VemSerMeta!
    """
    service = GeminiService()
    result = service.expand_job_data(JOB_DESCRIPTION)
    if result:
        print("✅ Model response:\n", json.dumps(result, indent=2, ensure_ascii=False))
