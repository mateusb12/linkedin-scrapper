import re
from typing import Optional, Dict

EN_PATTERNS = [
    r'(\d+)\s*\+\s*years?',
    r'at\s+least\s+(\d+)\s+years?',
    r'minimum\s+(\d+)\s+years?',
    r'(\d+)\s*-\s*(\d+)\s+years?',
    r'(\d+)\s+years?\s+of\s+[\w\s,-]{0,60}\s+experience'
]

PT_PATTERNS = [
    r'(\d+)\s*\+\s*anos?',
    r'm[ií]nimo\s+de\s+(\d+)\s+anos?',
    r'ao\s+menos\s+(\d+)\s+anos?',
    r'(\d+)\s+a\s+(\d+)\s+anos?',
    r'(\d+)\s+anos?\s+de\s+[\w\s,-]{0,60}\s+experi[eê]ncia'
]

ALL_PATTERNS = EN_PATTERNS + PT_PATTERNS


def extract_years_experience(text: str) -> Optional[Dict]:
    if not text:
        return None

    text = text.lower()

    for pattern in ALL_PATTERNS:
        match = re.search(pattern, text)
        if match:
            groups = match.groups()

            if len(groups) == 1:
                return {
                    "min": int(groups[0]),
                    "max": None,
                    "raw": match.group(0)
                }

            if len(groups) == 2:
                return {
                    "min": int(groups[0]),
                    "max": int(groups[1]),
                    "raw": match.group(0)
                }

    return None
