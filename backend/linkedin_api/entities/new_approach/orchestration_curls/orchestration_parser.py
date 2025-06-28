import json
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict


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


def parse_orchestration_data(pagination_data: dict, structured_jobs_data: dict):
    """
    Main function to load, merge, and save the job data.
    """
    # --- 2. Pre-process data for efficient merging ---

    # Create a lookup map for structured jobs using the job ID as the key
    structured_jobs_map = {}
    for job_data in structured_jobs_data:
        job_id = get_id_from_url(job_data.get('job_url'))
        if job_id:
            structured_jobs_map[job_id] = job_data

    # --- 3. Instantiate dataclasses from pagination_data ---

    # Create Company objects
    companies = {
        urn: Company(
            urn=data['urn'],
            name=data['name'],
            logo_url=data['logo_url']
        )
        for urn, data in pagination_data.get('companies', {}).items()
    }

    # Create SeekerState objects
    seeker_states = {
        urn: SeekerState(**data)
        for urn, data in pagination_data.get('seeker_states', {}).items()
    }

    # --- 4. Merge job data ---
    merged_jobs = []
    for p_job in pagination_data.get('jobs', []):
        job_id = get_id_from_urn(p_job.get('urn'))
        s_job = structured_jobs_map.get(job_id)

        company_obj = companies.get(p_job.get('company_urn'))

        # Merge data if a corresponding structured job is found
        if s_job and company_obj:
            # Update company URL from structured data
            company_obj.url = s_job.get('company', {}).get('url')

            # Create a unified Job object
            job = Job(
                urn=p_job['urn'],
                title=p_job['title'],
                company_urn=p_job['company_urn'],
                location_names=p_job['location_names'],
                posted_on=p_job['posted_on'],  # Or s_job['posted_on'] if you prefer that format
                description_snippet=p_job['description_snippet'],
                easy_apply=p_job['easy_apply'],
                employment_type=s_job.get('employment_type'),  # Use more descriptive type
                workplace_type=s_job.get('workplace_type'),
                applicants=s_job.get('applicants'),
                job_state=s_job.get('job_state'),
                job_url=s_job.get('job_url'),
                description=JobDescription(**s_job['description']) if s_job.get('description') else None,
                company=company_obj
            )
        else:
            # Create a Job object with only pagination data
            job = Job(
                urn=p_job.get('urn'),
                title=p_job.get('title'),
                company_urn=p_job.get('company_urn'),
                location_names=p_job.get('location_names'),
                posted_on=p_job.get('posted_on'),
                description_snippet=p_job.get('description_snippet'),
                easy_apply=p_job.get('easy_apply'),
                employment_type=p_job.get('employment_type'),
                company=company_obj
            )
        merged_jobs.append(job)

    # --- 5. Assemble the final combined data structure ---
    combined_data = CombinedData(
        paging=Paging(**pagination_data['paging']),
        metadata=Metadata(**pagination_data['metadata']),
        jobs=merged_jobs,
        companies=companies,
        geos=pagination_data.get('geos', {}),
        seeker_states=seeker_states
    )

    # --- 6. Serialize the combined data to a new JSON file ---
    # Convert the dataclass object to a dictionary for JSON serialization
    output_dict = asdict(combined_data)

    return output_dict