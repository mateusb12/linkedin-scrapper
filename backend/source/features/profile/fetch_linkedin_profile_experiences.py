# backend/source/features/profile/fetch_linkedin_profile_experiences.py

import json
import re
import urllib.parse
from dataclasses import dataclass, field
from typing import List, Optional, Any, Dict, Tuple

# IMPORTS
from source.features.fetch_curl.linkedin_http_client import (
    LinkedInClient,
    SduiPaginationRequest
)

# ===================================================================
# 1) DATACLASSES
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
# 2) HELPERS (ARRUMADOS)
# ===================================================================

def encode_urn_only(raw_urn: str) -> str:
    return urllib.parse.quote(raw_urn, safe='')


def is_garbage(text: str) -> bool:
    t = text.strip()
    if not t:
        return True

    # CSS classes (_abc123)
    if t.startswith("_"):
        return True

    # Template vars ($L1, $undefined)
    if t.startswith("$"):
        return True

    # UUID
    if re.match(r'^[0-9a-f-]{36}$', t):
        return True

    # Hashes longos
    if re.match(r'^[0-9a-f]{8,}$', t):
        return True

    # Namespaces
    if "proto.sdui" in t or "com.linkedin" in t:
        return True

    # URNs
    if "urn:li" in t:
        return True

    # Tokens técnicos comuns no dump
    technical_tokens = {
        "div", "span", "click", "block", "horizontal",
        "default", "icon", "center", "modal", "screen",
        "button", "figure", "low", "high", "xMidYMid",
        "slice", "true", "false", "null",
        "menu", "menuitem", "presentation",
        "hr", "li", "ul", "img", "image",
        "sans", "small", "normal", "open",
        "start", "1x", "more"
    }
    if t.lower() in technical_tokens:
        return True

    # UI inútil
    ui_texts = {
        "Edit experience", "Reorder experience",
        "Show more", "Show less",
        "Expanded", "Add experience",
        "Add career break", "Skills:", "Skills",
        "Voltar", "Back", "Open menu", "Close menu"
    }
    if t in ui_texts:
        return True

    return False


def clean_text_list(raw_texts: List[str]) -> List[str]:
    clean = []
    for t in raw_texts:
        if not isinstance(t, str):
            continue

        t = t.strip()
        if len(t) < 2:
            continue

        if not is_garbage(t):
            if clean and clean[-1] == t:
                continue
            clean.append(t)

    return clean


def flatten_values(data: Any, text_list: List[str]):
    """Extrai recursivamente apenas VALORES strings de qualquer JSON."""
    if isinstance(data, str):
        text_list.append(data)
    elif isinstance(data, list):
        for item in data:
            flatten_values(item, text_list)
    elif isinstance(data, dict):
        for v in data.values():
            flatten_values(v, text_list)


def parse_date_row(text: str) -> Optional[Dict[str, str]]:
    """
    Detecta linha de data: 'Aug 2025 - Present · 7 mos'
    """
    if not re.search(r'\d{4}', text):
        return None

    if " - " not in text and " – " not in text and "·" not in text and "Present" not in text:
        return None

    parts = text.split("·")
    main_date = parts[0].strip()
    duration = parts[1].strip() if len(parts) > 1 else ""

    start, end = "", ""

    if " - " in main_date:
        d = main_date.split(" - ")
        start, end = d[0], d[1]
    elif " – " in main_date:
        d = main_date.split(" – ")
        start, end = d[0], d[1]
    elif "Present" in main_date:
        start = main_date.replace("Present", "").strip() or "?"
        end = "Present"
    else:
        start = main_date

    return {"start": start.strip(), "end": end.strip(), "duration": duration.strip()}


def looks_like_description(text: str) -> bool:
    t = text.strip()

    # se for curtinho, quase nunca é descrição
    if len(t) < 60:
        return False

    # descrição normalmente é multiline ou começa com bullet
    if "\n" in t:
        return True

    if t.startswith(("-", "•")):
        return True

    return False


def extract_description_blocks(included: List[Any]) -> List[Tuple[int, str]]:
    """
    Retorna [(included_idx, description_text), ...]
    """
    blocks: List[Tuple[int, str]] = []

    for idx, item in enumerate(included):
        raw: List[str] = []
        flatten_values(item, raw)

        # pega o primeiro texto que pareça descrição
        for s in raw:
            if isinstance(s, str) and looks_like_description(s):
                blocks.append((idx, s.strip()))
                break

    return blocks


def split_location_work_type(location_line: str) -> Tuple[str, str]:
    """
    Ex: "Fortaleza, Ceará, Brazil · Hybrid" -> ("Fortaleza, Ceará, Brazil", "Hybrid")
    """
    if "·" in location_line:
        parts = [p.strip() for p in location_line.split("·") if p.strip()]
        if len(parts) >= 2:
            return parts[0], parts[-1]

    return location_line.strip(), ""


def is_location_like(t: str) -> bool:
    # mantém heurística simples (boa o suficiente)
    needles = [
        "Brazil", "Brasil",
        "United States",
        "Remote", "Hybrid", "On-site", "Onsite",
        "Ceará", "São Paulo", "Fortaleza"
    ]
    return any(x in t for x in needles)

# ===================================================================
# 3) PARSER (VERSÃO NOVA: ITEM-BASED + PROXIMIDADE)
# ===================================================================

def parse_experiences(json_data: dict, debug: bool = False) -> List[Experience]:
    """
    - Para cada item em included, tenta achar o padrão:
      [Título, Empresa · Tipo, Data · Duração, (Local...)]
    - Descrição não é confiável no mesmo item, então:
      extrai blocos de descrição separados (expandable_text_block)
      e associa por proximidade: entre experiência atual e a próxima.
    """
    included: List[Any] = json_data.get("included", [])

    desc_blocks = extract_description_blocks(included)

    found: List[Tuple[int, Experience]] = []

    for idx, item in enumerate(included):
        raw: List[str] = []
        flatten_values(item, raw)

        clean = clean_text_list(raw)
        if not clean:
            continue

        # acha a primeira linha de data no item
        date_idx = -1
        date_info = None
        for i, text in enumerate(clean):
            parsed = parse_date_row(text)
            if parsed:
                date_info = parsed
                date_idx = i
                break

        if date_idx == -1 or date_idx < 2:
            continue

        title = clean[date_idx - 2]

        company_line = clean[date_idx - 1]
        company = company_line.strip()
        emp_type = ""
        if "·" in company_line:
            parts = [p.strip() for p in company_line.split("·") if p.strip()]
            if parts:
                company = parts[0]
            if len(parts) >= 2:
                emp_type = parts[1]

        # tenta pegar localização no próprio item (às vezes vem aqui)
        location = ""
        work_type = ""

        after = clean[date_idx + 1:]
        for t in after:
            if is_location_like(t):
                loc, wt = split_location_work_type(t)
                location = loc
                work_type = wt
                break

        exp = Experience(
            title=title,
            company_name=company,
            employment_type=emp_type,
            location=location,
            work_type=work_type,
            start_date=date_info["start"],
            end_date=date_info["end"],
            duration=date_info["duration"],
            description="",
            skills=[]
        )

        found.append((idx, exp))

    # dedupe por chave (título+empresa+start)
    unique: List[Tuple[int, Experience]] = []
    seen = set()
    for idx, exp in found:
        key = f"{exp.title}|{exp.company_name}|{exp.start_date}"
        if key not in seen:
            unique.append((idx, exp))
            seen.add(key)

    # associa descrição por proximidade
    exp_idxs = [i for i, _ in unique]
    for k, (exp_idx, exp) in enumerate(unique):
        next_exp_idx = exp_idxs[k + 1] if k + 1 < len(exp_idxs) else float("inf")

        desc = ""
        for d_idx, d_text in desc_blocks:
            if exp_idx < d_idx < next_exp_idx:
                desc = d_text
                break

        exp.description = desc

    if debug:
        # preview de debug (bem leve)
        for idx, exp in unique:
            print(f"[DEBUG] exp@{idx}: {exp.title} | {exp.company_name} | desc={'yes' if exp.description else 'no'}")

    return [exp for _, exp in unique]

# ===================================================================
# 4) SDUI STREAM PARSER (MANTIDO)
# ===================================================================

def parse_sdui_stream_to_dict(raw_text: str) -> dict:
    """Converte o stream SDUI em um dicionário único."""
    included_items = []
    lines = raw_text.split('\n')
    for line in lines:
        if not line.strip():
            continue
        if ':' in line:
            _, json_part = line.split(':', 1)
            try:
                parsed = json.loads(json_part)
                if isinstance(parsed, list):
                    included_items.append(parsed)
                    for item in parsed:
                        if isinstance(item, dict):
                            included_items.append(item)
                elif isinstance(parsed, dict):
                    included_items.append(parsed)
            except json.JSONDecodeError:
                continue
    return {"data": {}, "included": included_items}


def extract_vanity_from_referer(referer: str) -> Optional[str]:
    if not referer:
        return None
    match = re.search(r"/in/([^/]+)/", referer)
    return match.group(1) if match else None

# ===================================================================
# 5) MAIN FUNCTION (ENDPOINT LOGIC)
# ===================================================================

def fetch_linkedin_profile_experiences(
        profile_urn: str,
        vanity_name: str | None = None,
        locale: str = "en",
        start: int = 0,
        count: int = 10,
        debug: bool = True
):
    if debug:
        print("=== Fetch LinkedIn Experiences via SDUI (Item-Based Parser) ===")

    config_name = "Experience"
    client = LinkedInClient(config_name)

    if not client.config:
        return {"ok": False, "error": f"Config '{config_name}' missing", "stage": "config_load"}

    if not vanity_name:
        vanity_name = extract_vanity_from_referer(client.config.get("referer"))

    if not vanity_name:
        return {"ok": False, "error": "No vanity_name found", "stage": "vanity_resolve"}

    profile_id = profile_urn.replace("urn:li:fsd_profile:", "").strip()

    payload = {
        "pagerId": "com.linkedin.sdui.pagers.profile.details.experience",
        "clientArguments": {
            "$type": "proto.sdui.actions.requests.RequestedArguments",
            "payload": {
                "vanityName": vanity_name,
                "locale": locale,
                "start": start,
                "count": count,
                "profileId": profile_id
            },
            "requestedStateKeys": [],
            "requestMetadata": {"$type": "proto.sdui.common.RequestMetadata"},
            "states": [],
            "screenId": "com.linkedin.sdui.flagshipnav.profile.ProfileExperienceDetails"
        },
        "paginationRequest": {
            "$type": "proto.sdui.actions.requests.PaginationRequest",
            "pagerId": "com.linkedin.sdui.pagers.profile.details.experience",
            "requestedArguments": {
                "$type": "proto.sdui.actions.requests.RequestedArguments",
                "payload": {
                    "vanityName": vanity_name,
                    "locale": locale,
                    "start": start,
                    "count": count,
                    "profileId": profile_id
                },
                "requestedStateKeys": [],
                "requestMetadata": {"$type": "proto.sdui.common.RequestMetadata"}
            },
            "trigger": {
                "$case": "itemDistanceTrigger",
                "itemDistanceTrigger": {
                    "$type": "proto.sdui.actions.requests.ItemDistanceTrigger",
                    "preloadDistance": 3,
                    "preloadLength": 250
                }
            },
            "retryCount": 2
        }
    }

    try:
        req = SduiPaginationRequest(
            base_url=client.config["base_url"],
            body=payload,
            debug=debug
        )
        response = client.execute(req)

        if response.status_code == 403:
            return {"ok": False, "error": "403 Forbidden", "stage": "linkedin_forbidden"}

        if response.status_code != 200:
            return {"ok": False, "error": f"Status {response.status_code}", "body": response.text[:500]}

        content_type = response.headers.get("Content-Type", "")
        parsed_data: Dict[str, Any] = {}

        if "application/octet-stream" in content_type:
            if debug:
                print("📦 Detectado stream SDUI. Processando linhas...")
            parsed_data = parse_sdui_stream_to_dict(response.text)
        else:
            parsed_data = response.json()

        if debug:
            with open("linkedin_sdui_dump.json", "w", encoding="utf-8") as f:
                json.dump(parsed_data, f, indent=2, ensure_ascii=False)

        # Extração (nova)
        experiences_list = parse_experiences(parsed_data, debug=debug)
        experiences_dicts = [exp.to_dict() for exp in experiences_list]

        if debug:
            print(f"✅ Parser encontrou {len(experiences_dicts)} experiências.")

        return {
            "ok": True,
            "experiences": experiences_dicts,
            "raw": parsed_data if debug else None
        }

    except Exception as e:
        return {"ok": False, "error": str(e), "stage": "execution_error"}


if __name__ == "__main__":
    res = fetch_linkedin_profile_experiences(
        "urn:li:fsd_profile:ACoAAD016UkBWKGUUWKD7WdA2pTCzevPYoF-xnE",
        debug=True
    )
    print(json.dumps(res, indent=2, ensure_ascii=False))
