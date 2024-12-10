from boltons.iterutils import first
from selenium import webdriver
from selenium.webdriver.common.by import By

from source.core_scrapper.selenium_utils import open_chrome, export_cookies
from selenium.webdriver.support import expected_conditions as ec
from selenium.webdriver.support.ui import WebDriverWait


class CoreScrapper:
    def __init__(self, driver: webdriver.Chrome = None):
        self.driver = driver if driver else open_chrome()
        self.current_page = 1
        self.driver.get("https://www.linkedin.com/my-items/saved-jobs/?cardType=APPLIED")
        # self.collect_data_from_current_page()
        return

    def save_cookies(self):
        export_cookies(self.driver)

    def collect_data_from_current_page(self):
        print("Collecting data from current page...")
        search_containers = WebDriverWait(self.driver, 10).until(
            ec.presence_of_all_elements_located((By.CLASS_NAME, "reusable-search__result-container"))
        )

        for index, container in enumerate(search_containers):
            try:
                # Find the span with class `entity-result__title-text`
                title_span = container.find_element(By.CLASS_NAME, "entity-result__title-text")
                subtitle_div = container.find_element(By.XPATH,
                                                      "/html/body/div[5]/div[3]/div/main/section/div/div[2]/div/ul/li[1]/div/div/div/div[2]/div[1]/div[2]")
                secondary_subtitle_div = container.find_element(By.XPATH,
                                                                "/html/body/div[5]/div[3]/div/main/section/div/div[2]/div/ul/li[1]/div/div/div/div[2]/div[1]/div[3]")
                timestamp_div = container.find_element(By.CLASS_NAME, "reusable-search-simple-insight__text")

                anchor_text = title_span.find_element(By.TAG_NAME, "a").text
                subtitle_text = subtitle_div.text
                secondary_subtitle_text = secondary_subtitle_div.text
                timestamp_text = timestamp_div.text
                print(f"Container {index + 1} Anchor Text: [{anchor_text}]")
                print(f"Container {index + 1} Subtitle Text: [{subtitle_text}]")
                print(f"Container {index + 1} Secondary Subtitle Text: [{secondary_subtitle_text}]")
                print(f"Container {index + 1} Timestamp Text: [{timestamp_text}]")
                print("\n")
            except Exception as e:
                print(f"Error in container {index + 1}: {e}")

    def browse_next_page(self):
        next_page_tag = (self.current_page - 1) * 10
        next_page_url = f"https://www.linkedin.com/my-items/saved-jobs/?cardType=APPLIED&page={next_page_tag}"
        self.driver.get(next_page_url)
        self.collect_data_from_current_page()
        self.current_page += 1

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