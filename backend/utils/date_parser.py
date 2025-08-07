# backend/utils/date_parser.py
import re
from datetime import datetime, timedelta, timezone


def parse_relative_date(status_string: str) -> str:
    """
    Parses a relative date string (e.g., "Applied 2h ago", "3mo ago") into an ISO 8601 timestamp.
    """
    now = datetime.now(timezone.utc)

    # Fix: match longest units first
    match = re.search(r'(\d+)\s*(mo|y|w|d|h)', status_string.lower())
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
    elif unit == 'mo':
        delta = timedelta(days=value * 30)  # Approximation
    elif unit == 'y':
        delta = timedelta(days=value * 365)  # Approximation
    else:
        delta = timedelta()

    past_date = now - delta
    return past_date.isoformat()


def format_datetime_pt_br(dt: datetime) -> str:
    """
    Formats a datetime object to 'DD/mmm/YYYY at HH:MM' in Brazilian Portuguese month format.

    Example: 2025-08-06 15:43 → '06/ago/2025 at 15:43'
    """
    month_map_pt = {
        1: 'jan', 2: 'fev', 3: 'mar', 4: 'abr', 5: 'mai', 6: 'jun',
        7: 'jul', 8: 'ago', 9: 'set', 10: 'out', 11: 'nov', 12: 'dez'
    }
    day = f"{dt.day:02d}"
    month = month_map_pt[dt.month]
    year = dt.year
    time = dt.strftime('%H:%M')
    return f"{day}/{month}/{year} at {time}"