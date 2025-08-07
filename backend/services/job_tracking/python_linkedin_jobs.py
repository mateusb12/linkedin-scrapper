import requests
import math
import time
from typing import List, Dict, Any

from path.file_content_loader import load_cookie_value


# -----------------------------------------

def fetch_all_jobs_data() -> Dict[str, Any]:
    """
    Fetches all pages of saved job data from the LinkedIn API by handling pagination.
    """
    # Use a session object to persist headers and cookies across requests
    session = requests.Session()
    session.headers.update({
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'accept-language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
        'csrf-token': 'ajax:2584240299603910567',  # Note: This might need to be dynamic
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
        'Cookie': load_cookie_value()
    })

    page_size = 10
    all_included_items = []

    # 1. Initial request to get the total number of jobs
    try:
        print("Fetching first page to get total count...")
        initial_url = (f"https://www.linkedin.com/voyager/api/graphql?variables=(start:0,query:("
                       f"flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))&queryId=voyagerSearchDashClusters"
                       f".5ba32757c00b31aea747c8bebb92855c")
        response = session.get(initial_url)
        response.raise_for_status()
        initial_data = response.json()

        # Safely access the total number of jobs
        total_jobs = initial_data.get('data', {}).get('data', {}).get('searchDashClustersByAll', {}).get('paging',
                                                                                                         {}).get(
            'total', 0)

        if total_jobs == 0:
            print("No saved jobs found.")
            return {}

        num_pages = math.ceil(total_jobs / page_size)
        print(f"✅ Found {total_jobs} jobs across {num_pages} pages.")

        if 'included' in initial_data:
            all_included_items.extend(initial_data['included'])

    except requests.exceptions.RequestException as e:
        print(f"An error occurred during the initial request: {e}")
        return {}
    except (KeyError, TypeError) as e:
        print(f"Could not parse total job count from response: {e}")
        return initial_data  # Return first page data if pagination fails

    # 2. Loop through the remaining pages
    for start_index in range(page_size, total_jobs, page_size):
        current_page = (start_index // page_size) + 1
        print(f"Fetching page {current_page}/{num_pages}...")

        page_url = (f"https://www.linkedin.com/voyager/api/graphql?variables=(start:{start_index},query:("
                    f"flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))&queryId=voyagerSearchDashClusters"
                    f".5ba32757c00b31aea747c8bebb92855c")

        try:
            # Add a small delay to be respectful to the server
            time.sleep(1)

            response = session.get(page_url)
            response.raise_for_status()
            page_data = response.json()
            if 'included' in page_data:
                all_included_items.extend(page_data['included'])

        except requests.exceptions.RequestException as e:
            print(f"An error occurred on page {current_page}: {e}")
            continue  # Skip to the next page on error

    return {'included': all_included_items}


def parse_jobs_data(response_json: Dict[str, Any]) -> List[Dict[str, str]]:
    # This function remains unchanged, as it processes the final aggregated data
    structured_jobs = []
    if not response_json or 'included' not in response_json:
        return structured_jobs

    for item in response_json.get('included', []):
        if item.get('$type') == 'com.linkedin.voyager.dash.search.EntityResultViewModel':
            job = {
                'title': item.get('title', {}).get('text', 'N/A').strip(),
                'company': item.get('primarySubtitle', {}).get('text', 'N/A').strip(),
                'location': item.get('secondarySubtitle', {}).get('text', 'N/A').strip(),
                'url': item.get('navigationUrl', 'N/A'),
                'status': 'N/A'  # Default status
            }
            # Safely access the status
            insights = item.get('insightsResolutionResults', [])
            if insights and isinstance(insights, list) and len(insights) > 0:
                job['status'] = insights[0].get('simpleInsight', {}).get('title', {}).get('text', 'N/A').strip()

            structured_jobs.append(job)

    return structured_jobs


def get_linkedin_applied_jobs() -> List[Dict[str, str]]:
    """Orchestrator function to fetch and parse all jobs."""
    # This function now calls the new fetching function
    response_data = fetch_all_jobs_data()
    if not response_data:
        return []
    return parse_jobs_data(response_data)


def main():
    jobs = get_linkedin_applied_jobs()
    print(f"\n--- Successfully parsed {len(jobs)} jobs ---\n")
    for job in jobs:
        print(job)


if __name__ == "__main__":
    main()