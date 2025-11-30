import re
import urllib.parse
from typing import Optional, Dict, Any, List

from source.features.fetch_curl.fetch_service import FetchService

class EnrichmentService:
    QUERY_ID = "voyagerJobsDashJobCards.174f05382121bd73f2f133da2e4af893"

    @staticmethod
    def fetch_job_details(job_id: str) -> Optional[Dict[str, Any]]:
        raw_urn = f"urn:li:fsd_jobPostingCard:({job_id},JOB_DETAILS)"
        encoded_urn = urllib.parse.quote(raw_urn)

        # We request count:5 to ensure we get all sections
        variables_str = (
            f"(jobPostingDetailDescription_start:0,"
            f"jobPostingDetailDescription_count:5,"
            f"jobCardPrefetchQuery:(prefetchJobPostingCardUrns:List({encoded_urn}),"
            f"jobUseCase:JOB_DETAILS,count:1),"
            f"jobDetailsContext:(isJobSearch:false))"
        )

        params = {
            "variables": variables_str,
            "queryId": EnrichmentService.QUERY_ID
        }

        response_data = FetchService.execute_fetch_graphql(params)
        if not response_data:
            return None

        # Pass job_id so we can find the specific matching description entity
        return EnrichmentService._parse_full_details(response_data, job_id)

    @staticmethod
    def _recursive_text_extract(data: Any) -> List[str]:
        texts = []
        if isinstance(data, dict):
            if 'text' in data and isinstance(data['text'], str):
                val = data['text'].strip()
                if val:
                    texts.append(val)

            for value in data.values():
                texts.extend(EnrichmentService._recursive_text_extract(value))

        elif isinstance(data, list):
            for item in data:
                texts.extend(EnrichmentService._recursive_text_extract(item))

        return texts

    @staticmethod
    def _parse_full_details(data: dict, job_id: str) -> Optional[Dict[str, Any]]:
        try:
            included = data.get("included", [])
            if not included:
                return None

            # --- 1. Find the Main Job Card ---
            # We look for the card that matches our specific Job ID to be safe
            job_card = next((item for item in included
                             if item.get("$type") == "com.linkedin.voyager.dash.jobs.JobPostingCard"
                             and job_id in item.get("entityUrn", "")), None)

            if not job_card:
                # Fallback: take any JobPostingCard found
                job_card = next((item for item in included if item.get("$type") == "com.linkedin.voyager.dash.jobs.JobPostingCard"), None)

            if not job_card:
                return None

            # --- 2. Extract Description (Direct Entity Method) ---
            # Instead of traversing the nested card structure, we look for the
            # independent JobDescription entity in the 'included' list.
            # It usually has the type 'com.linkedin.voyager.dash.jobs.JobDescription'

            description_html = "No description provided"

            # Find the description entity
            desc_entity = next((item for item in included
                                if item.get("$type") == "com.linkedin.voyager.dash.jobs.JobDescription"), None)

            if desc_entity:
                # Often in 'descriptionText' -> 'text'
                if "descriptionText" in desc_entity:
                    description_html = desc_entity["descriptionText"].get("text")
                # Sometimes just 'text'
                elif "text" in desc_entity:
                    description_html = desc_entity["text"]

            # Fallback: If entity method fails, use the 'Vacuum' on the card structure
            if not description_html or description_html == "No description provided":
                desc_collection = job_card.get("jobPostingDetailDescription", {})
                all_text_lines = EnrichmentService._recursive_text_extract(desc_collection)
                if all_text_lines:
                    seen = set()
                    deduped_lines = [x for x in all_text_lines if not (x in seen or seen.add(x))]
                    description_html = "\n<br>\n".join(deduped_lines)

            # --- 3. Extract Metadata ---
            applicant_count = 0
            tertiary_text = job_card.get("tertiaryDescription", {}).get("text", "")
            app_match = re.search(r'(\d+)\s+applicants?', tertiary_text)
            if app_match:
                applicant_count = int(app_match.group(1))
            elif "Over 100" in tertiary_text:
                applicant_count = 100

            app_detail = next((item for item in included if item.get("$type") == "com.linkedin.voyager.dash.jobs.JobSeekerApplicationDetail"), None)
            apply_url = app_detail.get("companyApplyUrl") if app_detail else None

            nav_subtitle = job_card.get("navigationBarSubtitle", "")
            workplace_type = "On-site"
            if "(Remote)" in nav_subtitle:
                workplace_type = "Remote"
            elif "(Hybrid)" in nav_subtitle:
                workplace_type = "Hybrid"

            return {
                "description_full": description_html,
                "applicants": applicant_count,
                "workplace_type": workplace_type,
                "employment_type": "Full-time",
                "job_url": apply_url,
                "processed": True
            }

        except Exception as e:
            print(f"[Enrichment Error] Parsing logic failed: {e}")
            return None