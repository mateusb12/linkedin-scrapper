import time

from selenium.common import NoSuchElementException, TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.wait import WebDriverWait

from source.core_scrapper.engine import CoreScrapper
from source.models.recommendation import Recommendation
from source.utils.experience_utils import clean_experiences
from source.utils.selenium_utils import load_element_text, get_text_content_from_ul_element
from source.path.file_content_loader import load_userdata_json


class FriendsScrapper(CoreScrapper):
    def __init__(self, wait_time=10):
        super().__init__()
        self.data = self.load_data("linkedin_friend_links.json")
        self.wait = WebDriverWait(self.driver, wait_time)
        self.current_index = 0
        # self.scrape_all_users()

    def scrape_all_users(self):
        scrapped_data = []
        start = time.time()
        for index, link in enumerate(self.data, start=1):
            self.current_index = index
            total_users = len(self.data)
            remaining_users = len(self.data) - index
            time_so_far = time.time() - start
            current_speed = index / time_so_far if time_so_far != 0 else 0
            eta = remaining_users / current_speed if current_speed != 0 else 0
            formatted_eta = time.strftime("%H:%M:%S", time.gmtime(eta))
            time_per_user = time_so_far / index
            print(f"{index}/{total_users}, Time per user: {time_per_user:.2f}s, ETA: {formatted_eta}, [Link] → {link}")
            user_data = self.scrape_single_user(link)
            scrapped_data.append(user_data)
        self.save_data(scrapped_data, "linkedin_friend_data.json")

    def scrape_single_user(self, user_link: str):
        self.driver.get(user_link)

        element_to_be_rendered_xpath = ("/html/body/div[6]/div[3]/div/div/div[2]/div/div/aside/"
                                        "section[2]/div[2]/div/div/div/h2/span[1]")

        if not self.wait_for_element((By.XPATH, element_to_be_rendered_xpath)):
            print("Element not found within the specified time.")

        self.scroll_until_the_bottom()

        title_xpath = ("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/"
                       "section[1]/div[2]/div[2]/div[1]/div[1]/span[1]/a/h1")
        title = load_element_text(driver=self.driver, selector_type=By.XPATH, selector_value=title_xpath)
        subtitle_xpath = ("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/"
                          "section[1]/div[2]/div[2]/div[1]/div[2]")
        subtitle = load_element_text(driver=self.driver, selector_type=By.XPATH, selector_value=subtitle_xpath)
        company_xpath = ("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/"
                         "section[1]/div[2]/div[2]/ul/li[1]/button/span/div")
        company = load_element_text(driver=self.driver, selector_type=By.XPATH, selector_value=company_xpath)
        university_xpath = ('//*[@id="profile-content"]/div/div[2]/div/div/main/'
                            'section[1]/div[2]/div[2]/ul/li[2]/button/span/div')
        university = load_element_text(driver=self.driver, selector_type=By.XPATH, selector_value=university_xpath)
        place_xpath = "/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[1]/div[2]/div[2]/div[2]/span[1]"
        place = load_element_text(driver=self.driver, selector_type=By.XPATH, selector_value=place_xpath)
        all_profile_sections_xpath = ("//section[contains(@class, 'artdeco-card') and "
                                      "contains(@class, 'pv-profile-card') and contains(@class, 'break-words')]")
        all_sections = self.driver.find_elements(By.XPATH, all_profile_sections_xpath)
        section_texts = [item.text for item in all_sections]
        about = next((text for text in section_texts if text.startswith("About\nAbout\n")), None)
        top_skills = self.get_top_skills()
        raw_experiences = self.get_text_content_from_ul_xpath("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/"
                                                              "section[5]/div[3]/ul")
        experiences = clean_experiences(raw_experiences) if raw_experiences else None
        licenses = self.get_text_content_from_ul_xpath("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/"
                                                       "section[7]/div[3]/ul")
        volunteering = self.get_text_content_from_ul_xpath("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/"
                                                           "section[8]/div[3]/ul")
        skills = self.get_all_skills(user_link)

        recommendations = self.get_recommendations()

        return {"title": title, "subtitle": subtitle, "company": company, "university": university, "place": place,
                "about": about, "top_skills": top_skills, "experiences": experiences, "licenses": licenses,
                "volunteering": volunteering, "skills": skills, "recommendations": recommendations}

    def get_top_skills(self):
        top_skills = None
        try:
            top_skills_container_xpath = ("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/"
                                          "section[3]/div[4]/div/ul/li/div/div/div[2]/div/div/div[2]/div/div/span[1]")
            top_skills_container = self.driver.find_element(By.XPATH, top_skills_container_xpath)
            top_skills = top_skills_container.text
        except NoSuchElementException:
            pass
        return top_skills

    def get_all_skills(self, user_link: str):
        self.driver.get(f"{user_link}/details/skills/")
        main_element = self.wait_for_element((By.CLASS_NAME, "scaffold-finite-scroll__content"))
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

    def get_recommendations(self):
        ul_path = "/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[10]/div[3]/div[2]/div/ul"
        ul_element = self.wait_for_element((By.XPATH, ul_path))

        try:
            li_elements = ul_element.find_elements(By.TAG_NAME, "li")
            li_example = li_elements[0]
            li_example_children = li_example.find_elements(By.XPATH, "./*/child::*[last()]/*[1]/*/*")

            recommender_name = li_example_children[0].find_element(By.XPATH, "./*[1]/*/*/*").text
            recommender_job = li_example_children[1].find_element(By.XPATH, "./*").text
            recommender_worked_with_date = li_example_children[2].find_element(By.XPATH, "./*").text
            recommendation_description = li_example.find_element(By.TAG_NAME, "ul").text

            return Recommendation(
                recommender_name=recommender_name,
                recommender_job=recommender_job,
                recommender_worked_with_date=recommender_worked_with_date,
                recommendation_description=recommendation_description
            )
        except (NoSuchElementException, IndexError) as e:
            print(f"Error extracting recommendation details: {e}")
            return None

    def scroll_until_the_bottom(self):
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")

    def get_text_content_from_ul_xpath(self, ul_xpath: str):
        try:
            ul_element = self.driver.find_element(By.XPATH, ul_xpath)
        except NoSuchElementException:
            return None
        return get_text_content_from_ul_element(ul_element)


def main():
    fs = FriendsScrapper()
    res = fs.scrape_single_user('https://www.linkedin.com/in/barbara-perina/')
    return


if __name__ == "__main__":
    main()
