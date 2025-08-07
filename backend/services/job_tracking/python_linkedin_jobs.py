import re
import math
import time
import requests
from typing import List, Dict, Any, Optional, Tuple

from path.file_content_loader import load_cookie_value
from services.job_tracking.linkedin_find_timestamp import fetch_job_timestamp
from utils.date_parser import format_datetime_pt_br


def setup_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'accept-language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
        'csrf-token': 'ajax:2584240299603910567',
        'priority': 'u=1, i',
        'referer': 'https://www.linkedin.com/my-items/saved-jobs/',
        'sec-ch-prefers-color-scheme': 'dark',
        'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-li-lang': 'en_US',
        'x-li-page-instance': 'urn:li:page:d_flagship3_myitems_savedjobs;gGeMib0KRoGTbXxHpSSTfg==',
        'x-li-pem-metadata': 'Voyager - My Items=myitems-saved-jobs',
        'x-li-track': '{"clientVersion":"1.13.37702","mpVersion":"1.13.37702","osName":"web","timezoneOffset":-3,'
                      '"timezone":"America/Fortaleza","deviceFormFactor":"DESKTOP","mpName":"voyager-web",'
                      '"displayDensity":1,"displayWidth":1920,"displayHeight":1080}',
        'x-restli-protocol-version': '2.0.0',
        'Cookie': load_cookie_value(),
    })
    return session


def _parse_page_data(page_json: Dict[str, Any]) -> List[Dict[str, str]]:
    structured_jobs = []
    for item in page_json.get('included', []):
        if item.get('$type') == 'com.linkedin.voyager.dash.search.EntityResultViewModel':
            url = item.get('navigationUrl', 'N/A')
            match = re.search(r'/jobs/view/(\d+)', url)
            urn_id = f"urn:li:jobPosting:{match.group(1)}" if match else 'N/A'

            job = {
                'title': item.get('title', {}).get('text', 'N/A').strip(),
                'company': item.get('primarySubtitle', {}).get('text', 'N/A').strip(),
                'location': item.get('secondarySubtitle', {}).get('text', 'N/A').strip(),
                'url': url,
                'status': 'N/A',
                'urn': urn_id
            }

            insights = item.get('insightsResolutionResults', [])
            if insights and isinstance(insights, list):
                job['status'] = insights[0].get('simpleInsight', {}).get('title', {}).get('text', 'N/A').strip()
                job_number = urn_id.split(':')[-1]
                job_datetime_obj = fetch_job_timestamp(job_number)
                job["timestamp"] = job_datetime_obj.isoformat()
                job["formattedTimestamp"] = format_datetime_pt_br(job_datetime_obj)

            structured_jobs.append(job)

    return structured_jobs


def _get_initial_data(session: requests.Session, page_size: int) -> Optional[Tuple[int, Dict[str, Any]]]:
    print("Fetching first page to get total job count...")
    initial_url = (
        "https://www.linkedin.com/voyager/api/graphql?variables=(start:0,query:("
        "flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))&queryId=voyagerSearchDashClusters"
        ".5ba32757c00b31aea747c8bebb92855c"
    )
    try:
        response = session.get(initial_url)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Error on initial request: {e}")
        return None

    total_jobs = data.get('data', {}).get('data', {}).get('searchDashClustersByAll', {}).get('paging', {}).get('total',
                                                                                                               0)
    if total_jobs == 0:
        print("No saved jobs found.")
        return None

    num_pages = math.ceil(total_jobs / page_size)
    print(f"✅ Found {total_jobs} jobs across {num_pages} pages.")
    return total_jobs, data


def fetch_all_linkedin_jobs() -> List[Dict[str, str]]:
    from repository.job_repository import JobRepository
    job_repo = JobRepository()
    page_size = 10
    session = setup_session()
    initial_data_tuple = _get_initial_data(session, page_size)
    if not initial_data_tuple:
        return []

    total_jobs, first_page_data = initial_data_tuple
    all_jobs = []

    print(f"\n--- Parsing page 1 ---")
    all_jobs.extend(_parse_page_data(first_page_data))

    for start_index in range(page_size, total_jobs, page_size):
        current_page = (start_index // page_size) + 1
        print(f"\n--- Fetching and parsing page {current_page} ---")

        current_page_url = (
            f"https://www.linkedin.com/voyager/api/graphql?variables=(start:{start_index},query:("
            f"flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))&queryId=voyagerSearchDashClusters"
            f".5ba32757c00b31aea747c8bebb92855c"
        )
        try:
            time.sleep(1)
            response = session.get(current_page_url)
            response.raise_for_status()
            page_data = response.json()
            parsed_page_data = _parse_page_data(page_data)
            job_urn_list = [item["urn"] for item in parsed_page_data]
            existing_job_match = job_repo.get_multiple_jobs_by_urn_list(job_urn_list)
            job_map = {item["urn"]: item for item in parsed_page_data}
            new_jobs = {key: value for key, value in existing_job_match.items() if not value}
            for key, value in new_jobs.items():
                if not value:
                    print(f"New job found: {key}")
                    job_to_be_added_data = job_map.get(key, {})
                    job_repo.add_job_by_dict(job_to_be_added_data)
            all_jobs.extend(parsed_page_data)
        except requests.exceptions.RequestException as e:
            print(f"❌ Error on page {current_page}: {e}. Skipping.")
            continue

    return all_jobs


def main():
    print("--- Starting LinkedIn Job Scraper ---")
    jobs = fetch_all_linkedin_jobs()
    for job in jobs:
        print(job)
    print(f"\n--- ✨ Successfully processed {len(jobs)} jobs in total. ---")


if __name__ == "__main__":
    main()
