from dataclasses import dataclass
from datetime import datetime, date
from typing import List, Optional, Dict

# --- DTOs (Data Transfer Objects) ---

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
class JobPostingSummary:
    urn: str
    title: str
    company_urn: Optional[str]
    location_names: List[str]
    posted_on: Optional[date]
    description_snippet: str
    easy_apply: bool

@dataclass
class JobsPage:
    paging: Paging
    metadata: Metadata
    jobs: List[JobPostingSummary]

# --- Parsing Logic ---

def parse_jobs_page(data: Dict) -> Optional[JobsPage]:
    """
    Pure logic: Converts raw LinkedIn API JSON into a structured JobsPage object.
    """
    if not data or 'data' not in data or 'included' not in data:
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
    except KeyError:
        return None

    jobs: List[JobPostingSummary] = []

    # Extract Job Cards
    job_cards = [item for item in included_map.values() if item.get('$type') == "com.linkedin.voyager.dash.jobs.JobPostingCard"]

    for card in job_cards:
        job_card_urn = card.get('entityUrn')
        if not job_card_urn: continue

        # Extract Company Logo/Name mapping if needed (Simplified for brevity)
        company_urn = None
        logo_attributes = card.get('logo', {}).get('attributes', [])
        if logo_attributes:
            company_urn = logo_attributes[0].get('detailData', {}).get('*companyLogo')

        # Extract Date
        posted_on_date = None
        easy_apply = False
        for item in card.get('footerItems', []):
            if item.get('type') == 'LISTED_DATE' and item.get('timeAt'):
                posted_on_date = datetime.fromtimestamp(item['timeAt'] / 1000).date()
            if item.get('type') == 'EASY_APPLY_TEXT':
                easy_apply = True

        # Extract Snippet
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
            easy_apply=easy_apply
        )
        jobs.append(job_summary)

    valid_jobs = [j for j in jobs if j.urn is not None and j.title != "No Title"]

    return JobsPage(paging=paging, metadata=metadata, jobs=valid_jobs)