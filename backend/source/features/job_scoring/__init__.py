"""Production-facing job scoring feature package."""

from source.features.job_scoring.job_scoring_router import job_scoring_bp

__all__ = ["job_scoring_bp"]
