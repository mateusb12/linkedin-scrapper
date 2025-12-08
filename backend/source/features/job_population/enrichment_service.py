import json
import re
import urllib.parse
from typing import Dict, Any, List, Optional

import requests

from source.features.fetch_curl.fetch_service import FetchService

def extract_all_items(payload):
    stack = [payload]
    while stack:
        item = stack.pop()
        if isinstance(item, dict):
            yield item
            stack.extend(item.values())
        elif isinstance(item, list):
            stack.extend(item)

class EnrichmentService:
    QUERY_ID = "voyagerJobsDashJobCards.174f05382121bd73f2f133da2e4af893"
    DETAIL_QUERY_ID = "voyagerJobsDashJobPostingDetailSections.5b0469809f45002e8d68c712fd6e6285"

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
        Wrapper around the more comprehensive method.
        """
        data = EnrichmentService.fetch_single_job_details_enrichment(session, job_urn)
        return data.get("description")

    @staticmethod
    def fetch_single_job_details_enrichment(session: requests.Session, job_urn: str) -> Dict[str, Any]:
        """
        Fetches:
        1. Full HTML description
        2. Premium Applicant Insights (Count, applicantsInPastDay, rankPercentile)
        3. Job Status (Actively Reviewing / No Longer Accepting)
        4. Date Text (Posted on ...)
        """
        clean_id = job_urn.split(':')[-1]
        target_urn = f"urn:li:fsd_jobPosting:{clean_id}"

        variables = (
            f"(cardSectionTypes:List(JOB_DESCRIPTION_CARD,JOB_APPLICANT_INSIGHTS),"
            f"jobPostingUrn:{urllib.parse.quote(target_urn)},"
            f"includeSecondaryActionsV2:true)"
        )

        base_url = "https://www.linkedin.com/voyager/api/graphql"
        url = f"{base_url}?variables={variables}&queryId={EnrichmentService.DETAIL_QUERY_ID}"

        result = {
            "description": None,
            "applicants": None,
            "applicants_in_past_day": None,
            "applicant_rank_percentile": None,
            "application_status": None,
            "posted_date_text": None
        }

        try:
            print(f"   🕵️ Enriching {clean_id}...", end=" ")
            response = session.get(url, timeout=15)

            if response.status_code != 200:
                print(f"❌ HTTP {response.status_code}")
                return result

            data = response.json()

            # Save JSON snapshot for debugging
            with open("response.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=4)

            found_description = False
            found_insights = False
            detected_status = None
            posted_date_text = None

            # 🔍 UNIVERSAL RECURSIVE SCAN
            for item in extract_all_items(data):
                type_id = item.get("$type", "")

                # ---------------------------------
                # 1. Capture Description & Date
                # ---------------------------------
                if type_id == "com.linkedin.voyager.dash.jobs.JobDescription":
                    # Capture Description
                    desc = item.get("descriptionText", {}).get("text")
                    if desc:
                        result["description"] = desc
                        found_description = True

                    # Capture Date Text (e.g. "Posted on Oct 15, 2025.")
                    if item.get("postedOnText"):
                        posted_date_text = item.get("postedOnText")

                # ---------------------------------
                # 2. Capture ALL Premium Applicant Insights
                # ---------------------------------
                if "JobApplicantInsights" in type_id:
                    count = item.get("applicantCount")
                    if count is not None:
                        result["applicants"] = int(count)

                    result["applicants_in_past_day"] = item.get("applicantsInPastDay")
                    result["applicant_rank_percentile"] = item.get("applicantRankPercentile")

                    found_insights = True

                # --- ✨ 3. CAPTURE STATUS TEXT ---

                # Check A: Explicit Job State (CLOSED)
                if type_id == "com.linkedin.voyager.dash.jobs.JobPosting":
                    if item.get("jobState") == "CLOSED":
                        detected_status = "No Longer Accepting"
                        # print(f"   [DEBUG] Found CLOSED state")

                # Check B: Text Scrape for "Actively reviewing" / "No longer accepting"
                # We scan ALL text fields because this tag moves around in the JSON structure
                text_content = ""
                if "text" in item and isinstance(item["text"], str):
                    text_content = item["text"]
                elif "text" in item and isinstance(item["text"], dict):
                    text_content = item["text"].get("text", "")

                if text_content:
                    lower_text = text_content.lower()

                    # Priority 1: Closed/No longer accepting
                    if "no longer accepting applications" in lower_text:
                        detected_status = "No Longer Accepting"
                        # print(f"   [DEBUG] Found 'No Longer Accepting' text")

                    # Priority 2: Actively reviewing (Only if not already detected as closed)
                    elif "actively reviewing applicants" in lower_text:
                        if detected_status != "No Longer Accepting":
                            detected_status = "Actively Reviewing"
                            # print(f"   [DEBUG] Found 'Actively Reviewing' text")

            # Store the discovered data
            result["application_status"] = detected_status
            result["posted_date_text"] = posted_date_text

            # ---------------------------------
            # Logging summary
            # ---------------------------------
            status = []
            status.append("Desc ✅" if found_description else "Desc ❌")

            if found_insights:
                status.append(f"Applicants: {result['applicants']} 💎")
            else:
                status.append("No Premium Data ⚪")

            if detected_status:
                status.append(f"Status: {detected_status} 🏷️")

            if posted_date_text:
                status.append(f"Date Found 📅")

            print(" -> " + ", ".join(status))
            return result

        except Exception as e:
            print(f"❌ Error: {e}")
            return result