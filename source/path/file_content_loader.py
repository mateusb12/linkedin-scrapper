import json

from source.path.path_reference import get_userdata_path


def load_userdata_json(filename: str) -> dict:
    userdata_path = get_userdata_path()
    with open(userdata_path / filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data