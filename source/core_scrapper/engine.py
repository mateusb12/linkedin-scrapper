from boltons.iterutils import first
from selenium import webdriver
from selenium.webdriver.common.by import By

from source.core_scrapper.selenium_utils import open_chrome, export_cookies
from selenium.webdriver.support import expected_conditions as ec
from selenium.webdriver.support.ui import WebDriverWait


class CoreScrapper:
    def __init__(self, base_url, driver=None):
        self.driver = driver if driver else open_chrome()
        self.driver.get(base_url)

    def save_cookies(self):
        export_cookies(self.driver)

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