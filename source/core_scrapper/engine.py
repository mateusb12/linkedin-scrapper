import json
from pathlib import Path
from typing import Any, Tuple, Optional

from selenium.common import TimeoutException
from selenium.webdriver.support.wait import WebDriverWait

from source.utils.selenium_utils import open_chrome, export_cookies
from source.path.path_reference import get_root_folder_path
from selenium.webdriver.support import expected_conditions


class CoreScrapper:
    def __init__(self, driver=None):
        self.default_wait_time = 10
        self.driver = driver if driver else open_chrome()
        self.subfolder = 'userdata'

    def save_cookies(self):
        export_cookies(self.driver)

    def save_data(self, data: Any, filename: str):
        script_directory = get_root_folder_path()
        data_folder = Path(script_directory) / self.subfolder
        data_folder.mkdir(parents=True, exist_ok=True)

        file_path = data_folder / filename
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"Data stored in {file_path}")

    def load_data(self, filename: str):
        """
        Retrieve previously stored JSON data from the persistent folder.
        If the file does not exist, return None or an empty structure.
        """
        script_directory = get_root_folder_path()
        file_path = Path(script_directory) / self.subfolder / filename

        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            print(f"Data retrieved from {file_path}")
            return data
        else:
            print(f"No existing data found at {file_path}")
            return None
        
    def wait_for_element(self, locator: Tuple, timeout: Optional[int] = None):
        """
        Wait for an element to be present on the page.
        :param locator: A tuple like (By.XPATH, xpath_value)
        :param timeout: Optional timeout (in seconds). Defaults to self.default_wait_time.
        :return: The WebElement if found, else None.
        """
        wait_time = timeout if timeout else self.default_wait_time
        wait = WebDriverWait(self.driver, wait_time)
        try:
            return wait.until(expected_conditions.presence_of_element_located(locator))
        except TimeoutException:
            return None

    def __del__(self):
        try:
            self.save_cookies()
        finally:
            if self.driver:
                self.driver.quit()


def main():
    core_scrapper = CoreScrapper()
    core_scrapper.save_cookies()
    print("Done!")


if __name__ == '__main__':
    main()