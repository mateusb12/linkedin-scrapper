import json
import re
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path
from pprint import pformat
from typing import List, Optional, Any, Dict, Tuple, Iterable

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


def preview_text(text: str, limit: int = 140) -> str:
    t = normalize_text(text)
    if len(t) <= limit:
        return t
    return t[:limit] + "..."


def debug_print(debug: bool, message: str):
    if debug:
        print(message)


def debug_block(debug: bool, title: str, payload: Any):
    if not debug:
        return
    print(f"\n[TRACE] {title}")
    if isinstance(payload, str):
        print(payload)
    else:
        print(pformat(payload, width=120, compact=False))


def write_trace_json(trace_rows: Any, filename: str = "experience_trace.json"):
    dump_path = Path(__file__).resolve().parent / "debug" / filename
    dump_path.parent.mkdir(parents=True, exist_ok=True)
    dump_path.write_text(
        json.dumps(trace_rows, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


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

    if lowered.startswith("/in/") or lowered.startswith("/jobs/") or lowered.startswith("/company/"):
        return True

    if "/details/experience/edit/forms/" in lowered:
        return True

    if "/overlay/" in lowered and "skill-associations-details" in lowered:
        return True

    if "licdn.com" in lowered:
        return True

    if t.startswith("{") and t.endswith("}"):
        if "\"semanticId\"" in t or "\"key\"" in t:
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


@dataclass
class ExperienceCardRecord:
    component_key: str
    position_id: str
    title: str
    company_name: str
    employment_type: str
    location: str
    work_type: str
    start_date: str
    end_date: str
    duration: str
    local_stream: List[str] = field(default_factory=list)
    debug: Dict[str, Any] = field(default_factory=dict)

    def to_trace_dict(self) -> Dict[str, Any]:
        return {
            "component_key": self.component_key,
            "position_id": self.position_id,
            "title": self.title,
            "company_name": self.company_name,
            "employment_type": self.employment_type,
            "location": self.location,
            "work_type": self.work_type,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "duration": self.duration,
            "debug": self.debug,
        }


@dataclass
class DescriptionBlockRecord:
    binding_key: str
    expansion_key: str
    text: str
    component_key: str
    position_id: str
    association_id: str
    debug: Dict[str, Any] = field(default_factory=dict)

    def to_trace_dict(self) -> Dict[str, Any]:
        return {
            "binding_key": self.binding_key,
            "expansion_key": self.expansion_key,
            "component_key": self.component_key,
            "position_id": self.position_id,
            "association_id": self.association_id,
            "text_preview": preview_text(self.text, 320),
            "debug": self.debug,
        }


@dataclass
class FlightRecord:
    label: str
    kind: str
    value: Any


def make_serializable_payload(parsed_data: Dict[str, Any]) -> Dict[str, Any]:
    serializable = dict(parsed_data)
    flight_records = serializable.get("flight_records")
    if isinstance(flight_records, dict):
        serializable["flight_records"] = {
            label: {
                "kind": record.kind,
                "value_type": type(record.value).__name__,
            }
            for label, record in flight_records.items()
        }
    return serializable


def write_debug_stream_dump(stream: List[str]):
    dump_path = Path(__file__).resolve().parent / "debug" / "stream_dump.txt"
    dump_path.parent.mkdir(parents=True, exist_ok=True)

    with open(dump_path, "w", encoding="utf-8") as f:
        for idx, s in enumerate(stream):
            f.write(f"{idx}: {s}\n")


def walk_nodes(data: Any) -> Iterable[Any]:
    yield data

    if isinstance(data, dict):
        for value in data.values():
            yield from walk_nodes(value)
    elif isinstance(data, list):
        for item in data:
            yield from walk_nodes(item)


def iter_dicts(data: Any) -> Iterable[Dict[str, Any]]:
    for node in walk_nodes(data):
        if isinstance(node, dict):
            yield node


def first_non_empty(*values: Any) -> str:
    for value in values:
        normalized = normalize_text(str(value)) if value is not None else ""
        if normalized:
            return normalized
    return ""


def extract_strings_from_children(children: Any) -> List[str]:
    result: List[str] = []

    if isinstance(children, str):
        normalized = normalize_text(children)
        if normalized:
            result.append(normalized)
        return result

    if isinstance(children, list):
        for item in children:
            result.extend(extract_strings_from_children(item))

    return result


def find_component_dicts(top_level_item: Any) -> List[Dict[str, Any]]:
    seen: set[int] = set()
    matches: List[Dict[str, Any]] = []

    for node in iter_dicts(top_level_item):
        component_key = first_non_empty(node.get("componentKey"), node.get("componentkey"))
        if not component_key:
            continue
        node_id = id(node)
        if node_id in seen:
            continue
        seen.add(node_id)
        matches.append(node)

    return matches


def collect_structural_entries(data: Any) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    seen_anchors: set[int] = set()
    seen_cards: set[str] = set()
    seen_descriptions: set[Tuple[str, str]] = set()

    def visit(node: Any):
        if isinstance(node, dict):
            component_key = first_non_empty(node.get("componentKey"), node.get("componentkey"))
            if component_key == "profileExperienceDetails_top_anchor":
                node_id = id(node)
                if node_id not in seen_anchors:
                    seen_anchors.add(node_id)
                    entries.append({"type": "anchor", "node": node, "component_key": component_key})

            elif component_key.startswith("entity-collection-item"):
                if component_key not in seen_cards:
                    seen_cards.add(component_key)
                    entries.append({"type": "card", "node": node, "component_key": component_key})

            text_props = node.get("textProps")
            binding_key = node.get("bindingKey")
            if isinstance(text_props, dict) and isinstance(binding_key, dict):
                binding_value = first_non_empty(binding_key.get("value"))
                expansion_key = first_non_empty(node.get("expansionKey"))
                description_key = (binding_value, expansion_key)
                if any(description_key) and description_key not in seen_descriptions:
                    seen_descriptions.add(description_key)
                    entries.append({"type": "description", "node": node, "component_key": component_key})

            for value in node.values():
                visit(value)

        elif isinstance(node, list):
            for item in node:
                visit(item)

    visit(data)
    return entries


def find_first_key_value(data: Any, key: str) -> str:
    for node in iter_dicts(data):
        value = node.get(key)
        if isinstance(value, (str, int)):
            normalized = normalize_text(str(value))
            if normalized:
                return normalized
    return ""


def collect_payload_values(data: Any, payload_key: str) -> List[str]:
    values: List[str] = []
    seen: set[str] = set()

    for node in iter_dicts(data):
        payload = node.get("payload")
        if not isinstance(payload, dict):
            continue
        value = payload.get(payload_key)
        if value is None:
            continue
        normalized = normalize_text(str(value))
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        values.append(normalized)

    return values


def parse_text_flight_record(content: str) -> str:
    if "," not in content:
        return content[1:]
    _, text = content.split(",", 1)
    return text


def parse_sdui_stream_to_dict(raw_text: str) -> dict:
    included_items = []
    flight_records: Dict[str, FlightRecord] = {}
    raw_bytes = raw_text.encode("utf-8")
    idx = 0
    text_len = len(raw_bytes)

    while idx < text_len:
        if raw_bytes[idx:idx + 1] in {b"\n", b"\r"}:
            idx += 1
            continue

        colon_idx = raw_bytes.find(b":", idx)
        if colon_idx == -1:
            break

        label = raw_bytes[idx:colon_idx].decode("utf-8", errors="replace").strip()
        if not label:
            idx = colon_idx + 1
            continue

        payload_start = colon_idx + 1
        if payload_start >= text_len:
            break

        record_type = raw_bytes[payload_start:payload_start + 1]

        if record_type == b"T":
            comma_idx = raw_bytes.find(b",", payload_start)
            if comma_idx == -1:
                break
            hex_length = raw_bytes[payload_start + 1:comma_idx].decode("ascii", errors="ignore")
            try:
                content_length = int(hex_length, 16)
            except ValueError:
                content_length = 0
            content_start = comma_idx + 1
            content_end = min(text_len, content_start + content_length)
            value = raw_bytes[content_start:content_end].decode("utf-8", errors="replace")
            flight_records[label] = FlightRecord(label=label, kind="text", value=value)
            idx = content_end
            continue

        newline_idx = raw_bytes.find(b"\n", payload_start)
        if newline_idx == -1:
            payload_text = raw_bytes[payload_start:].decode("utf-8", errors="replace").strip()
            idx = text_len
        else:
            payload_text = raw_bytes[payload_start:newline_idx].decode("utf-8", errors="replace").strip()
            idx = newline_idx + 1

        if not payload_text:
            continue

        if payload_text.startswith("I"):
            flight_records[label] = FlightRecord(label=label, kind="import", value=payload_text)
            continue

        try:
            parsed = json.loads(payload_text)
        except json.JSONDecodeError:
            flight_records[label] = FlightRecord(label=label, kind="raw", value=payload_text)
            continue

        if isinstance(parsed, (list, dict)):
            included_items.append(parsed)

        flight_records[label] = FlightRecord(label=label, kind="json", value=parsed)

    return {"data": {}, "included": included_items, "flight_records": flight_records}


def resolve_flight_ref_token(token: str, flight_records: Dict[str, FlightRecord]) -> Any:
    if not isinstance(token, str) or not token.startswith("$"):
        return token

    if token in {"$undefined", "$null"}:
        return None

    if token.startswith("$L"):
        label = token[2:]
    else:
        label = token[1:]

    record = flight_records.get(label)
    if not record:
        return None

    return record.value


def resolve_text_children(children: Any, flight_records: Dict[str, FlightRecord]) -> List[str]:
    result: List[str] = []

    if isinstance(children, str):
        if children.startswith("$"):
            resolved = resolve_flight_ref_token(children, flight_records)
            if isinstance(resolved, str):
                normalized = normalize_text(resolved)
                if normalized:
                    result.append(normalized)
            elif resolved is not None:
                result.extend(resolve_text_children(resolved, flight_records))
            return result

        normalized = normalize_text(children)
        if normalized:
            result.append(normalized)
        return result

    if isinstance(children, list):
        for item in children:
            result.extend(resolve_text_children(item, flight_records))

    return result


def classify_resolved_component(resolved: Any, flight_records: Dict[str, FlightRecord]) -> str:
    if resolved is None:
        return "missing"

    if isinstance(resolved, str):
        return "text"

    if isinstance(resolved, list) and len(resolved) >= 4 and isinstance(resolved[3], dict):
        props = resolved[3]

        text_props = props.get("textProps")
        if isinstance(text_props, dict):
            text_preview = " ".join(resolve_text_children(text_props.get("children"), flight_records))
            if text_preview and looks_like_description(text_preview):
                return "description_block"
            return "text_block"

        if props.get("componentkey") or props.get("componentKey"):
            component_key = first_non_empty(props.get("componentkey"), props.get("componentKey"))
            if component_key == "004febd4-7234-43de-8d61-dca439f3d521":
                return "media_button"

        if props.get("children") == []:
            return "empty_spacer"

        if find_first_key_value(props, "associationId"):
            return "skills_block"

        if "helped me get this job" in json.dumps(props, ensure_ascii=False).lower():
            return "promo_block"

        if "Portfolio" in json.dumps(props, ensure_ascii=False):
            return "portfolio_block"

        if "imageId" in json.dumps(props, ensure_ascii=False):
            return "media_block"

        return "component"

    if isinstance(resolved, dict):
        dumped = json.dumps(resolved, ensure_ascii=False)
        if "helped me get this job" in dumped.lower():
            return "promo_block"
        if "Portfolio" in dumped:
            return "portfolio_block"
        return "object"

    return "unknown"


def collect_card_reference_details(card_node: Any, flight_records: Dict[str, FlightRecord]) -> List[Dict[str, Any]]:
    refs: List[Dict[str, Any]] = []
    seen_labels: set[str] = set()

    def visit(node: Any, path: str):
        if isinstance(node, str):
            if node.startswith("$L"):
                label = node[2:]
                if label in seen_labels:
                    return
                seen_labels.add(label)
                record = flight_records.get(label)
                resolved = record.value if record else None
                component_type = classify_resolved_component(resolved, flight_records)
                text_preview = ""

                if component_type in {"description_block", "text_block"} and isinstance(resolved, list) and len(resolved) >= 4:
                    text_props = resolved[3].get("textProps", {})
                    text_preview = preview_text(
                        " ".join(resolve_text_children(text_props.get("children"), flight_records)),
                        280
                    )

                refs.append({
                    "label": label,
                    "ref": node,
                    "path": path,
                    "record_kind": record.kind if record else "missing",
                    "component_type": component_type,
                    "text_preview": text_preview,
                })
            return

        if isinstance(node, list):
            for idx, item in enumerate(node):
                visit(item, f"{path}[{idx}]")
        elif isinstance(node, dict):
            for key, value in node.items():
                visit(value, f"{path}.{key}")

    visit(card_node, "card")
    return refs


def extract_text_component_records(top_level_item: Any) -> List[DescriptionBlockRecord]:
    records: List[DescriptionBlockRecord] = []
    seen_keys: set[Tuple[str, str, str]] = set()

    for node in iter_dicts(top_level_item):
        text_props = node.get("textProps")
        binding_key = node.get("bindingKey")
        if not isinstance(text_props, dict) or not isinstance(binding_key, dict):
            continue

        children = extract_strings_from_children(text_props.get("children"))
        text = "\n\n".join(children).strip()
        if not text or not looks_like_description(text):
            continue

        binding_value = first_non_empty(binding_key.get("value"))
        expansion_key = first_non_empty(node.get("expansionKey"))
        key = (binding_value, expansion_key, text)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        records.append(
            DescriptionBlockRecord(
                binding_key=binding_value,
                expansion_key=expansion_key,
                text=text,
                component_key=first_non_empty(node.get("componentKey"), node.get("componentkey")),
                position_id=find_first_key_value(node, "positionId"),
                association_id=find_first_key_value(node, "associationId"),
                debug={
                    "text_children_count": len(children),
                    "top_level_item_kind": type(top_level_item).__name__,
                },
            )
        )

    return records


def parse_experience_card_component(component: Dict[str, Any]) -> Optional[ExperienceCardRecord]:
    raw_texts: List[str] = []
    flatten_values(component, raw_texts)
    local_stream = clean_text_list(raw_texts)

    anchors: List[Tuple[int, Dict[str, str]]] = []
    for idx, text in enumerate(local_stream):
        parsed_date = parse_date_row(text)
        if parsed_date:
            anchors.append((idx, parsed_date))

    if not anchors:
        return None

    date_idx, date_info = anchors[0]
    header_candidates = collect_header_candidates(local_stream, date_idx, window=5)
    resolved = resolve_title_company_from_candidates(header_candidates)
    if not resolved:
        return None

    location, work_type, _ = extract_location_after_date(local_stream, date_idx)

    position_ids = collect_payload_values(component, "positionId")
    association_ids = collect_payload_values(component, "associationId")

    return ExperienceCardRecord(
        component_key=first_non_empty(component.get("componentKey"), component.get("componentkey")),
        position_id=position_ids[0] if position_ids else "",
        title=resolved["title"],
        company_name=resolved["company_name"],
        employment_type=resolved["employment_type"],
        location=location,
        work_type=work_type,
        start_date=date_info["start"],
        end_date=date_info["end"],
        duration=date_info["duration"],
        local_stream=local_stream,
        debug={
            "date_anchor": {
                "stream_idx": date_idx,
                "raw": local_stream[date_idx],
                "start": date_info["start"],
                "end": date_info["end"],
                "duration": date_info["duration"],
            },
            "header_candidates": [{"idx": idx, "text": text} for idx, text in header_candidates],
            "resolved_header": resolved,
            "association_ids": association_ids,
            "local_stream_preview": [
                {"idx": idx, "text": text}
                for idx, text in enumerate(local_stream[:20])
            ],
        },
    )


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
        company_name: str,
        debug: bool = False,
) -> str:
    description_parts: List[str] = []
    accepted_candidates: List[Dict[str, Any]] = []

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

        accepted_candidates.append({
            "idx": j,
            "preview": preview_text(text_segment, 180),
        })

        append_description_part(description_parts, text_segment)

    deduped_parts: List[str] = []
    seen: set[str] = set()

    for part in description_parts:
        normalized = normalize_text(part)
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped_parts.append(part)

    if debug:
        debug_block(
            True,
            f"DESCRIPTION CANDIDATES for {title} @ {company_name}",
            accepted_candidates
        )
        debug_print(
            True,
            f"[TRACE] FINAL INLINE DESCRIPTION: {preview_text(' '.join(deduped_parts), 240)}"
        )

    return "\n\n".join(deduped_parts).strip()


def extract_last_description_after_boundary(
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

    return description_parts[-1] if description_parts else ""


def find_description_section_boundary(stream: List[str], start_idx: int, end_idx: int) -> int:
    for idx in range(start_idx, min(end_idx, len(stream))):
        if normalize_text(stream[idx]) == "profileExperienceDetails_top_anchor":
            return idx

    return end_idx


def extract_description_slots_after_anchor(stream: List[str], anchor_idx: int) -> List[str]:
    """
    The later details section stores one logical description slot per experience.
    Each slot ends after two repeated `stringValue` markers. When a description is
    missing in the raw payload, the slot is still present but contains no text.
    """
    slots: List[str] = []
    description_parts: List[str] = []
    string_value_count = 0

    for j in range(anchor_idx + 1, len(stream)):
        text_segment = normalize_text(stream[j])

        if not text_segment:
            continue

        if text_segment == "stringValue":
            string_value_count += 1
            if string_value_count == 2:
                slots.append(description_parts[-1] if description_parts else "")
                description_parts = []
                string_value_count = 0
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

    return slots


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

    debug_block(
        debug,
        "DATE ANCHORS",
        [
            {
                "stream_idx": idx,
                "raw": stream[idx],
                "start": parsed["start"],
                "end": parsed["end"],
                "duration": parsed["duration"],
            }
            for idx, parsed in anchors
        ]
    )

    details_anchor_indices = [
        idx for idx, text in enumerate(stream)
        if normalize_text(text) == "profileExperienceDetails_top_anchor"
    ]

    debug_block(
        debug,
        "DETAIL ANCHOR INDICES",
        details_anchor_indices
    )
    entries = collect_structural_entries(json_data.get("included", []))
    flight_records: Dict[str, FlightRecord] = json_data.get("flight_records", {})
    section_index = 0
    card_records: List[ExperienceCardRecord] = []
    description_records: List[DescriptionBlockRecord] = []
    card_reference_map: Dict[str, List[Dict[str, Any]]] = {}

    for entry_index, entry in enumerate(entries):
        item = entry["node"]
        entry_type = entry["type"]

        if entry_type == "anchor":
            section_index += 1
            continue

        if section_index == 1 and entry_type == "card":
            card_record = parse_experience_card_component(item)
            if not card_record:
                continue
            card_record.debug["entry_index"] = entry_index
            card_refs = collect_card_reference_details(item, flight_records)
            card_record.debug["flight_refs"] = card_refs
            card_reference_map[card_record.component_key] = card_refs
            card_records.append(card_record)

    debug_block(
        debug,
        "PARSED CARD RECORDS",
        [record.to_trace_dict() for record in card_records]
    )

    results: List[Experience] = []
    join_decisions: List[Dict[str, Any]] = []

    for card in card_records:
        matched_description: Optional[DescriptionBlockRecord] = None
        join_key = ""
        join_source = "unmatched"
        card_refs = card_reference_map.get(card.component_key, [])
        description_candidates: List[DescriptionBlockRecord] = []

        for ref in card_refs:
            if ref["component_type"] != "description_block":
                continue
            record = flight_records.get(ref["label"])
            if not record or not isinstance(record.value, list) or len(record.value) < 4:
                continue
            props = record.value[3]
            text_props = props.get("textProps", {})
            text = "\n\n".join(resolve_text_children(text_props.get("children"), flight_records)).strip()
            if not text:
                continue
            description_candidates.append(
                DescriptionBlockRecord(
                    binding_key=first_non_empty(find_first_key_value(props.get("bindingKey"), "value")),
                    expansion_key=first_non_empty(props.get("expansionKey")),
                    text=text,
                    component_key=card.component_key,
                    position_id=card.position_id,
                    association_id="",
                    debug={
                        "source_ref": ref["ref"],
                        "source_label": ref["label"],
                        "source_path": ref["path"],
                    },
                )
            )

        if len(description_candidates) == 1:
            matched_description = description_candidates[0]
            join_key = matched_description.debug["source_label"]
            join_source = "card_ref"
            description_records.append(matched_description)

        join_decisions.append({
            "component_key": card.component_key,
            "position_id": card.position_id,
            "title": card.title,
            "company_name": card.company_name,
            "card_refs": card_refs,
            "description_candidate_labels": [candidate.debug["source_label"] for candidate in description_candidates],
            "matched": bool(matched_description),
            "join_source": join_source,
            "join_key": join_key,
            "description_binding_key": matched_description.binding_key if matched_description else "",
            "description_expansion_key": matched_description.expansion_key if matched_description else "",
            "description_preview": preview_text(matched_description.text, 260) if matched_description else "",
            "reason": (
                "matched using explicit structural identifier"
                if matched_description
                else "no shared structural identifier between card and description block"
            ),
        })

        try:
            results.append(
                Experience(
                    title=card.title,
                    company_name=card.company_name,
                    employment_type=card.employment_type,
                    location=card.location,
                    work_type=card.work_type,
                    start_date=card.start_date,
                    end_date=card.end_date,
                    duration=card.duration,
                    description=matched_description.text if matched_description else "",
                    skills=[]
                )
            )
        except ValueError as e:
            if debug:
                print(f"[DEBUG] Invalid structured experience skipped ({card.component_key}): {e}")

    debug_block(debug, "FINAL JOIN DECISIONS", join_decisions)
    debug_block(
        debug,
        "PARSED DESCRIPTION BLOCK RECORDS",
        [record.to_trace_dict() for record in description_records]
    )

    if debug:
        write_trace_json({
            "stream_size": len(stream),
            "date_anchors": [
                {
                    "stream_idx": idx,
                    "raw": stream[idx],
                    "start": parsed["start"],
                    "end": parsed["end"],
                    "duration": parsed["duration"],
                }
                for idx, parsed in anchors
            ],
            "detail_anchor_indices": details_anchor_indices,
            "card_records": [record.to_trace_dict() for record in card_records],
            "description_block_records": [record.to_trace_dict() for record in description_records],
            "join_decisions": join_decisions,
        })

    return merge_experience_lists(results)


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
        debug: bool = True,
        dump_raw_payload: bool = False,
        include_raw_in_result: bool = False,
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

        if debug and dump_raw_payload:
            dump_dir = Path(__file__).resolve().parent / "debug"
            dump_dir.mkdir(parents=True, exist_ok=True)
            dump_path = dump_dir / "linkedin_sdui_dump.json"
            dump_path.write_text(
                json.dumps(make_serializable_payload(parsed_data), indent=2, ensure_ascii=False),
                encoding="utf-8"
            )
            print(f"[DEBUG] Raw payload dumped to: {dump_path}")

        experiences_list = parse_experiences_from_stream(parsed_data, debug=debug)
        experiences_dicts = [exp.to_dict() for exp in experiences_list]

        if debug:
            print(f"✅ Stream Parser encontrou {len(experiences_dicts)} experiências.")
            print(
                f"[DEBUG] Trace file saved to: "
                f"{Path(__file__).resolve().parent / 'debug' / 'experience_trace.json'}"
            )

        return {
            "ok": True,
            "experiences": experiences_dicts,
            "raw": make_serializable_payload(parsed_data) if include_raw_in_result else None
        }

    except Exception as e:
        return {"ok": False, "error": str(e), "stage": "execution_error"}


if __name__ == "__main__":
    profile_urn = "urn:li:fsd_profile:ACoAAD016UkBWKGUUWKD7WdA2pTCzevPYoF-xnE"
    vanity = "mateus-bessa-m"
    locale = "en-US"

    result = fetch_linkedin_profile_experiences(
        profile_urn=profile_urn,
        vanity_name=vanity,
        locale=locale,
        start=0,
        count=10,
        debug=True,
        dump_raw_payload=False,
        include_raw_in_result=False,
    )

    debug_dir = Path(__file__).resolve().parent / "debug"
    debug_dir.mkdir(parents=True, exist_ok=True)

    result_path = debug_dir / "linkedin_experiences_result.json"
    result_path.write_text(
        json.dumps(result, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    print("\n===== RESULT =====\n")
    print(json.dumps(result, indent=2, ensure_ascii=False))

    print(f"\nSaved full result to: {result_path}")
