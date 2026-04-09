"""
linkedin_proxy.py — CLEANED UP VERSION
Logic moved to utils_proxy.py.
Enrichment handled by LinkedInJobEnricher.
Retains HTTP methods, main execution flow, and debug logging.
"""

import json
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from source.features.enrich_jobs.linkedin_http_batch_enricher import BatchEnrichmentService
from source.features.enrich_jobs.linkedin_http_job_enricher import LinkedInJobEnricher
from source.features.fetch_curl.linkedin_http_client import LinkedInClient
from source.features.get_applied_jobs.utils_proxy import (
    JobPost,
    JobServiceResponse,
    LinkedInAppliedJobsEmptyError,
    RawStringRequest,
    ms_to_iso,
    parse_linkedin_stream,
    extract_job_ids_from_stream,
    find_job_objects_recursive,
    log as _log)


# ══════════════════════════════════════════════════════════════
# MAIN PROXY CLASS
# ══════════════════════════════════════════════════════════════

class LinkedInProxy:
    """
    Pure LinkedIn HTTP proxy for fetching job listings.
    Every method returns dicts or dataclasses. No SQL writes.
    """

    def __init__(self, debug: bool = False, slim_mode: bool = True):
        self.debug = debug
        self.client = LinkedInClient("SavedJobs", slim_mode=slim_mode)
        self.batch_enricher = BatchEnrichmentService(
            debug=debug,
            slim_mode=slim_mode,
            return_seed_on_failure=True,
        )

        from database.database_connection import get_db_session
        from models.fetch_models import FetchCurl

        db = get_db_session()
        try:
            record_saved = db.query(FetchCurl).filter(FetchCurl.name == "SavedJobs").first()
            if not record_saved:
                raise ValueError("SavedJobs config missing from FetchCurl table")
            self.saved_url = record_saved.base_url
            self.saved_method = record_saved.method or "POST"
            self.saved_body = record_saved.body or ""
        finally:
            db.close()

    def fetch_latest_applied_candidates(self, limit: int = 15) -> List[Dict[str, Any]]:
        """Fetch the latest applied jobs from LinkedIn (light, no enrichment)."""
        _log("\n" + "=" * 60)
        _log("🕵️ fetch_latest_applied_candidates...")

        target_url = self.saved_url.replace("stage=saved", "stage=applied")
        target_body = self.saved_body
        if target_body:
            target_body = target_body.replace('"stage":"saved"', '"stage":"applied"')

        target_body = self._prepare_body(target_body, page_index=0)

        req = RawStringRequest(self.saved_method, target_url, target_body, clean_headers=False)
        req._headers["x-li-initial-url"] = "/jobs-tracker/?stage=applied"

        response = self.client.execute(req)

        if response.status_code != 200:
            _log(f"⚠️ HTTP {response.status_code}")
            return []

        stream_items = parse_linkedin_stream(response.text)
        candidates = []
        for item in stream_items:
            candidates.extend(find_job_objects_recursive(item))
        raw_job_ids = extract_job_ids_from_stream(response.text)

        if response.status_code == 200 and not raw_job_ids and not candidates:
            _log(
                "⚠️ POSSIBLE STALE LINKEDIN AUTH: "
                "stage=applied, HTTP 200, zero regex IDs, zero JSON candidates"
            )
            raise LinkedInAppliedJobsEmptyError()

        results = []
        global_seen_ids = set()

        for job in candidates:
            jid = str(job.get("jobId", ""))
            if not jid or jid in global_seen_ids:
                continue
            if not (job.get("title") or job.get("jobTitle")):
                continue
            global_seen_ids.add(jid)
            results.append(self._build_base_job(job))
            if len(results) >= limit:
                break

        _log(f"✅ Jobs via JSON: {len(results)}")

        if len(results) == 0:
            _log("⚠️ JSON returned 0. Regex fallback...")
            patterns = [
                r"web_opp_contacts_(\d+)",
                r"opportunity_tracker_confirm_hear_back_is_visible_(\d+)",
                r"job_notes_show_api_(\d+)",
                r"opportunity_tracker_check_back_(\d+)",
                r"urn:li:fs_jobPosting:(\d+)",
            ]
            found_ids = set()
            for p in patterns:
                for m in re.findall(p, response.text):
                    if len(m) > 5 and m not in global_seen_ids:
                        found_ids.add(m)

            _log(f"🔍 Regex candidate IDs: {len(found_ids)}")
            for jid in found_ids:
                if len(results) >= limit:
                    break
                if jid in global_seen_ids:
                    continue
                global_seen_ids.add(jid)
                results.append({
                    "job_id": jid,
                    "title": "Carregando...",
                    "company": "LinkedIn",
                    "location": "Unknown",
                    "job_url": f"https://www.linkedin.com/jobs/view/{jid}/",
                    "posted_at": datetime.now(timezone.utc).isoformat(),
                })

        _log(f"🏁 Total: {len(results)}")
        _log("=" * 60 + "\n")
        return results

    def fetch_jobs_listing(self, stage: str = "saved") -> 'JobServiceResponse':
        """
        🔑 MAIN METHOD: Fetch full job listing for a stage.
        """
        is_pagination = (stage == "saved")
        page_index = 0
        max_pages = 20

        all_base_jobs = []
        global_seen_ids = set()

        while True:
            _log(f"\n🔄 Fetching {stage} - Page {page_index}")

            target_url = self.saved_url
            target_body = self.saved_body

            if stage != "saved":
                target_url = target_url.replace("stage=saved", f"stage={stage}")
                if target_body:
                    target_body = target_body.replace('"stage":"saved"', f'"stage":"{stage}"')

            if is_pagination:
                target_body = self._prepare_body(target_body, page_index)

            req = RawStringRequest(self.saved_method, target_url, target_body, clean_headers=False)
            req._headers["x-li-initial-url"] = f"/jobs-tracker/?stage={stage}"

            response = self.client.execute(req)
            if response.status_code != 200:
                _log(f"⚠️ HTTP {response.status_code}")
                break

            # ═══ Step 3: PRIMARY - Extract job IDs via regex ═══
            raw_job_ids = extract_job_ids_from_stream(response.text)
            _log(f"   📊 Regex extracted {len(raw_job_ids)} job IDs")

            # ═══ Step 4: SECONDARY - Parse stream for structured job objects ═══
            stream_items = parse_linkedin_stream(response.text)
            page_candidates = []
            for item in stream_items:
                page_candidates.extend(find_job_objects_recursive(item))

            json_job_ids = {str(job.get("jobId")) for job in page_candidates if job.get("jobId")}
            _log(f"   📊 JSON found {len(json_job_ids)} structured jobs")

            if stage == "applied" and response.status_code == 200 and not raw_job_ids and not page_candidates:
                _log(
                    "⚠️ POSSIBLE STALE LINKEDIN AUTH: "
                    "stage=applied, HTTP 200, zero regex IDs, zero JSON candidates"
                )
                raise LinkedInAppliedJobsEmptyError()

            # ═══ Step 5: MERGE - Decide which approach to use ═══
            new_unique = 0

            if raw_job_ids and not page_candidates:
                _log(f"   ✅ Using regex IDs (JSON parsing missed them)")
                for job_id in sorted(raw_job_ids):
                    if job_id not in global_seen_ids:
                        global_seen_ids.add(job_id)
                        base_job = {
                            "job_id": job_id,
                            "title": "Loading...",
                            "company": "Loading...",
                            "location": "Unknown",
                            "job_url": f"https://www.linkedin.com/jobs/view/{job_id}/",
                            "posted_at": datetime.now(timezone.utc).isoformat(),
                        }
                        all_base_jobs.append(base_job)
                        new_unique += 1
                        _log(f"   ✓ Job {job_id}")

            elif page_candidates:
                _log(f"   ✅ Using JSON-parsed structured jobs")
                for job in page_candidates:
                    jid = job.get("jobId")
                    if not jid:
                        continue
                    jid = str(jid)

                    has_title = job.get("title") or job.get("jobTitle")
                    has_company = (
                            job.get("companyName")
                            or job.get("company")
                            or (isinstance(job.get("companyDetails"), dict) and job["companyDetails"].get("company"))
                    )
                    if not has_title and not has_company:
                        continue

                    if jid not in global_seen_ids:
                        global_seen_ids.add(jid)
                        base_job = self._build_base_job(job)
                        all_base_jobs.append(base_job)
                        new_unique += 1
                        _log(f"   ✓ {base_job['title']} at {base_job['company']} ({base_job['job_id']})")

            else:
                _log(f"   ⚠️ No jobs found (regex: {len(raw_job_ids)}, JSON: {len(page_candidates)})")

            _log(f"   → New unique: {new_unique}")

            if not is_pagination:
                break
            if new_unique == 0:
                break
            if new_unique < 100 and page_index > 0:
                break
            if page_index >= max_pages:
                break

            page_index += 1

        _log(f"✅ Total base jobs: {len(all_base_jobs)}")

        should_enrich = stage in ["applied", "saved"]

        if should_enrich:
            job_objects = self.batch_enricher.enrich_base_jobs(all_base_jobs)
        else:
            job_objects = [JobPost.from_dict(base) for base in all_base_jobs]

        return JobServiceResponse(count=len(job_objects), stage=stage, jobs=job_objects)

    def resolve_job_id(self, query: str, limit: int = 30) -> Optional[str]:
        """
        Search recent applied jobs by substring match on company/title/job_id.
        """
        candidates = self.fetch_latest_applied_candidates(limit=limit)
        q = query.lower().strip()
        for c in candidates:
            if q == str(c.get("job_id", "")):
                return str(c["job_id"])
            title = (c.get("title") or "").lower()
            company = (c.get("company") or "").lower()
            if q in title or q in company or q in f"{company} {title}":
                return str(c["job_id"])
        return None

    def _prepare_body(self, base_body_str: str, page_index: int) -> str:
        try:
            data = json.loads(base_body_str)
            ra = data.get("requestedArguments")
            if isinstance(ra, dict):
                payload = ra.get("payload")
                if isinstance(payload, dict):
                    payload["cacheId"] = str(uuid.uuid4())
                states = ra.get("states")
                if isinstance(states, list):
                    for st in states:
                        if (st.get("key") == "opportunity_tracker_current_page_saved"
                                and st.get("namespace") == "MemoryNamespace"):
                            st["value"] = page_index
            return json.dumps(data)
        except Exception as e:
            _log(f"⚠️ _prepare_body error: {e}")
            return base_body_str

    def _build_base_job(self, job_data: dict) -> dict:
        job_id_str = str(job_data.get("jobId"))

        posted_at = (
                job_data.get("listedAt")
                or job_data.get("formattedPostedDate")
                or job_data.get("postedAt")
        )
        if isinstance(posted_at, (int, float)):
            posted_at = ms_to_iso(posted_at)

        company = (
                job_data.get("companyName")
                or job_data.get("company")
                or job_data.get("companyDetails", {}).get("company", {}).get("name")
                or job_data.get("companyDescription", {}).get("companyName")
                or job_data.get("jobPosting", {}).get("companyName")
                or "Unknown"
        )

        return {
            "job_id": job_id_str,
            "title": job_data.get("title") or job_data.get("jobTitle"),
            "company": company,
            "location": job_data.get("formattedLocation") or job_data.get("locationPrimary"),
            "job_url": f"https://www.linkedin.com/jobs/view/{job_id_str}/",
            "posted_at": posted_at,
        }

    def enrich_single_job(self, job_id: str):
        return self.batch_enricher.enrich_job(job_id)
