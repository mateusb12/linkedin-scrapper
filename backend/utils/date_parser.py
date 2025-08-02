# backend/utils/date_parser.py
import re
from datetime import datetime, timedelta, timezone


def parse_relative_date(status_string: str) -> str:
    """
    Parses a relative date string (e.g., "Applied 2h ago") into an ISO 8601 timestamp.
    """
    now = datetime.now(timezone.utc)

    # Regex to find the number and unit (h, d, w, mo, y)
    match = re.search(r'(\d+)\s*(h|d|w|mo|y)', status_string)
    if not match:
        return now.isoformat()  # Default to now if parsing fails

    value = int(match.group(1))
    unit = match.group(2)

    if unit == 'h':
        delta = timedelta(hours=value)
    elif unit == 'd':
        delta = timedelta(days=value)
    elif unit == 'w':
        delta = timedelta(weeks=value)
    elif unit == 'mo':  # Approximation
        delta = timedelta(days=value * 30)
    elif unit == 'y':  # Approximation
        delta = timedelta(days=value * 365)
    else:
        delta = timedelta()

    past_date = now - delta
    return past_date.isoformat()