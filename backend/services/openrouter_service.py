import os
import json
import requests
import textwrap
import re

from dotenv import load_dotenv

from utils.decorators import execution_time

API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemini-2.0-flash-exp:free"
MAX_TOKENS = 1000

# Static input
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


def expand_job(description: str) -> str:
    """Call OpenRouter preset and return raw assistant response."""
    load_dotenv()
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise EnvironmentError("❌ Set OPENROUTER_API_KEY in your environment.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system",
             "content": "You are an assistant that extracts responsibilities, qualifications, and keywords from job "
                        "descriptions in Markdown format with headers: # Responsibilities, # Qualifications, "
                        "and # Keywords."},
            {"role": "user", "content": description}
        ],
        "max_tokens": MAX_TOKENS,
    }

    response = requests.post(API_URL, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()

    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError):
        raise RuntimeError(f"Invalid response:\n{json.dumps(data, indent=2)}")


def parse_response(text: str) -> dict:
    """Convert markdown-style output into structured dict."""
    result = {
        "responsibilities": [],
        "qualifications": [],
        "keywords": [],
    }

    current_key = None
    for line in text.splitlines():
        line = line.strip()
        clean = re.sub(r"[*_]", "", line).strip()  # Remove markdown bold/italic

        # Detect headers
        if re.match(r"^#+\s*Responsibilities", clean, re.IGNORECASE):
            current_key = "responsibilities"
        elif re.match(r"^#+\s*Qualifications", clean, re.IGNORECASE):
            current_key = "qualifications"
        elif re.match(r"^#+\s*Keywords", clean, re.IGNORECASE):
            current_key = "keywords"
        elif clean.startswith("-") and current_key in ("responsibilities", "qualifications"):
            result[current_key].append(clean.lstrip("- ").strip())
        elif current_key == "keywords" and clean:
            keywords = [kw.strip() for kw in clean.split(",") if kw.strip()]
            result["keywords"].extend(keywords)

    return result


if __name__ == "__main__":
    try:
        raw_output = expand_job(JOB_DESCRIPTION)
        print("\n" + "-" * 80 + "\n")
        print(textwrap.dedent(raw_output))
        print("\n" + "-" * 80 + "\n")

        structured = parse_response(raw_output)
        print(json.dumps(structured, indent=2, ensure_ascii=False))

    except Exception as err:
        print(f"❌ Request failed: {err}")
