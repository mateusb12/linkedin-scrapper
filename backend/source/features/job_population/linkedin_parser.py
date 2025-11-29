from typing import List, Dict, Optional
from datetime import datetime

def extract_paging_info(data: Dict) -> Dict:
    """Extracts total, start, and count from the raw response."""
    try:
        base_path = data.get('data', {}).get('data', {}).get('jobsDashJobCardsByJobCollections', {})
        paging = base_path.get('paging', {})
        return {
            "total": paging.get('total', 0),
            "count": paging.get('count', 0),
            "start": paging.get('start', 0)
        }
    except Exception:
        return {"total": 0, "count": 0, "start": 0}

def parse_job_entries(data: Dict) -> List[Dict]:
    """
    Parses the raw LinkedIn response and returns a list of dictionaries
    ready for the JobRepository.
    """
    if not data or 'included' not in data:
        return []

    included_map = {item['entityUrn']: item for item in data.get('included', []) if 'entityUrn' in item}
    parsed_jobs = []

    # Filter for Job Cards
    job_cards = [
        item for item in included_map.values()
        if item.get('$type') == "com.linkedin.voyager.dash.jobs.JobPostingCard"
    ]

    for card in job_cards:
        job_urn = card.get('*jobPosting')
        if not job_urn:
            continue

        # Extract basic info
        title = card.get('jobPostingTitle', 'Unknown Title')
        location = card.get('secondaryDescription', {}).get('text', 'Unknown Location')

        # Extract Description Snippet
        snippet = card.get('relevanceInsight', {}).get('text', {}).get('text', '')

        # Extract Company URN
        company_urn = None
        logo_attributes = card.get('logo', {}).get('attributes', [])
        if logo_attributes:
            company_urn = logo_attributes[0].get('detailData', {}).get('*companyLogo')

        # Extract Timestamp
        posted_on = None
        easy_apply = False
        for footer in card.get('footerItems', []):
            if footer.get('type') == 'LISTED_DATE' and footer.get('timeAt'):
                # Convert ms timestamp to ISO string
                dt = datetime.fromtimestamp(footer['timeAt'] / 1000)
                posted_on = dt.isoformat()
            if footer.get('type') == 'EASY_APPLY_TEXT':
                easy_apply = True

        parsed_jobs.append({
            "urn": job_urn,
            "title": title,
            "location": location,
            "company_urn": company_urn,
            "posted_on": posted_on,
            "description_snippet": snippet,
            "easy_apply": easy_apply,
            "job_url": f"https://www.linkedin.com/jobs/view/{job_urn.split(':')[-1]}/",
            "description_full": "No description provided", # Default until detail fetch
            "processed": False
        })

    return parsed_jobs