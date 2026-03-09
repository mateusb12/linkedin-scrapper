
import json
import re
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Any, Dict, Tuple

from source.features.fetch_curl.linkedin_http_client import (
    LinkedInClient,
    SduiPaginationRequest
)


EMPLOYMENT_TYPE_TOKENS = {
    "full-time",
    "part-time",
    "contract",
    "temporary",
    "internship",
    "freelance",
    "self-employed",
    "apprenticeship",
    "seasonal",
}

WORK_TYPE_TOKENS = {
    "remote",
    "hybrid",
    "on-site",
    "onsite",
}

UI_TEXTS = {
    "Edit experience",
    "Reorder experience",
    "Show more",
    "Show less",
    "Expanded",
    "Add experience",
    "Add career break",
    "Skills:",
    "Skills",
    "Voltar",
    "Back",
    "Open menu",
    "Close menu",
    "Add position",
    "Portfolio",
    "LinkedIn helped me get this job",
    "helped me get this job",
}

TECHNICAL_TOKENS = {
    "div", "span", "click", "block", "horizontal",
    "default", "icon", "center", "modal", "screen",
    "button", "figure", "low", "high", "xmidymid",
    "slice", "true", "false", "null",
    "menu", "menuitem", "presentation",
    "hr", "li", "ul", "img", "image",
    "sans", "small", "normal", "open",
    "start", "1x", "more", "fillavailable",
    "experience",
}



def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def encode_urn_only(raw_urn: str) -> str:
    return urllib.parse.quote(raw_urn, safe="")


def is_css_blob_token(token: str) -> bool:
    token = token.strip()
    return bool(re.fullmatch(r"_?[0-9a-f]{6,}", token, re.IGNORECASE))


def is_css_blob_text(text: str) -> bool:
    """
    Detects blobs like:
    'f30498a9 _37677861 _04bda81b _9dfef8a0 _837488b5'
    """
    t = normalize_text(text)
    if not t:
        return False

    parts = t.split()
    if len(parts) < 2:
        return False

    css_like_count = sum(1 for p in parts if is_css_blob_token(p))
    return css_like_count == len(parts)


def is_employment_type(text: str) -> bool:
    return normalize_text(text).lower() in EMPLOYMENT_TYPE_TOKENS


def parse_company_employment_line(text: str) -> Tuple[str, str]:
    """
    Example:
    'Rovester AI · Full-time' -> ('Rovester AI', 'Full-time')
    """
    t = normalize_text(text)
    if "·" not in t:
        return t, ""

    parts = [p.strip() for p in t.split("·") if p.strip()]
    if len(parts) < 2:
        return t, ""

    tail = parts[-1]
    if is_employment_type(tail):
        return " · ".join(parts[:-1]), tail

    return t, ""


def is_garbage(text: str) -> bool:
    t = normalize_text(text)
    if not t:
        return True

    lowered = t.lower()

    if is_css_blob_text(t):
        return True

    if t.startswith("_") and is_css_blob_token(t):
        return True

    if t.startswith("$"):
        return True

    if re.fullmatch(r"[0-9a-f-]{36}", t, re.IGNORECASE):
        return True

    if re.fullmatch(r"[0-9a-f]{8,}", t, re.IGNORECASE):
        return True

    if "proto.sdui" in lowered or "com.linkedin" in lowered:
        return True

    if "urn:li" in lowered:
        return True

    if lowered in TECHNICAL_TOKENS:
        return True

    if t in UI_TEXTS:
        return True

    if "helped me get this job" in lowered:
        return True

    if re.match(r"https?://", lowered):
        return True

    if "licdn.com" in lowered:
        return True

    if re.search(r"\d+_\d+\/", t):
        return True

    if "company-logo_" in lowered:
        return True

    if "profile-treasury-image" in lowered:
        return True

    if "dms/image" in lowered:
        return True

    if "?e=" in lowered and "&v=" in lowered and "beta" in lowered:
        return True

    if len(t) > 300 and " " not in t:
        return True

    return False


def flatten_values(data: Any, text_list: List[str]):
    """Recursively extracts string values from any JSON structure, preserving order."""
    if isinstance(data, str):
        text_list.append(data)
    elif isinstance(data, list):
        for item in data:
            flatten_values(item, text_list)
    elif isinstance(data, dict):
        for v in data.values():
            flatten_values(v, text_list)


def clean_text_list(raw_texts: List[str]) -> List[str]:
    """
    Cleans the raw stream.
    We do NOT use a global 'seen' set because the same text may appear in multiple experiences.
    Only consecutive duplicates are removed.
    """
    clean: List[str] = []

    for t in raw_texts:
        if not isinstance(t, str):
            continue

        t = normalize_text(t)
        if len(t) < 2:
            continue

        if is_garbage(t):
            continue

        if clean and clean[-1] == t:
            continue

        clean.append(t)

    return clean


def parse_date_row(text: str) -> Optional[Dict[str, str]]:
    """
    Detects lines like:
    'Aug 2025 - Present · 8 mos'
    'Jun 2024 - Jun 2025 · 1 yr 1 mo'
    """
    t = normalize_text(text)

    if not re.search(r"\d{4}", t):
        return None

    if " - " not in t and " – " not in t and "·" not in t and "Present" not in t:
        return None

    if len(t) > 60:
        return None

    parts = [p.strip() for p in t.split("·")]
    main_date = parts[0] if parts else t
    duration = parts[1] if len(parts) > 1 else ""

    start = ""
    end = ""

    if " - " in main_date:
        d = [x.strip() for x in main_date.split(" - ", 1)]
        if len(d) == 2:
            start, end = d
    elif " – " in main_date:
        d = [x.strip() for x in main_date.split(" – ", 1)]
        if len(d) == 2:
            start, end = d
    elif "Present" in main_date:
        start = main_date.replace("Present", "").strip() or "?"
        end = "Present"
    else:
        start = main_date

    return {
        "start": start.strip(),
        "end": end.strip(),
        "duration": duration.strip()
    }


def split_location_work_type(location_line: str) -> Tuple[str, str]:
    """
    Example:
    'Fortaleza, Ceará, Brazil · Hybrid' -> ('Fortaleza, Ceará, Brazil', 'Hybrid')
    """
    t = normalize_text(location_line)

    if "·" in t:
        parts = [p.strip() for p in t.split("·") if p.strip()]
        if len(parts) >= 2 and parts[-1].lower() in WORK_TYPE_TOKENS:
            return " · ".join(parts[:-1]), parts[-1]

    return t, ""


def is_location_like(text: str) -> bool:
    t = normalize_text(text)
    lowered = t.lower()

    if not t:
        return False

    if len(t) > 80:
        return False

    if t.startswith(("-", "•")):
        return False

    if lowered in {"remote", "hybrid", "on-site", "onsite"}:
        return True

    location_needles = [
        "brazil", "brasil",
        "united states",
        "ceará", "são paulo", "fortaleza",
    ]

    has_location_word = any(x in lowered for x in location_needles)
    has_location_shape = ("," in t) or (" · " in t)

    return has_location_word and has_location_shape


def looks_like_description(text: str) -> bool:
    t = normalize_text(text)

    if len(t) < 20:
        return False

    if "\n" in text:
        return True

    if t.startswith(("-", "•", "Concluí", "Atuei", "Desenvolvi", "Liderei", "Implementei")):
        return True

    if len(t) >= 80:
        return True

    return False


def is_valid_title(text: str) -> bool:
    t = normalize_text(text)

    if not t:
        return False
    if is_garbage(t):
        return False
    if parse_date_row(t):
        return False
    if is_location_like(t):
        return False
    if is_employment_type(t):
        return False
    if len(t) > 140:
        return False

    return True


def is_valid_company_name(text: str) -> bool:
    t = normalize_text(text)

    if not t:
        return False
    if is_garbage(t):
        return False
    if parse_date_row(t):
        return False
    if is_location_like(t):
        return False
    if len(t) > 140:
        return False

    return True



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

    def __post_init__(self):
        self.title = normalize_text(self.title)
        self.company_name = normalize_text(self.company_name)
        self.employment_type = normalize_text(self.employment_type)
        self.location = normalize_text(self.location)
        self.work_type = normalize_text(self.work_type)
        self.start_date = normalize_text(self.start_date)
        self.end_date = normalize_text(self.end_date)
        self.duration = normalize_text(self.duration)
        self.description = self.description.strip()
        self.skills = [normalize_text(s) for s in self.skills if normalize_text(s)]

        if not is_valid_title(self.title):
            raise ValueError(f"Invalid experience title: {self.title!r}")

        if self.company_name and not is_valid_company_name(self.company_name):
            raise ValueError(f"Invalid company name: {self.company_name!r}")

        if not self.start_date:
            raise ValueError("Missing start_date")

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



def write_debug_stream_dump(stream: List[str]):
    dump_path = Path(__file__).resolve().parent / "debug" / "stream_dump.txt"
    dump_path.parent.mkdir(parents=True, exist_ok=True)

    with open(dump_path, "w", encoding="utf-8") as f:
        for idx, s in enumerate(stream):
            f.write(f"{idx}: {s}\n")


def collect_header_candidates(stream: List[str], date_idx: int, window: int = 5) -> List[Tuple[int, str]]:
    candidates: List[Tuple[int, str]] = []
    start = max(0, date_idx - window)

    for idx in range(start, date_idx):
        t = normalize_text(stream[idx])

        if not t:
            continue
        if is_garbage(t):
            continue
        if parse_date_row(t):
            continue
        if is_location_like(t):
            continue
        if looks_like_description(t):
            continue

        if candidates and candidates[-1][1] == t:
            continue

        candidates.append((idx, t))

    return candidates


def resolve_title_company_from_candidates(candidates: List[Tuple[int, str]]) -> Optional[Dict[str, str]]:
    if not candidates:
        return None

    company_idx: Optional[int] = None
    company_name = ""
    employment_type = ""
    company_source_line = ""

    for idx, text in reversed(candidates):
        parsed_company, parsed_employment = parse_company_employment_line(text)

        if parsed_employment and is_valid_company_name(parsed_company):
            company_idx = idx
            company_name = parsed_company
            employment_type = parsed_employment
            company_source_line = text
            break

    if company_idx is None:
        idx, text = candidates[-1]
        if is_valid_company_name(text):
            company_idx = idx
            company_name = text
            company_source_line = text

    title = ""

    if company_idx is not None:
        for idx, text in reversed(candidates):
            if idx >= company_idx:
                continue
            if not is_valid_title(text):
                continue
            if text == company_source_line or text == company_name:
                continue
            title = text
            break

    if not title and company_name:
        title = company_name

    if not title:
        return None

    return {
        "title": title,
        "company_name": company_name,
        "employment_type": employment_type,
    }


def extract_location_after_date(stream: List[str], date_idx: int) -> Tuple[str, str, int]:
    """
    Returns:
    (location, work_type, description_start_idx)
    """
    location = ""
    work_type = ""
    desc_start_idx = date_idx + 1

    max_forward = min(len(stream), date_idx + 4)
    for idx in range(date_idx + 1, max_forward):
        text = normalize_text(stream[idx])

        if not text:
            continue
        if parse_date_row(text):
            break
        if is_location_like(text):
            location, work_type = split_location_work_type(text)
            desc_start_idx = idx + 1
            break

    return location, work_type, desc_start_idx


def append_description_part(parts: List[str], text_segment: str):
    if not text_segment:
        return

    if text_segment in parts:
        return

    for existing_part in parts:
        if text_segment in existing_part:
            return
        if existing_part in text_segment:
            idx_to_replace = parts.index(existing_part)
            parts[idx_to_replace] = text_segment
            return

    parts.append(text_segment)


def dedupe_repeated_tail(text: str) -> str:
    """
    Fix cases like:
    'A A'
    where the second half is an exact repetition of the first.
    """
    t = normalize_text(text)
    words = t.split()

    if len(words) < 8:
        return t

    half = len(words) // 2
    left = " ".join(words[:half]).strip()
    right = " ".join(words[half:]).strip()

    if left == right:
        return left

    for size in range(min(20, len(words) // 2), 4, -1):
        suffix1 = " ".join(words[-2 * size:-size]).strip()
        suffix2 = " ".join(words[-size:]).strip()
        if suffix1 and suffix1 == suffix2:
            return " ".join(words[:-size]).strip()

    return t


def extract_description(
        stream: List[str],
        start_idx: int,
        end_idx: int,
        title: str,
        company_name: str
) -> str:
    description_parts: List[str] = []

    skip_values = {
        normalize_text(title),
        normalize_text(company_name),
    }

    for j in range(start_idx, min(end_idx, len(stream))):
        text_segment = normalize_text(stream[j])

        if not text_segment:
            continue
        if text_segment in skip_values:
            continue
        if is_garbage(text_segment):
            continue
        if parse_date_row(text_segment):
            continue
        if is_location_like(text_segment):
            continue
        if not looks_like_description(text_segment):
            continue

        text_segment = dedupe_repeated_tail(text_segment)
        append_description_part(description_parts, text_segment)

    deduped_parts: List[str] = []
    seen: set[str] = set()

    for part in description_parts:
        normalized = normalize_text(part)
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped_parts.append(part)

    return "\n\n".join(deduped_parts).strip()


def same_experience(a: Experience, b: Experience) -> bool:
    if a.start_date != b.start_date:
        return False
    if a.end_date != b.end_date:
        return False
    if a.duration != b.duration:
        return False

    a_title = normalize_text(a.title).lower()
    b_title = normalize_text(b.title).lower()
    a_company = normalize_text(a.company_name).lower()
    b_company = normalize_text(b.company_name).lower()

    if a_company and b_company and a_company == b_company:
        return True
    if a_title and b_title and a_title == b_title:
        return True
    if a_title and b_company and a_title == b_company:
        return True
    if b_title and a_company and b_title == a_company:
        return True

    return False


def choose_better_title(current: str, incoming: str) -> str:
    current = normalize_text(current)
    incoming = normalize_text(incoming)

    if not current:
        return incoming
    if not incoming:
        return current

    current_company_like = bool(parse_company_employment_line(current)[1])
    incoming_company_like = bool(parse_company_employment_line(incoming)[1])

    if current_company_like and not incoming_company_like:
        return incoming
    if incoming_company_like and not current_company_like:
        return current

    return incoming if len(incoming) > len(current) else current


def choose_better_company(current: str, incoming: str) -> str:
    current = normalize_text(current)
    incoming = normalize_text(incoming)

    if not current:
        return incoming
    if not incoming:
        return current

    return incoming if len(incoming) > len(current) else current


def merge_experience_lists(experiences: List[Experience]) -> List[Experience]:
    merged: List[Experience] = []

    for exp in experiences:
        existing = next((m for m in merged if same_experience(m, exp)), None)

        if not existing:
            merged.append(exp)
            continue

        existing.title = choose_better_title(existing.title, exp.title)
        existing.company_name = choose_better_company(existing.company_name, exp.company_name)

        if not existing.employment_type and exp.employment_type:
            existing.employment_type = exp.employment_type
        if not existing.location and exp.location:
            existing.location = exp.location
        if not existing.work_type and exp.work_type:
            existing.work_type = exp.work_type

        if exp.description:
            if not existing.description:
                existing.description = exp.description
            elif exp.description not in existing.description:
                existing.description = f"{existing.description}\n\n{exp.description}"

    return merged



def parse_experiences_from_stream(json_data: dict, debug: bool = False) -> List[Experience]:
    """
    Strategy:
    1. Flatten all JSON text into a linear stream
    2. Find date anchors
    3. For each date anchor, inspect a small backward window to infer title/company
    4. Extract optional location and description
    5. Validate with dataclass
    6. Merge duplicates
    """

    raw_texts: List[str] = []
    flatten_values(json_data, raw_texts)

    stream = clean_text_list(raw_texts)

    if debug:
        print(f"[DEBUG] Stream size: {len(stream)}")
        write_debug_stream_dump(stream)

    anchors: List[Tuple[int, Dict[str, str]]] = []
    for idx, text in enumerate(stream):
        parsed_date = parse_date_row(text)
        if parsed_date:
            anchors.append((idx, parsed_date))

    results: List[Experience] = []

    for i, (date_idx, date_info) in enumerate(anchors):
        header_candidates = collect_header_candidates(stream, date_idx, window=5)
        resolved = resolve_title_company_from_candidates(header_candidates)

        if not resolved:
            if debug:
                print(f"[DEBUG] Skipping anchor at {date_idx}: could not resolve title/company")
            continue

        title = resolved["title"]
        company_name = resolved["company_name"]
        employment_type = resolved["employment_type"]

        location, work_type, desc_start_idx = extract_location_after_date(stream, date_idx)
        next_anchor_idx = anchors[i + 1][0] if i + 1 < len(anchors) else len(stream)

        full_description = extract_description(
            stream=stream,
            start_idx=desc_start_idx,
            end_idx=next_anchor_idx,
            title=title,
            company_name=company_name
        )

        try:
            exp = Experience(
                title=title,
                company_name=company_name,
                employment_type=employment_type,
                location=location,
                work_type=work_type,
                start_date=date_info["start"],
                end_date=date_info["end"],
                duration=date_info["duration"],
                description=full_description,
                skills=[]
            )
            results.append(exp)

        except ValueError as e:
            if debug:
                print(f"[DEBUG] Invalid experience skipped at anchor {date_idx}: {e}")
            continue

    return merge_experience_lists(results)



def parse_sdui_stream_to_dict(raw_text: str) -> dict:
    included_items = []
    lines = raw_text.split("\n")

    for line in lines:
        if not line.strip():
            continue

        if ":" not in line:
            continue

        _, json_part = line.split(":", 1)

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



def fetch_linkedin_profile_experiences(
        profile_urn: str,
        vanity_name: str | None = None,
        locale: str = "en-US",
        start: int = 0,
        count: int = 10,
        debug: bool = True
):
    if debug:
        print(f"=== Fetch LinkedIn Experiences via SDUI (Stream Parser) [Locale: {locale}] ===")

    config_name = "Experience"
    client = LinkedInClient(config_name)

    if not client.config:
        return {"ok": False, "error": f"Config '{config_name}' missing", "stage": "config_load"}

    if not vanity_name:
        vanity_name = extract_vanity_from_referer(client.config.get("referer"))

    if not vanity_name:
        return {"ok": False, "error": "No vanity_name found", "stage": "vanity_resolve"}

    current_referer = client.session.headers.get("Referer", "")
    if current_referer:
        if "locale=" in current_referer:
            new_referer = re.sub(r"locale=[a-zA-Z0-9-]+", f"locale={locale}", current_referer)
        else:
            separator = "&" if "?" in current_referer else "?"
            new_referer = f"{current_referer}{separator}locale={locale}"

        client.session.headers["Referer"] = new_referer

        if debug:
            print(f"🌍 [Patch] Referer atualizado para: {new_referer}")

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
            return {
                "ok": False,
                "error": f"Status {response.status_code}",
                "body": response.text[:500]
            }

        content_type = response.headers.get("Content-Type", "")
        parsed_data: Dict[str, Any] = {}

        if "application/octet-stream" in content_type:
            if debug:
                print("📦 Detectado stream SDUI. Processando linhas...")
            parsed_data = parse_sdui_stream_to_dict(response.text)
        else:
            parsed_data = response.json()

        if debug:
            dump_dir = Path(__file__).resolve().parent / "debug"
            dump_dir.mkdir(parents=True, exist_ok=True)
            dump_path = dump_dir / "linkedin_sdui_dump.json"
            dump_path.write_text(
                json.dumps(parsed_data, indent=2, ensure_ascii=False),
                encoding="utf-8"
            )

        experiences_list = parse_experiences_from_stream(parsed_data, debug=debug)
        experiences_dicts = [exp.to_dict() for exp in experiences_list]

        if debug:
            print(f"✅ Stream Parser encontrou {len(experiences_dicts)} experiências.")

        return {
            "ok": True,
            "experiences": experiences_dicts,
            "raw": parsed_data if debug else None
        }

    except Exception as e:
        return {"ok": False, "error": str(e), "stage": "execution_error"}


if __name__ == "__main__":
    import json

    profile_urn = "urn:li:fsd_profile:ACoAAD016UkBWKGUUWKD7WdA2pTCzevPYoF-xnE"
    vanity = "mateus-bessa-m"
    locale = "en-US"

    result = fetch_linkedin_profile_experiences(
        profile_urn=profile_urn,
        vanity_name=vanity,
        locale=locale,
        start=0,
        count=10,
        debug=True
    )

    print("\n===== RESULT =====\n")
    result_to_print = {k: v for k, v in result.items() if k != "raw"}
    print(json.dumps(result_to_print, indent=2, ensure_ascii=False))
