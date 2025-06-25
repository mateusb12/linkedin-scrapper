from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as ec
from selenium.webdriver.support.ui import WebDriverWait

from backend.core_scrapper.engine import CoreScrapper


class AppliedJobsScrapper(CoreScrapper):
    def __init__(self, driver=None):
        super().__init__(driver)
        url = "https://www.linkedin.com/my-items/saved-jobs/?cardType=APPLIED"
        self.driver.get(url)
        self.current_page = 0

    def collect_data_from_current_page(self):
        print("Collecting LinkedIn-specific data...")
        search_containers = WebDriverWait(self.driver, 10).until(
            ec.presence_of_all_elements_located((By.CLASS_NAME, "reusable-search__result-container"))
        )

        for index, container in enumerate(search_containers):
            try:
                title_span = container.find_element(By.CLASS_NAME, "entity-result__title-text")
                anchor_text = title_span.find_element(By.TAG_NAME, "a").text
                subtitle_text = container.find_element(By.CSS_SELECTOR, "[data-test-entity-subtitle]").text
                secondary_subtitle_text = container.find_element(By.CSS_SELECTOR, "[data-test-secondary-subtitle]").text
                timestamp_text = container.find_element(By.CLASS_NAME, "reusable-search-simple-insight__text").text

                print(f"Container {index + 1} Anchor Text: [{anchor_text}]")
                print(f"Container {index + 1} Subtitle Text: [{subtitle_text}]")
                print(f"Container {index + 1} Secondary Subtitle Text: [{secondary_subtitle_text}]")
                print(f"Container {index + 1} Timestamp Text: [{timestamp_text}]")
                print("\n")
            except Exception as e:
                print(f"Error in container {index + 1}: {e}")

    def browse_next_page(self):
        self.current_page = (self.current_page - 1) * 10
        next_page_url = f"https://www.linkedin.com/my-items/saved-jobs/?cardType=APPLIED&page={self.current_page}"
        self.driver.get(next_page_url)
        self.collect_data_from_current_page()


def main():
    linkedin_scrapper = AppliedJobsScrapper()
    linkedin_scrapper.save_cookies()
    print("Done!")


if __name__ == '__main__':
    main()
