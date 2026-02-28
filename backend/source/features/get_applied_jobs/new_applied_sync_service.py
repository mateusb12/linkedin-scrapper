from datetime import datetime
import json
import time

from database.database_connection import get_db_session
from models.job_models import Job, Company
from source.features.get_applied_jobs.new_get_applied_jobs_service import JobTrackerFetcher


class AppliedJobsIncrementalSync:

    # ============================================================
    # INCREMENTAL NORMAL
    # ============================================================

    @staticmethod
    def sync():

        db = get_db_session()
        fetcher = JobTrackerFetcher(debug=False)

        result = fetcher.fetch_jobs(stage="applied")
        jobs_data = result.get("jobs", [])

        inserted = 0
        stopped_early = False

        try:
            for job_data in jobs_data:

                job_id = job_data.get("job_id")
                if not job_id:
                    continue

                existing = db.query(Job).filter(Job.urn == job_id).first()

                if existing:
                    AppliedJobsIncrementalSync._update_job(existing, job_data)
                    continue

                AppliedJobsIncrementalSync._insert_job(db, job_data)
                inserted += 1

            db.commit()

        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

        return {
            "inserted": inserted,
            "stopped_early": stopped_early
        }

    # ============================================================
    # BACKFILL STREAM (🔥 PROGRESSIVO)
    # ============================================================

    @staticmethod
    def sync_backfill_stream(cutoff_date: datetime):

        db = get_db_session()
        fetcher = JobTrackerFetcher(debug=False)

        inserted = 0
        processed = 0

        try:
            result = fetcher.fetch_jobs(stage="applied")
            jobs_data = result.get("jobs", [])

            if not jobs_data:
                yield AppliedJobsIncrementalSync._event({
                    "type": "finished",
                    "reason": "no_jobs_found",
                    "inserted": 0
                })
                return

            for job_data in jobs_data:

                processed += 1

                applied_str = job_data.get("applied_at")
                if not applied_str:
                    continue

                applied_dt = datetime.fromisoformat(applied_str)

                # 🔥 STOP CONDITION
                if applied_dt < cutoff_date:
                    yield AppliedJobsIncrementalSync._event({
                        "type": "finished",
                        "reason": "cutoff_reached",
                        "processed": processed,
                        "inserted": inserted
                    })
                    return

                job_id = job_data.get("job_id")

                existing = db.query(Job).filter(Job.urn == job_id).first()
                if existing:
                    AppliedJobsIncrementalSync._update_job(existing, job_data)
                    db.commit()
                    continue

                AppliedJobsIncrementalSync._insert_job(db, job_data)
                inserted += 1
                db.commit()

                yield AppliedJobsIncrementalSync._event({
                    "type": "progress",
                    "processed": processed,
                    "inserted": inserted,
                    "job_id": job_id,
                    "timestamp": applied_dt.strftime("%d-%b-%Y"),
                    "title": job_data.get("title"),
                })

                time.sleep(0.2)  # anti flood

            yield AppliedJobsIncrementalSync._event({
                "type": "finished",
                "reason": "completed_page",
                "processed": processed,
                "inserted": inserted
            })

        except Exception as e:
            db.rollback()
            yield AppliedJobsIncrementalSync._event({
                "type": "error",
                "message": str(e)
            })
        finally:
            db.close()

    # ============================================================
    # INTERNAL INSERT
    # ============================================================

    @staticmethod
    def _insert_job(db, job_data):

        job_id = job_data.get("job_id")
        company_name = job_data.get("company") or "Unknown"
        company_urn = f"urn:li:company:{company_name}"

        company = db.query(Company).filter_by(urn=company_urn).first()
        if not company:
            company = Company(
                urn=company_urn,
                name=company_name
            )
            db.add(company)

        applied_on = None
        if job_data.get("applied_at"):
            applied_on = datetime.fromisoformat(job_data["applied_at"])

        expire_at = None
        if job_data.get("expire_at"):
            expire_at = datetime.fromisoformat(job_data["expire_at"])

        job = Job(
            urn=job_id,
            title=job_data.get("title"),
            location=job_data.get("location"),
            job_url=job_data.get("job_url"),
            posted_on=job_data.get("date_posted"),
            has_applied=True,
            applied_on=applied_on,
            application_status="Applied",
            company_urn=company_urn,

            # 🔥 enrichment
            job_state=job_data.get("job_state"),
            experience_level=job_data.get("experience_level"),
            employment_status=job_data.get("employment_status"),
            application_closed=job_data.get("application_closed"),
            expire_at=expire_at,
            applicants=job_data.get("applicants"),
        )

        db.add(job)

    @staticmethod
    def _update_job(existing_job, job_data):

        changes = {}

        def track(field_name, old, new):
            if old != new:
                changes[field_name] = {
                    "from": old,
                    "to": new
                }

        # applied_at
        if job_data.get("applied_at"):
            new_applied = datetime.fromisoformat(job_data["applied_at"])
            track("applied_on", existing_job.applied_on, new_applied)
            existing_job.applied_on = new_applied

        # job_state
        if job_data.get("job_state") is not None:
            track("job_state", existing_job.job_state, job_data.get("job_state"))
            existing_job.job_state = job_data.get("job_state")

        # experience_level
        if job_data.get("experience_level") is not None:
            track("experience_level", existing_job.experience_level, job_data.get("experience_level"))
            existing_job.experience_level = job_data.get("experience_level")

        # employment_status
        if job_data.get("employment_status") is not None:
            track("employment_status", existing_job.employment_status, job_data.get("employment_status"))
            existing_job.employment_status = job_data.get("employment_status")

        # application_closed
        if job_data.get("application_closed") is not None:
            track("application_closed", existing_job.application_closed, job_data.get("application_closed"))
            existing_job.application_closed = job_data.get("application_closed")

        # expire_at
        if job_data.get("expire_at"):
            new_expire = datetime.fromisoformat(job_data["expire_at"])
            track("expire_at", existing_job.expire_at, new_expire)
            existing_job.expire_at = new_expire

        # applicants
        if job_data.get("applicants") is not None:
            track("applicants", existing_job.applicants, job_data.get("applicants"))
            existing_job.applicants = job_data.get("applicants")

        return changes

    # ============================================================
    # SSE FORMATTER
    # ============================================================

    @staticmethod
    def _event(data: dict):
        return f"data: {json.dumps(data)}\n\n"
