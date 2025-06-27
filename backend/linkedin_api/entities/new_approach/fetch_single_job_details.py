import re
import shlex
import json
import requests
from urllib.parse import urlparse, parse_qs, urlunparse
import os
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


# --- DATA CLASSES TO STRUCTURE THE JOB INFORMATION ---

@dataclass
class Company:
    """Represents a company's details."""
    name: Optional[str] = None
    logo_url: Optional[str] = None
    is_following: Optional[bool] = None


@dataclass
class JobInsight:
    """Represents an insight about the job."""
    description: Optional[str] = None
    label: Optional[str] = None


@dataclass
class ApplicationDetails:
    """Holds details about the application process."""
    is_easy_apply: Optional[bool] = None
    apply_url: Optional[str] = None
    applicant_tracking_system: Optional[str] = None
    required_fields: List[str] = field(default_factory=list)


@dataclass
class JobPosting:
    """A structured representation of a single job posting."""
    job_id: str
    title: Optional[str] = None
    company: Optional[Company] = None
    location: Optional[str] = None
    workplace_type: Optional[str] = None
    employment_type: Optional[str] = None
    posted_at: Optional[str] = None
    insights: List[JobInsight] = field(default_factory=list)
    application_details: Optional[ApplicationDetails] = None
    is_reposted: bool = False
    company_apply_url: Optional[str] = None


class CurlParser:
    """
    A helper class to parse a raw cURL command string and extract its components.
    """

    def __init__(self, curl_string: str):
        self.curl_string = curl_string.replace('\\\n', ' ').replace('\n', ' ').strip()
        if not self.curl_string.startswith('curl '):
            raise ValueError("Invalid input: String must be a cURL command.")

    def parse(self):
        """
        Executes the parsing logic.
        """
        args = shlex.split(self.curl_string)
        full_url = next((arg for arg in args[1:] if not arg.startswith('-')), None)
        if not full_url:
            raise ValueError("Could not find URL in the cURL command.")

        parsed_url = urlparse(full_url)
        query_params = parse_qs(parsed_url.query)
        base_url = urlunparse(parsed_url._replace(query=''))

        headers = {}
        i = 1
        while i < len(args):
            if args[i] in ['-H', '--header']:
                i += 1
                if i < len(args):
                    key, value = args[i].split(':', 1)
                    headers[key.strip().lower()] = value.strip()
            elif args[i] in ['-b', '--cookie']:
                i += 1
                if i < len(args):
                    headers['cookie'] = args[i]
            i += 1

        return {
            'base_url': base_url,
            'headers': headers,
            'query_params': {k: v[0] for k, v in query_params.items()}
        }


class LinkedInGraphQLClient:
    """
    A Python client that uses a pre-configured requests.Session
    to interact with LinkedIn's GraphQL API.
    """

    def __init__(self, session: requests.Session):
        """
        Initializes the client with an existing, authenticated session.

        Args:
            session: A requests.Session object that already contains the necessary
                     headers (like 'cookie' and 'csrf-token').
        """
        print("Initializing client with a pre-configured session...")
        if not isinstance(session, requests.Session):
            raise TypeError("The client must be initialized with a requests.Session object.")
        self.session = session
        self.onsite_apply_config = {
            'base_url': 'https://www.linkedin.com/voyager/api/graphql',
            'queryId': 'voyagerJobsDashOnsiteApplyApplication.b495f032afec05dd276f0d97d4f108c2'
        }
        self.detail_sections_config = {
            'base_url': 'https://www.linkedin.com/voyager/api/graphql',
            'queryId': 'voyagerJobsDashJobPostingDetailSections.d5e26c6a0b129827c0cfd9d5a714c5e7'
        }
        print("Client initialized successfully.")

    def _make_request(self, config: dict, variables_str: str):
        """
        Makes a request using the shared session.
        """
        full_url = f"{config['base_url']}?variables={variables_str}&queryId={config['queryId']}"

        try:
            response = self.session.get(full_url, timeout=15)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as http_err:
            print(f"  [!] HTTP error occurred: {http_err}")
            print(f"      Request URL: {http_err.request.url}")
            print(f"      Response Body: {http_err.response.text}")
        except requests.exceptions.RequestException as req_err:
            print(f"  [!] A request error occurred: {req_err}")
        return None

    def get_onsite_apply_application(self, job_id: str):
        print(f"  -> Fetching OnsiteApplyApplication for job ID: {job_id}...")
        urn_encoded = f"urn%3Ali%3Afsd_jobPosting%3A{job_id}"
        variables = f"(jobPostingUrn:{urn_encoded})"
        return self._make_request(self.onsite_apply_config, variables)

    def get_detail_sections(self, job_id: str):
        print(f"  -> Fetching DetailSections for job ID: {job_id}...")
        urn_encoded = f"urn%3Ali%3Afsd_jobPosting%3A{job_id}"
        variables = f"(cardSectionTypes:List(TOP_CARD,HOW_YOU_FIT_CARD),jobPostingUrn:{urn_encoded},includeSecondaryActionsV2:true,jobDetailsContext:(isJobSearch:false))"
        return self._make_request(self.detail_sections_config, variables)


def has_api_errors(response_data):
    """
    Checks if the response dictionary from the API contains an 'errors' key.
    """
    if not response_data:
        return True
    return 'errors' in response_data or ('data' in response_data and 'errors' in response_data['data'])


# --- SCRIPT CONFIGURATION ---
CURL_ONSITE_APPLY = r'''
curl 'https://www.linkedin.com/voyager/api/graphql?variables=(jobPostingUrn:urn%3Ali%3Afsd_jobPosting%3A4242594667)&queryId=voyagerJobsDashOnsiteApplyApplication.b495f032afec05dd276f0d97d4f108c2' \
  -H 'accept: application/vnd.linkedin.normalized+json+2.1' \
  -H 'accept-language: en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7' \
  -b 'bcookie="v=2&8dbfbdc7-e798-40ce-8645-afc560856845"; bscookie="v=1&2025021218502355028f04-83cc-48ed-8919-ec97e40bda49AQE-zsW9viyonHpVi4HpRFLzIsEFwyoJ"; g_state={"i_l":0}; liap=true; JSESSIONID="ajax:2584240299603910567"; dfpfpt=02f41f47dbb840f9b833d6e8dfc0b0f4; li_ep_auth_context=AM9hcHA9YWNjb3VudENlbnRlckh1YixhaWQ9Mjc4NDA2MDY2LGlpZD0zMjQzMzI2NTAscGlkPTI3NjY4NDk4NixleHA9MTc0MjUzNjIwNTc0NyxjdXI9dHJ1ZXxhcHA9c2FsZXNOYXZpZ2F0b3IsYWlkPTI3ODQwNjA2NixpaWQ9NDIwODYxNDY1LHBpZD0yNzY2ODQ5ODYsZXhwPTE3NDUwOTk5ODI2ODcsY3VyPXRydWUsc2lkPTE1Mjk0MTEwMDQsY2lkPTIwMTAwNDU2NzQBf0iA5XMh-eRvJ2QB4KS5KK8SUNQ; li_theme=dark; li_theme_set=user; timezone=America/Fortaleza; li_at=AQEFAHUBAAAAABSqG7UAAAGXXzKSSAAAAZepf-gpTQAAGHVybjpsaTptZW1iZXI6MTAyNjk0MzMwNb94qjbbfxfynvvalaOd3GDQXIhYvNZu_jcWpGq2oeeShj0_vA8sCGHB0wEbL16xwvQzkU2OFQy-9279JnPbQR0RK5i8o9JpzSM0xdyiZprFjJpao7H6etsGF0OtVSDRyT04fLhk-eik0jPNkb2bVIf_YbSyVnHrULQMBt5m68wHQ8SCrq5ZHurqapdlXMGLeDekPow; sdui_ver=sdui-flagship:0.1.6871+sdui-flagship.production; lang=v=2&lang=en-us; lidc="b=VB05:s=V:r=V:a=V:p=V:g=7864:u=298:x=1:i=1750880031:t=1750966431:v=2:sig=AQFCShb0BNb3Y71CQqFI8iHF5XbNcozZ"; UserMatchHistory=AQIIiPwdmYSNSwAAAZeolRzUBx2fTnL7oVhEqzh6wyFKeMEgJbTS6VQtTDNmPk2qpKsxRTwUUWxDQ34ZaquH70UEO9CgL55BtUAwqwU26Xw8-0DcerYA8jyWH0tNpFPWCBG3MuwIzW0--rHAmLnR-TbAbV_LRT61BymprbjT8iJjrBeGj6bVUQbmlgq_0lXxYyop6prVPPBtLAxZ45m8R5rIg6_asoTaWoE2-g49jb9WfTFmM6PtvEh4lDFaf1R782M9QOtJAkPAVXln0IA9eDxk28MfxcjzRndXWCykmUoW66D23xOiAey15J5_twHrWJkP14-Ha_N1uWky8mFk; fptctx2=taBcrIH61PuCVH7eNCyH0FWPWMZs3CpAZMKmhMiLe%252bGSJM5F%252bTt2yo01yfcQpUp%252bXn7iyTiojlnIHsNNj29I4nZhkbIIfSGaS1yuiC9b2DS691Q5rnDgBPPHGmgmOkxJhNIPRxzb69mDGCSS6KMaJq9YdpYlQV5IL%252bqYKQGI%252f1rlXAUYNH3gSr%252bWuBmNRBckywr%252fb5FfIHyoM9ctJtfbCUHE2W7wSC0evjG8Lr5I8hi2pz5D7%252bHA0o7ejqG%252fdzA1CLcpp80e73o4a5q%252fJmCiBQs9kHRIH1rszBwoEjKJLSJpA05YNVPLtTExvYhVS9dR0hyeCS5MAtuf9c7NtoFjI1%252fzv6STuAZ%252b%252bhFnryrYQ5Y%253d; __cf_bm=Ep1kwRLEcU2BMQ8q7TbV3fsws8RCT2QpFI3vqxi6V8w-1750881834-1.0.1.1-B6kJkF5sD5p_pHneC2ZSOgKdH_Wz.d_ndIK0Ms80O6U8bmeSKPWl59MuPybgxapkSNowJ2jvj2ZFihSuJ6iiN2XO7WKZvvFJ8VZIJBLsJJE' \
  -H 'csrf-token: ajax:2584240299603910567' \
  -H 'dnt: 1' \
  -H 'priority: u=1, i' \
  -H 'referer: https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4242594667&discover=recommended&discoveryOrigin=JOBS_HOME_JYMBII&start=48' \
  -H 'sec-ch-prefers-color-scheme: dark' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0'
'''


def find_in_included(included_list: List[Dict[str, Any]], entity_urn: str) -> Optional[Dict[str, Any]]:
    """Finds an entity in the 'included' list by its URN."""
    for item in included_list:
        if item.get('entityUrn') == entity_urn:
            return item
    return None


def parse_job_data(job_id: str, raw_data: Dict[str, Any]) -> JobPosting:
    """Parses the raw JSON response and populates the dataclasses."""
    job = JobPosting(job_id=job_id)

    # --- Extracting from 'detail_sections' ---
    details_included = raw_data.get('detail_sections', {}).get('included', [])

    job_posting_details = find_in_included(details_included, f"urn:li:fsd_jobPosting:{job_id}")
    if job_posting_details:
        job.title = job_posting_details.get('title')
        job.is_reposted = job_posting_details.get('repostedJob', False)

        company_urn = job_posting_details.get('companyDetails', {}).get('jobCompany', {}).get('*company')
        company_details = find_in_included(details_included, company_urn) if company_urn else {}

        logo_info = company_details.get('logoResolutionResult', {}).get('vectorImage', {})
        logo_url = None
        if logo_info.get('rootUrl') and logo_info.get('artifacts'):
            logo_url = logo_info['rootUrl'] + logo_info['artifacts'][0]['fileIdentifyingUrlPathSegment']

        job.company = Company(
            name=company_details.get('name'),
            logo_url=logo_url
        )

        location_urn = job_posting_details.get('*location')
        location_details = find_in_included(details_included, location_urn) if location_urn else {}
        job.location = location_details.get('defaultLocalizedName')

        workplace_urn = job_posting_details.get('*workplaceTypesResolutionResults', [None])[0]
        workplace_details = find_in_included(details_included, workplace_urn) if workplace_urn else {}
        job.workplace_type = workplace_details.get('localizedName')

    top_card_urn = find_in_included(details_included, f"urn:li:fsd_jobPostingCard:({job_id},JOB_DETAILS)")
    if top_card_urn:
        tertiary_description = top_card_urn.get('tertiaryDescription', {}).get('text')
        if tertiary_description:
            job.posted_at = tertiary_description.split('·')[1].strip() if '·' in tertiary_description else 'N/A'

        insights_data = top_card_urn.get('jobInsightsV2ResolutionResults', [])
        for insight_item in insights_data:
            if insight_item.get('jobInsightViewModel'):
                for desc in insight_item['jobInsightViewModel'].get('description', []):
                    job.insights.append(JobInsight(description=desc.get('text', {}).get('text')))

    # --- Extracting from 'onsite_apply_application' ---
    onsite_included = raw_data.get('onsite_apply_application', {}).get('included', [])

    application_detail_urn = find_in_included(onsite_included, f"urn:li:fsd_jobSeekerApplicationDetail:{job_id}")
    job_posting_onsite = find_in_included(onsite_included, f"urn:li:fsd_jobPosting:{job_id}")

    if application_detail_urn and job_posting_onsite:
        job.application_details = ApplicationDetails(
            is_easy_apply=application_detail_urn.get('onsiteApply'),
            apply_url=application_detail_urn.get('companyApplyUrl'),
            applicant_tracking_system=application_detail_urn.get('applicantTrackingSystemName'),
        )
        job.company_apply_url = job_posting_onsite.get('companyApplyUrl')

    return job


if __name__ == '__main__':
    job_ids = ['4242594667', '3875225333', '3936990492']
    all_valid_results = {}
    structured_results = {}
    output_filename = 'raw_individual_jobs_data.json'
    structured_output_filename = 'structured_individual_jobs_data.json'

    try:
        parser = CurlParser(CURL_ONSITE_APPLY)
        config = parser.parse()
        master_headers = config['headers']

        api_session = requests.Session()
        api_session.headers.update(master_headers)
        linkedin_client = LinkedInGraphQLClient(session=api_session)

        for job_id in job_ids:
            print(f"Processing Job ID: {job_id}")
            is_job_id_valid = True
            temp_job_data = {}

            application_data = linkedin_client.get_onsite_apply_application(job_id)
            if has_api_errors(application_data):
                is_job_id_valid = False
                print(f"  [!] Error detected in 'OnsiteApplyApplication' response for job {job_id}.")
            else:
                print(f"  [✓] Successfully received OnsiteApplyApplication data.")
                temp_job_data['onsite_apply_application'] = application_data

            if is_job_id_valid:
                details_data = linkedin_client.get_detail_sections(job_id)
                if has_api_errors(details_data):
                    is_job_id_valid = False
                    print(f"  [!] Error detected in 'DetailSections' response for job {job_id}.")
                else:
                    print(f"  [✓] Successfully received DetailSections data.")
                    temp_job_data['detail_sections'] = details_data

            if is_job_id_valid:
                print(f"  ==> Job ID {job_id} is VALID. Storing for output.")
                all_valid_results[job_id] = temp_job_data
                structured_job = parse_job_data(job_id, temp_job_data)
                structured_results[job_id] = json.loads(json.dumps(structured_job, default=lambda o: o.__dict__))

            else:
                print(f"  ==> Job ID {job_id} is INVALID. Discarding results.")

            print("=" * 60)

        if all_valid_results:
            print(f"\nSaving {len(all_valid_results)} valid job(s) to {output_filename}...")
            with open(output_filename, 'w', encoding='utf-8') as f:
                json.dump(all_valid_results, f, ensure_ascii=False, indent=4)
            print(f"Successfully saved data to {os.path.abspath(output_filename)}")

            print(
                f"\nSaving structured data for {len(structured_results)} valid job(s) to {structured_output_filename}...")
            with open(structured_output_filename, 'w', encoding='utf-8') as f:
                json.dump(structured_results, f, ensure_ascii=False, indent=4)
            print(f"Successfully saved structured data to {os.path.abspath(structured_output_filename)}")

        else:
            print(f"\nNo fully valid jobs were found. The output files will not be created.")

    except (ValueError, FileNotFoundError) as e:
        print(f"An error occurred during client setup: {e}")
