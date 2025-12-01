import re
from datetime import datetime

import requests

from path.file_content_loader import load_cookie_value


def fetch_job_timestamp(job_id: str = "4275393151"):
    """
    Fetches the raw response from a LinkedIn job posting detail API endpoint
    for a specific job ID.

    Args:
        job_id (str): The LinkedIn job ID to fetch details for.
                      Defaults to '4275393151'.
    """
    job_urn = f"urn%3Ali%3Afsd_jobPosting%3A{job_id}"

    url = (
        f"https://www.linkedin.com/voyager/api/graphql?variables=(cardSectionTypes:List(TOP_CARD,HOW_YOU_FIT_CARD),"
        f"jobPostingUrn:{job_urn},includeSecondaryActionsV2:true,jobDetailsContext:(isJobSearch:false))"
        "&queryId=voyagerJobsDashJobPostingDetailSections.5b0469809f45002e8d68c712fd6e6285"
    )

    headers = {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'accept-language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
        'csrf-token': 'ajax:2584240299603910567',
        'dnt': '1',
        'priority': 'u=1, i',
        'referer': f'https://www.linkedin.com/jobs/view/{job_id}/',
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
        'x-li-page-instance': 'urn:li:page:d_flagship3_job_details;7rFd7xHhRe2KEDoJvpEWiw==',
        'x-li-pem-metadata': 'Voyager - Careers - Job Details=top-card-section-fetch,Voyager - Careers - Critical - '
                             'careers-api=top-card-section-fetch',
        'x-li-track': '{"clientVersion":"1.13.37865","mpVersion":"1.13.37865","osName":"web","timezoneOffset":-3,'
                      '"timezone":"America/Fortaleza","deviceFormFactor":"DESKTOP","mpName":"voyager-web",'
                      '"displayDensity":1,"displayWidth":1920,"displayHeight":1080}',
        'x-restli-protocol-version': '2.0.0',
        'Cookie': None,
    }

    response = requests.get(url, headers=headers)
    raw_json = response.text
    match = re.search(r'"epochAt"\s*:\s*(\d+)', raw_json)
    if match:
        epoch_value = int(match.group(1))
        dt = datetime.fromtimestamp(epoch_value / 1000)
        return dt


def main():
    job_id = "4275393151"  # Example job ID
    epoch_value = fetch_job_timestamp(job_id)
    if epoch_value:
        print(f"Epoch value for job ID {job_id}: {epoch_value}")
    else:
        print(f"No epoch value found for job ID {job_id}")


if __name__ == "__main__":
    main()
