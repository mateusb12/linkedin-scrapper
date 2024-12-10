import time
from selenium.common import TimeoutException, NoSuchElementException, StaleElementReferenceException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from source.core_scrapper.engine import CoreScrapper
from source.core_scrapper.selenium_utils import open_chrome


class FriendsScrapper(CoreScrapper):
    def __init__(self, driver=None, wait_time=10):
        self.driver = open_chrome() if not driver else driver
        super().__init__(
            "https://www.linkedin.com/mynetwork/invite-connect/connections/", self.driver
        )
        self.current_page = 0
        self.wait = WebDriverWait(self.driver, wait_time)
        self.base_url = "https://www.linkedin.com"

    def wait_for_page_load(self):
        try:
            start = time.time()
            self.wait.until(
                EC.presence_of_element_located((By.ID, "compactfooter-copyright"))
            )
            end = time.time()
            print(f"Page fully loaded in {end - start:.2f} seconds.")
        except Exception as e:
            print(f"Error while waiting for page to load: {e}")

    def load_all_connections(self, scroll_pause_time: float = 1.5):
        """
        Continuously scrolls and clicks 'Show more results' until no more results are loaded.
        """
        while True:
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(scroll_pause_time)

            try:
                show_more_button = self.wait.until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, "button.scaffold-finite-scroll__load-button"))
                )
                print("'Show more results' button found. Clicking to load more connections.")
                show_more_button.click()
                time.sleep(scroll_pause_time)
            except NoSuchElementException:
                print("No 'Show more results' button found. All connections should be loaded.")
                break
            except StaleElementReferenceException:
                print("StaleElementReferenceException encountered. Retrying to find the button.")
                try:
                    show_more_button = self.wait.until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, "button.scaffold-finite-scroll__load-button"))
                    )
                    show_more_button.click()
                    time.sleep(scroll_pause_time)
                except Exception as e:
                    print(f"Failed to click 'Show More' after retry: {e}")
                    break
            except TimeoutException:
                print("Timeout while waiting for 'Show more results' button to be clickable.")
                break
            except Exception as e:
                print(f"Unexpected error while clicking 'Show More' button: {e}")
                break

    def scrape_connections(self):
        self.wait_for_page_load()

        self.load_all_connections()

        try:
            connection_links = self.driver.find_elements(
                By.CSS_SELECTOR, "a.mn-connection-card__link.ember-view"
            )

            print(f"Total connection links found: {len(connection_links)}")

            links_list = []
            for link in connection_links:
                href = link.get_attribute("href")
                if href:
                    if href.startswith("/"):
                        full_link = self.base_url + href
                    else:
                        full_link = href
                    links_list.append(full_link)

            print("\nAll connection links:")
            for idx, link in enumerate(links_list, start=1):
                print(f"{idx}. {link}")

            return links_list

        except Exception as e:
            print(f"Error while scraping connections: {e}")

    def close(self):
        self.driver.quit()

def main():
    scrapper = FriendsScrapper()
    try:
        connections_links = scrapper.scrape_connections()
        print(connections_links)
    finally:
        scrapper.close()


if __name__ == "__main__":
    main()
