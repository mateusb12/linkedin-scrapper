import json
import re
import time
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from urllib.parse import quote

import requests


# This assumes you have a local module for loading the file.
# If the script is in the same directory as the file loader, this should work.
# from backend.path.file_content_loader import load_pagination_file

# --- MOCK for load_pagination_file since it's not provided ---
def load_pagination_file(filename: str) -> Dict[str, Any]:
    """Mocks the file loader to return URNs for demonstration."""
    print(f"--- MOCK: Loading URNs for '{filename}' ---")
    return {
        "jobs": [
            {"urn": "urn:li:jobPosting:4245505881"},
            {"urn": "urn:li:jobPosting:4237003528"},
        ]
    }


# -----------------------------------------------------------------


# ---------- 1. CONFIG --------------------------------------------------------

# IMPORTANT: The cURL string must be updated with a valid session.
MAIN_CURL = """
curl 'https://www.linkedin.com/voyager/api/graphql?variables=(jobPostingDetailDescription_start:0,jobPostingDetailDescription_count:5,jobCardPrefetchQuery:(prefetchJobPostingCardUrns:List(urn%3Ali%3Afsd_jobPostingCard%3A%284245505881%2CJOB_DETAILS%29),jobUseCase:JOB_DETAILS,count:1),jobDetailsContext:(isJobSearch:false))&queryId=voyagerJobsDashJobCards.174f05382121bd73f2f133da2e4af893' \
  -H 'accept: application/vnd.linkedin.normalized+json+2.1' \
  -H 'accept-language: en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7' \
  -b 'JSESSIONID="ajax:2584240299603910567"; li_at=AQEFAHUBAAAAABSqG7UAAAGXXzKSSAAAAZfQlkN3TQAAGHVybjpsaTptZW1iZXI6MTAyNjk0MzMwNWYm1DqJn9kEYGnmmj4HkCVrpl3L5eJp6SCHmQzh2UvTrNb4ZCrO6KrDqSahqKv352NrmK4nJ1ykljhPY1R_9fkxPKDDuXtFCJ252bFBMOqLHvgD4aER9aFWxI8uVrqQ-XclO2lS7kCDkElsJKBhmnizusR5CU2Vp131PBgPeO4t3b3NWk0VPkYPH7fgogE7wmRuSTI;' \
  -H 'csrf-token: ajax:2584240299603910567' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0' \
  -H 'referer: https://www.linkedin.com/jobs/collections/recommended/'
"""


# --- Extract parameters from MAIN_CURL string ---
def get_curl_param(pattern: str, text: str) -> str | None:
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(1).strip() if match else None


CSRF_TOKEN = get_curl_param(r'csrf-token: *"?ajax:([^;"]+)"?', MAIN_CURL)
LI_AT = get_curl_param(r"li_at=([^;]+)", MAIN_CURL)
USER_AGENT = get_curl_param(r"-H 'user-agent: (.*?)'", MAIN_CURL)
REFERER = get_curl_param(r"-H 'referer: (.*?)'", MAIN_CURL)

INPUT_FILE_PAGINATION: dict = load_pagination_file("structured_pagination_results.json")
RAW_OUTPUT_FILE = Path("job_details.json")
STRUCTURED_OUTPUT_FILE = Path("structured_job_details.json")


# ---------- 2. STRUCTURED DATACLASSES ---------------------------------------

@dataclass
class Company:
    """Structured data for a company."""
    name: Optional[str] = None
    urn: Optional[str] = None


@dataclass
class JobInsight:
    """Structured data for job insights like location and employment type."""
    location: Optional[str] = None
    employment_type: Optional[str] = None
    workplace_type: Optional[str] = None


@dataclass
class JobDetails:
    """Structured data for the core job details."""
    title: Optional[str] = None
    posted_on: Optional[str] = None
    total_applicants: Optional[int] = None
    description_text: Optional[str] = None
    sections: Dict[str, List[str]] = field(default_factory=dict)


@dataclass
class StructuredJob:
    """Top-level dataclass for a fully structured job posting."""
    urn: str
    job_details: JobDetails
    company: Company
    insights: JobInsight


# ---------- 3. PARSING AND STRUCTURING LOGIC ---------------------------------

def _find_in_included(raw_job: Dict[str, Any], type_name: str) -> Optional[Dict[str, Any]]:
    """Finds the first object of a given $type in the 'included' list."""
    for item in raw_job.get("detailResponse", {}).get("included", []):
        if item.get("$type") == type_name:
            return item
    return None


def _parse_description_sections(description: str) -> Tuple[str, Dict[str, List[str]]]:
    """
    (FIXED) Parses a job description string to extract key sections using a more
    robust find-and-slice method.
    """
    if not description:
        return "", {}

    section_keywords = {
        "responsibilities": ["Responsibilities and aatributions", "About The Role", "Responsabilidades e atribuições"],
        "requirements": ["Requirements", "Requisitos e qualificações"],
        "benefits": ["Benefits", "Nossos Benefícios"],
        "how_to_apply": ["How To Get Started"],
        "process_steps": ["Etapas do processo"],
    }

    # Find all keyword occurrences and their positions
    found_matches = []
    for key, keywords in section_keywords.items():
        for keyword in keywords:
            # Use finditer to get match objects with start/end positions
            for match in re.finditer(re.escape(keyword), description, re.IGNORECASE):
                found_matches.append({'key': key, 'start': match.start(), 'end': match.end()})

    # If no keywords are found, the whole description is the "about" section
    if not found_matches:
        return description.strip(), {}

    # Sort matches by their starting position in the text
    found_matches.sort(key=lambda x: x['start'])

    parsed_sections = {}
    # The "about" section is everything before the first keyword
    about_section = description[:found_matches[0]['start']].strip()

    # Slice the description between keywords to get section content
    for i, match in enumerate(found_matches):
        section_key = match['key']

        # The content starts after the current keyword
        content_start = match['end']

        # The content ends at the start of the next keyword, or at the end of the string
        content_end = len(description)
        if i + 1 < len(found_matches):
            content_end = found_matches[i + 1]['start']

        content = description[content_start:content_end].strip()

        # Split content into a list of lines/bullet points
        if content:
            list_items = [line.strip() for line in content.split('\n') if line.strip()]
            parsed_sections[section_key] = list_items

    return about_section, parsed_sections


def structure_raw_data(raw_jobs_data: List[Dict[str, Any]]) -> None:
    """Reads raw JSON data, structures it using dataclasses, and saves it."""
    print("\n--- Starting Data Structuring Process ---")
    structured_results: List[StructuredJob] = []

    for raw_job in raw_jobs_data:
        job_urn = raw_job.get("jobPostingUrn", "Unknown URN")

        # Find key entities in the 'included' list
        job_posting_entity = _find_in_included(raw_job, "com.linkedin.voyager.dash.jobs.JobPosting")
        job_desc_entity = _find_in_included(raw_job, "com.linkedin.voyager.dash.jobs.JobDescription")
        company_entity = _find_in_included(raw_job, "com.linkedin.voyager.dash.organization.Company")
        job_card_entity = _find_in_included(raw_job, "com.linkedin.voyager.dash.jobs.JobPostingCard")

        if not all([job_posting_entity, job_desc_entity, company_entity, job_card_entity]):
            print(f"Skipping URN {job_urn} due to missing essential data.")
            continue

        # 1. Parse JobInsights
        insights = JobInsight()
        if insights_data := job_card_entity.get("jobInsightsV2ResolutionResults"):
            insight_descriptions = insights_data[0].get("jobInsightViewModel", {}).get("description", [])
            for item in insight_descriptions:
                text_item = item.get("text", {})
                if not text_item: continue
                text = text_item.get("text", "").lower()

                if "remote" in text or "híbrido" in text:
                    insights.workplace_type = text_item.get("text")
                elif "full-time" in text or "part-time" in text or "tempo integral" in text:
                    insights.employment_type = text_item.get("text")

        geo_entity = _find_in_included(raw_job, "com.linkedin.voyager.dash.common.Geo")
        insights.location = geo_entity.get("defaultLocalizedName") if geo_entity else "N/A"

        # 2. Parse Company
        company = Company(
            name=company_entity.get("name"),
            urn=company_entity.get("entityUrn")
        )

        # 3. Parse JobDetails
        full_description_text = job_desc_entity.get("descriptionText", {}).get("text", "")
        about_text, sections = _parse_description_sections(full_description_text)

        # Extract total applicants from tertiary description
        applicants_text = job_card_entity.get("tertiaryDescription", {}).get("text", "")
        applicants_match = re.search(r'(\d+)\s+applicants', applicants_text)
        total_applicants = int(applicants_match.group(1)) if applicants_match else None

        job_details = JobDetails(
            title=job_posting_entity.get("title"),
            posted_on=job_desc_entity.get("postedOnText"),
            description_text=about_text,
            sections=sections,
            total_applicants=total_applicants
        )

        # 4. Assemble the final structured object
        structured_job = StructuredJob(
            urn=job_urn,
            job_details=job_details,
            company=company,
            insights=insights
        )

        structured_results.append(structured_job)
        print(f"Successfully structured URN: {job_urn}")

    if structured_results:
        results_as_dict = [asdict(job) for job in structured_results]
        STRUCTURED_OUTPUT_FILE.write_text(
            json.dumps(results_as_dict, indent=2, ensure_ascii=False),
            encoding='utf-8'
        )
        print(f"\nSaved {len(structured_results)} structured jobs to {STRUCTURED_OUTPUT_FILE}")
    else:
        print("\nNo jobs were structured.")


# ---------- 4. MAIN EXECUTION LOGIC -----------------------------------------

def make_session() -> requests.Session:
    """Prime a requests session with all headers/cookies once."""
    s = requests.Session()
    s.headers.update({
        "accept": "application/vnd.linkedin.normalized+json+2.1",
        "csrf-token": CSRF_TOKEN,
        "user-agent": USER_AGENT,
        "x-li-lang": "en_US",
        "x-restli-protocol-version": "2.0.0",
        "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
    })
    if REFERER:
        s.headers["referer"] = REFERER
    s.cookies.update({"li_at": LI_AT, "JSESSIONID": CSRF_TOKEN})
    return s


def fetch_detail(session: requests.Session, job_urn: str) -> Dict[str, Any]:
    """Return parsed JSON for one job’s detail-sections payload."""
    base_url = "https://www.linkedin.com/voyager/api/graphql"
    query_id = "voyagerJobsDashJobCards.174f05382121bd73f2f133da2e4af893"

    job_id_match = re.search(r'(\d+)$', job_urn)
    if not job_id_match:
        raise ValueError(f"Could not extract numeric ID from job URN: {job_urn}")
    job_id = job_id_match.group(1)

    prefetch_card_urn = f"urn:li:fsd_jobPostingCard:({job_id},JOB_DETAILS)"
    variables_str = f"(jobCardPrefetchQuery:(prefetchJobPostingCardUrns:List({quote(prefetch_card_urn)})))"
    full_url = f"{base_url}?variables={variables_str}&queryId={query_id}"

    r = session.get(full_url, timeout=20)
    r.raise_for_status()

    return r.json()


def main() -> None:
    """Main execution function."""
    urns = [j["urn"] for j in INPUT_FILE_PAGINATION.get("jobs", []) if j.get("urn")]
    if not urns:
        print("No job URNs found in the input file.")
        return

    raw_results = []
    if RAW_OUTPUT_FILE.exists():
        print(f"'{RAW_OUTPUT_FILE}' already exists. Loading data from file.")
        try:
            raw_results = json.loads(RAW_OUTPUT_FILE.read_text(encoding='utf-8'))
        except json.JSONDecodeError:
            print(f"Warning: Could not decode JSON from {RAW_OUTPUT_FILE}. Refetching data.")
            RAW_OUTPUT_FILE.unlink()  # Remove corrupted file

    if not raw_results:
        print("--- Starting Raw Data Fetching ---")
        sess = make_session()
        urns_to_process = urns
        print(f"Processing {len(urns_to_process)} jobs.")

        for idx, urn in enumerate(urns_to_process, start=1):
            try:
                print(f"[{idx}/{len(urns_to_process)}] Fetching {urn}… ", end="", flush=True)
                data = fetch_detail(sess, urn)
                raw_results.append({"jobPostingUrn": urn, "detailResponse": data})
                print("✓ SUCCESS")
                time.sleep(1.5)
            except requests.exceptions.RequestException as exc:
                print(f"FAILED → HTTP Error: {exc}")
            except Exception as exc:
                print(f"FAILED → An unexpected error occurred: {exc}")

        if raw_results:
            RAW_OUTPUT_FILE.write_text(
                json.dumps(raw_results, indent=2, ensure_ascii=False),
                encoding='utf-8'
            )
            print(f"\nSaved {len(raw_results)} raw jobs to {RAW_OUTPUT_FILE}")
        else:
            print("\nNo raw jobs were successfully fetched.")
            return

    if raw_results:
        structure_raw_data(raw_results)
    else:
        print("No data available to structure.")


if __name__ == "__main__":
    missing_vars = [
        var_name for var_name, var_value in {
            "LI_AT": LI_AT,
            "CSRF_TOKEN": CSRF_TOKEN,
            "USER_AGENT": USER_AGENT,
        }.items() if not var_value
    ]
    if missing_vars:
        raise SystemExit(
            f"Could not parse required parameters from the cURL string: {', '.join(missing_vars)}"
        )

    print("--- Initial Parameters Parsed Successfully ---")
    print(f"LI_AT: ...{LI_AT[-10:]}")
    # Clean up CSRF token for display
    print(f"CSRF_TOKEN: {CSRF_TOKEN.split('''-H''')[0].strip().replace('''"''', '')}")
    print("-" * 44 + "\n")

    main()