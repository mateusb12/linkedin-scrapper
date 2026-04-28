import math
import time
import json
import traceback
from datetime import datetime, timedelta
from typing import Dict, Any, Generator, List, Optional
from dateutil import parser as date_parser

from sqlalchemy import or_

from source.features.fetch_curl.fetch_service import FetchService
from source.features.job_population.job_repository import JobRepository
from models import Company, Job, Email
from source.features.job_population.linkedin_parser import parse_job_entries
from source.features.job_population.search_spec import PipelineSearchSpec
from source.features.job_population.enrichment_service import EnrichmentService
from source.features.fetch_curl.linkedin_http_client import get_linkedin_fetch_artefacts
from source.features.gmail_service.safe_reconciliation import reconcile_email_to_job
from database.database_connection import get_db_session

class PopulationService:
    ENRICHMENT_MISSING_SAMPLE_SIZE = 5
    RANGE_FETCH_MAX_ATTEMPTS = 3
    RANGE_FETCH_RETRY_DELAYS = (1, 2, 4)

    @staticmethod
    def _build_error_response(
        *,
        page_number: int,
        step: str,
        error: str,
        details: Optional[str] = None,
        **extra: Any,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "success": False,
            "page": page_number,
            "step": step,
            "error": error,
        }
        if details:
            payload["details"] = details
        payload.update({key: value for key, value in extra.items() if value is not None})
        return payload

    @staticmethod
    def _build_enrichment_summary(job_ids: List[str], enriched_results: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        missing_ids = [job_id for job_id in job_ids if job_id not in enriched_results]
        summary: Dict[str, Any] = {
            "requested": len(job_ids),
            "received": len(enriched_results),
            "missing_count": len(missing_ids),
        }
        if missing_ids:
            summary["missing_ids_sample"] = missing_ids[:PopulationService.ENRICHMENT_MISSING_SAMPLE_SIZE]
            summary["degraded"] = True
        return summary

    @staticmethod
    def _sse_event(event: str, payload: Dict[str, Any]) -> str:
        return f"event: {event}\ndata: {json.dumps(payload)}\n\n"

    @staticmethod
    def _is_retryable_result(result: Dict[str, Any]) -> bool:
        error_type = result.get("error_type")
        status = result.get("status")

        if error_type in {"timeout", "network_error", "rate_limit"}:
            return True

        if isinstance(status, int) and status >= 500:
            return True

        if result.get("step") == "fetch_pagination" and error_type == "http_error":
            return True

        return False

    @staticmethod
    def _is_fatal_result(result: Dict[str, Any]) -> bool:
        error_type = result.get("error_type")
        step = result.get("step")
        status = result.get("status")
        error = (result.get("error") or "").lower()

        if error_type in {"auth_error", "config_missing", "malformed_response"}:
            return True

        if isinstance(status, int) and status in {401, 403}:
            return True

        if step == "parse_job_entries":
            return True

        if step in {"save_jobs", "commit", "detect_new_jobs"}:
            return True

        if step == "unexpected":
            return True

        if "parser mismatch" in error:
            return True

        return False

    @staticmethod
    def _format_page_message(page_number: int, result: Dict[str, Any]) -> str:
        if result.get("success"):
            total_found = result.get("total_found", 0)
            count = result.get("count", 0)
            if result.get("result_type") == "empty_page":
                return f"Page {page_number} is empty"
            if count > 0:
                return f"Page {page_number} processed successfully"
            if total_found > 0:
                return f"Page {page_number} had no new jobs to save"
            return f"Page {page_number} completed"

        return f"Page {page_number} failed"

    @staticmethod
    def stream_fetch_page_range(
        start_page: Optional[int],
        end_page: Optional[int],
        search_spec: Optional[PipelineSearchSpec] = None,
    ) -> Generator[str, None, None]:
        if start_page is None or end_page is None:
            yield PopulationService._sse_event(
                "pipeline_error",
                {
                    "success": False,
                    "error": "Missing required query params",
                    "details": "Both start_page and end_page are required.",
                    "fatal": True,
                },
            )
            yield PopulationService._sse_event(
                "complete",
                {
                    "success": False,
                    "aborted": True,
                    "processed_pages": 0,
                    "successful_pages": 0,
                    "failed_pages": 0,
                    "message": "Pipeline aborted",
                    "abort_reason": "Missing required query params",
                },
            )
            return

        if start_page < 1 or end_page < start_page:
            yield PopulationService._sse_event(
                "pipeline_error",
                {
                    "success": False,
                    "error": "Invalid page range",
                    "details": "Expected start_page >= 1 and end_page >= start_page.",
                    "fatal": True,
                    "start_page": start_page,
                    "end_page": end_page,
                },
            )
            yield PopulationService._sse_event(
                "complete",
                {
                    "success": False,
                    "start_page": start_page,
                    "end_page": end_page,
                    "processed_pages": 0,
                    "successful_pages": 0,
                    "failed_pages": 0,
                    "aborted": True,
                    "message": "Pipeline aborted",
                    "abort_reason": "Invalid page range",
                },
            )
            return

        if search_spec and search_spec.is_active():
            validation = PopulationService.validate_search_mode(search_spec)
            if not validation.get("success"):
                yield PopulationService._sse_event(
                    "pipeline_error",
                    {
                        "success": False,
                        "error": validation.get("error", "Search mode validation failed"),
                        "details": validation.get("details"),
                        "fatal": True,
                        "step": validation.get("step"),
                        "curl": validation.get("curl"),
                        "status": validation.get("status"),
                    },
                )
                yield PopulationService._sse_event(
                    "complete",
                    {
                        "success": False,
                        "start_page": start_page,
                        "end_page": end_page,
                        "processed_pages": 0,
                        "successful_pages": 0,
                        "failed_pages": 0,
                        "aborted": True,
                        "message": "Pipeline aborted",
                        "abort_reason": validation.get("error", "Search mode validation failed"),
                    },
                )
                return

        total_available_pages = PopulationService.get_total_pages(search_spec=search_spec)
        if total_available_pages > 0 and end_page > total_available_pages:
            yield PopulationService._sse_event(
                "pipeline_error",
                {
                    "success": False,
                    "error": "Invalid page range",
                    "details": f"end_page exceeds available pages ({total_available_pages}).",
                    "fatal": True,
                    "start_page": start_page,
                    "end_page": end_page,
                    "total_pages": total_available_pages,
                },
            )
            yield PopulationService._sse_event(
                "complete",
                {
                    "success": False,
                    "start_page": start_page,
                    "end_page": end_page,
                    "processed_pages": 0,
                    "successful_pages": 0,
                    "failed_pages": 0,
                    "aborted": True,
                    "message": "Pipeline aborted",
                    "abort_reason": f"Requested end_page {end_page} exceeds available pages ({total_available_pages})",
                },
            )
            return

        total_pages = end_page - start_page + 1
        processed_pages = 0
        successful_pages = 0
        failed_pages = 0
        aborted = False
        abort_reason: Optional[str] = None

        try:
            for offset, page_number in enumerate(range(start_page, end_page + 1), start=1):
                yield PopulationService._sse_event(
                    "page_start",
                    {
                        "page": page_number,
                        "current": offset,
                        "total_pages": total_pages,
                        "message": f"Fetching page {page_number}...",
                    },
                )

                result: Dict[str, Any] = {}
                final_attempt = 1

                for attempt in range(1, PopulationService.RANGE_FETCH_MAX_ATTEMPTS + 1):
                    final_attempt = attempt
                    result = PopulationService.fetch_and_save_page(
                        page_number,
                        search_spec=search_spec,
                    )
                    if result.get("success"):
                        break

                    is_retryable = PopulationService._is_retryable_result(result)
                    has_more_attempts = attempt < PopulationService.RANGE_FETCH_MAX_ATTEMPTS
                    if not is_retryable or not has_more_attempts:
                        break

                    delay_seconds = PopulationService.RANGE_FETCH_RETRY_DELAYS[attempt - 1]
                    yield PopulationService._sse_event(
                        "retry",
                        {
                            "page": page_number,
                            "attempt": attempt + 1,
                            "max_attempts": PopulationService.RANGE_FETCH_MAX_ATTEMPTS,
                            "delay_seconds": delay_seconds,
                            "step": result.get("step"),
                            "status": result.get("status"),
                            "error_type": result.get("error_type"),
                            "message": f"Retrying page {page_number} after failure",
                        },
                    )
                    time.sleep(delay_seconds)

                page_payload = {
                    **result,
                    "page": page_number,
                    "attempts": final_attempt,
                    "fatal": False,
                    "message": PopulationService._format_page_message(page_number, result),
                }

                if result.get("success"):
                    successful_pages += 1
                    if result.get("warning"):
                        yield PopulationService._sse_event(
                            "warning",
                            {
                                "page": page_number,
                                "warning": result.get("warning"),
                                "message": result.get("warning"),
                            },
                        )
                    enrichment = result.get("enrichment") or {}
                    if enrichment.get("degraded"):
                        yield PopulationService._sse_event(
                            "warning",
                            {
                                "page": page_number,
                                "step": "batch_enrichment",
                                "enrichment": enrichment,
                                "warning_type": "enrichment_degraded",
                                "message": (
                                    f"Page {page_number} enrichment degraded: "
                                    f"missing {enrichment.get('missing_count', 0)} job(s)"
                                ),
                            },
                        )
                else:
                    failed_pages += 1
                    fatal = PopulationService._is_fatal_result(result)
                    if result.get("error_type") == "rate_limit" and final_attempt >= PopulationService.RANGE_FETCH_MAX_ATTEMPTS:
                        fatal = True
                    page_payload["fatal"] = fatal
                    if fatal:
                        aborted = True
                        abort_reason = (
                            f"Page {page_number} failed at {result.get('step', 'unknown_step')}: "
                            f"{result.get('error', 'Unknown error')}"
                        )

                yield PopulationService._sse_event("page_result", page_payload)

                processed_pages += 1
                yield PopulationService._sse_event(
                    "progress",
                    {
                        "processed_pages": processed_pages,
                        "total_pages": total_pages,
                        "successful_pages": successful_pages,
                        "failed_pages": failed_pages,
                        "progress": (processed_pages / total_pages) * 100,
                    },
                )

                if aborted:
                    break

            yield PopulationService._sse_event(
                "complete",
                {
                    "success": not aborted,
                    "start_page": start_page,
                    "end_page": end_page,
                    "processed_pages": processed_pages,
                    "successful_pages": successful_pages,
                    "failed_pages": failed_pages,
                    "aborted": aborted,
                    "abort_reason": abort_reason,
                    "message": "Pipeline aborted" if aborted else "Range fetch completed",
                },
            )
        except Exception as exc:
            yield PopulationService._sse_event(
                "pipeline_error",
                {
                    "success": False,
                    "fatal": True,
                    "error": "Unhandled range fetch error",
                    "details": str(exc),
                },
            )
            yield PopulationService._sse_event(
                "complete",
                {
                    "success": False,
                    "start_page": start_page,
                    "end_page": end_page,
                    "processed_pages": processed_pages,
                    "successful_pages": successful_pages,
                    "failed_pages": failed_pages,
                    "aborted": True,
                    "abort_reason": str(exc),
                    "message": "Pipeline aborted",
                },
            )

    @staticmethod
    def _inspect_pagination_payload(raw_data: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(raw_data, dict):
            return {
                "ok": False,
                "error": "Unexpected LinkedIn payload type",
                "details": f"Expected dict, got {type(raw_data).__name__}",
            }

        outer_data = raw_data.get("data")
        if not isinstance(outer_data, dict):
            return {
                "ok": False,
                "error": "Unexpected LinkedIn payload shape",
                "details": "Missing top-level 'data' object",
            }

        source = "Pagination"
        collection = None

        inner_data = outer_data.get("data")
        if isinstance(inner_data, dict):
            collection = inner_data.get("jobsDashJobCardsByJobCollections")

        if isinstance(collection, dict):
            paging = collection.get("paging") or {}
            elements = collection.get("elements")
        else:
            # Search payloads come back as data.elements/data.paging instead of data.data...
            paging = outer_data.get("paging") or {}
            elements = outer_data.get("elements")
            source = "JobCardsLite"

            if not isinstance(elements, list):
                return {
                    "ok": False,
                    "error": "Unexpected LinkedIn payload shape",
                    "details": (
                        "Missing legacy 'data.data.jobsDashJobCardsByJobCollections' and "
                        "search 'data.elements' collections"
                    ),
                }

        included = raw_data.get("included")

        if included is not None and not isinstance(included, list):
            return {
                "ok": False,
                "error": "Unexpected LinkedIn payload shape",
                "details": "Top-level 'included' field is not a list",
            }

        total = paging.get("total", 0) if isinstance(paging, dict) else 0
        start = paging.get("start", 0) if isinstance(paging, dict) else 0
        count = paging.get("count", 0) if isinstance(paging, dict) else 0

        is_empty_page = total == 0
        if isinstance(elements, list) and len(elements) == 0:
            is_empty_page = True
        elif total and count and start >= total:
            is_empty_page = True

        return {
            "ok": True,
            "source": source,
            "paging": {"total": total, "start": start, "count": count},
            "elements_count": len(elements) if isinstance(elements, list) else None,
            "included_count": len(included) if isinstance(included, list) else 0,
            "is_empty_page": is_empty_page,
        }

    @staticmethod
    def validate_search_mode(search_spec: Optional[PipelineSearchSpec]) -> Dict[str, Any]:
        if not search_spec or not search_spec.is_active():
            return {"success": True, "mode": "legacy"}

        validation = FetchService.validate_search_reference(with_meta=True)
        if not validation or not validation.get("success"):
            return {
                "success": False,
                "step": "validate_search_reference",
                "error": (validation or {}).get("error", "Stored JobCardsLite reference replay failed"),
                "details": (validation or {}).get("details"),
                "curl": (validation or {}).get("curl", "JobCardsLite"),
                "status": (validation or {}).get("status"),
                "error_type": (validation or {}).get("error_type"),
            }

        raw_data = validation["data"]
        payload_inspection = PopulationService._inspect_pagination_payload(raw_data)
        if not payload_inspection["ok"]:
            return {
                "success": False,
                "step": "validate_search_parser",
                "error": payload_inspection["error"],
                "details": payload_inspection["details"],
                "curl": "JobCardsLite",
                "status": validation.get("status"),
            }

        try:
            job_entries = parse_job_entries(raw_data)
        except Exception as exc:
            return {
                "success": False,
                "step": "validate_search_parser",
                "error": "LinkedIn parser raised an exception for the JobCardsLite reference payload",
                "details": str(exc),
                "curl": "JobCardsLite",
                "status": validation.get("status"),
            }

        if not job_entries and not payload_inspection["is_empty_page"]:
            return {
                "success": False,
                "step": "validate_search_parser",
                "error": "Parser returned no entries for the JobCardsLite reference payload",
                "details": (
                    "Search replay succeeded, but the population parser is still incompatible "
                    "with the validated search payload."
                ),
                "curl": "JobCardsLite",
                "status": validation.get("status"),
            }

        return {
            "success": True,
            "mode": "search",
            "curl": "JobCardsLite",
            "paging": payload_inspection["paging"],
            "parsed_entries": len(job_entries),
            "result_type": "empty_page" if payload_inspection["is_empty_page"] else "search_ready",
        }

    @staticmethod
    def get_total_pages(search_spec: Optional[PipelineSearchSpec] = None) -> int:
        data = FetchService.execute_fetch_page_raw(page_number=1, search_spec=search_spec)
        if not data: return 0
        try:
            inspection = PopulationService._inspect_pagination_payload(data)
            if not inspection["ok"]:
                return 0
            paging = inspection["paging"]
            total = paging.get('total', 0)
            count = paging.get('count', 25)
            if count == 0: return 0
            return math.ceil(total / count)
        except Exception:
            return 0

    @staticmethod
    def fetch_and_save_page(
        page_number: int,
        search_spec: Optional[PipelineSearchSpec] = None,
    ) -> Dict[str, Any]:
        print(f"\n[Population] ================= START PAGE {page_number} =================")
        repo = JobRepository()
        session = repo.session
        saved_count = 0
        enrichment_summary: Dict[str, Any] = {
            "requested": 0,
            "received": 0,
            "missing_count": 0,
        }

        try:
            if search_spec and search_spec.is_active():
                validation = PopulationService.validate_search_mode(search_spec)
                if not validation.get("success"):
                    return PopulationService._build_error_response(
                        page_number=page_number,
                        step=validation.get("step", "validate_search_reference"),
                        error=validation.get("error", "Search mode validation failed"),
                        details=validation.get("details"),
                        curl=validation.get("curl", "JobCardsLite"),
                        status=validation.get("status"),
                        error_type=validation.get("error_type"),
                    )

            # 1. FETCH PAGINATION (Lightweight)
            print(f"[Population] Step 1: Fetching List for Page {page_number}...")
            fetch_result = FetchService.execute_fetch_page_raw(
                page_number,
                with_meta=True,
                search_spec=search_spec,
            )
            if not fetch_result or not fetch_result.get("success"):
                print("[Population] ❌ Pagination fetch failed.")
                return PopulationService._build_error_response(
                    page_number=page_number,
                    step="fetch_pagination",
                    error=(fetch_result or {}).get("error", "LinkedIn pagination request failed"),
                    details=(fetch_result or {}).get("details"),
                    curl=(fetch_result or {}).get("curl", "Pagination"),
                    status=(fetch_result or {}).get("status"),
                    error_type=(fetch_result or {}).get("error_type"),
                )

            raw_data = fetch_result["data"]

            # 2. PARSE SUMMARIES
            payload_inspection = PopulationService._inspect_pagination_payload(raw_data)
            if not payload_inspection["ok"]:
                return PopulationService._build_error_response(
                    page_number=page_number,
                    step="parse_job_entries",
                    error=payload_inspection["error"],
                    details=payload_inspection["details"],
                    curl=fetch_result.get("curl", "Pagination"),
                    status=fetch_result.get("status"),
                )

            try:
                job_entries = parse_job_entries(raw_data)
            except Exception as exc:
                return PopulationService._build_error_response(
                    page_number=page_number,
                    step="parse_job_entries",
                    error="LinkedIn parser raised an exception",
                    details=str(exc),
                    curl=fetch_result.get("curl", "Pagination"),
                    status=fetch_result.get("status"),
                )

            if not job_entries:
                if payload_inspection["is_empty_page"]:
                    print("[Population] ⚠️ Legitimate empty page.")
                    return {
                        "success": True,
                        "page": page_number,
                        "count": 0,
                        "total_found": 0,
                        "message": "No jobs found",
                        "step": "parse_job_entries",
                        "result_type": "empty_page",
                        "paging": payload_inspection["paging"],
                        "enrichment": enrichment_summary,
                    }

                return PopulationService._build_error_response(
                    page_number=page_number,
                    step="parse_job_entries",
                    error="Parser returned no entries for a non-empty payload",
                    details=(
                        "Unexpected LinkedIn payload shape or parser mismatch. "
                        f"elements_count={payload_inspection.get('elements_count')}, "
                        f"included_count={payload_inspection.get('included_count')}"
                    ),
                    curl=fetch_result.get("curl", "Pagination"),
                    status=fetch_result.get("status"),
                )

            print(f"[Population] Step 2: Parsed {len(job_entries)} raw job entries.")

            # 3. IDENTIFY NEW JOBS
            try:
                new_jobs = []
                for job in job_entries:
                    if not repo.get_by_urn(job['urn']):
                        new_jobs.append(job)
            except Exception as exc:
                repo.rollback()
                return PopulationService._build_error_response(
                    page_number=page_number,
                    step="detect_new_jobs",
                    error="Failed to compare parsed jobs against the database",
                    details=str(exc),
                    total_found=len(job_entries),
                )

            # 4. BATCH ENRICHMENT
            if new_jobs:
                job_ids = [j['job_id'] for j in new_jobs]

                print(f"[Population] Step 4: Batch Enriching {len(job_ids)} IDs...")
                try:
                    enriched_results = EnrichmentService.fetch_batch_job_details(job_ids)
                except Exception as exc:
                    repo.rollback()
                    return PopulationService._build_error_response(
                        page_number=page_number,
                        step="batch_enrichment",
                        error="Batch enrichment request failed",
                        details=str(exc),
                        total_found=len(job_entries),
                        new_jobs=len(new_jobs),
                    )

                if not isinstance(enriched_results, dict):
                    repo.rollback()
                    return PopulationService._build_error_response(
                        page_number=page_number,
                        step="batch_enrichment",
                        error="Batch enrichment returned an unexpected result",
                        details=f"Expected dict, got {type(enriched_results).__name__}",
                        total_found=len(job_entries),
                        new_jobs=len(new_jobs),
                    )

                enrichment_summary = PopulationService._build_enrichment_summary(job_ids, enriched_results)
                if enrichment_summary["missing_count"] > 0:
                    print(
                        "[Population] ⚠️ Batch enrichment missing details for "
                        f"{enrichment_summary['missing_count']} job(s)."
                    )
                print(f"[Population] ✅ Batch returned data for {len(enriched_results)} jobs.")

                # 5. MERGE & SAVE
                for job in new_jobs:
                    job_id = job['job_id']

                    if job_id in enriched_results:
                        details = enriched_results[job_id]
                        job.update(details)
                    else:
                        print(f"   > [⚠️ Missing] No batch details for Job {job_id}. Marking unprocessed.")
                        job['description_full'] = "No description provided"
                        job['processed'] = False

                    c_urn = job.get('company_urn')
                    try:
                        if c_urn:
                            comp = session.query(Company).filter_by(urn=c_urn).first()
                            c_name = job.get('company_name', 'Unknown')
                            c_logo = job.get('company_logo')

                            if not comp:
                                print(f"     -> Creating NEW Company: {c_name} ({c_urn})")
                                new_comp = Company(urn=c_urn, name=c_name, logo_url=c_logo)
                                session.add(new_comp)
                                session.flush()
                            else:
                                if c_logo and not comp.logo_url:
                                    comp.logo_url = c_logo
                                    session.add(comp)

                        repo.add_job_by_dict(job)
                        saved_count += 1
                    except Exception as exc:
                        repo.rollback()
                        return PopulationService._build_error_response(
                            page_number=page_number,
                            step="save_jobs",
                            error="Failed while saving jobs to the database",
                            details=f"Job ID {job_id}: {exc}",
                            total_found=len(job_entries),
                            count=saved_count,
                            enrichment=enrichment_summary,
                        )

            print(f"[Population] Step 5: Committing {saved_count} jobs to database...")
            try:
                repo.commit()
            except Exception as exc:
                repo.rollback()
                return PopulationService._build_error_response(
                    page_number=page_number,
                    step="commit",
                    error="Database commit failed",
                    details=str(exc),
                    total_found=len(job_entries),
                    count=saved_count,
                    enrichment=enrichment_summary,
                )

            print(f"[Population] ================= END PAGE {page_number} =================\n")

            response: Dict[str, Any] = {
                "success": True,
                "page": page_number,
                "count": saved_count,
                "total_found": len(job_entries),
                "new_jobs_detected": len(new_jobs),
                "enrichment": enrichment_summary,
            }
            if saved_count == 0 and len(job_entries) > 0:
                response["message"] = f"All {len(job_entries)} jobs already in database."
            if enrichment_summary.get("missing_count", 0) > 0:
                response["warning"] = (
                    f"Batch enrichment missing for {enrichment_summary['missing_count']} "
                    "job(s); saved with fallback data."
                )
            return response
        except Exception as exc:
            repo.rollback()
            traceback.print_exc()
            return PopulationService._build_error_response(
                page_number=page_number,
                step="unexpected",
                error="Unexpected pipeline failure",
                details=str(exc),
                count=saved_count,
                enrichment=enrichment_summary,
            )
        finally:
            repo.close()

    @staticmethod
    def stream_description_backfill(time_range: str = 'all_time') -> Generator[str, None, None]:
        """
        Generator that processes jobs and yields SSE-compatible JSON events
        with detailed diffs on what changed.
        """
        print(f"[DEBUG] 🟢 Starting stream_description_backfill generator. Range: {time_range}", flush=True)

        try:
            db = get_db_session()

            # 1. Setup Session
            session_artefacts = get_linkedin_fetch_artefacts()
            if not session_artefacts:
                yield f"event: error\ndata: {json.dumps({'error': 'Could not load LinkedIn session. Update cookies.'})}\n\n"
                return

            requests_session, _ = session_artefacts

            # 2. Date Filtering Logic
            cutoff_date = None
            now = datetime.now()

            if time_range == 'past_24h':
                cutoff_date = now - timedelta(days=1)
            elif time_range == 'past_week':
                cutoff_date = now - timedelta(weeks=1)
            elif time_range == 'past_month':
                cutoff_date = now - timedelta(days=30)
            elif time_range == 'past_6_months':
                cutoff_date = now - timedelta(days=180)
            elif time_range == 'past_year':
                cutoff_date = now - timedelta(days=365)
            # 'all_time' leaves cutoff_date as None

            # 3. Build Query
            # We want to check ALL jobs for updates (applicants), not just ones missing descriptions
            query = db.query(Job)

            # Apply date filter if applicable
            if cutoff_date:
                # Assuming posted_on is stored as ISO string "YYYY-MM-DD..."
                # Lexicographical comparison works for ISO dates
                cutoff_str = cutoff_date.isoformat()
                print(f"[DEBUG] Filtering jobs posted after: {cutoff_str}")
                # [MODIFIED] Include jobs with missing dates so we can fix them!
                query = query.filter(
                    Job.posted_on.is_(None) | (Job.posted_on >= cutoff_str)
                )

            target_jobs = query.order_by(Job.posted_on.desc()).all()
            total = len(target_jobs)

            print(f"[DEBUG] Found {total} jobs matching criteria.", flush=True)

            if total == 0:
                # This event tells frontend we are done immediately
                yield f"event: complete\ndata: {json.dumps({'message': 'No jobs found for this period.'})}\n\n"
                return

            start_time = time.time()
            processed = 0
            success_count = 0

            # 4. Iterate and Stream
            for index, job in enumerate(target_jobs, start=1):
                print(
                    f"[DEBUG] Processing job {index}/{total} | Company: {job.company.name if job.company else 'Unknown'} | URN: {job.urn}",
                    flush=True
                )
                processed += 1

                # Metrics calculation
                elapsed = time.time() - start_time
                avg_time = elapsed / processed
                remaining_jobs = total - processed
                eta_seconds = remaining_jobs * avg_time

                # 5. Fetch Enrichment Data
                try:
                    enrichment_data = EnrichmentService.fetch_single_job_details_enrichment(requests_session, job.urn)
                except Exception as e:
                    print(f"[DEBUG] ❌ Error calling EnrichmentService: {e}", flush=True)
                    enrichment_data = {}

                new_desc = enrichment_data.get("description")
                new_applicants = enrichment_data.get("applicants")
                new_status = enrichment_data.get("application_status")
                posted_text = enrichment_data.get("posted_date_text")

                status = "failed"
                should_save = False
                changes = [] # List to store specific updates

                # --- Diff Logic ---
                TERMINAL_STATES = {"Refused", "Rejected", "Offer", "Hired", "Interviewing"}

                # 1. Check if we should ignore the update (Terminal State)
                if job.application_status in TERMINAL_STATES:
                    print(
                        f"[DEBUG] Skipping status update for {job.urn}. Current: {job.application_status} (Protected)")
                # 2. Check if it is ACTUALLY different (The Fix)
                elif job.application_status != new_status:
                    changes.append({
                        "field": "Status",
                        "old": job.application_status,
                        "new": new_status
                    })
                    job.application_status = new_status
                    should_save = True

                # 2. Fix Missing Date (NEW)
                if (job.posted_on is None or job.posted_on == "") and posted_text:
                    try:
                        # Clean string "Posted on Oct 15, 2025." -> "Oct 15, 2025"
                        clean_date_str = posted_text.replace("Posted on ", "").replace(".", "").strip()
                        # Parse to ISO format using dateutil
                        dt_object = date_parser.parse(clean_date_str)
                        new_iso_date = dt_object.isoformat()

                        changes.append({
                            "field": "Date Fix",
                            "old": "Missing",
                            "new": f"Fixed to {clean_date_str}"
                        })
                        job.posted_on = new_iso_date
                        should_save = True
                    except Exception as e:
                        print(f"[Warning] Date parse failed for {posted_text}: {e}")

                # 3. Check Description
                if new_desc and job.description_full != new_desc:
                    changes.append({
                        "field": "Description",
                        "old": "Missing" if job.description_full == "No description provided" else "Outdated",
                        "new": "Updated"
                    })
                    job.description_full = new_desc
                    should_save = True

                # 4. Check Applicants
                # Handle None/0 logic carefully
                old_applicants = job.applicants if job.applicants is not None else 0
                incoming_applicants = new_applicants if new_applicants is not None else 0

                if new_applicants is not None and old_applicants != incoming_applicants:
                    changes.append({
                        "field": "Applicants",
                        "old": old_applicants,
                        "new": incoming_applicants
                    })
                    job.applicants = incoming_applicants
                    should_save = True

                if should_save:
                    job.processed = False # Mark for re-indexing by AI if needed
                    db.commit()
                    status = "success"
                    success_count += 1
                    print(f"[DEBUG] 💾 Job {job.urn} updated.", flush=True)
                elif new_desc or new_applicants or new_status:
                    # Found data, but it matched DB (Success, but no update needed)
                    status = "success"
                    # print(f"[DEBUG] 🤷 Job {job.urn} is up to date.", flush=True)

                # 6. Build Payload
                payload = {
                    "current": processed,
                    "total": total,
                    "job_title": job.title,
                    "company": job.company.name if job.company else "Unknown",
                    "status": status,
                    "eta_seconds": round(eta_seconds),
                    "success_count": success_count,
                    "changes": changes # <--- Sending the Diff to frontend
                }

                yield f"data: {json.dumps(payload)}\n\n"

                # Gentle rate limit to avoid LinkedIn 429
                time.sleep(1.5)

            db.close()
            yield f"event: complete\ndata: {json.dumps({'message': 'Enrichment finished'})}\n\n"

        except Exception as e:
            traceback.print_exc()
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    @staticmethod
    def reconcile_failures() -> Dict[str, Any]:
        print("[Reconcile] Starting safe email-to-job reconciliation...")
        session = get_db_session()
        updated_count = 0

        try:
            rejection_emails = session.query(Email).filter(
                or_(Email.folder == 'Job fails', Email.category == 'Rejection'),
                Email.job_urn.is_(None),
            ).all()
            results = []

            for email in rejection_emails:
                result = reconcile_email_to_job(session, email, dry_run=False)
                results.append(result)
                if result.get("wrote") is True:
                    updated_count += 1

            session.commit()
            return {"success": True, "updated_count": updated_count, "results": results}

        except Exception as e:
            session.rollback()
            print(f"[Reconcile] Error: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}
        finally:
            session.close()
