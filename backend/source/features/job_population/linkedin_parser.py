from typing import List, Dict, Optional
from datetime import datetime

def extract_paging_info(data: Dict) -> Dict:
    """Extracts total, start, and count from the raw response."""
    try:
        # Use safe chaining
        data_block = (data.get('data') or {}).get('data') or {}
        base_path = data_block.get('jobsDashJobCardsByJobCollections') or {}
        paging = base_path.get('paging') or {}
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

        job_id = job_urn.split(':')[-1]

        # --- SAFE EXTRACTION START ---
        # We use (dict.get(key) or {}) to handle cases where the value is None (JSON null)

        # Title
        title = card.get('jobPostingTitle', 'Unknown Title')

        # Location
        # If secondaryDescription is null, we default to {} so .get() works
        secondary_desc = card.get('secondaryDescription') or {}
        location = secondary_desc.get('text', 'Unknown Location')

        # Snippet
        insight = card.get('relevanceInsight') or {}
        insight_text_obj = insight.get('text') or {}
        snippet = insight_text_obj.get('text', '')

        # Company Info
        company_urn = None
        logo = card.get('logo') or {}
        logo_attributes = logo.get('attributes', [])

        if logo_attributes and len(logo_attributes) > 0:
            # Check detailData inside the first attribute
            detail_data = logo_attributes[0].get('detailData') or {}
            company_urn = detail_data.get('*companyLogo')

        # Timestamp
        posted_on = None
        easy_apply = False
        footer_items = card.get('footerItems') or []

        for footer in footer_items:
            if footer.get('type') == 'LISTED_DATE' and footer.get('timeAt'):
                # Convert ms timestamp to ISO string
                dt = datetime.fromtimestamp(footer['timeAt'] / 1000)
                posted_on = dt.isoformat()
            if footer.get('type') == 'EASY_APPLY_TEXT':
                easy_apply = True
        # --- SAFE EXTRACTION END ---

        parsed_jobs.append({
            "urn": job_urn,
            "job_id": job_id,
            "title": title,
            "location": location,
            "company_urn": company_urn,
            "posted_on": posted_on,
            "description_snippet": snippet,
            "easy_apply": easy_apply,
            "job_url": f"https://www.linkedin.com/jobs/view/{job_urn.split(':')[-1]}/",
            "description_full": "No description provided",
            "processed": False
        })

    return parsed_jobs