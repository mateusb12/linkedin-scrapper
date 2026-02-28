# backend/source/features/get_applied_jobs/new_applied_sync_service.py

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
            # Pega o JobServiceResponse e converte para dicts
            result_obj = fetcher.fetch_jobs(stage="applied")
            # O result_obj é um JobServiceResponse, precisamos iterar sobre .jobs
            jobs_list = result_obj.jobs

            for job_dto in jobs_list:

                job_id = job_dto.job_id
                if not job_id:
                    continue

                existing = db.query(Job).filter(Job.urn == job_id).first()

                if existing:
                    # Passamos 'db' para permitir a criação/atualização de Company se necessário
                    changes = AppliedJobsIncrementalSync._update_job(db, existing, job_dto)
                    if changes:
                        updates_report.append({
                            "job_id": job_id,
                            "title": existing.title,
                            "changes": changes
                        })
                else:
                    AppliedJobsIncrementalSync._insert_job(db, job_dto)
                    inserted += 1

            db.commit()

        except Exception as e:
            db.rollback()
            raise e
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
            result_obj = fetcher.fetch_jobs(stage="applied")
            jobs_list = result_obj.jobs

            for job_dto in jobs_list:
                processed += 1

                applied_str = job_dto.applied_at
                if not applied_str:
                    continue

                try:
                    applied_dt = datetime.fromisoformat(applied_str)
                    if applied_dt < cutoff_date:
                        yield AppliedJobsIncrementalSync._event({
                            "type": "finished",
                            "reason": "cutoff_reached",
                            "processed": processed,
                            "inserted": inserted
                        })
                        return
                except ValueError:
                    continue

                job_id = job_dto.job_id
                if not job_id:
                    continue

                existing = db.query(Job).filter(Job.urn == job_id).first()

                if existing:
                    # Passamos 'db' aqui também
                    AppliedJobsIncrementalSync._update_job(db, existing, job_dto)
                    # Commit a cada update no stream para feedback real-time
                    db.commit()
                else:
                    AppliedJobsIncrementalSync._insert_job(db, job_dto)
                    db.commit()
                    inserted += 1

                yield AppliedJobsIncrementalSync._event({
                    "type": "progress",
                    "processed": processed,
                    "inserted": inserted,
                    "job_id": job_id,
                    "title": job_dto.title,
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
    # INSERT (UPDATED WITH NEW FIELDS)
    # ============================================================

    @staticmethod
    def _insert_job(db, job_dto):
        """
        Recebe um JobPost (Dataclass) e insere no banco.
        """
        company_name = job_dto.company or "Unknown Company"
        company_urn = None

        # Resolve Company
        company = db.query(Company).filter(Company.name == company_name).first()
        if not company:
            # Gera URN fake se não existir
            pseudo_urn = f"urn:li:company:{hashlib.md5(company_name.encode()).hexdigest()}"
            company = Company(urn=pseudo_urn, name=company_name)
            db.add(company)
            db.flush()
        company_urn = company.urn

        # Parsers de Data
        applied_on = None
        if job_dto.applied_at:
            try:
                applied_on = datetime.fromisoformat(job_dto.applied_at)
            except:
                pass

        expire_at = None
        if job_dto.expire_at:
            try:
                expire_at = datetime.fromisoformat(job_dto.expire_at)
            except:
                pass

        # Cria Objeto Job
        job = Job(
            urn=job_dto.job_id,
            title=job_dto.title,
            location=job_dto.location,
            job_url=job_dto.job_url,
            has_applied=True,
            applied_on=applied_on,
            application_status="Applied",
            company_urn=company_urn,

            # Campos Originais
            job_state=job_dto.job_state,
            experience_level=job_dto.experience_level,
            employment_status=job_dto.employment_status,
            application_closed=job_dto.application_closed,
            expire_at=expire_at,
            applicants=job_dto.applicants,
            description_full=job_dto.description_full,
            work_remote_allowed=job_dto.work_remote_allowed,

            # --- NOVOS CAMPOS (PREMIUM & METRICS) ---
            competition_level=job_dto.competition_level,
            applicants_velocity=job_dto.applicants_velocity_24h,
            seniority_distribution=job_dto.seniority_distribution,
            education_distribution=job_dto.education_distribution,
            premium_title=job_dto.premium_title,
            premium_description=job_dto.premium_description
        )

        db.add(job)

    # ============================================================
    # UPDATE (UPDATED WITH NEW FIELDS + COMPANY FIX)
    # ============================================================

    @staticmethod
    def _update_job(db, existing_job, job_dto):
        """
        Atualiza Job existente com dados do JobPost (Dataclass).
        Agora recebe 'db' para poder corrigir/criar empresas se o nome mudar.
        """
        changes = {}

        def update_field(field_name, old_val, new_val):
            # Comparação simples
            if new_val is not None and old_val != new_val:
                changes[field_name] = {"from": old_val, "to": new_val}
                setattr(existing_job, field_name, new_val)

        # 1. Atualizar Título (se mudou)
        if job_dto.title and existing_job.title != job_dto.title:
            changes["title"] = {"from": existing_job.title, "to": job_dto.title}
            existing_job.title = job_dto.title

        # 2. Atualizar Empresa (se mudou, ex: de Unknown para Metal Toad)
        if job_dto.company:
            # Pega o nome atual da empresa no banco (se houver)
            current_company_name = existing_job.company.name if existing_job.company else ""

            if current_company_name != job_dto.company:
                # Resolve a nova empresa (cria se não existir)
                new_company = db.query(Company).filter(Company.name == job_dto.company).first()
                if not new_company:
                    # Cria a empresa nova
                    pseudo_urn = f"urn:li:company:{hashlib.md5(job_dto.company.encode()).hexdigest()}"
                    new_company = Company(urn=pseudo_urn, name=job_dto.company)
                    db.add(new_company)
                    db.flush()

                # Atualiza o vínculo
                changes["company"] = {"from": current_company_name, "to": job_dto.company}
                existing_job.company_urn = new_company.urn

        # Datas
        if job_dto.applied_at:
            try:
                new_applied = datetime.fromisoformat(job_dto.applied_at)
                update_field("applied_on", existing_job.applied_on, new_applied)
            except:
                pass

        if job_dto.expire_at:
            try:
                new_expire = datetime.fromisoformat(job_dto.expire_at)
                update_field("expire_at", existing_job.expire_at, new_expire)
            except:
                pass

        # Campos Simples
        update_field("job_state", existing_job.job_state, job_dto.job_state)
        update_field("experience_level", existing_job.experience_level, job_dto.experience_level)
        update_field("employment_status", existing_job.employment_status, job_dto.employment_status)
        update_field("application_closed", existing_job.application_closed, job_dto.application_closed)
        update_field("applicants", existing_job.applicants, job_dto.applicants)

        # Novos Campos
        update_field("competition_level", existing_job.competition_level, job_dto.competition_level)
        update_field("applicants_velocity", existing_job.applicants_velocity, job_dto.applicants_velocity_24h)
        update_field("premium_title", existing_job.premium_title, job_dto.premium_title)
        update_field("premium_description", existing_job.premium_description, job_dto.premium_description)
        update_field("work_remote_allowed", existing_job.work_remote_allowed, job_dto.work_remote_allowed)

        # JSON Fields (Sempre sobrescreve se vier não-nulo)
        if job_dto.seniority_distribution:
            existing_job.seniority_distribution = job_dto.seniority_distribution
        if job_dto.education_distribution:
            existing_job.education_distribution = job_dto.education_distribution

        # Description (Hash Check)
        if job_dto.description_full:
            old_hash = hashlib.sha256((existing_job.description_full or "").encode()).hexdigest()
            new_hash = hashlib.sha256(job_dto.description_full.encode()).hexdigest()

            if old_hash != new_hash:
                changes["description_full"] = {"changed": True}
                existing_job.description_full = job_dto.description_full

        return changes

    @staticmethod
    def _event(data):
        return f"data: {json.dumps(data)}\n\n"
