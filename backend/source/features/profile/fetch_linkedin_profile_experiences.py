# backend/source/features/profile/fetch_linkedin_profile_experiences.py

import json
import urllib.parse
from dataclasses import dataclass, field
from typing import List

# IMPORTS REFATORADOS
from source.features.fetch_curl.linkedin_http_client import (
    LinkedInClient,
    VoyagerGraphQLRequest
)


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

    def to_dict(self):
        return {
            "title": self.title,
            "company_name": self.company_name,
            "employment_type": self.employment_type,
            "location": self.location,
            "work_type": self.work_type,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "duration": self.duration,
            "description": self.description,
            "skills": self.skills
        }


# ===================================================================
# 2) HELPERS & PARSER LOGIC BLINDADA
# ===================================================================

def encode_urn_only(raw_urn: str) -> str:
    return urllib.parse.quote(raw_urn, safe='')


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

def fetch_linkedin_profile_experiences(profile_urn: str, debug: bool = True):
    print("=== Fetch & Parse LinkedIn Experiences (REFATORED) ===")

    errors = []  # Collect debug-friendly messages

    # 1. INIT CLIENT
    client = LinkedInClient("LinkedIn_Profile_Experience_Scraper")
    if not client.config:
        msg = "Could not load config 'LinkedIn_Profile_Experience_Scraper'. Missing DB record?"
        print("❌", msg)
        return {"ok": False, "error": msg, "stage": "config_load"}

    # 2. BUILD REQUEST
    try:
        raw_urn = profile_urn.replace("profileUrn:", "").strip()
        encoded_urn = encode_urn_only(raw_urn)
        variables = f"(profileUrn:{encoded_urn},sectionType:experience)"

        req = VoyagerGraphQLRequest(
            base_url=client.config["base_url"],
            query_id=client.config["query_id"],
            variables=variables
        )
    except Exception as e:
        msg = f"Error building GraphQL request: {e}"
        print("❌", msg)
        return {"ok": False, "error": msg, "stage": "request_build"}

    # 3. EXECUTE REQUEST
    try:
        print("🚀 Sending request...")
        response = client.execute(req)
        print(f"➡️ STATUS: {response.status_code}")
    except Exception as e:
        msg = f"HTTP failure on client.execute(): {e}"
        print("❌", msg)
        return {"ok": False, "error": msg, "stage": "http_execute"}

    # 4. STATUS VALIDATION
    if response.status_code == 403:
        msg = "403 Forbidden — LinkedIn blocked the request. Cookies expired or CSRF mismatch."
        print("❌", msg)
        return {"ok": False, "error": msg, "stage": "linkedin_forbidden"}

    if response.status_code != 200:
        msg = f"Unexpected status {response.status_code}"
        print("❌", msg, "\n", response.text)
        return {
            "ok": False,
            "error": msg,
            "body": response.text,
            "stage": "non_200_status"
        }

    # 5. PARSE JSON
    try:
        parsed_json = response.json()
    except json.JSONDecodeError:
        msg = "Response is not valid JSON."
        print("❌", msg)
        return {
            "ok": False,
            "error": msg,
            "raw": response.text[:500],
            "stage": "json_decode"
        }

    # 6. DEBUG DUMP
    try:
        with open("linkedin_experience_dump.json", "w", encoding="utf-8") as f:
            json.dump(parsed_json, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("⚠️ Could not write dump file:", e)

    # 7. PARSE EXPERIENCES
    try:
        experiences = parse_experiences(parsed_json)
    except Exception as e:
        msg = f"Parser error: {e}"
        print("❌", msg)
        return {"ok": False, "error": msg, "stage": "parser"}

    # 8. EMPTY RESULT
    if not experiences:
        msg = "No experiences found — JSON structure changed or scraper missing permissions."
        print("⚠️", msg)
        return {"ok": False, "error": msg, "stage": "empty_result"}

    # 9. SUCCESS
    print(f"✅ {len(experiences)} experiences extracted.")
    return {
        "ok": True,
        "count": len(experiences),
        "experiences": [e.to_dict() for e in experiences]
    }



if __name__ == "__main__":
    # Exemplo de uso
    fetch_linkedin_profile_experiences(
        "profileUrn:urn:li:fsd_profile:ACoAAD016UkBWKGUUWKD7WdA2pTCzevPYoF-xnE"
    )