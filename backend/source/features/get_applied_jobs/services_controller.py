# backend/source/features/get_applied_jobs/services_controller.py

import json
import time
import math
import re
import traceback
import random
from datetime import timezone, datetime, timedelta
from flask import Blueprint, jsonify, request
from dateutil.parser import parse as parse_datetime
from sqlalchemy import or_, func

from exceptions.service_exceptions import LinkedInScrapingException
from models import Job, FetchCurl, Email, Company
from source.features.get_applied_jobs.linkedin_fetch_call_repository import get_linkedin_fetch_artefacts
from source.features.job_population.job_repository import JobRepository
from services.job_tracking.huntr_service import get_huntr_jobs_data
from database.database_connection import get_db_session
from source.features.get_applied_jobs.fetch_linkedin_applied_jobs import fetch_all_linkedin_jobs
from source.features.job_population.population_service import PopulationService
from source.services.experience_extractor import extract_years_experience

services_bp = Blueprint("services", __name__, url_prefix="/services")


def normalize_huntr_job(job: dict) -> dict:
    """Normalizes a single Huntr job entry."""
    return {
        "company": job.get("company"),
        "title": job.get("title", "").strip(),
        "appliedAt": job.get("appliedAt"),
        "source": "Huntr",
        "url": job.get("url"),
    }


def normalize_linkedin_job(job_data) -> dict:
    """Normalizes a single LinkedIn job (can be dict or Job object)."""
    if isinstance(job_data, Job):
        return normalize_sql_job(job_data)

    try:
        applied_at = job_data.get("applied_on")
        return {
            "company": job_data.get("company"),
            "title": job_data.get("title", "").strip(),
            "appliedAt": applied_at,
            "source": "LinkedIn",
            "url": job_data.get("job_url"),
            "urn": job_data.get("urn")
        }
    except KeyError as e:
        print("Key error on LinkedIn job normalization:", job_data)
        raise e


def normalize_sql_job(job: Job) -> dict:
    """Normalizes a single SQL Job object for the frontend."""
    experience = extract_years_experience(job.description_full)
    return {
        "company": job.company.name if job.company else "Unknown",
        "title": job.title.strip() if job.title else "Unknown Title",
        "appliedAt": job.applied_on,
        "source": "LinkedIn" if "linkedin" in (job.job_url or "") else "SQL",
        "url": job.job_url or None,
        "urn": job.urn,
        "location": job.location,
        "description_full": job.description_full,
        "applicants": job.applicants,
        "application_status": job.application_status or "Waiting",  # Default for frontend
        "experience": experience
    }


def apply_timezone_fix(job_dict):
    """Helper to ensure dates are UTC aware for frontend conversion."""
    applied_at = job_dict.get("appliedAt")
    if applied_at:
        if isinstance(applied_at, str):
            try:
                applied_at = parse_datetime(applied_at)
            except:
                pass

        if hasattr(applied_at, 'tzinfo'):
            if applied_at.tzinfo is None:
                applied_at = applied_at.replace(tzinfo=timezone.utc)

            job_dict["formattedDate"] = applied_at.strftime("%d-%b-%Y").lower()
            job_dict["appliedAt"] = applied_at.isoformat()
    return job_dict


@services_bp.route("/applied-jobs", methods=["GET"])
def get_all_applied_jobs():
    """
    Fetches job applications.
    Accepts 'start_date' (YYYY-MM-DD) to filter results when not paginated.
    Accepts 'skip_sync' (true/false) to bypass scraper sync.
    """
    repo = JobRepository()
    try:
        page = request.args.get('page', type=int)
        limit = request.args.get('limit', default=10, type=int)
        start_date_str = request.args.get('start_date')
        skip_sync = request.args.get('skip_sync') == 'true'

        if page:
            result = repo.fetch_paginated_applied_jobs(page, limit)

            normalized_jobs = []
            for job in result['jobs']:
                norm = normalize_sql_job(job)
                norm = apply_timezone_fix(norm)
                normalized_jobs.append(norm)

            return jsonify({
                "data": normalized_jobs,
                "total": result['total'],
                "page": result['page'],
                "limit": result['limit'],
                "total_pages": math.ceil(result['total'] / limit)
            }), 200

        else:
            if not skip_sync:
                print("Syncing LinkedIn jobs...")
                fetch_all_linkedin_jobs()
                print("Sync complete.")
            else:
                print("Skipping LinkedIn Sync for export/fetch.")

            all_jobs = repo.fetch_internal_sql_jobs()
            normalized_jobs = [normalize_sql_job(job) for job in all_jobs]

            # Parse start_date for filtering if provided
            start_date_dt = None
            if start_date_str:
                try:
                    # Assume input is YYYY-MM-DD, make it timezone aware (UTC) to match DB
                    start_date_dt = parse_datetime(start_date_str).replace(tzinfo=timezone.utc)
                except Exception as e:
                    print(f"Invalid start_date format: {start_date_str}")

            final_list = []
            for job in normalized_jobs:
                if not job.get("appliedAt"):
                    continue
                try:
                    job = apply_timezone_fix(job)

                    # Date Filtering Logic
                    if start_date_dt:
                        job_date_str = job.get("appliedAt")
                        if job_date_str:
                            job_dt = parse_datetime(job_date_str)
                            # Compare dates
                            if job_dt < start_date_dt:
                                continue

                    final_list.append(job)
                except Exception as parse_err:
                    print(f"Skipping job {job.get('title')} - invalid date ({parse_err})")
                    continue

            all_jobs_sorted = sorted(
                final_list,
                key=lambda x: x["appliedAt"],
                reverse=True
            )

            return jsonify(all_jobs_sorted), 200

    except Exception as e:
        print("An error occurred in /applied-jobs endpoint:")
        print(traceback.format_exc())
        return jsonify({"error": "Failed to fetch job data", "details": str(e)}), 500
    finally:
        repo.close()


@services_bp.route("/sync-status", methods=["POST"])
def sync_application_status():
    """
    Cross-references 'Job fails' emails with Jobs table to update status to 'Refused'.
    """
    session = get_db_session()
    try:
        rejection_emails = session.query(Email).filter(Email.folder == "Job fails").all()
        updated_count = 0

        for email in rejection_emails:
            target_company_name = None

            # 1. Parse Subject (Ascendion case)
            subject_match = re.search(r"application to .*? at (.*)", email.subject, re.IGNORECASE)

            if subject_match:
                target_company_name = subject_match.group(1).strip().rstrip('.')

            # 2. Fallback to Sender
            if not target_company_name:
                sender_clean = email.sender.split(' via ')[0].split('<')[0].strip().replace('"', '')
                if "linkedin" not in sender_clean.lower():
                    target_company_name = sender_clean

            if not target_company_name:
                continue

            print(f"   [Status Sync] Email: '{email.subject}' -> Detected Company: '{target_company_name}'")

            # 3. Find matching jobs
            # CRITICAL FIX: Allow application_status to be NULL or "Waiting"
            candidate_jobs = session.query(Job).join(Company).filter(
                or_(
                    Job.application_status == "Waiting",
                    Job.application_status.is_(None)
                ),
                or_(
                    func.lower(Company.name).contains(func.lower(target_company_name)),
                    func.lower(target_company_name).contains(func.lower(Company.name))
                )
            ).all()

            if not candidate_jobs:
                print(f"      -> ⚠️ NO MATCH found for '{target_company_name}' in DB (or already refused).")

            for job in candidate_jobs:
                job.application_status = "Refused"
                updated_count += 1
                print(f"      -> ✅ UPDATING: Marked '{job.title}' at '{job.company.name}' as Refused.")

        session.commit()
        return jsonify({"message": f"Sync complete. Updated {updated_count} jobs to 'Refused'."}), 200

    except Exception as e:
        session.rollback()
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@services_bp.route("/huntr", methods=["GET"])
def get_huntr_jobs():
    jobs: list[dict] = get_huntr_jobs_data()
    return jsonify(jobs), 200


@services_bp.route("/linkedin", methods=["GET"])
def get_linkedin_jobs():
    jobs: list[dict] = fetch_all_linkedin_jobs()
    return jsonify(jobs), 200


@services_bp.route("/sql", methods=["GET"])
def get_sql_jobs():
    repo = JobRepository()
    try:
        jobs = repo.fetch_applied_jobs()
        return jsonify([job.to_dict() for job in jobs]), 200
    finally:
        repo.close()


@services_bp.route("/cookies", methods=["GET", "PUT"])
def manage_cookies():
    session = get_db_session()

    if request.method == "GET":
        identifier = request.args.get("identifier")
        if not identifier:
            return jsonify({"error": "Missing 'identifier'"}), 400
        record = session.query(FetchCurl).filter_by(name=identifier).one_or_none()
        if not record:
            return jsonify({"error": "Record not found"}), 404
        return jsonify({"identifier": identifier, "cookies": record.cookies}), 200

    if request.method == "PUT":
        data = request.get_json()
        if not data or "identifier" not in data or "cookies" not in data:
            return jsonify({"error": "Missing required fields"}), 400

        identifier = data["identifier"]
        new_cookies = data["cookies"]
        csrf_token = data.get("csrfToken")

        record = session.query(FetchCurl).filter_by(name=identifier).one_or_none()

        if not record:
            record = FetchCurl(name=identifier, cookies=new_cookies)
            session.add(record)
        else:
            record.cookies = new_cookies
            if csrf_token and record.headers:
                try:
                    headers = json.loads(record.headers)
                    headers["csrf-token"] = csrf_token
                    record.headers = json.dumps(headers)
                except json.JSONDecodeError:
                    pass

        try:
            session.commit()
            return jsonify({
                "message": "Credentials updated successfully",
                "identifier": identifier,
                "cookies": new_cookies
            }), 200
        except Exception as e:
            session.rollback()
            return jsonify({"error": "Database error", "details": str(e)}), 500

    return jsonify({"error": "Method not allowed"}), 405


@services_bp.route("/insights", methods=["GET"])
def get_dashboard_insights():
    """
    Returns high-level metrics including new granular statuses:
    - Actively Reviewing
    - No Longer Accepting

    Includes 'competition_raw' for frontend-side dynamic histogram generation.
    """
    session = get_db_session()
    try:
        time_range = request.args.get('time_range', 'all_time')

        # 1. Base Query
        query = session.query(Job).filter(
            Job.has_applied.is_(True),
            Job.disabled.is_(False)
        )

        # 2. Apply Time Filter (Same as before)
        now = datetime.now(timezone.utc)
        start_date = None

        if time_range == 'current_week':
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif time_range == 'last_2_weeks':
            start_date = now - timedelta(weeks=2)
        elif time_range == 'last_month':
            start_date = now - timedelta(days=30)
        elif time_range == 'last_6_months':
            start_date = now - timedelta(days=180)
        elif time_range == 'last_year':
            start_date = now - timedelta(days=365)

        if start_date:
            query = query.filter(Job.applied_on >= start_date)

        jobs = query.all()
        total_applications = len(jobs)

        if total_applications == 0:
            return jsonify({
                "overview": {"total": 0, "refused": 0, "waiting": 0, "reviewing": 0, "closed": 0},
                "competition": {"low": 0, "medium": 0, "high": 0, "avg_applicants": 0, "high_comp_refusal_rate": 0},
                "competition_raw": []
            }), 200

        # --- Metric 1: Granular Status Counts ---
        status_counts = {
            "waiting": 0,
            "reviewing": 0,  # Actively Reviewing
            "closed": 0,  # No Longer Accepting
            "refused": 0  # Explicit Rejection
        }

        # --- Metric 2: Raw Competition Data (For Dynamic Histogram) ---
        competition_raw = []

        for j in jobs:
            # 1. Populate Overview stats
            status = (j.application_status or "waiting").lower()

            if "refused" in status:
                status_counts["refused"] += 1
            elif "actively" in status or "reviewing" in status:
                status_counts["reviewing"] += 1
            elif "no longer" in status or "closed" in status:
                status_counts["closed"] += 1
            else:
                status_counts["waiting"] += 1

            # 2. Populate Raw Data
            # We include only valid applicant numbers, but keep 0 to show low competition jobs
            if j.applicants is not None:
                competition_raw.append({
                    "title": j.title,
                    "applicants": j.applicants,
                    "status": j.application_status or "Waiting"
                })

        # --- Metric 3: Aggregated Competition Analysis (Legacy Support) ---
        low_comp = 0
        med_comp = 0
        high_comp = 0
        total_applicants_sum = 0
        jobs_with_applicants_data = 0

        for j in jobs:
            count = j.applicants or 0
            if count > 0:
                total_applicants_sum += count
                jobs_with_applicants_data += 1

            if count <= 50:
                low_comp += 1
            elif count <= 200:
                med_comp += 1
            else:
                high_comp += 1

        avg_applicants = 0
        if jobs_with_applicants_data > 0:
            avg_applicants = round(total_applicants_sum / jobs_with_applicants_data)

        # High competition refusal calculation
        high_comp_jobs = [j for j in jobs if (j.applicants or 0) > 200]
        high_comp_refusals = sum(1 for j in high_comp_jobs if "refused" in (j.application_status or "").lower())
        high_comp_refusal_rate = 0
        if len(high_comp_jobs) > 0:
            high_comp_refusal_rate = round((high_comp_refusals / len(high_comp_jobs)) * 100, 1)

        return jsonify({
            "overview": {
                "total": total_applications,
                "refused": status_counts["refused"],
                "waiting": status_counts["waiting"],
                "reviewing": status_counts["reviewing"],
                "closed": status_counts["closed"],
            },
            "competition": {
                "low": low_comp,
                "medium": med_comp,
                "high": high_comp,
                "avg_applicants": avg_applicants,
                "high_comp_refusal_rate": high_comp_refusal_rate
            },
            "competition_raw": competition_raw
        }), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@services_bp.route('/reconcile', methods=['POST'])
def reconcile_endpoints():
    """
    Triggers the SQL-to-SQL cross-check between Emails and Jobs.
    """
    try:
        result = PopulationService.reconcile_failures()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@services_bp.route("/debug-applied-jobs", methods=["GET"])
def debug_applied_jobs_payload():
    """
    DEBUG endpoint to inspect the raw LinkedIn payload and understand
    why company logos / profile data may be missing.

    Query params:
      - start: pagination offset (default: 0)
      - limit: page size (default: 10)
    """

    start = request.args.get("start", default=0, type=int)
    limit = request.args.get("limit", default=10, type=int)

    try:
        # --- Fetch LinkedIn artefacts ---
        session, config = get_linkedin_fetch_artefacts()
        if not session or not config:
            return jsonify({"error": "LinkedIn session not available"}), 500

        base_url = config.get("base_url")
        query_id = config.get("query_id")

        variables = f"(start:{start},query:(flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))"
        url = f"{base_url}?variables={variables}&queryId={query_id}"

        response = session.get(url)
        response.raise_for_status()
        data = response.json()

        # --- Extract included entities ---
        included = data.get("included", [])

        companies = {
            item.get("entityUrn"): item
            for item in included
            if item.get("$type") == "com.linkedin.voyager.dash.organization.Company"
        }

        jobs_debug = []

        # --- Walk clusters ---
        clusters = (
            data.get("data", {})
            .get("data", {})
            .get("searchDashClustersByAll", {})
            .get("elements", [])
        )

        for cluster in clusters:
            for item_wrapper in cluster.get("items", []):
                entity_ref = item_wrapper.get("item", {}).get("*entityResult")
                if not entity_ref:
                    continue

                entity = next(
                    (i for i in included if i.get("entityUrn") == entity_ref),
                    None
                )
                if not entity:
                    continue

                title = entity.get("title", {}).get("text")
                company_name = entity.get("primarySubtitle", {}).get("text")

                image_data = entity.get("image", {}).get("attributes", [])
                company_urn = None
                if image_data:
                    detail = image_data[0].get("detailData", {})
                    company_urn = detail.get("*companyLogo")

                company_entity = companies.get(company_urn)
                has_company_entity = company_entity is not None

                has_logo = False
                if company_entity:
                    logo = (
                        company_entity
                        .get("logoResolutionResult", {})
                        .get("vectorImage")
                    )
                    has_logo = bool(logo)

                jobs_debug.append({
                    "title": title,
                    "company": company_name,
                    "company_urn": company_urn,
                    "has_image_block": bool(image_data),
                    "has_company_entity": has_company_entity,
                    "has_logo_resolution": has_logo,
                })

        return jsonify({
            "pagination": {
                "start": start,
                "limit": limit
            },
            "stats": {
                "jobs_returned": len(jobs_debug),
                "companies_included": len(companies),
                "jobs_with_company_urn": sum(1 for j in jobs_debug if j["company_urn"]),
                "jobs_with_logo": sum(1 for j in jobs_debug if j["has_logo_resolution"]),
            },
            "jobs": jobs_debug
        }), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({
            "error": "Failed to debug applied jobs payload",
            "details": str(e)
        }), 500

def _recursive_text_extract(node, collected_text):
    """
    Recursively walks the React node tree to find text.
    """
    if node is None:
        return

    # 1. Direct String
    if isinstance(node, str):
        # Heuristic: Valid text usually has spaces or is a known short word.
        # Junk often looks like "urn:li:..." or "expandable_text_..."
        if node.startswith(("urn:", "$", "http", "https")):
            # We might want http links, but usually they are in navigationUrl props, not text.
            # For pure description, we can be strict or loose.
            # Let's keep it loose but filter specific junk patterns.
            pass

        if "component-" in node or "JobDetails" in node:
            return

        collected_text.append(node)
        return

    # 2. List
    if isinstance(node, list):
        for item in node:
            _recursive_text_extract(item, collected_text)
        return

    # 3. Dictionary
    if isinstance(node, dict):
        # PRIMARY SOURCE: textProps -> children
        if "textProps" in node:
            _recursive_text_extract(node["textProps"], collected_text)

        # SECONDARY SOURCE: Direct children
        if "children" in node:
            _recursive_text_extract(node["children"], collected_text)

        # TERTIARY SOURCE: stringValue (often used in simple text components)
        if "stringValue" in node:
            collected_text.append(node["stringValue"])

        # FALLBACK: Walk other keys, BUT BLOCK known metadata keys
        # This is where we fix the "className" leak
        ignore_keys = {
            "textProps", "children", "stringValue",  # Handled above
            "className", "style", "accessibilityLabel", "accessibilityRole",
            "layout", "attributes", "action", "onShowMoreAction", "onShowLessAction",
            "trackingUrn", "entityUrn", "$type", "key", "stateKey"
        }

        for key, value in node.items():
            if key not in ignore_keys and not key.startswith("$") and not key.startswith("_"):
                _recursive_text_extract(value, collected_text)


def extract_description_from_sdui(blob: bytes) -> str:
    """
    Parses LinkedIn/Voyager SDUI streaming response and cleans it.
    """
    text_content = blob.decode("utf-8", errors="ignore")
    lines = text_content.split('\n')

    all_extracted_lines = []

    for line in lines:
        line = line.strip()
        if not line: continue

        # 1. Strip Stream ID (e.g. "1:...")
        split_line = line.split(':', 1)
        if len(split_line) < 2: continue
        json_payload_str = split_line[1]

        # 2. Parse JSON
        try:
            data = json.loads(json_payload_str)
        except json.JSONDecodeError:
            continue

        # 3. Extract
        _recursive_text_extract(data, all_extracted_lines)

    # 4. Final Cleanup & Dedup
    seen = set()
    final_text = []

    # Blocklist for specific UI junk that might sneak through
    junk_exact = {
        "Collapsed", "Expanded", "MemoryNamespace", "$undefined", "null",
        "See more", "See less", "more", "less"
    }

    for t in all_extracted_lines:
        t = t.strip()

        # Filter empty or tiny strings
        if len(t) < 2: continue

        # Filter exact blocklist
        if t in junk_exact: continue

        # Filter patterns
        if t.startswith("com.linkedin.sdui"): continue
        # Filter CSS class soup (e.g., "_276ccfa0 b67466c0")
        if t.startswith("_") and " " in t: continue
        if t.startswith("_") and len(t) > 6 and t[1].isalnum(): continue

        if t not in seen:
            seen.add(t)
            final_text.append(t)

    return "\n".join(final_text)


@services_bp.route("/linkedin-applied-jobs/raw", methods=["GET"])
def get_linkedin_applied_jobs_raw():
    """
    PURE LinkedIn "My Jobs" raw endpoint.

    This endpoint proxies LinkedIn's internal Voyager GraphQL API
    and returns a paste-safe, structured subset of the raw payload.

    It supports multiple job "tabs" using LinkedIn's internal `cardType`
    filter, exactly as used by the browser UI, and is **context-aware**:
    it automatically adjusts headers (page instance, referer, metadata)
    to match the selected card type so LinkedIn does not silently fall
    back to another feed.

    ------------------------------------------------------------------
    Query Parameters
    ------------------------------------------------------------------

    start : int (default = 0)
        Pagination offset used by LinkedIn.
        - start=0   → first page
        - start=10  → second page (LinkedIn uses page size = 10)

    pagination : str (default = "1")
        Controls which pages are fetched.
        - "1"       → first page only
        - "2"       → second page only
        - "all"     → fetch all pages until empty

    card_type : str (default = "applied")
        Determines which "My Jobs" tab is fetched.

        Allowed values (case-insensitive):

        - "applied"      → APPLIED
        - "saved"        → SAVED
        - "in_progress"  → IN_PROGRESS
        - "archived"     → ARCHIVED

        These values map 1:1 with LinkedIn's internal `cardType`
        GraphQL query parameter.

    debug : bool (default = false)
        When true, logs the **exact curl commands** executed downstream
        (Voyager + SDUI) and returns them in the response.

    enrich : bool (default = true)
        When true, fetches full job descriptions via the SDUI/RSC endpoint.
    """

    PAGE_SIZE = 10

    pagination = request.args.get("pagination", default="1")
    start_override = request.args.get("start", type=int)
    card_type_raw = request.args.get("card_type", default="applied").lower()
    debug = request.args.get("debug", default="false").lower() == "true"
    enrich = request.args.get("enrich", default="true").lower() == "true"
    trace = request.args.get("trace", default="false").lower() == "true"
    trace_info = []

    debug_curls = []  # <<< COLLECT ALL DOWNSTREAM CURLS HERE

    CARD_TYPE_MAP = {
        "applied": "APPLIED",
        "saved": "SAVED",
        "in_progress": "IN_PROGRESS",
        "archived": "ARCHIVED",
    }

    if card_type_raw not in CARD_TYPE_MAP:
        return jsonify({
            "error": "Invalid card_type",
            "allowed": list(CARD_TYPE_MAP.keys())
        }), 400

    card_type = CARD_TYPE_MAP[card_type_raw]

    PAGE_CONTEXT = {
        "APPLIED": {
            "page_instance": "urn:li:page:d_flagship3_myitems_appliedjobs",
            "referer": "https://www.linkedin.com/my-items/applied-jobs/",
            "pem": "Voyager - My Items=myitems-applied-jobs",
        },
        "SAVED": {
            "page_instance": "urn:li:page:d_flagship3_myitems_savedjobs",
            "referer": "https://www.linkedin.com/my-items/saved-jobs/",
            "pem": "Voyager - My Items=myitems-saved-jobs",
        },
        "IN_PROGRESS": {
            "page_instance": "urn:li:page:d_flagship3_myitems_savedjobs",
            "referer": "https://www.linkedin.com/my-items/saved-jobs/?cardType=IN_PROGRESS",
            "pem": "Voyager - My Items=myitems-saved-jobs",
        },
        "ARCHIVED": {
            "page_instance": "urn:li:page:d_flagship3_myitems_savedjobs",
            "referer": "https://www.linkedin.com/my-items/saved-jobs/?cardType=ARCHIVED",
            "pem": "Voyager - My Items=myitems-saved-jobs",
        },
    }

    try:
        artefacts = get_linkedin_fetch_artefacts()
        if not artefacts:
            return jsonify({"error": "LinkedIn artefacts not available"}), 500

        session, config = artefacts

        base_url = "https://www.linkedin.com/voyager/api/graphql"
        query_id = "voyagerSearchDashClusters.ef3d0937fb65bd7812e32e5a85028e79"

        ctx = PAGE_CONTEXT[card_type]
        session.headers["x-li-page-instance"] = ctx["page_instance"]
        session.headers["x-li-pem-metadata"] = ctx["pem"]
        session.headers["Referer"] = ctx["referer"]

        # ------------------------
        # CSRF TOKEN EXTRACTION
        # ------------------------
        csrf_token = None

        # 1️⃣ Try cookies object
        if "JSESSIONID" in session.cookies:
            csrf_token = session.cookies.get("JSESSIONID")

        # 2️⃣ Fallback: raw Cookie header
        if not csrf_token:
            cookie_header = session.headers.get("Cookie", "")
            m = re.search(r'JSESSIONID="?([^";]+)', cookie_header)
            if m:
                csrf_token = m.group(1)

        if csrf_token:
            csrf_token = csrf_token.strip('"')

        print("FINAL CSRF TOKEN:", csrf_token)

        # ------------------------
        # CURL GENERATOR (SHARED)
        # ------------------------
        def generate_curl(method, url, headers, cookies, body=None):
            parts = [f"curl -X {method} '{url}'"]
            for k, v in headers.items():
                parts.append(f"-H '{k}: {v}'")
            if cookies:
                cookie_str = "; ".join(f"{c.name}={c.value}" for c in cookies)
                parts.append(f"-H 'Cookie: {cookie_str}'")
            if body is not None:
                parts.append(f"--data '{json.dumps(body)}'")
            return " \\\n  ".join(parts)

        # ------------------------
        # VOYAGER LIST FETCH
        # ------------------------
        def build_url(start: int) -> str:
            variables = (
                f"(start:{start},query:("
                "flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER,"
                f"queryParameters:List((key:cardType,value:List({card_type})))"
                "))"
            )
            return f"{base_url}?variables={variables}&queryId={query_id}"

        def fetch_page(start: int) -> dict:
            url = build_url(start)

            if debug:
                debug_curls.append(
                    generate_curl("GET", url, session.headers, session.cookies)
                )

            resp = session.get(url, timeout=15)
            resp.raise_for_status()
            return resp.json()

        # ------------------------
        # JOB EXTRACTION (UNCHANGED)
        # ------------------------
        def extract_jobs(payload: dict) -> list:
            included = payload.get("included", [])
            included_map = {i.get("entityUrn"): i for i in included}
            jobs = []

            clusters = (
                payload.get("data", {})
                .get("data", {})
                .get("searchDashClustersByAll", {})
                .get("elements", [])
            )

            for cluster in clusters:
                for item in cluster.get("items", []):
                    ref = item.get("item", {}).get("*entityResult")
                    if not ref:
                        continue
                    entity = included_map.get(ref)
                    if not entity:
                        continue

                    image_attrs = entity.get("image", {}).get("attributes", [])
                    company_urn = None
                    if image_attrs:
                        company_urn = image_attrs[0].get("detailData", {}).get("*companyLogo")

                    insights = []
                    for block in entity.get("insightsResolutionResults", []):
                        simple = block.get("simpleInsight")
                        if simple:
                            txt = simple.get("title", {}).get("text")
                            if txt:
                                insights.append(txt)

                    jobs.append({
                        "job_posting_urn": entity.get("trackingUrn"),
                        "entity_urn": entity.get("entityUrn"),
                        "title": entity.get("title", {}).get("text"),
                        "company": {
                            "name": entity.get("primarySubtitle", {}).get("text"),
                            "urn": company_urn,
                        },
                        "location": entity.get("secondarySubtitle", {}).get("text"),
                        "navigation_url": entity.get("navigationUrl"),
                        "insights": insights,
                    })
            return jobs

        # ------------------------
        # FETCH PAGES
        # ------------------------
        all_jobs = []
        pages_fetched = []

        if pagination == "all":
            start = start_override or 0
            while True:
                payload = fetch_page(start)
                jobs = extract_jobs(payload)
                if not jobs:
                    break
                all_jobs.extend(jobs)
                pages_fetched.append(start // PAGE_SIZE + 1)
                start += PAGE_SIZE
                time.sleep(0.5)
        else:
            page_num = max(1, int(pagination))
            start = start_override if start_override is not None else (page_num - 1) * PAGE_SIZE
            payload = fetch_page(start)
            all_jobs = extract_jobs(payload)
            pages_fetched.append(page_num)

        # ------------------------
        # SDUI ENRICHMENT
        # ------------------------
        print("CSRF TOKEN:", csrf_token)
        if enrich and csrf_token:
            for job in all_jobs:
                urn = job.get("job_posting_urn")
                if not urn:
                    continue

                m = re.search(r'jobPosting:(\d+)', urn)
                if not m:
                    continue

                job_id = m.group(1)

                url = (
                    "https://www.linkedin.com/flagship-web/rsc-action/actions/component"
                    "?componentId=com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"
                )

                payload = {
                    "clientArguments": {
                        "payload": {
                            "jobId": job_id,
                            "renderAsCard": True
                        },
                        "states": [],
                        "requestMetadata": {}
                    },
                    "screenId": "com.linkedin.sdui.flagshipnav.jobs.JobDetails"
                }

                headers = dict(session.headers)
                headers["csrf-token"] = csrf_token
                headers["Content-Type"] = "application/json"

                if debug:
                    debug_curls.append(
                        generate_curl("POST", url, headers, session.cookies, payload)
                    )

                resp = session.post(url, json=payload, headers=headers)
                if trace:
                    job_trace = {
                        "job_id": job_id,
                        "status": resp.status_code,
                        "content_type": resp.headers.get("content-type"),
                        "len_bytes": len(resp.content or b""),
                    }

                    # Always write the raw bytes + decoded preview
                    bin_path = f"/tmp/sdui_{job_id}.bin"
                    txt_path = f"/tmp/sdui_{job_id}.txt"

                    try:
                        with open(bin_path, "wb") as f:
                            f.write(resp.content or b"")
                        raw_text = (resp.content or b"").decode("utf-8", errors="replace")
                        with open(txt_path, "w", encoding="utf-8") as f:
                            f.write(raw_text)

                        # Print a *real* preview to container logs
                        print("\n" + "=" * 120)
                        print(f"[TRACE SDUI] job_id={job_id}")
                        print("STATUS:", resp.status_code)
                        print("CONTENT-TYPE:", resp.headers.get("content-type"))
                        print("LEN:", len(resp.content or b""))
                        print("FIRST 300 CHARS (decoded):")
                        print(raw_text[:300])
                        print("FIRST 50 BYTES (raw):", (resp.content or b"")[:50])
                        print("WROTE:", bin_path, txt_path)
                        print("=" * 120 + "\n")

                        # Put preview into response too (so curl can see it)
                        job_trace["first_300_chars"] = raw_text[:300]
                        job_trace["first_50_bytes_hex"] = (resp.content or b"")[:50].hex()

                    except Exception as e:
                        print("[TRACE SDUI] failed writing trace files:", e)
                        job_trace["trace_error"] = str(e)

                    trace_info.append(job_trace)

                print("SDUI STATUS:", resp.status_code)
                print("SDUI CT:", resp.headers.get("content-type"))
                print("SDUI LEN:", len(resp.content))
                with open(f"/tmp/sdui_{job_id}.bin", "wb") as f:
                    print(f"Writing /tmp/sdui_{job_id}.bin")
                    f.write(resp.content)
                if resp.ok and resp.content:
                    print("=" * 80)
                    print("SDUI RAW RESPONSE")
                    print("STATUS:", resp.status_code)
                    print("CONTENT-TYPE:", resp.headers.get("content-type"))
                    print("LEN:", len(resp.content))
                    print("FIRST 500 BYTES:")
                    print(resp.content[:500])
                    print("=" * 80)

                    raw_text = resp.content.decode("utf-8", errors="ignore")

                    with open(f"/tmp/sdui_{job_id}.txt", "w") as f:
                        f.write(raw_text)

                    print(f"WROTE /tmp/sdui_{job_id}.txt")

                    description = extract_description_from_sdui(resp.content)
                    job["description"] = description or "Empty description"
                else:
                    job["description"] = "Failed to fetch description."

        response_payload = {
            "card_type": card_type_raw,
            "pagination": pagination,
            "pages_fetched": pages_fetched,
            "count": len(all_jobs),
            "jobs": all_jobs,
        }

        if debug:
            response_payload["debug"] = {
                "curl_count": len(debug_curls),
                "curls": debug_curls,
            }

        if trace:
            response_payload["trace"] = {
                "count": len(trace_info),
                "items": trace_info,
                "tmp_dir_hint": "/tmp (inside linkedin-backend-dev container)",
            }

        return jsonify(response_payload), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({
            "error": "Failed to fetch raw LinkedIn jobs",
            "details": str(e)
        }), 500
