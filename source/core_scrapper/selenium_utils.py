import json
from pathlib import Path

from source.path.path_reference import get_root_folder_path, get_data_folder_path
from selenium.webdriver.chrome.options import Options
from selenium import webdriver


def open_chrome():
    print("Opening Chrome...")
    script_directory = get_root_folder_path()
    chrome_options = Options()
    chrome_options.add_argument(f"user-data-dir={script_directory}\\userdata")
    return webdriver.Chrome(options=chrome_options)


def export_cookies(driver: webdriver.Chrome):
    cookies = driver.get_cookies()
    cookies_path = Path(get_data_folder_path(), "cookies.json")
    with open(cookies_path, "w") as f:
        json.dump(cookies, f)
    print("Cookies exported successfully.")


def load_cookies(input_path: Path) -> dict:
    # json_path: Path = get_hubspot_cookies_file_path()
    if not input_path.exists():
        raise FileNotFoundError(f"File not found: {input_path}")
    with open(input_path) as f:
        cookies_list = json.load(f)

    # Convert list of cookies to a dictionary with cookie names as keys and values as values
    cookies = {cookie['name']: cookie['value'] for cookie in cookies_list}
    return cookies