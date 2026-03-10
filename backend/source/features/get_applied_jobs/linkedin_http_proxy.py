"""
linkedin_proxy.py — CLEANED UP VERSION
Logic moved to utils_proxy.py.
Retains HTTP methods, main execution flow, and debug logging.
"""

import json
import re
import time
import uuid
import sys
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from dataclasses import asdict

import requests

from source.features.fetch_curl.linkedin_http_client import LinkedInClient
from source.features.get_applied_jobs.utils_proxy import (
    JobPost,
    JobServiceResponse,
    NotificationEvent,
    PremiumParser,
    RawStringRequest,
    ms_to_datetime,
    ms_to_iso,
    parse_linkedin_stream,
    extract_job_ids_from_stream,
    find_job_objects_recursive,
    parse_notification_for_job,
    PREMIUM_ENABLED,
    REQUEST_DELAY_SECONDS,
    log as _log,  # Import as _log to keep consistency
    LOG
)


# ══════════════════════════════════════════════════════════════
# MAIN PROXY CLASS
# ══════════════════════════════════════════════════════════════

class LinkedInProxy:
    """
    Pure LinkedIn HTTP proxy. Every method returns dicts or dataclasses.
    No SQL writes. No ORM imports.
    """

    def __init__(self, debug: bool = False, slim_mode: bool = True):
        self.debug = debug
        self.client = LinkedInClient("SavedJobs", slim_mode=slim_mode)
        self.premium_parser = PremiumParser()

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

            self.premium_url = ""
            self.premium_headers = {}
            self.premium_method = "POST"
            self.premium_body = ""
            rec_prem = db.query(FetchCurl).filter(FetchCurl.name == "PremiumInsights").first()
            if rec_prem:
                self.premium_url = rec_prem.base_url
                self.premium_method = rec_prem.method
                self.premium_body = rec_prem.body
                self.premium_headers = json.loads(rec_prem.headers) if rec_prem.headers else {}

            self.notifications_url = ""
            self.notifications_headers = {}
            self.notifications_method = "GET"
            rec_notif = db.query(FetchCurl).filter(FetchCurl.name == "Notifications").first()
            if rec_notif:
                self.notifications_url = rec_notif.base_url
                self.notifications_method = rec_notif.method or "GET"
                self.notifications_headers = json.loads(rec_notif.headers) if rec_notif.headers else {}
                _log(f"✓ Loaded Notifications config from DB")
            else:
                _log(f"⚠️ Notifications config not found in FetchCurl table")
        finally:
            db.close()

    def fetch_job_details(self, job_id: str) -> Dict[str, Any]:
        """Fetch Voyager job details. Returns a plain dict, datetimes as ISO strings."""
        session = self.client.session
        csrf = session.headers.get("csrf-token")
        if not csrf:
            for c in session.cookies:
                if c.name == "JSESSIONID":
                    csrf = c.value.replace('"', "")
                    break

        url = f"https://www.linkedin.com/voyager/api/jobs/jobPostings/{job_id}"
        resp = session.get(
            url,
            headers={"csrf-token": csrf, "accept": "application/json"},
            timeout=20,
        )

        if resp.status_code != 200:
            _log(f"⚠️ fetch_job_details({job_id}): HTTP {resp.status_code}")
            return {"_raw": None, "_status": resp.status_code}

        try:
            d = resp.json()

            applied_at_raw = d.get("applyingInfo", {}).get("appliedAt")
            if applied_at_raw and self.debug:
                dt_utc = ms_to_datetime(applied_at_raw)
                dt_brt = dt_utc.astimezone(timezone(timedelta(hours=-3)))
                _log(f"⏱️ Job {job_id} :: Applied At: {dt_utc} UTC / {dt_brt} BRT")

            company_urn = None
            company_name = None

            company_details = d.get("companyDetails", {})

            voyager_wrapper = company_details.get(
                "com.linkedin.voyager.jobs.JobPostingCompany", {}
            )
            if voyager_wrapper:
                company_urn = voyager_wrapper.get("company")
                company_name = voyager_wrapper.get("companyName")

            if not company_name:
                nested_company = company_details.get("company")
                if isinstance(nested_company, dict):
                    company_name = nested_company.get("name")
                    if not company_urn:
                        company_urn = nested_company.get("entityUrn")

            company_desc = d.get("companyDescription", {})
            if not company_name and isinstance(company_desc, dict):
                company_name = company_desc.get("companyName")

            if not company_name:
                company_name = (
                        d.get("companyName")
                        or d.get("formattedCompanyName")
                )

            company_logo = None
            company_url = None
            if isinstance(company_desc, dict):
                company_url = company_desc.get("companyPageUrl")
                logo_obj = company_desc.get("logo") or company_desc.get("companyLogo")
                if isinstance(logo_obj, dict):
                    image = logo_obj.get("image") or logo_obj
                    root_url = image.get("rootUrl", "")
                    artifacts = image.get("artifacts", [])
                    if root_url and artifacts:
                        best = max(artifacts, key=lambda a: a.get("width", 0))
                        company_logo = root_url + best.get("fileIdentifyingUrlPathSegment", "")
                    elif isinstance(logo_obj, str):
                        company_logo = logo_obj

            location = d.get("formattedLocation")

            return {
                "title": d.get("title"),
                "company": company_name or "Unknown",
                "company_urn": company_urn,
                "company_logo": company_logo,
                "company_url": company_url,
                "location": location,
                "applied": d.get("applyingInfo", {}).get("applied", False),
                "applied_at": ms_to_iso(d.get("applyingInfo", {}).get("appliedAt")),
                "posted_at": ms_to_iso(d.get("listedAt") or d.get("postedAt")),
                "created_at": ms_to_iso(d.get("createdAt")),
                "applicants": d.get("applies"),
                "job_state": d.get("jobState"),
                "description_full": d.get("description", {}).get("text"),
                "work_remote_allowed": d.get("workRemoteAllowed"),
                "expire_at": ms_to_iso(d.get("expireAt")),
                "_raw_keys": sorted(d.keys()) if self.debug else None,
                "_raw_company_details": company_details if self.debug else None,
                "_raw_company_description": company_desc if self.debug else None,
            }
        except Exception as e:
            _log(f"❌ fetch_job_details({job_id}) parse error: {e}")
            return {"_error": str(e)}

    def fetch_company_details(self, company_urn: str) -> Dict[str, Any]:
        """
        Resolve a company URN to name, logo, and URL via Voyager.
        """
        company_id = company_urn.split(":")[-1] if ":" in company_urn else company_urn

        session = self.client.session
        csrf = session.headers.get("csrf-token")
        if not csrf:
            for c in session.cookies:
                if c.name == "JSESSIONID":
                    csrf = c.value.replace('"', "")
                    break

        url = f"https://www.linkedin.com/voyager/api/organization/companies/{company_id}"
        resp = session.get(
            url,
            headers={"csrf-token": csrf, "accept": "application/json"},
            timeout=20,
        )

        if resp.status_code != 200:
            _log(f"⚠️ fetch_company_details({company_id}): HTTP {resp.status_code}")
            _log(f"⚠️ Body snippet: {resp.text[:500]}")
            return {"_status": resp.status_code}

        try:
            d = resp.json()

            logo_url = None
            logo_obj = d.get("logo") or {}
            if isinstance(logo_obj, dict):
                vector = (
                        logo_obj.get("image", {}).get("com.linkedin.common.VectorImage")
                        or logo_obj.get("com.linkedin.common.VectorImage")
                        or {}
                )
                root_url = vector.get("rootUrl", "https://media.licdn.com/dms/image/")
                artifacts = vector.get("artifacts", [])
                if artifacts:
                    best = max(artifacts, key=lambda a: a.get("width", 0))
                    logo_url = root_url + best.get("fileIdentifyingUrlPathSegment", "")

            return {
                "company_id": company_id,
                "company_name": d.get("name") or d.get("universalName"),
                "company_url": d.get("companyPageUrl") or d.get("url")
                               or f"https://www.linkedin.com/company/{d.get('universalName', company_id)}/",
                "company_logo": logo_url,
                "description": d.get("description"),
                "industry": d.get("companyIndustries", [{}])[0].get("localizedName") if d.get(
                    "companyIndustries") else None,
                "staff_count": d.get("staffCount"),
                "headquarters": d.get("headquarter", {}).get("city") if d.get("headquarter") else None,
                "_raw_keys": sorted(d.keys()) if self.debug else None,
            }
        except Exception as e:
            _log(f"❌ fetch_company_details({company_id}) parse error: {e}")
            return {"_error": str(e)}

    def _fetch_and_merge_enrichment(self, job_id: str) -> Dict[str, Any]:
        """
        EXTRACTED HTTP LAYER: Pure enrichment fetch & merge.
        """
        details = self.fetch_job_details(job_id)

        # Strip internal debug keys
        for k in list(details.keys()):
            if k.startswith("_"):
                details.pop(k)

        premium = self.fetch_premium_insights(job_id)

        # Fetch notification for this job
        notification = self.fetch_notifications_for_job(job_id)
        notification_dict = asdict(notification) if notification else None

        return {**details, **premium, "notification": notification_dict}

    def enrichment_pipeline(self, job_id: str) -> Dict[str, Any]:
        """PUBLIC: Debug-oriented enrichment (raw dict output)."""
        return self._fetch_and_merge_enrichment(job_id)

    def fetch_premium_insights(self, job_id: str) -> Dict[str, Any]:
        """Fetch Premium RSC insights."""
        empty = {
            "premium_component_found": False,
            "applicants_total": None,
            "applicants_last_24h": None,
            "seniority_distribution": [],
            "education_distribution": [],
            "premium_title": None,
            "premium_description": None,
            "learn_more_url": None,
            "data_sdui_components": [],
        }
        try:
            if not PREMIUM_ENABLED or not self.premium_url:
                return empty

            body = re.sub(
                r'("jobId"\s*:\s*)("\d+"|\d+)',
                f'\\1"{job_id}"',
                self.premium_body,
            )
            headers = self.premium_headers.copy()
            headers["Referer"] = f"https://www.linkedin.com/jobs/view/{job_id}/"
            headers.pop("Accept-Encoding", None)
            headers["Accept-Encoding"] = "identity"

            r = requests.request(
                method=self.premium_method,
                url=self.premium_url,
                headers=headers,
                data=body,
                timeout=20,
            )

            if r.status_code != 200:
                raise RuntimeError(f"HTTP {r.status_code}")

            return self.premium_parser.parse(r.text)

        except Exception as e:
            _log(f"⚠️ fetch_premium_insights({job_id}) error: {e}")
            return empty

    def fetch_notifications_for_job(self, job_id: str) -> Optional[NotificationEvent]:
        """
        Fetch notifications and extract "Application viewed" event for a specific job ID.
        Uses Notifications config from database (FetchCurl table).
        """
        if not self.notifications_url:
            _log(f"❌ Notifications config not loaded from database")
            _log(f"❌ Make sure 'Notifications' record exists in FetchCurl table")
            return None

        session = self.client.session
        csrf = session.headers.get("csrf-token")
        if not csrf:
            for c in session.cookies:
                if c.name == "JSESSIONID":
                    csrf = c.value.replace('"', "")
                    break

        try:
            headers = session.headers.copy()
            headers.update(self.notifications_headers)
            headers["csrf-token"] = csrf

            resp = session.request(
                method=self.notifications_method,
                url=self.notifications_url,
                headers=headers,
                timeout=20,
            )

            if resp.status_code != 200:
                _log(f"⚠️ HTTP {resp.status_code}")
                return None

            try:
                data = resp.json()
            except Exception as e:
                _log(f"⚠️ Failed to parse JSON response: {e}")
                return None

            # DELEGATE TO UTILS FUNCTION
            notification_event = parse_notification_for_job(data, job_id)

            if notification_event:
                _log(f"✅ Found: {notification_event.event_type} at {notification_event.timestamp}")
            else:
                _log(f"⚠️ No 'Application viewed' notification found for job {job_id}")

            return notification_event

        except Exception as e:
            _log(f"❌ fetch_notifications_for_job({job_id}) error: {e}")
            import traceback
            traceback.print_exc()
            return None

    def enrich_single_job(self, base_job_dict: Dict[str, Any]) -> JobPost:
        """
        Sync-layer enrichment: HTTP fetch + merge + business logic + dataclass conversion.
        """
        jid = str(base_job_dict["job_id"])

        # Step 1: Fetch enriched data
        enriched = self._fetch_and_merge_enrichment(jid)

        # Step 2: Merge enriched data into base dict
        base_job_dict.update(enriched)

        # Step 3: Company URN fallback
        if base_job_dict.get("company") in [None, "Unknown"] and base_job_dict.get("company_urn"):
            company_info = self.fetch_company_details(base_job_dict["company_urn"])
            if company_info.get("company_name"):
                base_job_dict["company"] = company_info["company_name"]
            if company_info.get("company_url") and not base_job_dict.get("company_url"):
                base_job_dict["company_url"] = company_info["company_url"]
            if company_info.get("company_logo") and not base_job_dict.get("company_logo"):
                base_job_dict["company_logo"] = company_info["company_logo"]

        # Step 4: Applicants normalization
        app_tot = base_job_dict.get("applicants_total")
        if isinstance(app_tot, int) and app_tot > 0:
            base_job_dict["applicants"] = app_tot

        # Step 5: Rate limiting
        time.sleep(REQUEST_DELAY_SECONDS)

        return JobPost.from_dict(base_job_dict)

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
            time.sleep(1.0)

        _log(f"✅ Total base jobs: {len(all_base_jobs)}")

        job_objects = []
        should_enrich = stage in ["applied", "saved"]
        for base in all_base_jobs:
            if should_enrich:
                job_objects.append(self.enrich_single_job(base))
            else:
                job_objects.append(JobPost.from_dict(base))

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


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("🧪 LinkedInProxy Notification Fetcher Test")
    print("=" * 70)

    test_job_id = "4375526458"

    try:
        proxy = LinkedInProxy(debug=False, slim_mode=True)
        print(f"\n📌 Testing notification fetch for job ID: {test_job_id}")

        notification = proxy.fetch_notifications_for_job(test_job_id)

        if notification:
            print(f"\n✅ SUCCESS - Notification Event Found:")
            print(f"   Job ID: {notification.job_id}")
            print(f"   Event Type: {notification.event_type}")
            print(f"   Timestamp: {notification.timestamp}")
            print(f"   Status: {notification.status}")
            print(f"   Company: {notification.company}")
            print(f"   Headline: {notification.headline}")
            print(f"\n📋 Full Data:")
            print(notification.to_dict())
        else:
            print(f"\n⚠️  No notification found for job {test_job_id}")

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)

    print("\n" + "=" * 70)
    print("✨ Test completed")
    print("=" * 70 + "\n")
