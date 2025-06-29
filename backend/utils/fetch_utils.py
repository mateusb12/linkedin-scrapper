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
