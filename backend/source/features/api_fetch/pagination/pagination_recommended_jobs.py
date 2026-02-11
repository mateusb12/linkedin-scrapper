from dataclasses import dataclass
from datetime import datetime, date
from typing import List, Optional, Dict

# --- Dataclass Definitions ---

@dataclass
class Paging:
    count: int
    start: int
    total: int

@dataclass
class Metadata:
    resultsCountHeader: str
    resultsCountHeaderWithTotal: str

@dataclass
class Company:
    urn: str
    name: str
    logo_url: Optional[str]

@dataclass
class Geo:
    urn: str
    name: str

@dataclass
class JobSeekerState:
    job_card_urn: str
    is_saved: bool
    is_applied: bool

@dataclass
class JobPostingSummary:
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
    paging: Paging
    metadata: Metadata
    jobs: List[JobPostingSummary]
    companies: Dict[str, Company]
    geos: Dict[str, Geo]
    seeker_states: Dict[str, JobSeekerState]


# --- Response Parsing Logic ---

def parse_jobs_page(data: Dict) -> Optional[JobsPage]:
    """
    Pure logic function: Converts raw LinkedIn API JSON into a structured JobsPage object.
    """
    if not data or 'data' not in data or 'included' not in data:
        print("Error: Invalid or empty data provided to parser.")
        return None

    included_map = {item['entityUrn']: item for item in data.get('included', []) if 'entityUrn' in item}

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
            resultsCountHeaderWithTotal=header_text
        )
    except KeyError as e:
        print(f"Error: Could not find paging/metadata information. Missing key: {e}")
        return None

    companies: Dict[str, Company] = {}
    geos: Dict[str, Geo] = {}

    for urn, item in included_map.items():
        item_type = item.get('$type')

        if item_type == "com.linkedin.voyager.dash.organization.Company":
            logo_url = None
            logo_info = (item.get("logoResolutionResult") or {}).get("vectorImage") or {}
            if logo_info and logo_info.get("rootUrl") and logo_info.get("artifacts"):
                artifact = next((a for a in logo_info["artifacts"] if a.get("width") == 200),
                                logo_info["artifacts"][0] if logo_info["artifacts"] else None)
                if artifact:
                    logo_url = logo_info["rootUrl"] + artifact["fileIdentifyingUrlPathSegment"]

            companies[urn] = Company(
                urn=urn,
                name=item.get('name', 'Unknown Company'),
                logo_url=logo_url
            )
        elif item_type == "com.linkedin.voyager.dash.common.geo.Geo":
            geos[urn] = Geo(
                urn=urn,
                name=item.get('name', 'Unknown Location')
            )

    jobs: List[JobPostingSummary] = []
    seeker_states: Dict[str, JobSeekerState] = {}

    job_cards = [item for item in included_map.values() if
                 item.get('$type') == "com.linkedin.voyager.dash.jobs.JobPostingCard"]

    for card in job_cards:
        job_card_urn = card.get('entityUrn')
        if not job_card_urn:
            continue

        company_urn = None
        logo_attributes = card.get('logo', {}).get('attributes', [])
        if logo_attributes:
            company_urn = logo_attributes[0].get('detailData', {}).get('*companyLogo')

        if company_urn and company_urn in companies:
            company_name_from_card = card.get('primaryDescription', {}).get('text')
            if company_name_from_card:
                companies[company_urn].name = company_name_from_card

        posted_on_date = None
        easy_apply = False
        for item in card.get('footerItems', []):
            if item.get('type') == 'LISTED_DATE' and item.get('timeAt'):
                posted_on_date = datetime.fromtimestamp(item['timeAt'] / 1000).date()
            if item.get('type') == 'EASY_APPLY_TEXT':
                easy_apply = True

        relevance_insight = card.get('relevanceInsight') or {}
        text_insight = relevance_insight.get('text') or {}
        description_snippet = text_insight.get('text', '')

        job_summary = JobPostingSummary(
            urn=card.get('*jobPosting'),
            title=card.get('jobPostingTitle', 'No Title'),
            company_urn=company_urn,
            location_names=[card.get('secondaryDescription', {}).get('text', 'No Location')],
            posted_on=posted_on_date,
            description_snippet=description_snippet,
            easy_apply=easy_apply,
            employment_type=""
        )
        jobs.append(job_summary)

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

    valid_jobs = [j for j in jobs if j.urn is not None and j.title != "No Title"]

    return JobsPage(
        paging=paging,
        metadata=metadata,
        jobs=valid_jobs,
        companies=companies,
        geos=geos,
        seeker_states=seeker_states
    )