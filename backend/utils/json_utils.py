import json
from pathlib import Path
from typing import Any


def save_json_local(data: dict[str, Any], filename: str = "file.json", indent: int = 2) -> Path:
    output_path = Path.cwd() / filename
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
    return output_path
