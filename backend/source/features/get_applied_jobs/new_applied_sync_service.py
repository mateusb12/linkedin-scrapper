from datetime import datetime
import time
import hashlib
import json

from database.database_connection import get_db_session
from models.job_models import Job, Company
from source.features.get_applied_jobs.new_get_applied_jobs_service import JobTrackerFetcher


class AppliedJobsIncrementalSync:

    # ============================================================
    # INCREMENTAL SYNC (PAGE 1 ONLY)
    # ============================================================

    @staticmethod
    def sync():

        db = get_db_session()
        fetcher = JobTrackerFetcher(debug=False)

        inserted = 0
        updates_report = []

        try:
            result = fetcher.fetch_jobs(stage="applied")
            jobs_data = result.get("jobs", [])

            for job_data in jobs_data:

                job_id = job_data.get("job_id")
                if not job_id:
                    continue

                existing = db.query(Job).filter(Job.urn == job_id).first()

                if existing:
                    changes = AppliedJobsIncrementalSync._update_job(existing, job_data)

                    if changes:
                        updates_report.append({
                            "job_id": job_id,
                            "title": existing.title,
                            "changes": changes
                        })

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
            "updated": len(updates_report),
            "updates": updates_report,
            "stopped_early": False
        }

    # ============================================================
    # BACKFILL WITH CUTOFF (STREAM)
    # ============================================================

    @staticmethod
    def sync_backfill_stream(cutoff_date):

        db = get_db_session()
        fetcher = JobTrackerFetcher(debug=False)

        processed = 0
        inserted = 0

        try:
            result = fetcher.fetch_jobs(stage="applied")
            jobs_data = result.get("jobs", [])

            for job_data in jobs_data:

                processed += 1

                applied_str = job_data.get("applied_at")
                if not applied_str:
                    continue

                applied_dt = datetime.fromisoformat(applied_str)

                if applied_dt < cutoff_date:
                    yield AppliedJobsIncrementalSync._event({
                        "type": "finished",
                        "reason": "cutoff_reached",
                        "processed": processed,
                        "inserted": inserted
                    })
                    return

                job_id = job_data.get("job_id")
                if not job_id:
                    continue

                existing = db.query(Job).filter(Job.urn == job_id).first()

                if existing:
                    AppliedJobsIncrementalSync._update_job(existing, job_data)
                    db.commit()
                    continue

                AppliedJobsIncrementalSync._insert_job(db, job_data)
                db.commit()
                inserted += 1

                yield AppliedJobsIncrementalSync._event({
                    "type": "progress",
                    "processed": processed,
                    "inserted": inserted,
                    "job_id": job_id,
                    "title": job_data.get("title"),
                })

                time.sleep(0.2)

            yield AppliedJobsIncrementalSync._event({
                "type": "finished",
                "reason": "completed",
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
    # INSERT
    # ============================================================

    @staticmethod
    def _insert_job(db, job_data):

        job_id = job_data.get("job_id")
        if not job_id:
            return

        company_name = job_data.get("company")
        company_urn = None

        if company_name:
            company = db.query(Company).filter(Company.name == company_name).first()
            if not company:
                company = Company(name=company_name)
                db.add(company)
                db.flush()
            company_urn = company.urn

        applied_on = None
        if job_data.get("applied_at"):
            applied_on = datetime.fromisoformat(job_data["applied_at"])

        expire_at = None
        if job_data.get("expire_at") is not None:
            expire_at = datetime.fromisoformat(job_data["expire_at"])

        job = Job(
            urn=job_id,
            title=job_data.get("title"),
            location=job_data.get("location"),
            job_url=job_data.get("job_url"),
            has_applied=True,
            applied_on=applied_on,
            application_status="Applied",
            company_urn=company_urn,
            job_state=job_data.get("job_state"),
            experience_level=job_data.get("experience_level"),
            employment_status=job_data.get("employment_status"),
            application_closed=job_data.get("application_closed"),
            expire_at=expire_at,
            applicants=job_data.get("applicants"),
            description_full=job_data.get("description_full"),
        )

        db.add(job)

    # ============================================================
    # HASH HELPER (FOR DESCRIPTION DIFF)
    # ============================================================

    @staticmethod
    def _hash_text(text):
        if not text:
            return None
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    # ============================================================
    # UPDATE WITH DIFF
    # ============================================================

    @staticmethod
    def _update_job(existing_job, job_data):

        changes = {}

        def track(field, old, new):
            if old != new:
                changes[field] = {
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

        # description (HASH BASED DIFF)
        if job_data.get("description_full") is not None:

            old_hash = AppliedJobsIncrementalSync._hash_text(
                existing_job.description_full
            )
            new_hash = AppliedJobsIncrementalSync._hash_text(
                job_data.get("description_full")
            )

            if old_hash != new_hash:
                changes["description_full"] = {
                    "changed": True
                }
                existing_job.description_full = job_data.get("description_full")

        return changes

    # ============================================================
    # SSE FORMATTER
    # ============================================================

    @staticmethod
    def _event(data):
        return f"data: {json.dumps(data)}\n\n"
