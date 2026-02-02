import json
import urllib.parse
import requests
import os
from dataclasses import dataclass, field
from typing import List

from source.features.fetch_curl.linkedin_http_client import load_experience_config


# ===================================================================
# 1) DATACLASSES (FORMATO COMPLETO)
# ===================================================================

@dataclass
class Experience:
    title: str
    company_name: str
    employment_type: str
    location: str
    work_type: str
    start_date: str
    end_date: str
    duration: str
    description: str
    skills: List[str] = field(default_factory=list)

    def __repr__(self):
        skills_str = ', '.join(self.skills) if self.skills else "N/A"
        return (f"🏢 {self.company_name} ({self.employment_type})\n"
                f"   💼 {self.title}\n"
                f"   📅 {self.start_date} - {self.end_date} ({self.duration})\n"
                f"   📍 {self.location} ({self.work_type})\n"
                f"   📝 Descrição:\n{self.description}\n"
                f"   🛠️ Skills: {skills_str}\n")


# ===================================================================
# 2) HELPERS & PARSER LOGIC BLINDADA
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


def safe_get(obj, *keys):
    """
    Navega com segurança absoluta pelo dicionário.
    Retorna '' se qualquer chave for inexistente ou valor for None.
    """
    curr = obj
    for k in keys:
        if isinstance(curr, dict):
            curr = curr.get(k)
        else:
            return ""

        if curr is None:
            return ""

    return str(curr)


def parse_experiences(json_data: dict) -> List[Experience]:
    experiences = []
    raw_jobs = []

    # --- ESTRATÉGIA: BUSCA EM 'INCLUDED' ---
    # Verifica se a chave 'included' existe e não é nula
    included = json_data.get('included')
    if included and isinstance(included, list):
        for item in included:
            if item.get('$type') == 'com.linkedin.voyager.dash.identity.profile.tetris.PagedListComponent':
                # Achamos a lista de experiências
                comps = item.get('components')
                if comps:
                    elements = comps.get('elements')
                    if elements:
                        raw_jobs = elements
                        break

    # Fallback para estrutura antiga (apenas se não achou no included)
    if not raw_jobs:
        try:
            root = json_data.get('data', {}).get('data', {}).get('identityDashProfileComponentsBySectionType')
            if root:
                elements = root.get('elements', [])
                if elements:
                    paged_list = elements[0].get('components', {}).get('pagedListComponent')
                    if paged_list:
                        raw_jobs = paged_list.get('components', {}).get('elements', [])
        except (KeyError, IndexError, TypeError):
            pass

    if not raw_jobs:
        print("⚠️ ERRO: Não foi possível localizar a lista de jobs no JSON.")
        return []

    # --- PROCESSAMENTO ---
    for job_node in raw_jobs:
        # Acesso defensivo ao EntityComponent
        comps = job_node.get('components')
        if not comps: continue

        entity = comps.get('entityComponent')
        if not entity: continue

        # 1. HEADER - Extração Segura
        title = safe_get(entity, 'titleV2', 'text', 'text')
        subtitle_raw = safe_get(entity, 'subtitle', 'text')
        metadata_raw = safe_get(entity, 'metadata', 'text')
        caption_raw = safe_get(entity, 'caption', 'text')

        # Parsing das Strings
        company = subtitle_raw
        emp_type = ""
        if '·' in subtitle_raw:
            parts = subtitle_raw.split('·')
            company = parts[0].strip()
            emp_type = parts[1].strip() if len(parts) > 1 else ""

        location = metadata_raw
        work_type = ""
        if '·' in metadata_raw:
            parts = metadata_raw.split('·')
            location = parts[0].strip()
            work_type = parts[1].strip() if len(parts) > 1 else ""

        date_range = ""
        duration = ""
        start_date = ""
        end_date = ""

        if caption_raw:
            parts = caption_raw.split('·')
            date_range = parts[0].strip()
            if len(parts) > 1:
                duration = parts[1].strip()

            if '-' in date_range:
                d_parts = date_range.split('-')
                start_date = d_parts[0].strip()
                end_date = d_parts[1].strip()
            else:
                start_date = date_range

        # 2. DESCRIPTION & SKILLS (Blidagem contra NoneType)
        description = ""
        skills = []

        sub_comps_wrapper = entity.get('subComponents')
        if sub_comps_wrapper:
            sub_components_list = sub_comps_wrapper.get('components', [])

            if sub_components_list:
                for sub in sub_components_list:
                    sub_inner = sub.get('components')
                    if not sub_inner: continue

                    # AQUI OCORRIA O ERRO: fixedListComponent pode ser None
                    fixed_list = sub_inner.get('fixedListComponent')
                    if not fixed_list: continue  # Pula se for None

                    items = fixed_list.get('components')
                    if not items: continue

                    for item in items:
                        item_comps = item.get('components')
                        if not item_comps: continue

                        text_comp = item_comps.get('textComponent')
                        if not text_comp: continue

                        # Texto aqui é: text -> text
                        raw_text = safe_get(text_comp, 'text', 'text')

                        if raw_text:
                            if raw_text.startswith("Skills:"):
                                clean = raw_text.replace("Skills:", "").strip()
                                skills = [s.strip() for s in clean.split('·') if s.strip()]
                            else:
                                description += raw_text + "\n"

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
    print("=== Fetch & Parse LinkedIn Experiences (ROBUST FIX) ===")

    cfg = load_experience_config()
    if not cfg:
        print("❌ Could not load config.")
        return

    headers = cfg["headers"]
    query_id = cfg["query_id"]

    url = build_url(profile_urn, query_id)

    session = requests.Session()
    session.headers.update(headers)

    print(f"🚀 Sending request...")
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