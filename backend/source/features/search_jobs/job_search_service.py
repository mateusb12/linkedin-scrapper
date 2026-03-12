from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

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


class LinkedInJobsSearchService:
    """
    Orchestrates:
    1) fetch raw LinkedIn GraphQL payload
    2) parse the payload into meaningful job data
    3) optionally save raw and parsed JSON artifacts

    This class does NOT duplicate fetch or parse logic.
    It imports and reuses both existing files.
    """

    def __init__(self, base_dir: str | Path | None = None):
        self.base_dir = Path(base_dir) if base_dir else Path(__file__).parent
        self.base_dir.mkdir(parents=True, exist_ok=True)


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
    ) -> dict[str, Any]:
        """
        Full orchestration flow for endpoint usage.

        Returns:
            {
              "meta": {...},
              "audit": {...},
              "jobs": [...]
            }
        """

        raw_payload = fetch_and_save(
            page=page,
            count=count,
            tuning=tuning,
            debug=debug,
            save_json=save_raw_json,
        )

        if not save_raw_json and self.raw_json_path.exists():
            self.raw_json_path.unlink(missing_ok=True)

        parsed_output: ParseOutput = parse_linkedin_graphql_response(raw_payload)

        parsed_jobs_json = jobs_to_json_serializable(parsed_output.jobs)
        if save_parsed_json:
            with self.parsed_json_path.open("w", encoding="utf-8") as f:
                json.dump(parsed_jobs_json, f, ensure_ascii=False, indent=2)

        return {
            "meta": {
                "page": page,
                "count": count,
                "raw_json_path": str(self.raw_json_path) if save_raw_json else None,
                "parsed_json_path": str(self.parsed_json_path) if save_parsed_json else None,
                "keywords": parsed_output.search_metadata.keywords,
                "origin": parsed_output.search_metadata.origin,
                "paging": asdict(parsed_output.paging),
                "geo": asdict(parsed_output.geo) if parsed_output.geo else None,
            },
            "audit": self._build_audit(parsed_output.jobs),
            "jobs": parsed_jobs_json,
        }


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
    service = LinkedInJobsSearchService()

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
    )

    print(json.dumps(result["audit"], indent=2, ensure_ascii=False))
    print(f"Returned jobs: {len(result['jobs'])}")
