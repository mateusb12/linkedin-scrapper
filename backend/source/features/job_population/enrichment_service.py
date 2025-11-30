import re
import urllib.parse
from typing import Dict, Any, List

from source.features.fetch_curl.fetch_service import FetchService

class EnrichmentService:
    QUERY_ID = "voyagerJobsDashJobCards.174f05382121bd73f2f133da2e4af893"

    @staticmethod
    def fetch_batch_job_details(job_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Fetches details for MULTIPLE jobs in one single HTTP request.
        Returns a dictionary mapping job_id -> enriched_data_dict.
        """
        if not job_ids:
            return {}

        # 1. Construct the list of encoded URNs
        # Format: urn:li:fsd_jobPostingCard:(<ID>,JOB_DETAILS)
        urn_list = []
        for jid in job_ids:
            raw_urn = f"urn:li:fsd_jobPostingCard:({jid},JOB_DETAILS)"
            encoded_urn = urllib.parse.quote(raw_urn)
            urn_list.append(encoded_urn)

        # Join them with commas for the List(...) syntax
        urns_string = ",".join(urn_list)

        # 2. Build Query
        # Notice we pass the comma-separated list inside List(...)
        variables_str = (
            f"(jobPostingDetailDescription_start:0,"
            f"jobPostingDetailDescription_count:5,"
            f"jobCardPrefetchQuery:(prefetchJobPostingCardUrns:List({urns_string}),"
            f"jobUseCase:JOB_DETAILS,count:{len(job_ids)}),"
            f"jobDetailsContext:(isJobSearch:false))"
        )

        params = {
            "variables": variables_str,
            "queryId": EnrichmentService.QUERY_ID
        }

        # 3. Execute
        response_data = FetchService.execute_fetch_graphql(params)
        if not response_data:
            return {}

        # 4. Parse Batch Response
        return EnrichmentService._parse_batch_response(response_data)

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
    def _parse_batch_response(data: dict) -> Dict[str, Dict[str, Any]]:
        """
        Parses the batch response and maps data back to specific Job IDs.
        """
        results = {}

        # In a batch response, 'elements' contains the JobCards
        # We need to look into 'jobsDashJobCardsByPrefetch' usually
        base_data = data.get("data", {}).get("data", {})
        prefetch_data = base_data.get("jobsDashJobCardsByPrefetch", {})
        elements = prefetch_data.get("elements", [])

        # Also grab the 'included' list for cross-referencing descriptions
        included = data.get("included", [])

        if not elements:
            return {}

        for card in elements:
            job_card = card.get("jobCard", {})

            # Extract URN to identify which job this is
            # usually in '*jobPostingCard' or we have to find the ID in the entityUrn
            # Let's try to find the ID from the available data
            entity_urn = card.get("entityUrn") or job_card.get("*jobPostingCard")
            if not entity_urn:
                continue

            # Extract ID from URN: urn:li:fsd_jobPostingCard:(4143563457,JOB_DETAILS)
            match = re.search(r'\((\d+),', entity_urn)
            if not match:
                continue
            job_id = match.group(1)

            # --- Now we parse the details for this specific card ---
            # (Reusing the logic from before, but applied to this card item)

            description_html = "No description provided"

            # 1. Try finding linked description in 'included'
            # (We skip this optimization for brevity, vacuuming the card is safer for batching)

            # 2. Vacuum the card itself
            desc_collection = job_card.get("jobPostingDetailDescription", {})
            if not desc_collection and included:
                # Fallback: Check if description is in 'included' matched by URN
                # This part is complex in batch, so we rely on the card having the data usually
                pass

            all_text_lines = EnrichmentService._recursive_text_extract(desc_collection)

            if all_text_lines:
                seen = set()
                deduped_lines = [x for x in all_text_lines if not (x in seen or seen.add(x))]
                description_html = "\n<br>\n".join(deduped_lines)

            # Metadata
            applicant_count = 0
            tertiary_text = job_card.get("tertiaryDescription", {}).get("text", "")
            app_match = re.search(r'(\d+)\s+applicants?', tertiary_text)
            if app_match:
                applicant_count = int(app_match.group(1))
            elif "Over 100" in tertiary_text:
                applicant_count = 100

            # Workplace
            nav_subtitle = job_card.get("navigationBarSubtitle", "")
            workplace_type = "On-site"
            if "(Remote)" in nav_subtitle:
                workplace_type = "Remote"
            elif "(Hybrid)" in nav_subtitle:
                workplace_type = "Hybrid"

            results[job_id] = {
                "description_full": description_html,
                "applicants": applicant_count,
                "workplace_type": workplace_type,
                "employment_type": "Full-time",
                "processed": True
            }

        return results