import json
import requests
import re
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import List, Optional, Dict, Tuple


# --- Dataclasses ---
# Defines the structure for storing company information.
@dataclass
class Company:
    """A dataclass to hold company-specific information."""
    id: int
    name: str
    linkedin_url: Optional[str] = None
    logo_url: Optional[str] = None


# Defines the structure for storing job posting details.
@dataclass
class JobPosting:
    """A dataclass for storing detailed information about a job posting."""
    job_id: int
    title: str
    location: Optional[str] = None
    posted_at: Optional[datetime] = None
    is_promoted: bool = False
    has_easy_apply: bool = False
    salary_and_benefits: Optional[str] = None
    relevance_insight: Optional[str] = None
    company: Optional[Company] = None


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

    # Clean up the string from newlines, backslashes, and non-breaking spaces
    curl_string = curl_string.replace('\\\n', ' ').replace('\n', ' ').replace('\xa0', ' ').strip()

    # Extract URL, which is typically the first argument in single quotes after 'curl'
    url_match = re.search(r"curl '([^']*)'", curl_string)
    if not url_match:
        raise ValueError("Could not find URL in cURL string. Ensure it's enclosed in single quotes.")
    url = url_match.group(1)

    # Extract all headers specified with -H
    header_matches = re.findall(r"-H '([^']*)'", curl_string)
    for header in header_matches:
        try:
            key, value = header.split(':', 1)
            headers[key.strip()] = value.strip()
        except ValueError:
            # This can happen if a header is malformed, e.g., doesn't contain a colon
            print(f"Warning: Could not parse header: {header}")

    # Extract cookie from the -b flag and add it to the headers dictionary
    # This will overwrite any 'cookie' header from -H, which is the correct behavior.
    cookie_match = re.search(r"-b '([^']*)'", curl_string)
    if cookie_match:
        headers['Cookie'] = cookie_match.group(1).strip()

    return url, headers


def extract_id_from_urn(urn: str) -> Optional[int]:
    """Extracts the numeric ID from a LinkedIn URN string."""
    if not isinstance(urn, str):
        return None
    try:
        # Handles URNs like 'urn:li:fsd_company:12345' or 'urn:li:fsd_jobPostingCard:(67890,JOB_DETAILS)'
        if '(' in urn:
            return int(urn.split('(')[1].split(',')[0])
        else:
            return int(urn.split(':')[-1])
    except (IndexError, ValueError):
        return None


def parse_job_postings(data: Dict) -> List[JobPosting]:
    """
    Parses the full JSON response from LinkedIn to extract job postings and company data.

    Args:
        data: The loaded JSON data as a Python dictionary.

    Returns:
        A list of JobPosting dataclass objects.
    """
    included_items = data.get("included", [])
    companies: Dict[str, Company] = {}
    job_postings: List[JobPosting] = []

    # First pass: Extract all company information for easy lookup.
    for item in included_items:
        if item.get("$type") == "com.linkedin.voyager.dash.organization.Company":
            company_urn = item.get("entityUrn")
            company_id = extract_id_from_urn(company_urn)
            if not company_id:
                continue

            # Extract company logo URL from the available artifacts.
            logo_info = item.get("logoResolutionResult", {}).get("vectorImage", {})
            logo_url = None
            if logo_info.get("rootUrl") and logo_info.get("artifacts"):
                # Select the 200x200 resolution artifact for the logo URL.
                artifact = next((a for a in logo_info["artifacts"] if a.get("width") == 200), None)
                if artifact:
                    logo_url = logo_info["rootUrl"] + artifact["fileIdentifyingUrlPathSegment"]

            # Company name will be retrieved from the job posting card later.
            companies[company_urn] = Company(id=company_id, name="", logo_url=logo_url)

    # Second pass: Extract job postings and link them to companies.
    for item in included_items:
        if item.get("$type") == "com.linkedin.voyager.dash.jobs.JobPostingCard":
            job_id = extract_id_from_urn(item.get("entityUrn", ""))
            if not job_id:
                continue

            # Extract basic job details.
            title = item.get("jobPostingTitle", None)
            if not title:
                continue
            primaryDescription = item.get("primaryDescription", {})
            secondaryDescription = item.get("secondaryDescription", {})
            tertiaryDescription = item.get("tertiaryDescription", {})
            relevance_pot = item.get("relevanceInsight", {})
            company_name = primaryDescription.get("text") if primaryDescription else "Unknown Company"
            location = secondaryDescription.get("text") if secondaryDescription else "Unknown Location"
            salary_and_benefits = tertiaryDescription.get("text") if tertiaryDescription else None
            relevance_insight = relevance_pot.get("text", {}).get("text") if relevance_pot else None

            # Extract details from footer items.
            posted_at_timestamp = None
            is_promoted = False
            has_easy_apply = False
            for footer_item in item.get("footerItems", []):
                if footer_item.get("type") == "LISTED_DATE" and footer_item.get("timeAt"):
                    posted_at_timestamp = footer_item["timeAt"]
                elif footer_item.get("type") == "PROMOTED":
                    is_promoted = True
                elif footer_item.get("type") == "EASY_APPLY_TEXT":
                    has_easy_apply = True

            posted_at = datetime.fromtimestamp(posted_at_timestamp / 1000) if posted_at_timestamp else None

            # Find and link the corresponding company object.
            company_urn_ref = item.get("logo", {}).get("attributes", [{}])[0].get("detailData", {}).get("*companyLogo")
            company = companies.get(company_urn_ref)
            if company:
                company.name = company_name  # Update company name from the job card.
                company.linkedin_url = item.get("logo", {}).get("actionTarget")

            # Create the JobPosting object.
            job_postings.append(
                JobPosting(
                    job_id=job_id,
                    title=title,
                    company=company,
                    location=location,
                    posted_at=posted_at,
                    is_promoted=is_promoted,
                    has_easy_apply=has_easy_apply,
                    salary_and_benefits=salary_and_benefits,
                    relevance_insight=relevance_insight,
                )
            )

    return job_postings


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
        # Raise an exception for bad status codes (4xx or 5xx)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error making request to LinkedIn: {e}")
        # The response might contain useful info even on failure
        if e.response is not None:
            print(f"Status Code: {e.response.status_code}")
            print(f"Response Text: {e.response.text}")
        return None
    except json.JSONDecodeError:
        print("Error: Failed to decode JSON from response.")
        return None


def get_recommended_jobs(url: str, headers: Dict) -> List[JobPosting]:
    """
    Fetches and parses recommended jobs from LinkedIn.
    This function can be imported and used by other scripts.
    """
    print("Fetching initial list of recommended jobs...")
    live_data = fetch_linkedin_jobs(url, headers)
    if live_data:
        parsed_jobs = parse_job_postings(live_data)
        print(f"Successfully parsed {len(parsed_jobs)} job postings.")
        return parsed_jobs
    return []


def main():
    """
    Main function to fetch, parse, and print LinkedIn job postings.
    """
    # --- Configuration ---
    # Paste the entire cURL command copied from your browser's developer tools here.
    # The script will parse it to get the URL, headers, and cookies.
    curl_command = """
    curl 'https://www.linkedin.com/voyager/api/graphql?variables=(count:24,jobCollectionSlug:recommended,query:(origin:GENERIC_JOB_COLLECTIONS_LANDING),start:72)&queryId=voyagerJobsDashJobCards.93590893e4adb90623f00d61719b838c' \
      -H 'accept: application/vnd.linkedin.normalized+json+2.1' \
      -H 'accept-language: en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7' \
      -b 'bcookie="v=2&8dbfbdc7-e798-40ce-8645-afc560856845"; bscookie="v=1&2025021218502355028f04-83cc-48ed-8919-ec97e40bda49AQE-zsW9viyonHpVi4HpRFLzIsEFwyoJ"; g_state={"i_l":0}; liap=true; JSESSIONID="ajax:2584240299603910567"; dfpfpt=02f41f47dbb840f9b833d6e8dfc0b0f4; li_ep_auth_context=AM9hcHA9YWNjb3VudENlbnRlckh1YixhaWQ9Mjc4NDA2MDY2LGlpZD0zMjQzMzI2NTAscGlkPTI3NjY4NDk4NixleHA9MTc0MjUzNjIwNTc0NyxjdXI9dHJ1ZXxhcHA9c2FsZXNOYXZpZ2F0b3IsYWlkPTI3ODQwNjA2NixpaWQ9NDIwODYxNDY1LHBpZD0yNzY2ODQ5ODYsZXhwPTE3NDUwOTk5ODI2ODcsY3VyPXRydWUsc2lkPTE1Mjk0MTEwMDQsY2lkPTIwMTAwNDU2NzQBf0iA5XMh-eRvJ2QB4KS5KK8SUNQ; li_theme=dark; li_theme_set=user; timezone=America/Fortaleza; li_at=AQEFAHUBAAAAABSqG7UAAAGXXzKSSAAAAZepf-gpTQAAGHVybjpsaTptZW1iZXI6MTAyNjk0MzMwNb94qjbbfxfynvvalaOd3GDQXIhYvNZu_jcWpGq2oeeShj0_vA8sCGHB0wEbL16xwvQzkU2OFQy-9279JnPbQR0RK5i8o9JpzSM0xdyiZprFjJpao7H6etsGF0OtVSDRyT04fLhk-eik0jPNkb2bVIf_YbSyVnHrULQMBt5m68wHQ8SCrq5ZHurqapdlXMGLeDekPow; sdui_ver=sdui-flagship:0.1.6871+sdui-flagship.production; lang=v=2&lang=en-us; lidc="b=VB05:s=V:r=V:a=V:p=V:g=7864:u=298:x=1:i=1750880031:t=1750966431:v=2:sig=AQFCShb0BNb3Y71CQqFI8iHF5XbNcozZ"; UserMatchHistory=AQIIiPwdmYSNSwAAAZeolRzUBx2fTnL7oVhEqzh6wyFKeMEgJbTS6VQtTDNmPk2qpKsxRTwUUWxDQ34ZaquH70UEO9CgL55BtUAwqwU26Xw8-0DcerYA8jyWH0tNpFPWCBG3MuwIzW0--rHAmLnR-TbAbV_LRT61BymprbjT8iJjrBeGj6bVUQbmlgq_0lXxYyop6prVPPBtLAxZ45m8R5rIg6_asoTaWoE2-g49jb9WfTFmM6PtvEh4lDFaf1R782M9QOtJAkPAVXln0IA9eDxk28MfxcjzRndXWCykmUoW66D23xOiAey15J5_twHrWJkP14-Ha_N1uWky8mFk; fptctx2=taBcrIH61PuCVH7eNCyH0FWPWMZs3CpAZMKmhMiLe%252bGSJM5F%252bTt2yo01yfcQpUp%252bXn7iyTiojlnIHsNNj29I4nZhkbIIfSGaS1yuiC9b2DS691Q5rnDgBPPHGmgmOkxJhNIPRxzb69mDGCSS6KMaJq9YdpYlQV5IL%252bqYKQGI%252f1rlXAUYNH3gSr%252bWuBmNRBckywr%252fb5FfIHyoM9ctJtfbCUHE2W7wSC0evjG8Lr5I8hi2pz5D7%252bHA0o7ejqG%252fdzA1CLcpp80e73o4a5q%252fJmCiBQs9kHRIH1rszBwoEjKJLSJpA05YNVPLtTExvYhVS9dR0hyeCS5MAtuf9c7NtoFjI1%252fzv6STuAZ%252b%252bhFnryrYQ5Y%253d; __cf_bm=Ep1kwRLEcU2BMQ8q7TbV3fsws8RCT2QpFI3vqxi6V8w-1750881834-1.0.1.1-B6kJkF5sD5p_pHneC2ZSOgKdH_Wz.d_ndIK0Ms80O6U8bmeSKPWl59MuPybgxapkSNowJ2jvj2ZFihSuJ6iiN2XO7WKZvvFJ8VZIJBLsJJE' \
      -H 'csrf-token: ajax:2584240299603910567' \
      -H 'dnt: 1' \
      -H 'priority: u=1, i' \
      -H 'referer: https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4249289136&discover=recommended&discoveryOrigin=JOBS_HOME_JYMBII&start=48' \
      -H 'sec-ch-prefers-color-scheme: dark' \
      -H 'sec-ch-ua: "Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"' \
      -H 'sec-ch-ua-mobile: ?0' \
      -H 'sec-ch-ua-platform: "Windows"' \
      -H 'sec-fetch-dest: empty' \
      -H 'sec-fetch-mode: cors' \
      -H 'sec-fetch-site: same-origin' \
      -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0' \
      -H 'x-li-lang: en_US' \
      -H 'x-li-page-instance: urn:li:page:d_flagship3_job_collections_discovery_landing;Hca42kdbS5CMxyiiBnCJ3Q==' \
      -H 'x-li-pem-metadata: Voyager - Careers - Job Collections=job-collection-pagination-fetch' \
      -H 'x-li-prefetch: 1' \
      -H 'x-li-track: {"clientVersion":"1.13.36749","mpVersion":"1.13.36749","osName":"web","timezoneOffset":-3,"timezone":"America/Fortaleza","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":1,"displayWidth":1920,"displayHeight":1080}' \
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

    # Fetch the data from the API
    live_data = fetch_linkedin_jobs(url, headers)

    if live_data:
        # Parse the data to get a list of job postings.
        parsed_jobs = parse_job_postings(live_data)

        # Print the results.
        if parsed_jobs:
            print(f"Successfully parsed {len(parsed_jobs)} job postings.\n")
            serializable = [asdict(job) for job in parsed_jobs]
            for entry in serializable:
                if entry.get('posted_at'):
                    entry['posted_at'] = entry['posted_at'].isoformat()
            output_file = 'pagination_results.json'
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(serializable, f, ensure_ascii=False, indent=4)
            print(f"Saved parsed jobs to {output_file}")

        else:
            print("No job postings were found or parsed from the API response.")


# --- Main Execution ---
if __name__ == "__main__":
    main()
