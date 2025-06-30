import json
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import List, Optional, Dict

from path.path_reference import get_output_curls_folder_path


# --- Dataclass Definitions ---
# Based on the analysis of both JSON files, we define a set of dataclasses
# that will hold the combined information.

@dataclass
class Paging:
    """Represents the pagination information."""
    count: int
    start: int
    total: int


@dataclass
class Metadata:
    """Represents the metadata for the job search results."""
    resultsCountHeader: str
    resultsCountHeaderWithTotal: str


@dataclass
class Company:
    """Represents a company with details from both files."""
    urn: str
    name: str
    logo_url: str
    url: Optional[str] = None  # This field comes from structured_jobs.json


@dataclass
class JobDescription:
    """Represents the detailed job description."""
    about: Optional[str]
    responsibilities: Optional[str]
    requirements: Optional[str]
    benefits: Optional[str]
    full_text: str


@dataclass
class SeekerState:
    """Represents the seeker's interaction state with a job."""
    job_card_urn: str
    is_saved: bool
    is_applied: bool


@dataclass
class Job:
    """Represents a single, unified job posting with all available data."""
    # --- Fields from pagination_data.json ---
    urn: str
    title: str
    company_urn: str
    location_names: List[str]
    posted_on: str
    description_snippet: str
    easy_apply: bool

    # --- Fields from structured_jobs.json (optional) ---
    workplace_type: Optional[str] = None
    applicants: Optional[int] = None
    job_state: Optional[str] = None
    job_url: Optional[str] = None
    description: Optional[JobDescription] = None

    # --- Combined and enriched fields ---
    company: Optional[Company] = None
    # The employment_type from structured_jobs is more reliable
    employment_type: Optional[str] = None


@dataclass
class CombinedData:
    """The root dataclass for the final combined JSON structure."""
    paging: Paging
    metadata: Metadata
    jobs: List[Job]
    companies: Dict[str, Company]
    geos: Dict
    seeker_states: Dict[str, SeekerState]


def get_id_from_urn(urn: str) -> Optional[str]:
    """Extracts the numeric ID from a LinkedIn URN."""
    try:
        return urn.split(':')[-1]
    except (IndexError, AttributeError):
        return None


def get_id_from_url(url: str) -> Optional[str]:
    """Extracts the numeric job ID from a LinkedIn job URL."""
    try:
        # Handles URLs like 'https://www.linkedin.com/job-apply/4244689637'
        return url.split('/')[-1].split('?')[0]
    except (IndexError, AttributeError):
        return None


def parse_orchestration_data(pagination_data: dict, structured_jobs_data: list):
    """
    Combines pagination data and structured job data into a unified structure.

    This function iterates through the list of jobs and enriches the detailed
    job information with data from the pagination dictionary, such as company
    logos, URNs, and the user's application status for each job.

    Args:
        pagination_data: A dictionary containing paginated job search results,
                         which includes company information, job summaries,
                         paging details, and seeker states.
        structured_jobs_data: A list of dictionaries, where each dictionary
                                contains detailed information for a single job.

    Returns:
        A dictionary containing a list of unified job objects, along with the
        original metadata and paging information.
    """
    unified_jobs = []

    # A mapping of company URNs to their details for quick lookup
    companies_map = pagination_data.get('companies', {})

    # A mapping of seeker states for quick lookup. The key is the job ID.
    seeker_states_map = {}
    for key, state in pagination_data.get('seeker_states', {}).items():
        match = re.search(r'\((\d+),', key)
        if match:
            job_id = match.group(1)
            seeker_states_map[job_id] = state

    # Iterate through both job lists simultaneously.
    for i, job_summary in enumerate(pagination_data.get('jobs', [])):
        # Ensure we don't go out of bounds for the detailed jobs list.
        if i >= len(structured_jobs_data):
            break

        detailed_job = structured_jobs_data[i]

        # Start with the detailed job data as the base for our unified object.
        unified_job = detailed_job.copy()

        # Merge the summary data. We prefer the more detailed data, so we only add
        # a field from the summary if it's not already present in the detailed view.
        for key, value in job_summary.items():
            if key not in unified_job or unified_job[key] is None or unified_job[key] == '':
                unified_job[key] = value

        # Enrich the company information.
        company_urn = job_summary.get('company_urn')
        if company_urn in companies_map:
            # Merge company details from both sources
            merged_company = companies_map[company_urn].copy()
            if 'company' in detailed_job and detailed_job['company']:
                merged_company.update(detailed_job['company'])
            unified_job['company'] = merged_company

        # Add the seeker state (e.g., if the job has been saved or applied to).
        job_urn = job_summary.get('urn')
        if job_urn:
            job_id_match = re.search(r'\d+$', job_urn)
            if job_id_match:
                job_id = job_id_match.group(0)
                if job_id in seeker_states_map:
                    unified_job['seeker_state'] = seeker_states_map[job_id]

        unified_jobs.append(unified_job)

    # Construct the final result, preserving metadata and pagination controls.
    final_result = {
        'jobs': unified_jobs,
        'metadata': pagination_data.get('metadata', {}),
        'paging': pagination_data.get('paging', {})
    }

    return final_result


def main():
    # Load the JSON files
    output_folder = get_output_curls_folder_path()

    with open(Path(output_folder, 'pagination_data.json'), 'r', encoding='utf-8') as f:
        pagination_data = json.load(f)

    with open(Path(output_folder, 'structured_jobs.json'), 'r', encoding='utf-8') as f:
        structured_jobs_data = json.load(f)

    # Parse and combine the data
    combined_data = parse_orchestration_data(pagination_data, structured_jobs_data)

    # Save the combined data to a new JSON file
    with open('combined_jobs.json', 'w', encoding='utf-8') as f:
        json.dump(combined_data, f, indent=4, ensure_ascii=False)


if __name__ == '__main__':
    main()
