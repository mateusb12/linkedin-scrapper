import requests
import os
import json
import re
from datetime import datetime

# ============================================
# Configurações
# ============================================

CACHE_FILE = "linkedin_raw_stream.txt"

# Tokens (Atualize se necessário)
CSRF_TOKEN = "ajax:2777072973261931503"
COOKIE = (
    'bcookie="v=2&06a00d93-90e5-4ec0-8bee-f68d7c1c1d9f"; '
    'JSESSIONID="ajax:2777072973261931503"; '
    'li_at=AQEDAT016UkA2kzbAAABnLWy_BEAAAGc2b-AEU0AeCarHPFpq8noGEAStRJiOmwuKQEhik6SrxpIxyFGN0CDlXsf1Bv8dH3N9Te5KKMgZl3cwU3BAH8anP3HvWie6d5i5XVPwhaWCCKeGMIOQEZ_ydxq;'
)


# ============================================
# Lógica de Parsing (Copiada do seu Service)
# ============================================

def parse_linkedin_stream(raw_text: str) -> list:
    """
    Quebra o stream do LinkedIn linha a linha, remove prefixos de protocolo
    e converte para JSONs individuais.
    """
    parsed_items = []
    for line in raw_text.split("\n"):
        if not line.strip(): continue
        try:
            # O formato geralmente é "index:JSON" ou apenas "JSON"
            if ":" in line and line[0].isalnum():
                _, rest = line.split(":", 1)
                rest = rest.strip()
                # Ignora linhas de controle de UI (ex: I["..."]) se não forem dados úteis
                if rest.startswith("I["):
                    continue
                parsed_items.append(json.loads(rest))
            else:
                parsed_items.append(json.loads(line))
        except Exception:
            continue
    return parsed_items


def find_job_objects_recursive(data):
    """
    Navega recursivamente no JSON (SDUI) procurando objetos que tenham 'jobId' ou 'jobPostingUrn'.
    """
    found = []
    if isinstance(data, dict):
        # Critério para saber se é um Job
        if "jobId" in data or "jobPostingUrn" in data:
            found.append(data)
        # Continua descendo na árvore
        for value in data.values():
            found.extend(find_job_objects_recursive(value))
    elif isinstance(data, list):
        for item in data:
            found.extend(find_job_objects_recursive(item))
    return found


def extract_job_details(job_data):
    """
    Limpa e padroniza os dados do job encontrado.
    """
    title = job_data.get("title") or job_data.get("jobTitle")

    # Tenta achar o nome da empresa em vários lugares possíveis
    company = (
            job_data.get("companyName")
            or job_data.get("company")
            or job_data.get("companyDetails", {}).get("company", {}).get("name")
            or job_data.get("companyDescription", {}).get("companyName")
            or job_data.get("jobPosting", {}).get("companyName")
            or "Unknown"
    )

    # Formata Job ID
    job_id = str(job_data.get("jobId") or job_data.get("jobPostingUrn") or "")
    if "urn:li:jobPosting:" in job_id:
        job_id = job_id.split(":")[-1]

    location = job_data.get("formattedLocation") or job_data.get("locationPrimary")

    return {
        "job_id": job_id,
        "title": title,
        "company": company,
        "location": location
    }


# ============================================
# Função 1: Faz o Curl (ou lê Cache)
# ============================================

def get_raw_response(force_update=False):
    # 1. Tenta ler do cache se existir
    if os.path.exists(CACHE_FILE) and not force_update:
        print(f"📂 Lendo cache local: {CACHE_FILE}")
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return f.read()

    print("🌐 Executando CURL no LinkedIn...")

    url = "https://www.linkedin.com/flagship-web/jobs-tracker/?stage=applied"

    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0',
        'Accept': '*/*',
        'csrf-token': CSRF_TOKEN,
        'x-li-page-instance-tracking-id': 'UpSOYTJpScWfNfTUxsM/GA==',
        'x-li-rsc-stream': 'true',
        'x-li-application-instance': 'QoH0Qw8yQ0K5eoCJon+Naw==',
        'x-li-anchor-page-key': 'd_flagship3_opportunity_tracker',
        'x-li-application-version': '0.2.4292',
        'x-li-page-instance': 'urn:li:page:d_flagship3_opportunity_tracker;UpSOYTJpScWfNfTUxsM/GA==',
        'Content-Type': 'application/json',
        'Cookie': COOKIE
    }

    # Payload SDUI
    payload = {
        "$type": "proto.sdui.actions.core.NavigateToScreen",
        "screenId": "com.linkedin.sdui.flagshipnav.jobs.OpportunityTrackerPage",
        "pageKey": "opportunity_tracker",
        "presentationStyle": "PresentationStyle_FULL_PAGE",
        "presentation": {"$case": "fullPage",
                         "fullPage": {"$type": "proto.sdui.actions.core.presentation.FullPagePresentation"}},
        "title": "Job tracker",
        "newHierarchy": {
            "$type": "proto.sdui.navigation.ScreenHierarchy",
            "screenHash": "com.linkedin.sdui.flagshipnav.home.Home#0",
            "screenId": "com.linkedin.sdui.flagshipnav.home.Home",
            "pageKey": "",
            "isAnchorPage": False,
            "childHierarchy": {
                "$type": "proto.sdui.navigation.ScreenHierarchy",
                "screenHash": "com.linkedin.sdui.flagshipnav.jobs.OpportunityTrackerPage#676e15a2",
                "screenId": "com.linkedin.sdui.flagshipnav.jobs.OpportunityTrackerPage",
                "pageKey": "",
                "isAnchorPage": False,
                "url": ""
            },
            "url": ""
        },
        "url": "/jobs-tracker/?stage=applied",
        "inheritActor": False,
        "shouldHideLoadingSpinner": True,
        "replaceCurrentScreen": True,
        "requestedArguments": {
            "payload": {
                "stage": "applied",
                "count": "10",
                "cacheId": "7fc58830-54d0-439f-88d0-e93194097e5b"
            },
            "states": [{"key": "opportunity_tracker_current_page_applied", "namespace": "MemoryNamespace", "value": 0,
                        "originalProtoCase": "intValue"}],
            "requestMetadata": {"$type": "proto.sdui.common.RequestMetadata"},
            "screenId": ""
        }
    }

    try:
        r = requests.post(url, headers=headers, json=payload, timeout=20)
        print(f"📡 Status Code: {r.status_code}")

        if r.status_code != 200:
            print("❌ Erro na requisição.")
            print(r.text[:500])
            return None

        # Salva Cache
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            f.write(r.text)
        print(f"💾 Resposta salva em {CACHE_FILE}")
        return r.text

    except Exception as e:
        print(f"❌ Exception: {e}")
        return None


# ============================================
# Função 2: Orquestra o Parsing
# ============================================

def parse_response(raw_text):
    if not raw_text:
        return []

    print("\n🔍 Processando stream...")

    # 1. Transforma o texto bagunçado em uma lista de JSONs válidos
    stream_items = parse_linkedin_stream(raw_text)
    print(f"   -> {len(stream_items)} blocos JSON extraídos do stream.")

    # 2. Varre esses JSONs recursivamente procurando por Jobs
    all_candidates = []
    for item in stream_items:
        found = find_job_objects_recursive(item)
        all_candidates.extend(found)

    print(f"   -> {len(all_candidates)} objetos candidatos a Job encontrados.")

    # 3. Limpa e deduplica
    clean_jobs = []
    seen_ids = set()

    for job in all_candidates:
        clean = extract_job_details(job)

        # Filtros básicos de qualidade
        if not clean['job_id'] or not clean['title']:
            continue

        if clean['job_id'] not in seen_ids:
            seen_ids.add(clean['job_id'])
            clean_jobs.append(clean)

    return clean_jobs


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":

    # Passo 1: Obter dados (Web ou Cache)
    raw = get_raw_response(force_update=True)

    # Passo 2: Parsear usando a lógica do seu Service
    if raw:
        jobs = parse_response(raw)

        print(f"\n✅ Total de Jobs Aplicados (Únicos): {len(jobs)}\n")

        for j in jobs:
            print(f"ID: {j['job_id']:<12} | {j['company'][:20]:<20} | {j['title']}")
