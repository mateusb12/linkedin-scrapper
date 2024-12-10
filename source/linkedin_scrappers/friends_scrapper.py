import time

from selenium.common import StaleElementReferenceException, NoSuchElementException, TimeoutException, \
    ElementClickInterceptedException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.wait import WebDriverWait

from source.core_scrapper.engine import CoreScrapper
from source.core_scrapper.selenium_utils import open_chrome, load_element_text, click_button
from source.path.file_content_loader import load_userdata_json
from source.utils.experience_utils import parse_all_experiences


class FriendsScrapper(CoreScrapper):
    def __init__(self, wait_time=10):
        super().__init__()
        self.data = load_userdata_json("linkedin_friend_links.json")
        self.wait = WebDriverWait(self.driver, wait_time)

    def scrape_single_user(self, user_link: str):
        self.driver.get(user_link)

        element_to_be_rendered_xpath = "/html/body/div[6]/div[3]/div/div/div[2]/div/div/aside/section[2]/div[2]/div/div/div/h2/span[1]"
        self.wait.until(expected_conditions.presence_of_element_located((By.XPATH, element_to_be_rendered_xpath)))

        title_xpath = "/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[1]/div[2]/div[2]/div[1]/div[1]/span[1]/a/h1"
        title = load_element_text(driver=self.driver, selector_type=By.XPATH, selector_value=title_xpath)
        subtitle_xpath = "/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[1]/div[2]/div[2]/div[1]/div[2]"
        subtitle = load_element_text(driver=self.driver, selector_type=By.XPATH, selector_value=subtitle_xpath)
        company_xpath = "/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[1]/div[2]/div[2]/ul/li[1]/button/span/div"
        company = load_element_text(driver=self.driver, selector_type=By.XPATH, selector_value=company_xpath)
        university_xpath = '//*[@id="profile-content"]/div/div[2]/div/div/main/section[1]/div[2]/div[2]/ul/li[2]/button/span/div'
        university = load_element_text(driver=self.driver, selector_type=By.XPATH, selector_value=university_xpath)
        place_xpath = "/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[1]/div[2]/div[2]/div[2]/span[1]"
        place = load_element_text(driver=self.driver, selector_type=By.XPATH, selector_value=place_xpath)
        about_xpath = "/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[3]/div[3]/div/div/div/span[1]"
        about = load_element_text(driver=self.driver, selector_type=By.XPATH, selector_value=about_xpath)
        top_skills_container_xpath = "/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[3]/div[4]/div/ul/li/div/div/div[2]/div/div/div[2]/div/div/span[1]"
        top_skills_container = self.driver.find_element(By.XPATH, top_skills_container_xpath)
        top_skills = top_skills_container.text
        experiences = self.get_text_content_from_ul("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[5]/div[3]/ul")
        licenses = self.get_text_content_from_ul("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[7]/div[3]/ul")
        volunteering = self.get_text_content_from_ul("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[8]/div[3]/ul")

        return {"title": title, "subtitle": subtitle, "company": company, "university": university, "place": place,
                "about": about, "top_skills": top_skills, "experiences": experiences}

    def get_text_content_from_ul(self, ul_xpath: str):
        ul_element = self.driver.find_element(By.XPATH, ul_xpath)
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


def main():
    fs = FriendsScrapper()
    fs.scrape_single_user('https://www.linkedin.com/in/barbara-perina/')
    return


if __name__ == "__main__":
    main()
