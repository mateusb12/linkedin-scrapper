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
import unicodedata
from dataclasses import asdict
from typing import Any, Callable, Dict, Iterable, List, Optional

import requests

from source.features.enrich_jobs.linkedin_http_job_enricher import (
    LinkedInJobEnricher,
    RetryableEnrichmentError,
    NonRetryableEnrichmentError,
    AuthExpiredError,
    InvalidPremiumApplicantsError,
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
        self.last_failure_context: Dict[str, Any] = {}

        self.blacklist: list[str] = []
        self._blacklist_set: set[str] = set()

    def set_blacklist(self, companies: Optional[List[str]]) -> None:
        self.blacklist = [str(c).strip() for c in (companies or []) if str(c).strip()]
        self._blacklist_set = {
            self._normalize_company_name(company)
            for company in self.blacklist
            if self._normalize_company_name(company)
        }

    def clear_blacklist(self) -> None:
        self.blacklist = []
        self._blacklist_set = set()

    def _normalize_company_name(self, value: Optional[str]) -> str:
        if not value:
            return ""

        text = str(value).strip().lower()
        text = unicodedata.normalize("NFKD", text)
        text = "".join(ch for ch in text if not unicodedata.combining(ch))
        text = " ".join(text.split())
        return text

    def _is_blacklisted(self, seed_data: Optional[Dict[str, Any]]) -> bool:
        if not self._blacklist_set or not seed_data:
            return False

        company_name = (
                seed_data.get("company")
                or seed_data.get("company_name")
                or ""
        )

        normalized_company = self._normalize_company_name(company_name)
        return normalized_company in self._blacklist_set

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

    def _config_for_operation(self, label: str) -> str:
        if label == "fetch_job_details":
            return "SavedJobs"
        if label == "fetch_premium_insights":
            return "PremiumInsights"
        if label == "fetch_notifications_for_job":
            return "Notifications"
        if label == "fetch_company_details":
            return "SavedJobs"
        return "unknown"

    def _record_failure_context(self, label: str, exc: Exception) -> None:
        status_code = getattr(exc, "status_code", None)
        operation = getattr(exc, "operation", label)
        message = str(exc)
        failed_config = self._config_for_operation(label)
        self.last_failure_context = {
            "operation": operation,
            "job_id": self._current_job_id,
            "status_code": status_code,
            "failed_config": failed_config,
            "message": message,
            "action": f"Refresh the '{failed_config}' LinkedIn curl/config.",
        }
        for attr in (
                "title",
                "company",
                "source",
                "provider",
                "raw_applicants_value",
                "normalized_applicants_value",
                "config_id",
                "config_name",
                "reason",
        ):
            value = getattr(exc, attr, None)
            if value is not None:
                self.last_failure_context[attr] = value

    def _with_backoff(
            self,
            label: str,
            fn: Callable[[], Any],
    ) -> Any:
        last_exc: Optional[Exception] = None

        for attempt in range(1, self.max_attempts + 1):
            try:
                return fn()

            except AuthExpiredError as e:
                self._record_failure_context(label, e)
                raise

            except InvalidPremiumApplicantsError as e:
                self._record_failure_context(label, e)
                raise

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

        # SKIP EARLY IF BLACKLISTED
        if self._is_blacklisted(base_job_dict):
            _log(
                f"🚫 Skipping enrichment for blacklisted company "
                f"'{base_job_dict.get('company')}' on job {job_id}"
            )

            base_job_dict.update({
                "blacklisted": True,
                "enrichment_skipped": True,
                "enrichment_skip_reason": "company_blacklist",
                "description_full": None,
                "notification": None,
                "premium_component_found": False,
                "applicants_total": None,
                "applicants_last_24h": None,
                "seniority_distribution": [],
                "education_distribution": [],
                "premium_title": None,
                "premium_description": None,
                "learn_more_url": None,
                "data_sdui_components": [],
            })

            self._current_job_id = None
            return JobPost.from_dict(base_job_dict)

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
            self._validate_premium_applicants(job_id, base_job_dict, premium)
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

            base_job_dict["blacklisted"] = False

            return JobPost.from_dict(base_job_dict)

        except AuthExpiredError:
            raise  # never swallow — caller must abort the loop

        except InvalidPremiumApplicantsError:
            raise

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

    def _validate_premium_applicants(
            self,
            job_id: str,
            base_job_dict: Dict[str, Any],
            premium: Dict[str, Any],
    ) -> None:
        raw_applicants = premium.get("applicants_total") if isinstance(premium, dict) else None
        premium_low_data_state = bool(
            isinstance(premium, dict) and premium.get("premium_low_data_state")
        )

        if raw_applicants == -1:
            return

        if raw_applicants == 0 and premium_low_data_state:
            return

        invalid = raw_applicants in (None, 0)

        if not invalid:
            return

        config_name = self.single.premium_config_name
        config_id = self.single.premium_config_id
        reason = (
            "premium details enrichment returned no valid applicants_total; "
            "aborting to avoid exposing a misleading 0 applicants value"
        )
        _log(
            "[ENRICHMENT_ABORT] "
            f"stage=fetch_premium_insights "
            f"source=linkedin "
            f"provider=premiumApplicantInsights "
            f"job_id={job_id} "
            f"external_job_id={job_id} "
            f"title={repr(base_job_dict.get('title'))} "
            f"company={repr(base_job_dict.get('company'))} "
            f"raw_applicants_value={repr(raw_applicants)} "
            f"normalized_applicants_value=0 "
            f"config={config_name}:{config_id} "
            f"reason={reason}"
        )

        exc = InvalidPremiumApplicantsError(
            operation=f"fetch_premium_insights({job_id})",
            message=(
                "Premium details enrichment failed: applicants data came back invalid "
                f"({raw_applicants!r}) from config {config_name}:{config_id}. "
                "The PremiumInsights curl/config may be expired, invalid, or stale. "
                "The stream was interrupted intentionally to avoid misleading data."
            ),
        )
        exc.job_id = job_id
        exc.title = base_job_dict.get("title")
        exc.company = base_job_dict.get("company")
        exc.source = "linkedin"
        exc.provider = "premiumApplicantInsights"
        exc.raw_applicants_value = raw_applicants
        exc.normalized_applicants_value = 0
        exc.config_id = config_id
        exc.config_name = config_name
        exc.reason = reason
        raise exc
