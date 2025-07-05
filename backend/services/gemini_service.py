import json
import os
import re

import requests
from dotenv import load_dotenv

# ── Constants ────────────────────────────────────────────────────────────
load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")
MODEL_ID = "gemini-2.5-flash"
ENDPOINT = f"https://generativelanguage.googleapis.com/v1/models/{MODEL_ID}:generateContent?key={API_KEY}"
HEADERS = {"Content-Type": "application/json"}


# ── Function ─────────────────────────────────────────────────────────────
def generate_gemini_response(prompt: str) -> str:
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
        response = requests.post(ENDPOINT, headers=HEADERS, json=payload, timeout=30)
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


def structure_gemini_data(expanded_description_text: str) -> dict:
    """Extract and parse JSON from markdown-style code block inside a string."""

    # Remove markdown code block markers like ```json and ```
    json_str = re.sub(r"^```json\n|```$", "", expanded_description_text.strip(), flags=re.MULTILINE)

    try:
        parsed = json.loads(json_str)
        return parsed
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON: {e}")


def expand_job_data(job_description: str) -> dict:
    prompt = f"""
    You are an expert in extracting meaningful information from job descriptions.
    Please expand the following job description into a detailed format, including:
    - Responsibilities
    - Qualifications
    - Keywords
    - Language: PTBR or EN based on the input
    Try to respect the input language. If input language is portuguese, output should be in portuguese.
    If input language is english, output should be in english.
    Output should be in json format. Try to stick to a list of strings with short sentences
    Here is the job description:
    {job_description}
    """
    response_text = generate_gemini_response(prompt)

    if not response_text:
        return {"error": "Failed to get a valid response from the model."}

    return structure_gemini_data(response_text)


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
    result = expand_job_data(JOB_DESCRIPTION)
    if result:
        print("✅ Model response:\n", result)
