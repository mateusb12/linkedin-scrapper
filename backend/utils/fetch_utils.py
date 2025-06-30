import re

from flask import abort
from sqlalchemy.orm import Session

from backend.models.fetch_models import FetchCurls


def ensure_singleton(db: Session) -> FetchCurls:
    """
    Guarantee there is a row with primary-key 1.
    If none exists, create one with both fields blank so
    later PUT calls can update each field independently.
    """
    singleton = db.get(FetchCurls, 1)
    if singleton is None:
        singleton = FetchCurls(pagination_curl="", individual_job_curl="")
        db.add(singleton)
        db.commit()
    return singleton


def validate_str(payload: dict, key: str) -> str:
    val = payload.get(key)
    if not isinstance(val, str) or not val.strip():
        abort(400, description=f"JSON body must contain a non-empty '{key}' string.")
    return val.strip()


def clean_and_prepare_curl(raw_curl: str) -> str:
    """
    Cleans a raw cURL string copied from a browser.

    1. Replaces Windows-style newlines with Unix-style.
    2. Removes erroneous newlines that are NOT part of a bash line continuation,
       which often occur from copying long, word-wrapped lines.
    3. Standardizes the valid bash line continuations.
    """
    # Normalize line endings to \n
    s = raw_curl.replace('\r\n', '\n')

    # This regex is the key. It finds any newline (\n) that is NOT
    # preceded by a space and a backslash. This is a negative lookbehind.
    # It will find and remove the bad newlines inside your URL and headers.
    # We replace the bad newline with a single space.
    s = re.sub(r'(?<! \\)\n', ' ', s)

    # Now, ensure the valid line continuations are standardized.
    # This makes the final string clean and predictable.
    s = s.replace(' \\\n', ' \\\n')  # Standardize the correct ones

    return s.strip()
