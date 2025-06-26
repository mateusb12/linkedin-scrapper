import json
import os
from dataclasses import asdict
from datetime import datetime
from urllib.parse import urlencode

import requests

from backend.linkedin_api.entities.recommended_jobs_analysis.new_approach.fetch_single_job_details import \
    LinkedInGraphQLClient
from backend.linkedin_api.entities.recommended_jobs_analysis.new_approach.pagination_recommended_jobs import \
    get_recommended_jobs, parse_curl_command


# Import the necessary components from your other modules
# Note the addition of CurlParser here.


# Custom JSON encoder to handle datetime objects
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def main():
    """
    Orchestrates fetching jobs and their details using only raw cURL commands
    for configuration.
    """
    print("--- Starting Job Orchestration Process (cURL-driven) ---")

    # --- Configuration ---
    # PASTE YOUR 3 COMPLETE AND VALID cURL COMMANDS HERE.
    # Ensure they are from the same browser session to share the same authentication.

    CURL_JOB_LIST = """
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

    CURL_ONSITE_APPLY = r'''
    curl 'https://www.linkedin.com/voyager/api/graphql?variables=(jobPostingUrn:urn%3Ali%3Afsd_jobPosting%3A4242594667)&queryId=voyagerJobsDashOnsiteApplyApplication.b495f032afec05dd276f0d97d4f108c2' \
      -H 'accept: application/vnd.linkedin.normalized+json+2.1' \
      -H 'cookie: PASTE_YOUR_COOKIE_HERE' \
      -H 'csrf-token: PASTE_YOUR_CSRF_TOKEN_HERE'
    '''

    CURL_DETAIL_SECTIONS = r'''
    curl 'https://www.linkedin.com/voyager/api/graphql?variables=(cardSectionTypes:List(TOP_CARD,HOW_YOU_FIT_CARD),jobPostingUrn:urn%3Ali%3Afsd_jobPosting%3A4242594667,includeSecondaryActionsV2:true,jobDetailsContext:(isJobSearch:false))&queryId=voyagerJobsDashJobPostingDetailSections.d5e26c6a0b129827c0cfd9d5a714c5e7' \
      -H 'accept: application/vnd.linkedin.normalized+json+2.1' \
      -H 'cookie: PASTE_YOUR_COOKIE_HERE' \
      -H 'csrf-token: PASTE_YOUR_CSRF_TOKEN_HERE'
    '''

    # --- Step 1: Parse the job list cURL and fetch the initial jobs ---
    try:
        print("Parsing job list cURL command...")
        list_url, master_headers = parse_curl_command(CURL_JOB_LIST)
        api_session = requests.Session()
        api_session.headers.update(master_headers)
    except (ValueError, IndexError) as e:
        print(f"Error parsing job list cURL command: {e}")
        print("Please ensure CURL_JOB_LIST is a valid cURL command copied from your browser.")
        return

    print("Fetching initial list of recommended jobs...")
    recommended_jobs = get_recommended_jobs(list_url, api_session.headers)

    if not recommended_jobs:
        print("Orchestrator halting: Could not fetch the initial job list.")
        return

    # --- Step 2: Initialize the detail-fetching client ---
    try:
        linkedin_client = LinkedInGraphQLClient(session=api_session)
    except ValueError as e:
        print(f"An error occurred during client setup: {e}")
        print("Please ensure CURL_ONSITE_APPLY and CURL_DETAIL_SECTIONS are valid.")
        return

    # --- Step 3 & 4 ... (code is correct)
    all_combined_jobs_data = []
    print(f"\nFound {len(recommended_jobs)} recommended jobs. Processing details...")
    for job in recommended_jobs:
        print(f"\nProcessing Job ID: {job.job_id} ('{job.title}')")
        job_data_dict = asdict(job)

        application_data = linkedin_client.get_onsite_apply_application(str(job.job_id))
        details_data = linkedin_client.get_detail_sections(str(job.job_id))

        job_data_dict['details'] = {
            'onsite_apply_application': application_data or {'status': 'error', 'data': 'Failed to fetch'},
            'detail_sections': details_data or {'status': 'error', 'data': 'Failed to fetch'}
        }

        all_combined_jobs_data.append(job_data_dict)
        print(f"Finished processing Job ID: {job.job_id}")

    output_filename = 'combined_jobs_data.json'
    if all_combined_jobs_data:
        print(f"\nSaving data for {len(all_combined_jobs_data)} jobs to {output_filename}...")
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(all_combined_jobs_data, f, ensure_ascii=False, indent=4, cls=DateTimeEncoder)
        print(f"Orchestration complete. Successfully saved data to {os.path.abspath(output_filename)}")
    else:
        print("\nNo job data was combined. The output file will not be created.")


if __name__ == "__main__":
    main()