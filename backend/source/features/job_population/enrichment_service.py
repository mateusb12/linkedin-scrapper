import json
import re
import urllib.parse
from typing import Dict, Any, List, Optional

import requests

from source.features.fetch_curl.fetch_service import FetchService

class EnrichmentService:
    QUERY_ID = "voyagerJobsDashJobCards.174f05382121bd73f2f133da2e4af893"

    @staticmethod
    def fetch_batch_job_details(job_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        if not job_ids:
            return {}

        urn_list = []
        for jid in job_ids:
            raw_urn = f"urn:li:fsd_jobPostingCard:({jid},JOB_DETAILS)"
            encoded_urn = urllib.parse.quote(raw_urn)
            urn_list.append(encoded_urn)

        urns_string = ",".join(urn_list)

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

        response_data = FetchService.execute_fetch_graphql(params)
        if not response_data:
            return {}

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
    def _build_company_map(included: List[Dict]) -> Dict[str, Dict]:
        """
        Creates a lookup: {'urn:li:fsd_company:123': {'name': 'Google', 'logo': 'http...'}}
        """
        company_map = {}
        for item in included:
            if item.get("$type") == "com.linkedin.voyager.dash.organization.Company":
                urn = item.get("entityUrn")
                name = item.get("name")

                # Resolve Logo
                logo_url = None
                res_result = item.get("logoResolutionResult", {})
                vector_img = res_result.get("vectorImage", {})
                artifacts = vector_img.get("artifacts", [])
                root_url = vector_img.get("rootUrl", "")

                if root_url and artifacts:
                    # Prefer 200px width, else take the first one
                    best_artifact = next((a for a in artifacts if a.get("width") == 200), artifacts[0])
                    file_path = best_artifact.get("fileIdentifyingUrlPathSegment", "")
                    logo_url = f"{root_url}{file_path}"

                if urn:
                    company_map[urn] = {"name": name, "logo_url": logo_url}

        # Debug: Print how many companies we found
        # print(f"   [Enrichment] Built Company Map with {len(company_map)} entries.")
        return company_map

    @staticmethod
    def _parse_batch_response(data: dict) -> Dict[str, Dict[str, Any]]:
        results = {}

        base_data = data.get("data", {}).get("data", {})
        prefetch_data = base_data.get("jobsDashJobCardsByPrefetch", {})
        elements = prefetch_data.get("elements", [])
        included = data.get("included", [])

        if not elements:
            return {}

        # 1. Build Lookup Maps
        company_map = EnrichmentService._build_company_map(included)

        # Map: Job URN -> Description Text
        desc_map = {}
        # Map: Job URN -> Company URN (from JobPosting entity)
        job_to_company_map = {}

        for item in included:
            urn = item.get("entityUrn", "")

            # Extract Description
            if item.get("$type") == "com.linkedin.voyager.dash.jobs.JobDescription":
                match = re.search(r'jobDescription:(\d+)', urn)
                if match:
                    text = item.get("descriptionText", {}).get("text") or item.get("text")
                    if text:
                        desc_map[match.group(1)] = text

            # Extract Company Link from JobPosting entity
            if item.get("$type") == "com.linkedin.voyager.dash.jobs.JobPosting":
                # URN is usually "urn:li:fsd_jobPosting:4331369291"
                match = re.search(r'jobPosting:(\d+)', urn)
                if match:
                    jid = match.group(1)
                    # companyDetails -> jobCompany -> *company
                    comp_details = item.get("companyDetails", {})
                    job_comp = comp_details.get("jobCompany", {})
                    comp_urn = job_comp.get("*company")
                    if comp_urn:
                        job_to_company_map[jid] = comp_urn

        for card in elements:
            job_card = card.get("jobCard", {})

            entity_urn = card.get("entityUrn") or job_card.get("*jobPostingCard")
            if not entity_urn: continue
            match = re.search(r'\((\d+),', entity_urn)
            if not match: continue
            job_id = match.group(1)

            # --- DESCRIPTION ---
            description_html = "No description provided"
            if job_id in desc_map:
                description_html = desc_map[job_id]
            else:
                desc_collection = job_card.get("jobPostingDetailDescription", {})
                all_text_lines = EnrichmentService._recursive_text_extract(desc_collection)
                if all_text_lines:
                    seen = set()
                    deduped_lines = [x for x in all_text_lines if not (x in seen or seen.add(x))]
                    description_html = "\n<br>\n".join(deduped_lines)

            # --- COMPANY RESOLUTION (Nuclear Strategy) ---
            company_name = "Unknown Company"
            company_logo = None
            company_urn = None

            # 1. Try the robust JobPosting -> Company map we just built
            if job_id in job_to_company_map:
                company_urn = job_to_company_map[job_id]

            # 2. Fallback to Logo attribute if map failed
            if not company_urn:
                logo_attributes = job_card.get("logo", {}).get("attributes", [])
                if logo_attributes:
                    detail_data = logo_attributes[0].get("detailData", {})
                    company_urn = detail_data.get("*companyLogo")

            # 3. Resolve Name/Logo from the Company Map
            if company_urn and company_urn in company_map:
                c_data = company_map[company_urn]
                company_name = c_data["name"]
                company_logo = c_data["logo_url"]

            # --- METADATA ---
            applicant_count = 0
            tertiary_text = job_card.get("tertiaryDescription", {}).get("text", "")
            app_match = re.search(r'(\d+)\s+applicants?', tertiary_text)
            if app_match:
                applicant_count = int(app_match.group(1))
            elif "Over 100" in tertiary_text:
                applicant_count = 100

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
                "company_name": company_name,
                "company_urn": company_urn,
                "company_logo": company_logo,
                "processed": False
            }

        return results

    @staticmethod
    def fetch_single_job_description(session: requests.Session, job_urn: str) -> Optional[str]:
        """
        Fetches the full HTML description for a single job using the 'JOB_DESCRIPTION_CARD' query.
        """
        clean_id = job_urn.split(':')[-1]
        target_urn = f"urn:li:fsd_jobPosting:{clean_id}"

        # Variables for the "Golden Query"
        variables = (
            f"(cardSectionTypes:List(JOB_DESCRIPTION_CARD),"
            f"jobPostingUrn:{urllib.parse.quote(target_urn)},"
            f"includeSecondaryActionsV2:true)"
        )

        query_id = "voyagerJobsDashJobPostingDetailSections.5b0469809f45002e8d68c712fd6e6285"
        base_url = "https://www.linkedin.com/voyager/api/graphql"
        url = f"{base_url}?variables={variables}&queryId={query_id}"

        try:
            print(f"   🕵️ Fetching description for {clean_id}...", end=" ")
            # Use a slightly higher timeout for safety
            response = session.get(url, timeout=15)

            if response.status_code != 200:
                print(f"❌ HTTP {response.status_code}")
                return None

            data = response.json()

            # --- 🎯 NEW PARSING LOGIC ---
            # The description is always in the 'included' list with a specific type.
            included_items = data.get("included", [])

            for item in included_items:
                # Look for the JobDescription entity
                if item.get("$type") == "com.linkedin.voyager.dash.jobs.JobDescription":
                    # Extract the text
                    description = item.get("descriptionText", {}).get("text")
                    if description:
                        print("✅ Found (in 'included')")
                        return description

            print("⚠️ Description not found in response")
            return None

        except Exception as e:
            print(f"❌ Error: {e}")
            return None