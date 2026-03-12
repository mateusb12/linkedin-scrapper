"""
linkedin_http_batch_enricher.py — BATCH ENRICHMENT ORCHESTRATOR

Owns cross-request concerns:
    - retry / exponential backoff / jitter
    - per-request pacing
    - per-job pacing
    - sequential batch enrichment

Low-level HTTP parsing stays inside LinkedInJobEnricher.
"""

import random
import time
from dataclasses import asdict
from typing import Any, Callable, Dict, Iterable, List, Optional

import requests

from source.features.enrich_jobs.linkedin_http_job_enricher import (
    LinkedInJobEnricher,
    RetryableEnrichmentError,
    NonRetryableEnrichmentError,
)
from source.features.get_applied_jobs.utils_proxy import (
    JobPost,
    REQUEST_DELAY_SECONDS,
    log as _log,
)


class BatchEnrichmentService:
    def __init__(
            self,
            debug: bool = False,
            slim_mode: bool = True,
            max_attempts: int = 4,
            base_backoff_seconds: float = 1.25,
            max_backoff_seconds: float = 12.0,
            jitter_seconds: float = 0.35,
            per_request_delay_seconds: float = 0.75,
            per_job_delay_seconds: float = REQUEST_DELAY_SECONDS,
            return_seed_on_failure: bool = True,
    ):
        self.debug = debug
        self.single = LinkedInJobEnricher(debug=debug, slim_mode=slim_mode)

        self.max_attempts = max_attempts
        self.base_backoff_seconds = base_backoff_seconds
        self.max_backoff_seconds = max_backoff_seconds
        self.jitter_seconds = jitter_seconds
        self.per_request_delay_seconds = per_request_delay_seconds
        self.per_job_delay_seconds = per_job_delay_seconds
        self.return_seed_on_failure = return_seed_on_failure

        self._current_job_id: Optional[str] = None

    def _sleep(self, seconds: float) -> None:
        if seconds and seconds > 0:
            time.sleep(seconds)

    def _compute_backoff(self, attempt: int) -> float:
        delay = min(
            self.max_backoff_seconds,
            self.base_backoff_seconds * (2 ** (attempt - 1)),
        )
        delay += random.uniform(0, self.jitter_seconds)
        return delay

    def _strip_private_keys(self, data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not isinstance(data, dict):
            return {}
        return {k: v for k, v in data.items() if not k.startswith("_")}

    def _with_backoff(
            self,
            label: str,
            fn: Callable[[], Any],
    ) -> Any:
        last_exc: Optional[Exception] = None

        for attempt in range(1, self.max_attempts + 1):
            try:
                return fn()

            except NonRetryableEnrichmentError:
                raise

            except RetryableEnrichmentError as e:
                last_exc = e

            except requests.RequestException as e:
                last_exc = RetryableEnrichmentError(
                    operation=label,
                    message=str(e),
                )

            if attempt >= self.max_attempts:
                break

            delay = self._compute_backoff(attempt)
            _log(
                f"⏳ Retryable failure in {label} for job {self._current_job_id} "
                f"(attempt {attempt}/{self.max_attempts}) -> sleeping {delay:.2f}s | {last_exc}"
            )
            self._sleep(delay)

        assert last_exc is not None
        raise last_exc

    def enrich_job(
            self,
            job_urn: str,
            seed_data: Optional[Dict[str, Any]] = None,
    ) -> JobPost:
        """
        Enrich one job with retry/backoff logic.
        seed_data is used as a safe fallback if enrichment partially or fully fails.
        """
        job_id = str(job_urn).split(":")[-1] if ":" in str(job_urn) else str(job_urn)
        self._current_job_id = job_id

        base_job_dict: Dict[str, Any] = {
            "job_id": job_id,
            "job_url": f"https://www.linkedin.com/jobs/view/{job_id}/",
            "title": None,
            "company": "Unknown",
            "location": None,
        }

        if seed_data:
            base_job_dict.update(seed_data)

        try:
            details = self._with_backoff(
                "fetch_job_details",
                lambda: self.single.fetch_job_details(job_id, raise_on_failure=True),
            )
            base_job_dict.update(self._strip_private_keys(details))
            self._sleep(self.per_request_delay_seconds)

            premium = self._with_backoff(
                "fetch_premium_insights",
                lambda: self.single.fetch_premium_insights(job_id, raise_on_failure=True),
            )
            base_job_dict.update(self._strip_private_keys(premium))
            self._sleep(self.per_request_delay_seconds)

            notification = self._with_backoff(
                "fetch_notifications_for_job",
                lambda: self.single.fetch_notifications_for_job(job_id, raise_on_failure=True),
            )
            base_job_dict["notification"] = asdict(notification) if notification else None

            if base_job_dict.get("company") in [None, "Unknown"] and base_job_dict.get("company_urn"):
                self._sleep(self.per_request_delay_seconds)

                company_info = self._with_backoff(
                    "fetch_company_details",
                    lambda: self.single.fetch_company_details(
                        base_job_dict["company_urn"],
                        raise_on_failure=True,
                    ),
                )

                if company_info.get("company_name"):
                    base_job_dict["company"] = company_info["company_name"]
                if company_info.get("company_url") and not base_job_dict.get("company_url"):
                    base_job_dict["company_url"] = company_info["company_url"]
                if company_info.get("company_logo") and not base_job_dict.get("company_logo"):
                    base_job_dict["company_logo"] = company_info["company_logo"]

            app_tot = base_job_dict.get("applicants_total")
            if isinstance(app_tot, int) and app_tot > 0:
                base_job_dict["applicants"] = app_tot

            return JobPost.from_dict(base_job_dict)

        except Exception as e:
            if self.return_seed_on_failure:
                _log(f"⚠️ Returning seed data for job {job_id} after enrichment failure: {e}")
                return JobPost.from_dict(base_job_dict)
            raise

        finally:
            self._sleep(self.per_job_delay_seconds)
            self._current_job_id = None

    def enrich_jobs(self, job_urns: Iterable[str]) -> List[JobPost]:
        return [self.enrich_job(job_urn) for job_urn in job_urns]

    def enrich_base_jobs(self, base_jobs: List[Dict[str, Any]]) -> List[JobPost]:
        return [
            self.enrich_job(base_job["job_id"], seed_data=base_job)
            for base_job in base_jobs
        ]
