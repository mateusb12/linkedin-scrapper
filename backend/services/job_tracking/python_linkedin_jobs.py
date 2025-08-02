import requests
from typing import List, Dict, Any

from path.file_content_loader import load_cookie_value


def fetch_jobs_data() -> Dict[str, Any]:
    """
    Fetches job data from the LinkedIn API.

    Reads a cookie from 'linkedin_cookie.txt' to authenticate the request.
    """
    url = ("https://www.linkedin.com/voyager/api/graphql?variables=(start:0,query:("
           "flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))&queryId=voyagerSearchDashClusters"
           ".5ba32757c00b31aea747c8bebb92855c")

    # try:
    #     with open("linkedin_cookie.txt", "r", encoding="utf-8") as f:
    #         cookie_value = f.read().strip()
    # except FileNotFoundError:
    #     print("Error: 'linkedin_cookie.txt' not found.")
    #     return {}

    cookie_value = load_cookie_value()

    headers = {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'accept-language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
        'csrf-token': 'ajax:2584240299603910567',
        'dnt': '1',
        'priority': 'u=1, i',
        'referer': 'https://www.linkedin.com/my-items/saved-jobs/',
        'sec-ch-prefers-color-scheme': 'dark',
        'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
                      'Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
        'x-li-lang': 'en_US',
        'x-li-page-instance': 'urn:li:page:d_flagship3_myitems_savedjobs;gGeMib0KRoGTbXxHpSSTfg==',
        'x-li-pem-metadata': 'Voyager - My Items=myitems-saved-jobs',
        'x-li-track': '{"clientVersion":"1.13.37702","mpVersion":"1.13.37702","osName":"web","timezoneOffset":-3,'
                      '"timezone":"America/Fortaleza","deviceFormFactor":"DESKTOP","mpName":"voyager-web",'
                      '"displayDensity":1,"displayWidth":1920,"displayHeight":1080}',
        'x-restli-protocol-version': '2.0.0',
        'Cookie': cookie_value
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"An error occurred during the request: {e}")
        return {}


def parse_jobs_data(response_json: Dict[str, Any]) -> List[Dict[str, str]]:
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
                'status': item.get('insightsResolutionResults', [{}])[0]
                            .get('simpleInsight', {})
                            .get('title', {})
                            .get('text', 'N/A')
                            .strip()
            }
            structured_jobs.append(job)

    return structured_jobs


def get_linkedin_applied_jobs() -> List[Dict[str, str]]:
    response_data = fetch_jobs_data()
    if not response_data:
        return []
    return parse_jobs_data(response_data)


def main():
    jobs = get_linkedin_applied_jobs()
    for job in jobs:
        print(job)


if __name__ == "__main__":
    main()
