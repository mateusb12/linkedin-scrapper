import time

from selenium.common import NoSuchElementException, TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.wait import WebDriverWait

from linkedin import CoreScrapper
from models.recommendation import Recommendation
from utils.experience_utils import clean_experiences
from utils.selenium_utils import load_element_text, get_text_content_from_ul_element


class FriendsScrapper(CoreScrapper):
    def __init__(self, wait_time=10):
        super().__init__()
        self.data = self.load_data("linkedin_friend_links.json")
        self.wait = WebDriverWait(self.driver, wait_time)
        self.current_index = 0
        self.scrape_all_users()

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
        about_xpath = "/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/section[3]/div[3]/div/div/div/span[1]"
        try:
            about_element = self.driver.find_element(By.XPATH, about_xpath)
            about = about_element.text
        except NoSuchElementException:
            about = ""
        top_skills = self.get_top_skills()
        raw_experiences = self.get_text_content_from_ul_xpath("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/"
                                                              "section[5]/div[3]/ul")
        experiences = clean_experiences(raw_experiences) if raw_experiences else None
        licenses = self.get_text_content_from_ul_xpath("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/"
                                                       "section[7]/div[3]/ul")
        volunteering = self.get_text_content_from_ul_xpath("/html/body/div[6]/div[3]/div/div/div[2]/div/div/main/"
                                                           "section[8]/div[3]/ul")

        recommendations = self.get_recommendations()

        skills = self.get_all_skills(user_link)

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
        self.driver.get(self.driver.current_url.rstrip('/') + '/details/recommendations/?detailScreenTabIndex=0')

        ul_path = "/html/body/div[5]/div[3]/div/div/div[2]/div/div/main/section/div[2]/div[2]/div/div/div[1]/ul"
        try:
            self.scroll_until_the_bottom()
            time.sleep(1)
            ul_element = self.wait.until(expected_conditions.visibility_of_element_located((By.XPATH, ul_path)))
        except TimeoutException:
            print("Timed out waiting for the recommendations element to load.")
            return

        try:
            li_elements = ul_element.find_elements(By.TAG_NAME, "li")
            li_example = li_elements[0]
            li_example_children = li_example.find_elements(By.XPATH, "./div/child::*[last()]/div[2]/div")

            person_name = li_example_children[0].find_element(By.XPATH, "./a/div/div/div/div/span").text
            person_titles = li_example_children[0].find_element(By.XPATH, "./a/span[1]/span").text
            person_worked_with = li_example_children[0].find_element(By.XPATH, "./a/span[2]/span[1]").text
            recommendation_description = li_example_children[1].find_element(By.XPATH,
                                                                             "./ul/li/div/ul/li/div/div/div/span").text

            return Recommendation(
                recommender_name=person_name,
                recommender_job=person_titles,
                recommender_worked_with_date=person_worked_with,
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
    res = fs.scrape_single_user('https://www.linkedin.com/in/amanda-zanin/')
    return


if __name__ == "__main__":
    main()
