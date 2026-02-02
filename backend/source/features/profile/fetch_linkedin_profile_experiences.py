import json
import urllib.parse
import requests
import os
from dataclasses import dataclass, field
from typing import List

from source.features.fetch_curl.linkedin_http_client import load_experience_config


# ===================================================================
# 1) DATACLASSES
# ===================================================================

@dataclass
class Experience:
    title: str
    company_name: str
    employment_type: str  # Ex: Full-time
    location: str  # Ex: Fortaleza
    work_type: str  # Ex: Remote
    start_date: str
    end_date: str
    duration: str
    description: str
    skills: List[str] = field(default_factory=list)

    def __repr__(self):
        return (f"🏢 {self.company_name}\n"
                f"   💼 {self.title}\n"
                f"   📅 {self.start_date} - {self.end_date} ({self.duration})\n"
                f"   📍 {self.location} ({self.work_type})\n"
                f"   📝 Desc: {self.description[:60].replace(chr(10), ' ')}...\n"
                f"   🛠️ Skills: {', '.join(self.skills[:4])}...")


# ===================================================================
# 2) HELPERS & PARSER LOGIC
# ===================================================================

def encode_urn_only(raw_urn: str) -> str:
    return urllib.parse.quote(raw_urn, safe='')


def build_url(profile_urn: str, query_id: str):
    raw_urn = profile_urn.replace("profileUrn:", "").strip()
    encoded_urn = encode_urn_only(raw_urn)
    variables_param = f"(profileUrn:{encoded_urn},sectionType:experience)"

    url = (
        "https://www.linkedin.com/voyager/api/graphql"
        f"?includeWebMetadata=true"
        f"&variables={variables_param}"
        f"&queryId={query_id}"
    )
    return url


def safe_get_text(obj, *keys):
    """Navega com segurança pelo JSON para pegar texto."""
    curr = obj
    try:
        for k in keys:
            curr = curr[k]
            if curr is None:  # Proteção extra contra null no meio do caminho
                return ""
        return curr.get('text', '')
    except (KeyError, TypeError, AttributeError):
        return ""


def parse_experiences(json_data: dict) -> List[Experience]:
    experiences = []
    raw_jobs = []

    # --- ESTRATÉGIA 1: BUSCA EM 'INCLUDED' (Formato Normalized) ---
    if 'included' in json_data:
        for item in json_data['included']:
            if item.get('$type') == 'com.linkedin.voyager.dash.identity.profile.tetris.PagedListComponent':
                raw_jobs = item.get('components', {}).get('elements', [])
                if raw_jobs:
                    print(f"✅ Lista encontrada em 'included' com {len(raw_jobs)} itens.")
                    break

    # --- ESTRATÉGIA 2: BUSCA ANINHADA (Fallback) ---
    if not raw_jobs:
        try:
            root = json_data['data']['data']['identityDashProfileComponentsBySectionType']
            container = root['elements'][0]['components']['pagedListComponent']
            raw_jobs = container['components']['elements']
        except (KeyError, IndexError, TypeError):
            pass

    if not raw_jobs:
        print("⚠️ ERRO CRÍTICO: Não foi possível localizar a lista de jobs no JSON.")
        return []

    # --- PROCESSAMENTO DOS JOBS ---
    for job_node in raw_jobs:
        # Acesso seguro ao entityComponent
        components = job_node.get('components', {})
        if not components:
            continue

        entity = components.get('entityComponent')
        if not entity:
            continue

        # 1. Cabeçalho
        title = safe_get_text(entity, 'titleV2', 'text')

        subtitle_raw = safe_get_text(entity, 'subtitle', 'text')
        company = subtitle_raw.split('·')[0].strip() if '·' in subtitle_raw else subtitle_raw
        emp_type = subtitle_raw.split('·')[1].strip() if '·' in subtitle_raw else ""

        metadata_raw = safe_get_text(entity, 'metadata', 'text')
        location = metadata_raw.split('·')[0].strip() if '·' in metadata_raw else metadata_raw
        work_type = metadata_raw.split('·')[1].strip() if '·' in metadata_raw else ""

        caption_raw = safe_get_text(entity, 'caption', 'text')
        date_parts = caption_raw.split('·')
        date_range = date_parts[0].strip() if len(date_parts) > 0 else ""
        duration = date_parts[1].strip() if len(date_parts) > 1 else ""

        start_date = date_range.split('-')[0].strip() if '-' in date_range else date_range
        end_date = date_range.split('-')[1].strip() if '-' in date_range else "Present"

        # 2. Descrição e Skills (SubComponents)
        description = ""
        skills = []

        sub_components_container = entity.get('subComponents', {})
        sub_components_list = sub_components_container.get('components', []) if sub_components_container else []

        for sub in sub_components_list:
            try:
                sub_comps = sub.get('components', {})
                if not sub_comps:
                    continue

                fixed_list = sub_comps.get('fixedListComponent', {})
                if fixed_list:
                    # Itera sobre os itens da lista fixa
                    for item in fixed_list.get('components', []):
                        item_comps = item.get('components', {})
                        if not item_comps:
                            continue

                        # --- CORREÇÃO DO ERRO AQUI ---
                        # Verifica se 'textComponent' existe E não é None
                        text_comp = item_comps.get('textComponent')
                        if not text_comp:
                            continue

                        # Agora é seguro chamar .get()
                        raw_text = text_comp.get('text', {}).get('text', '')

                        if raw_text:
                            if raw_text.strip().startswith("Skills:"):
                                clean_skills = raw_text.replace("Skills:", "").strip()
                                skills = [s.strip() for s in clean_skills.split('·') if s.strip()]
                            else:
                                description += raw_text + "\n"
            except (KeyError, IndexError, TypeError) as e:
                print(f"⚠️ Erro ao processar subcomponente: {e}")
                continue

        # 3. Cria Objeto
        exp = Experience(
            title=title,
            company_name=company,
            employment_type=emp_type,
            location=location,
            work_type=work_type,
            start_date=start_date,
            end_date=end_date,
            duration=duration,
            description=description.strip(),
            skills=skills
        )
        experiences.append(exp)

    return experiences


# ===================================================================
# 3) MAIN EXECUTION
# ===================================================================

def fetch_linkedin_profile_experiences(profile_urn: str):
    print("=== Fetch & Parse LinkedIn Experiences (FINAL FIX) ===")

    cfg = load_experience_config()
    if not cfg:
        print("❌ Could not load config.")
        return

    headers = cfg["headers"]
    query_id = cfg["query_id"]

    url = build_url(profile_urn, query_id)

    session = requests.Session()
    session.headers.update(headers)

    print(f"🚀 Sending request... ({url[:60]}...)")
    response = session.get(url, allow_redirects=False)
    print(f"➡️ STATUS: {response.status_code}")

    if response.status_code != 200:
        print(response.text)
        return

    try:
        parsed_json = response.json()
    except json.JSONDecodeError:
        print("❌ Response is not valid JSON.")
        return

    # Salva dump para debug
    with open("linkedin_experience_dump.json", "w", encoding="utf-8") as f:
        json.dump(parsed_json, f, indent=2, ensure_ascii=False)
    print("💾 JSON salvo em 'linkedin_experience_dump.json'")

    print("\n=== 💰 PROCESSANDO DADOS ===")
    experiences = parse_experiences(parsed_json)

    if not experiences:
        print("⚠️ Nenhuma experiência encontrada.")
    else:
        print(f"✅ Sucesso! {len(experiences)} experiências extraídas:\n")
        for i, exp in enumerate(experiences, 1):
            print(f"--- JOB #{i} ---")
            print(exp)
            print("-" * 50)


if __name__ == "__main__":
    fetch_linkedin_profile_experiences(
        "profileUrn:urn:li:fsd_profile:ACoAAD016UkBWKGUUWKD7WdA2pTCzevPYoF-xnE"
    )