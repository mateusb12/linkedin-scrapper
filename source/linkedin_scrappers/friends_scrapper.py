from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.wait import WebDriverWait

from source.core_scrapper.engine import CoreScrapper
from source.utils.selenium_utils import load_element_text, get_text_content_from_ul_element
from source.path.file_content_loader import load_userdata_json


class FriendsScrapper(CoreScrapper):
    def __init__(self, wait_time=10):
        super().__init__()
        self.data = self.load_data("linkedin_friend_links.json")
        self.wait = WebDriverWait(self.driver, wait_time)
        self.scrape_all_users()

    def scrape_all_users(self):
        scrapped_data = []
        for index, link in enumerate(self.data, start=1):
            print(f"Scraping user {index} of {len(self.data)}...")
            scrapped_data.append(self.scrape_single_user(link))
        self.save_data(scrapped_data, "linkedin_friend_data.json")

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
        experiences = self.get_text_content_from_ul_xpath("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[5]/div[3]/ul")
        licenses = self.get_text_content_from_ul_xpath("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[7]/div[3]/ul")
        volunteering = self.get_text_content_from_ul_xpath("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[8]/div[3]/ul")
        skills = self.get_all_skills(user_link)

        return {"title": title, "subtitle": subtitle, "company": company, "university": university, "place": place,
                "about": about, "top_skills": top_skills, "experiences": experiences, "licenses": licenses,
                "volunteering": volunteering, "skills": skills}

    def get_all_skills(self, user_link: str):
        anchor_id = "navigation-index-Show-all-52-skills"
        anchor_element = self.driver.find_element(By.ID, anchor_id)
        anchor_element.click()
        main_element = WebDriverWait(self.driver, 10).until(
            expected_conditions.presence_of_element_located((By.CLASS_NAME, "scaffold-finite-scroll__content"))
        )
        ul = main_element.find_element(By.TAG_NAME, 'ul')
        li_elements = ul.find_elements(By.TAG_NAME, 'li')
        skills = []
        for index, li_element in enumerate(li_elements, start=1):
            newline_character_count = li_element.text.count('\n')
            if newline_character_count >= 3:
                skill_name = li_element.text.split('\n')[0]
                skills.append(skill_name)

        self.driver.get(user_link)
        return skills

    def scroll_until_the_bottom(self):
        pass

    def get_text_content_from_ul_xpath(self, ul_xpath: str):
        ul_element = self.driver.find_element(By.XPATH, ul_xpath)
        return get_text_content_from_ul_element(ul_element)


def main():
    fs = FriendsScrapper()
    fs.scrape_single_user('https://www.linkedin.com/in/barbara-perina/')
    return


if __name__ == "__main__":
    main()
