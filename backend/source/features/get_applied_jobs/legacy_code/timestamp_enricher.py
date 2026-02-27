import logging
import time
from datetime import datetime, timezone
import requests

def fetch_exact_applied_date(session: requests.Session, job_urn: str) -> datetime | None:
    """
    Mimics the 'Golden Curl': Hits the jobPostings endpoint to retrieve the
    exact 'applyingInfo.appliedAt' timestamp.

    Args:
        session: The authenticated requests Session.
        job_urn: The full URN (e.g., 'urn:li:jobPosting:12345')
    """
    # Extract the numeric ID from the URN
    job_id = job_urn.split(":")[-1]

    # The Golden Endpoint found in your Bash script
    url = f"https://www.linkedin.com/voyager/api/jobs/jobPostings/{job_id}"

    # Headers are already in the session, but we ensure JSON acceptance
    headers = {
        'accept': 'application/json',
        'x-restli-protocol-version': '2.0.0'
    }

    try:
        # Respectful delay to prevent rate limiting (like sleep 1 in bash)
        time.sleep(1.0)

        response = session.get(url, headers=headers, timeout=10)

        if response.status_code != 200:
            logging.warning(f"Failed to fetch details for {job_id}: {response.status_code}")
            return None

        data = response.json()

        # JQ Equivalent: .applyingInfo.appliedAt
        applying_info = data.get("applyingInfo", {})
        timestamp_ms = applying_info.get("appliedAt")

        if timestamp_ms:
            # Convert ms to seconds for Python datetime
            dt = datetime.fromtimestamp(timestamp_ms / 1000.0, tz=timezone.utc)
            return dt

    except Exception as e:
        logging.error(f"Error enriching timestamp for {job_id}: {e}")

    return None