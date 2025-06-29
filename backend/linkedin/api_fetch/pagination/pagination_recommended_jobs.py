import json
import requests
import re
from dataclasses import dataclass, asdict
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Tuple


# --- Dataclass Definitions for Structured Output ---
# These dataclasses define the final, clean structure for the job data.

@dataclass
class Paging:
    """Contains pagination information for the job list."""
    count: int
    start: int
    total: int


@dataclass
class Metadata:
    """Contains metadata about the search results."""
    resultsCountHeader: str
    resultsCountHeaderWithTotal: str


@dataclass
class Company:
    """Represents a company posting a job."""
    urn: str
    name: str
    logo_url: Optional[str]


@dataclass
class Geo:
    """Represents a geographical location."""
    urn: str
    name: str


@dataclass
class JobSeekerState:
    """Tracks the user's interaction with a job (e.g., saved, applied)."""
    job_card_urn: str
    is_saved: bool
    is_applied: bool


@dataclass
class JobPostingSummary:
    """A summary of a single job posting."""
    urn: str
    title: str
    company_urn: Optional[str]
    location_names: List[str]
    posted_on: Optional[date]
    description_snippet: str
    easy_apply: bool
    employment_type: str


@dataclass
class JobsPage:
    """The root object representing the entire structured page of job data."""
    paging: Paging
    metadata: Metadata
    jobs: List[JobPostingSummary]
    companies: Dict[str, Company]  # Keyed by company_urn
    geos: Dict[str, Geo]  # Keyed by geo_urn
    seeker_states: Dict[str, JobSeekerState]  # Keyed by job_card_urn


# --- Helper Functions ---

def parse_curl_command(curl_string: str) -> Tuple[str, Dict[str, str]]:
    """
    Parses a cURL command string to extract the URL and headers.

    Args:
        curl_string: The raw cURL command string, typically copied from a browser.

    Returns:
        A tuple containing the URL and a dictionary of headers.

    Raises:
        ValueError: If the URL cannot be found in the cURL string.
    """
    headers = {}
    # Normalize the cURL command by removing line breaks and extra spaces.
    curl_string = curl_string.replace('\\\n', ' ').replace('\n', ' ').replace('\xa0', ' ').strip()

    # Extract the URL.
    url_match = re.search(r"curl '([^']*)'", curl_string)
    if not url_match:
        raise ValueError("Could not find URL in cURL string. Ensure it's enclosed in single quotes.")
    url = url_match.group(1)

    # Extract all headers.
    header_matches = re.findall(r"-H '([^']*)'", curl_string)
    for header in header_matches:
        try:
            key, value = header.split(':', 1)
            headers[key.strip()] = value.strip()
        except ValueError:
            print(f"Warning: Could not parse header: {header}")

    # Specifically find and add the cookie header if it exists separately.
    cookie_match = re.search(r"-b '([^']*)'", curl_string)
    if cookie_match:
        headers['Cookie'] = cookie_match.group(1).strip()

    return url, headers


def fetch_linkedin_jobs(url: str, headers: Dict) -> Optional[Dict]:
    """
    Fetches job data from the LinkedIn API.

    Args:
        url: The API endpoint URL.
        headers: The request headers, including authentication tokens.

    Returns:
        The JSON response as a dictionary, or None if the request fails.
    """
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error making request to LinkedIn: {e}")
        if e.response is not None:
            print(f"Status Code: {e.response.status_code}")
            print(f"Response Text: {e.response.text}")
        return None
    except json.JSONDecodeError:
        print("Error: Failed to decode JSON from response.")
        return None


def parse_jobs_page(data: Dict) -> Optional[JobsPage]:
    """
    Parses the full JSON response from LinkedIn to build a structured JobsPage object.
    This function orchestrates the entire transformation from raw to structured data.

    Args:
        data: The loaded JSON data as a Python dictionary.

    Returns:
        A JobsPage dataclass object, or None if parsing fails.
    """
    if not data or 'data' not in data or 'included' not in data:
        print("Error: Invalid or empty data provided to parser. Cannot find 'data' or 'included' keys.")
        return None

    # Create a lookup map for all items in the 'included' array for efficient access.
    included_map = {item['entityUrn']: item for item in data.get('included', []) if 'entityUrn' in item}

    # 1. Parse Paging and Metadata from the main data block.
    try:
        base_path = data['data']['data']['jobsDashJobCardsByJobCollections']
        paging_data = base_path['paging']
        paging = Paging(
            count=paging_data.get('count', 0),
            start=paging_data.get('start', 0),
            total=paging_data.get('total', 0)
        )

        metadata_data = base_path['metadata']
        header_text = metadata_data.get('resultsCountHeader', {}).get('text', '')
        metadata = Metadata(
            resultsCountHeader=header_text,
            resultsCountHeaderWithTotal=header_text  # In the example JSON, these are the same.
        )
    except KeyError as e:
        print(f"Error: Could not find paging/metadata information. Missing key: {e}")
        return None

    # 2. Pre-parse all Company and Geo api_fetch from the lookup map.
    companies: Dict[str, Company] = {}
    geos: Dict[str, Geo] = {}

    for urn, item in included_map.items():
        item_type = item.get('$type')

        if item_type == "com.linkedin.voyager.dash.organization.Company":
            logo_url = None
            logo_info = item.get("logoResolutionResult", {}).get("vectorImage", {})
            if logo_info and logo_info.get("rootUrl") and logo_info.get("artifacts"):
                # Prefer 200px artifact for the logo, but fall back to the first available one.
                artifact = next((a for a in logo_info["artifacts"] if a.get("width") == 200),
                                logo_info["artifacts"][0] if logo_info["artifacts"] else None)
                if artifact:
                    logo_url = logo_info["rootUrl"] + artifact["fileIdentifyingUrlPathSegment"]

            companies[urn] = Company(
                urn=urn,
                name=item.get('name', 'Unknown Company'),  # Name is often in the job card, will be updated.
                logo_url=logo_url
            )
        elif item_type == "com.linkedin.voyager.dash.common.geo.Geo":
            geos[urn] = Geo(
                urn=urn,
                name=item.get('name', 'Unknown Location')
            )

    # 3. Parse JobPostings and SeekerStates, linking them to the pre-parsed api_fetch.
    jobs: List[JobPostingSummary] = []
    seeker_states: Dict[str, JobSeekerState] = {}

    # We iterate through JobPostingCard objects, as they are the central nodes connecting other api_fetch.
    job_cards = [item for item in included_map.values() if
                 item.get('$type') == "com.linkedin.voyager.dash.jobs.JobPostingCard"]

    for card in job_cards:
        job_card_urn = card.get('entityUrn')
        if not job_card_urn:
            continue

        # --- Link Company ---
        company_urn = None
        logo_attributes = card.get('logo', {}).get('attributes', [])
        if logo_attributes:
            company_urn = logo_attributes[0].get('detailData', {}).get('*companyLogo')

        # The company name is more reliably found in the job card's description.
        # We update our company record with this more specific name.
        if company_urn and company_urn in companies:
            company_name_from_card = card.get('primaryDescription', {}).get('text')
            if company_name_from_card:
                companies[company_urn].name = company_name_from_card

        # --- Extract Job Details ---
        posted_on_date = None
        easy_apply = False
        for item in card.get('footerItems', []):
            if item.get('type') == 'LISTED_DATE' and item.get('timeAt'):
                posted_on_date = datetime.fromtimestamp(item['timeAt'] / 1000).date()
            if item.get('type') == 'EASY_APPLY_TEXT':
                easy_apply = True

        # --- Safely extract description snippet ---
        relevance_insight = card.get('relevanceInsight') or {}
        text_insight = relevance_insight.get('text') or {}
        description_snippet = text_insight.get('text', '')

        # --- Create JobPostingSummary ---
        job_summary = JobPostingSummary(
            urn=card.get('*jobPosting'),
            title=card.get('jobPostingTitle', 'No Title'),
            company_urn=company_urn,
            location_names=[card.get('secondaryDescription', {}).get('text', 'No Location')],
            posted_on=posted_on_date,
            description_snippet=description_snippet,
            easy_apply=easy_apply,
            employment_type=""  # This field is not available in the provided JSON structure.
        )
        jobs.append(job_summary)

        # --- Parse JobSeekerState ---
        seeker_state_urn = card.get('*jobSeekerJobState')
        if seeker_state_urn and seeker_state_urn in included_map:
            state_data = included_map[seeker_state_urn]
            actions = {action.get('jobSeekerJobStateEnums') for action in
                       state_data.get('jobSeekerJobStateActions', [])}
            seeker_states[job_card_urn] = JobSeekerState(
                job_card_urn=job_card_urn,
                is_saved='SAVED' in actions,
                is_applied='APPLIED' in actions
            )

    valid_jobs = [
        job for job in jobs
        if job.urn is not None and job.title != "No Title"
    ]

    # 4. Assemble the final JobsPage object.
    return JobsPage(
        paging=paging,
        metadata=metadata,
        jobs=valid_jobs,
        companies=companies,
        geos=geos,
        seeker_states=seeker_states
    )


class CustomJsonEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle date objects, converting them to ISO 8601 strings."""

    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)


def main():
    """
    Main function to fetch, parse, and save LinkedIn job postings to JSON files.
    """
    curl_command = """
curl 'https://www.linkedin.com/voyager/api/graphql?variables=(count:24,jobCollectionSlug:recommended,query:(origin:GENERIC_JOB_COLLECTIONS_LANDING),start:48)&queryId=voyagerJobsDashJobCards.93590893e4adb90623f00d61719b838c' \
  -H 'accept: application/vnd.linkedin.normalized+json+2.1' \
  -H 'accept-language: en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7' \
  -b 'bcookie="v=2&8dbfbdc7-e798-40ce-8645-afc560856845"; bscookie="v=1&2025021218502355028f04-83cc-48ed-8919-ec97e40bda49AQE-zsW9viyonHpVi4HpRFLzIsEFwyoJ"; g_state={"i_l":0}; liap=true; JSESSIONID="ajax:2584240299603910567"; dfpfpt=02f41f47dbb840f9b833d6e8dfc0b0f4; li_ep_auth_context=AM9hcHA9YWNjb3VudENlbnRlckh1YixhaWQ9Mjc4NDA2MDY2LGlpZD0zMjQzMzI2NTAscGlkPTI3NjY4NDk4NixleHA9MTc0MjUzNjIwNTc0NyxjdXI9dHJ1ZXxhcHA9c2FsZXNOYXZpZ2F0b3IsYWlkPTI3ODQwNjA2NixpaWQ9NDIwODYxNDY1LHBpZD0yNzY2ODQ5ODYsZXhwPTE3NDUwOTk5ODI2ODcsY3VyPXRydWUsc2lkPTE1Mjk0MTEwMDQsY2lkPTIwMTAwNDU2NzQBf0iA5XMh-eRvJ2QB4KS5KK8SUNQ; li_theme=dark; li_theme_set=user; timezone=America/Fortaleza; sdui_ver=sdui-flagship:0.1.6871+sdui-flagship.production; lang=v=2&lang=en-us; li_at=AQEFAHUBAAAAABSqG7UAAAGXXzKSSAAAAZfQlkN3TQAAGHVybjpsaTptZW1iZXI6MTAyNjk0MzMwNWYm1DqJn9kEYGnmmj4HkCVrpl3L5eJp6SCHmQzh2UvTrNb4ZCrO6KrDqSahqKv352NrmK4nJ1ykljhPY1R_9fkxPKDDuXtFCJ252bFBMOqLHvgD4aER9aFWxI8uVrqQ-XclO2lS7kCDkElsJKBhmnizusR5CU2Vp131PBgPeO4t3b3NWk0VPkYPH7fgogE7wmRuSTI; lidc="b=VB05:s=V:r=V:a=V:p=V:g=7865:u=301:x=1:i=1751049807:t=1751136207:v=2:sig=AQH6C-mDLo0Y-9rIPqjQWgxsHxv19WR1"; __cf_bm=WnaKB5VywiaFAXx5cA5iFpWE_cbPfjF2P_WI2swbQWE-1751049808-1.0.1.1-g38N8e8Q6siDYZqtR5GHg80ATPycsGJmp3yaRMNO1NrAW1SOYChLl7SaPYjOC6AZmAppQE0F9qQ_UKHAyuOJQ8TZMF8Q5WnjnRBoQph1jBI; UserMatchHistory=AQIcXnTONGRR0QAAAZeys6_tXWVMH4g-KhgLSXM5YBq-kwvbnWhoffj3T5SS-Bo4pvkWNTDrj136CqiGNZPxuIEBjGNHqAB0_M5Nssxek7yVdrWIhbr5zTiN4VwgXsafZPym3BCx3A43oTpq8bUFtSrnrgMbzRNzUcihACF57iClpJa-ZC9uv-Dt2RHK1CvmZFvUWsseVijLrVPbKACTK8k3McoJ0PalyCd6q6VZ5wgUOjDWx6VyooB8k34W4MLajimf7R4WZzKlIufqONDGgJplpsbpR5nquGK7DM82YQgaemWFVHAnV0mt6H8t482LuWSnn6b2G8c4lOk4gfRZ; fptctx2=taBcrIH61PuCVH7eNCyH0FWPWMZs3CpAZMKmhMiLe%252bGSJM5F%252bTt2yo01yfcQpUp%252bXn7iyTiojlnIHsNNj29I4nZhkbIIfSGaS1yuiC9b2DS691Q5rnDgBPPHGmgmOkxJhNIPRxzb69mDGCSS6KMaJn35EQA1I4AHJosb1V%252fo5Lfn7ET83DBWpW35rctKLplLDsY%252fK9ZIii2Wuv9R9yfQM%252bdt%252btxI0AQv%252bxadJ%252bmBjm0VLMxpOnsC6fCNcHvfHmb294FcaBAKsWpVaJzosSzjkV0luQwCLlTJeENQcSGolkYW6cGL0fvZOiyiuuqnqIM3og5fyg%252b7Y%252fihSXP2qhavwXN2CGjxaeb6%252bG3ed9DZB04%253d' \
  -H 'csrf-token: ajax:2584240299603910567' \
  -H 'dnt: 1' \
  -H 'priority: u=1, i' \
  -H 'referer: https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4236355838&discover=recommended&discoveryOrigin=JOBS_HOME_JYMBII&start=24' \
  -H 'sec-ch-prefers-color-scheme: dark' \
  -H 'sec-ch-ua: "Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0' \
  -H 'x-li-lang: en_US' \
  -H 'x-li-page-instance: urn:li:page:d_flagship3_job_collections_discovery_landing;R2XO7GA+SDyM3+nq0Z4vRg==' \
  -H 'x-li-pem-metadata: Voyager - Careers - Job Collections=job-collection-pagination-fetch' \
  -H 'x-li-prefetch: 1' \
  -H 'x-li-track: {"clientVersion":"1.13.36800","mpVersion":"1.13.36800","osName":"web","timezoneOffset":-3,"timezone":"America/Fortaleza","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":1,"displayWidth":1920,"displayHeight":1080}' \
  -H 'x-restli-protocol-version: 2.0.0'
    """

    try:
        url, headers = parse_curl_command(curl_command)
        print("--- Successfully parsed cURL command ---")
        print("IMPORTANT: The cURL command contains sensitive, time-limited tokens (cookie, csrf-token).")
        print(
            "You will need to paste a fresh cURL command from your browser when they expire for the script to work.\n")
    except ValueError as e:
        print(f"Error: Could not parse the cURL command. Please check its format.")
        print(f"Details: {e}")
        return

    # To use a local file for testing instead of a live request, you can uncomment the following lines:
    # print("--- Using local 'response.json' file for data ---")
    # with open('response.json', 'r', encoding='utf-8') as f:
    #     live_data = json.load(f)

    # This block makes the live request to the LinkedIn API.
    print("--- Fetching live data from LinkedIn API ---")
    live_data = fetch_linkedin_jobs(url, headers)

    if live_data:
        # 1. Save the raw, unprocessed data for debugging or archival.
        raw_output_file = 'raw_pagination_results.json'
        try:
            with open(raw_output_file, 'w', encoding='utf-8') as f:
                json.dump(live_data, f, ensure_ascii=False, indent=4)
            print(f"Successfully saved raw API data to {raw_output_file}")
        except Exception as e:
            print(f"Error saving raw data: {e}")

        # 2. Parse the raw data into our structured JobsPage object.
        parsed_page = parse_jobs_page(live_data)

        if parsed_page:
            print(f"\nSuccessfully parsed {len(parsed_page.jobs)} job postings.")

            # Convert the structured dataclass object into a dictionary for JSON serialization.
            serializable_page = asdict(parsed_page)

            # 3. Save the final, structured data.
            structured_output_file = 'structured_pagination_results.json'
            try:
                with open(structured_output_file, 'w', encoding='utf-8') as f:
                    # Use the custom encoder to handle date objects.
                    json.dump(serializable_page, f, ensure_ascii=False, indent=4, cls=CustomJsonEncoder)
                print(f"Saved structured page data to {structured_output_file}")
            except Exception as e:
                print(f"Error saving structured data: {e}")
        else:
            print("Could not parse the data into a structured page. Check the parsing logic and input format.")
    else:
        print("Failed to fetch data from LinkedIn. No files were created.")


# --- Main Execution ---
if __name__ == "__main__":
    main()
