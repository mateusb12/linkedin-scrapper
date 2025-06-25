import json

from backend.path.path_reference import get_userdata_path, get_data_folder_path


def load_userdata_json(filename: str) -> dict:
    userdata_path = get_userdata_path()
    with open(userdata_path / filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data


def load_curl_file(filename: str) -> str:
    data_folder_path = get_data_folder_path()
    file_path = data_folder_path / filename

    if not file_path.exists():
        raise FileNotFoundError(f"File '{file_path}' does not exist.")

    with open(file_path, 'r', encoding='utf-8') as f:
        data = f.read().strip()

    if not data:
        raise ValueError(f"File '{file_path}' is empty.")

    return data
