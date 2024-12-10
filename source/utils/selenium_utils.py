import json
from pathlib import Path

from selenium.common import NoSuchElementException
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement

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

def load_element_text(driver: webdriver.Chrome, selector_type: By, selector_value: str) -> str:
    try:
        element = driver.find_element(selector_type, selector_value)
        return element.text
    except NoSuchElementException:
        return "Element not found"

def click_button(driver: webdriver.Chrome, selector_type: By, selector_value: str):
    try:
        button = driver.find_element(selector_type, selector_value)
        button.click()
    except NoSuchElementException:
        print("Button not found")


def get_text_content_from_ul_element(ul_element: WebElement):
    li_elements = ul_element.find_elements(By.TAG_NAME, 'li')

    seen_experiences = set()
    experiences = []

    for index, li_element in enumerate(li_elements, start=1):
        element_text = li_element.text
        lines = element_text.split('\n')
        unique_lines = tuple(sorted(set(line.strip() for line in lines if line.strip())))
        if unique_lines and unique_lines not in seen_experiences:
            experiences.append(unique_lines)
            seen_experiences.add(unique_lines)

    return [list(item) for item in experiences if item]
