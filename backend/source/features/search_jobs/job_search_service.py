from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

from source.features.enrich_jobs.linkedin_http_batch_enricher import (
    BatchEnrichmentService,
)
from source.features.enrich_jobs.linkedin_http_job_enricher import AuthExpiredError
from source.features.enrich_jobs.linkedin_http_job_enricher import InvalidPremiumApplicantsError
from source.features.search_jobs.curl_voyager_jobs_fetch import (
    DatePosted,
    ExperienceLevel,
    JobSearchTuning,
    SearchOrigin,
    SortBy,
    WorkType,
    fetch_and_save,
)
from source.features.search_jobs.curl_voyager_jobs_parse import (
    ParsedJobCard,
    ParseOutput,
    parse_linkedin_graphql_response,
    jobs_to_json_serializable,
)


def _deduplicate_jobs(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Remove duplicate jobs using normalized_job_posting_urn or job_id.
    """
    seen = set()
    unique = []

    for job in jobs:
        key = (
                job.get("normalized_job_posting_urn")
                or job.get("job_posting_urn")
                or job.get("job_id")
        )

        if key in seen:
            continue

        seen.add(key)
        unique.append(job)

    return unique


class LinkedInJobsSearchService:
    """
    Orchestrates:
    1) fetch raw LinkedIn GraphQL payload
    2) parse the payload into meaningful job card data
    3) enrich parsed jobs through BatchEnrichmentService
    4) optionally save raw and parsed/enriched JSON artifacts

    This class does NOT duplicate fetch or parse logic.
    It imports and reuses both existing files.
    """

    def __init__(
            self,
            base_dir: str | Path | None = None,
            debug: bool = False,
            slim_mode: bool = True,
    ):
        self.base_dir = Path(base_dir) if base_dir else Path(__file__).parent
        self.base_dir.mkdir(parents=True, exist_ok=True)

        self.debug = debug
        self.slim_mode = slim_mode
        self.batch_enricher = BatchEnrichmentService(
            debug=debug,
            slim_mode=slim_mode,
            return_seed_on_failure=True,
        )

    @property
    def raw_json_path(self) -> Path:
        return self.base_dir / "linkedin_graphql_response.json"

    @property
    def parsed_json_path(self) -> Path:
        return self.base_dir / "linkedin_graphql_parsed_jobs.json"

    def search_jobs(
            self,
            page: int = 1,
            count: int | None = None,
            tuning: JobSearchTuning | None = None,
            debug: bool = False,
            save_raw_json: bool = True,
            save_parsed_json: bool = True,
            enrich_jobs: bool = True,
            blacklist: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Wrapper síncrono para garantir retrocompatibilidade.
        Ele consome a versão stream e retorna apenas os dados finais processados.
        """
        result = {}
        for event in self.search_jobs_stream(
                page=page,
                count=count,
                tuning=tuning,
                debug=debug,
                save_raw_json=save_raw_json,
                save_parsed_json=save_parsed_json,
                enrich_jobs=enrich_jobs,
                blacklist=blacklist,
        ):
            if event.get("type") == "result":
                result = event.get("data", {})
            elif event.get("type") in {"auth_error", "enrichment_error"}:
                raise RuntimeError(
                    event.get("message") or event.get("error") or "Job search failed."
                )

        return result

    def search_jobs_stream(
            self,
            page: int = 1,
            count: int | None = None,
            tuning: JobSearchTuning | None = None,
            debug: bool = False,
            save_raw_json: bool = True,
            save_parsed_json: bool = True,
            enrich_jobs: bool = True,
            blacklist: list[str] | None = None,
    ):
        """
        Full orchestration flow for endpoint usage with stream/progress capability.
        Yields events throughout the lifecycle.
        """
        yield {"type": "progress", "step": "fetching", "message": "Fetching jobs from LinkedIn..."}

        raw_payload = fetch_and_save(
            page=page,
            count=count,
            tuning=tuning,
            debug=debug,
            save_json=save_raw_json,
        )

        if not save_raw_json and self.raw_json_path.exists():
            self.raw_json_path.unlink(missing_ok=True)

        yield {"type": "progress", "step": "parsing", "message": "Parsing payload data..."}

        parsed_output: ParseOutput = parse_linkedin_graphql_response(raw_payload)

        parsed_jobs_json = jobs_to_json_serializable(parsed_output.jobs)

        original_job_count = len(parsed_jobs_json)
        parsed_jobs_json = _deduplicate_jobs(parsed_jobs_json)
        duplicates_removed = original_job_count - len(parsed_jobs_json)

        self.batch_enricher.set_blacklist(blacklist or [])

        if enrich_jobs:
            final_jobs_json = []
            for event_type, data in self._enrich_parsed_jobs_stream(parsed_jobs_json):
                if event_type == "progress":
                    yield {"type": "progress", **data}
                elif event_type == "result":
                    final_jobs_json = data
                elif event_type == "auth_error":
                    yield {"type": "auth_error", **data}
                    return
                elif event_type == "enrichment_error":
                    yield {"type": "enrichment_error", **data}
                    return
        else:
            final_jobs_json = parsed_jobs_json

        if save_parsed_json:
            with self.parsed_json_path.open("w", encoding="utf-8") as f:
                json.dump(final_jobs_json, f, ensure_ascii=False, indent=2)

        yield {"type": "result", "data": {
            "meta": {
                "page": page,
                "count": len(final_jobs_json),
                "duplicates_removed": duplicates_removed,
                "raw_json_path": str(self.raw_json_path) if save_raw_json else None,
                "parsed_json_path": str(self.parsed_json_path) if save_parsed_json else None,
                "keywords": parsed_output.search_metadata.keywords,
                "origin": parsed_output.search_metadata.origin,
                "paging": asdict(parsed_output.paging),
                "geo": asdict(parsed_output.geo) if parsed_output.geo else None,
                "jobs_enriched": enrich_jobs,
            },
            "audit": self._build_audit(parsed_output.jobs),
            "jobs": final_jobs_json,
        }}

    def _enrich_parsed_jobs(self, parsed_jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Wrapper síncrono para o antigo enrich_parsed_jobs"""
        for event_type, data in self._enrich_parsed_jobs_stream(parsed_jobs):
            if event_type == "result":
                return data
        return parsed_jobs

    def _enrich_parsed_jobs_stream(self, parsed_jobs: list[dict[str, Any]]):
        """
        Convert parsed card payload into seed/base jobs, batch-enrich them in chunks,
        and yield progress while merging enriched fields back.
        """
        base_jobs: list[dict[str, Any]] = []

        for job in parsed_jobs:
            job_id = str(job.get("job_id") or "").strip()
            if not job_id:
                continue
            base_jobs.append(self._build_base_job_seed(job))

        if not base_jobs:
            yield "result", parsed_jobs
            return

        total = len(base_jobs)
        enriched_job_objects = []

        # Aqui está o pulo do gato: processamos em batches de 1 (ou maiores)
        # pra você conseguir ter o update de progresso fino: "job 3/55"
        chunk_size = 1

        for i in range(0, total, chunk_size):
            chunk = base_jobs[i:i + chunk_size]
            try:
                enriched = self.batch_enricher.enrich_base_jobs(chunk)
            except AuthExpiredError as exc:
                context = self.batch_enricher.last_failure_context or {}
                failed_config = context.get("failed_config") or "SavedJobs"
                operation = context.get("operation") or "LinkedIn enrichment"
                job_id = context.get("job_id")
                status_code = context.get("status_code")
                action = context.get("action") or f"Refresh the '{failed_config}' LinkedIn curl/config."
                detail_parts = [
                    f"{operation} failed",
                    f"config={failed_config}",
                ]
                if job_id:
                    detail_parts.append(f"job_id={job_id}")
                if status_code:
                    detail_parts.append(f"HTTP {status_code}")
                detail_parts.append(action)
                yield "auth_error", {
                    "step": "enriching",
                    "code": "LINKEDIN_AUTH_EXPIRED",
                    "failed_config": failed_config,
                    "operation": operation,
                    "job_id": job_id,
                    "status_code": status_code,
                    "action": action,
                    "message": ". ".join(detail_parts),
                    "error": str(exc),
                }
                return
            except InvalidPremiumApplicantsError as exc:
                context = self.batch_enricher.last_failure_context or {}
                failed_config = context.get("failed_config") or context.get("config_name") or "PremiumInsights"
                operation = context.get("operation") or "fetch_premium_insights"
                job_id = context.get("job_id")
                action = context.get("action") or f"Refresh the '{failed_config}' LinkedIn curl/config."
                message = (
                    "Enrichment failed: applicants data came back invalid "
                    f"({context.get('raw_applicants_value')!r}) during {operation}. "
                    f"The LinkedIn premium details config '{failed_config}' may be expired, invalid, or stale. "
                    "The pipeline was interrupted intentionally to avoid returning misleading 0 applicants data."
                )
                yield "enrichment_error", {
                    "step": "enriching",
                    "code": "PREMIUM_APPLICANTS_ENRICHMENT_FAILED",
                    "failed_config": failed_config,
                    "config_name": context.get("config_name"),
                    "config_id": context.get("config_id"),
                    "operation": operation,
                    "job_id": job_id,
                    "title": context.get("title"),
                    "company": context.get("company"),
                    "source": context.get("source"),
                    "provider": context.get("provider"),
                    "raw_applicants_value": context.get("raw_applicants_value"),
                    "normalized_applicants_value": context.get("normalized_applicants_value"),
                    "reason": context.get("reason"),
                    "action": action,
                    "message": message,
                    "error": str(exc),
                }
                return
            enriched_job_objects.extend(enriched)

            current = min(i + chunk_size, total)
            yield "progress", {
                "step": "enriching",
                "current": current,
                "total": total,
                "message": f"Enriquecendo vaga {current}/{total}"
            }

        enriched_by_id = {
            str(job.job_id): asdict(job)
            for job in enriched_job_objects
        }

        merged_jobs: list[dict[str, Any]] = []
        for parsed_job in parsed_jobs:
            job_id = str(parsed_job.get("job_id") or "").strip()
            enriched = enriched_by_id.get(job_id)

            if not enriched:
                merged_jobs.append(parsed_job)
                continue

            merged = {**parsed_job, **enriched}

            if merged.get("company") and not merged.get("company_name"):
                merged["company_name"] = merged["company"]

            if merged.get("location") and not merged.get("location_text"):
                merged["location_text"] = merged["location"]

            if merged.get("company_logo") and not merged.get("company_logo_url"):
                merged["company_logo_url"] = merged["company_logo"]

            if merged.get("company_url") and not merged.get("company_page_url"):
                merged["company_page_url"] = merged["company_url"]

            if merged.get("description_full") and not merged.get("description_snippet"):
                merged["description_snippet"] = merged["description_full"][:280]

            merged_jobs.append(merged)

        yield "result", merged_jobs

    def _build_base_job_seed(self, job: dict[str, Any]) -> dict[str, Any]:
        """
        Map parsed GraphQL card fields into the generic shape expected by BatchEnrichmentService.
        """
        job_id = str(job.get("job_id") or "").strip()

        return {
            "job_id": job_id,
            "job_url": self._build_job_url(job_id),
            "title": (
                    job.get("title")
                    or job.get("title_raw_from_job_posting")
                    or job.get("title_accessibility_text")
            ),
            "company": job.get("company_name") or job.get("company"),
            "company_urn": job.get("company_urn"),
            "company_logo": job.get("company_logo_url") or job.get("company_logo"),
            "location": job.get("location_text") or job.get("location"),
            "posted_at": (
                    job.get("listed_at")
                    or job.get("posted_at")
                    or job.get("created_at")
                    or job.get("formatted_posted_date")
            ),
            "description_full": job.get("description_snippet"),
        }

    def _build_job_url(self, job_id: str) -> str:
        return f"https://www.linkedin.com/jobs/view/{job_id}/"

    def _build_audit(self, jobs: list[ParsedJobCard]) -> dict[str, Any]:
        total = len(jobs)

        def count_populated(attr: str) -> int:
            populated = 0
            for job in jobs:
                value = getattr(job, attr)
                if value is None:
                    continue
                if isinstance(value, str) and not value.strip():
                    continue
                populated += 1
            return populated

        jobs_with_meaningful_card_data = 0
        for job in jobs:
            if job.title and job.company_name:
                jobs_with_meaningful_card_data += 1

        description_count = count_populated("description_snippet")

        notes: list[str] = []
        if total == 0:
            notes.append("No jobs were parsed from the payload.")
        if total > 0 and description_count == 0:
            notes.append(
                "This payload can extract useful card data, but not full job descriptions."
            )
        if total > 0 and all(job.has_job_details_stub for job in jobs):
            notes.append(
                "JOB_DETAILS objects are stubs in this payload, so this is not a hydrated details response."
            )

        return {
            "total_jobs": total,
            "jobs_with_title": count_populated("title"),
            "jobs_with_company_name": count_populated("company_name"),
            "jobs_with_location_text": count_populated("location_text"),
            "jobs_with_company_logo_url": count_populated("company_logo_url"),
            "jobs_with_verification": sum(1 for job in jobs if job.has_verification_record),
            "jobs_with_company_record": sum(1 for job in jobs if job.has_company_record),
            "jobs_with_job_posting_record": sum(1 for job in jobs if job.has_job_posting_record),
            "jobs_with_description_snippet": description_count,
            "jobs_with_meaningful_card_data": jobs_with_meaningful_card_data,
            "can_extract_meaningful_data": jobs_with_meaningful_card_data > 0,
            "can_extract_full_descriptions": description_count > 0,
            "notes": notes,
        }


if __name__ == "__main__":
    service = LinkedInJobsSearchService(debug=False, slim_mode=True)

    search = JobSearchTuning(
        current_job_id="4381764035",
        keywords="Python NOT Estágio NOT Junior NOT Senior",
        geo_id="106057199",
        distance=25.0,
        sort_by=SortBy.RELEVANCE,
        work_types=[WorkType.REMOTE],
        experience_levels=[
            ExperienceLevel.INTERNSHIP,
            ExperienceLevel.ENTRY_LEVEL,
            ExperienceLevel.ASSOCIATE,
        ],
        date_posted=DatePosted.PAST_WEEK,
        origin=SearchOrigin.JOB_SEARCH_PAGE_JOB_FILTER,
        spell_correction_enabled=True,
    )

    result = service.search_jobs(
        page=1,
        count=50,
        tuning=search,
        debug=False,
        save_raw_json=True,
        save_parsed_json=True,
        enrich_jobs=True,
    )

    print(json.dumps(result["audit"], indent=2, ensure_ascii=False))
    print(f"Returned jobs: {len(result['jobs'])}")
