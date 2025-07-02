import json
import os

from path.path_reference import get_userdata_path, get_data_folder_path, get_pagination_folder_path


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


def load_pagination_file(filename: str) -> dict:
    pagination_folder_path = get_pagination_folder_path()
    file_path = pagination_folder_path / filename

    if not file_path.exists():
        raise FileNotFoundError(f"File '{file_path}' does not exist.")

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not data:
        raise ValueError(f"File '{file_path}' is empty or contains no valid JSON.")

    return data


def load_db_path():
    basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
    db_dir = os.path.join(basedir, "database")
    os.makedirs(db_dir, exist_ok=True)
    return os.path.join(db_dir, "linkedin.db")


def main():
    db_path = load_db_path()
    print(f"Database path: {db_path}")


if __name__ == "__main__":
    main()
