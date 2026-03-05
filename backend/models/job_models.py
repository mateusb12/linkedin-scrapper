# database/orm_models.py
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Text, ForeignKey, Integer, Boolean, JSON, DateTime
from sqlalchemy.orm import relationship

from .base_model import Base


class Company(Base):
    __tablename__ = 'companies'

    # Columns based on the 'company' object in the JSON
    urn = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    logo_url = Column(String)
    url = Column(String)

    # This creates the one-to-many relationship: One Company has many Jobs
    jobs = relationship("Job", back_populates="company")

    def __repr__(self):
        return f"<Company(name='{self.name}')>"

    def to_dict(self, *, include_jobs: bool = False):
        data = {
            "urn": self.urn,
            "name": self.name,
            "logo_url": self.logo_url,
            "url": self.url,
        }
        if include_jobs:
            data["jobs"] = [job.to_dict(include_company=False) for job in self.jobs]
        return data


class Job(Base):
    __tablename__ = 'jobs'

    urn = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    location = Column(String)
    workplace_type = Column(String)
    employment_type = Column(String)
    posted_on = Column(String)
    job_url = Column(String)
    description_full = Column(Text)

    # Métricas Básicas
    applicants = Column(Integer, default=0)

    # --- NOVOS CAMPOS (ATUALIZAÇÃO) ---
    competition_level = Column(String, nullable=True)
    applicants_velocity = Column(Integer, nullable=True)
    seniority_distribution = Column(JSON, nullable=True)
    education_distribution = Column(JSON, nullable=True)
    work_remote_allowed = Column(Boolean, default=False)
    premium_title = Column(String, nullable=True)
    premium_description = Column(String, nullable=True)
    # ----------------------------------

    description_snippet = Column(Text, default="")
    easy_apply = Column(Boolean, default=False)
    language = Column(String, default="PTBR")
    disabled = Column(Boolean, default=False)
    processed = Column(Boolean, default=False)

    responsibilities = Column(JSON, nullable=True)
    qualifications = Column(JSON, nullable=True)
    keywords = Column(JSON, nullable=True)

    job_type = Column(String, nullable=True, default="Full-stack")
    programming_languages = Column(JSON, nullable=True, default=[])

    has_applied = Column(Boolean, default=False)
    applied_on = Column(DateTime, nullable=True, default=None)
    application_status = Column(String, default="Waiting")

    job_state = Column(String, nullable=True)
    experience_level = Column(String, nullable=True)
    employment_status = Column(String, nullable=True)
    application_closed = Column(Boolean, nullable=True)
    expire_at = Column(DateTime, nullable=True)

    # Relacionamento
    company_urn = Column(String, ForeignKey('companies.urn'), nullable=True)
    company = relationship("Company", back_populates="jobs")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        comp_name = self.company.name if self.company else "NoCompany"
        return f"<Job(id='{self.urn}', title='{self.title}', company='{comp_name}')>"

    def to_dict(self, *, include_company: bool = True):
        days_until_expire = None
        if self.expire_at:
            delta = self.expire_at - datetime.utcnow()
            days_until_expire = delta.days

        # --- LÓGICA DE CONVERSÃO BRT NO BACKEND ---
        applied_at_brt = None
        if self.applied_on:
            # 1. Garante que temos um timezone UTC no objeto (se vier naive do banco)
            dt_utc = self.applied_on
            if dt_utc.tzinfo is None:
                dt_utc = dt_utc.replace(tzinfo=timezone.utc)

            # 2. Converte para BRT (UTC-3)
            brt_zone = timezone(timedelta(hours=-3))
            dt_brt = dt_utc.astimezone(brt_zone)

            # 3. Formata como ISO String com o offset correto (-03:00)
            applied_at_brt = dt_brt.isoformat()
        # ------------------------------------------

        data = {
            "urn": self.urn,
            "title": self.title,
            "location": self.location,
            "workplace_type": self.workplace_type,
            "employment_type": self.employment_type,
            "posted_on": self.posted_on,
            "job_url": self.job_url,
            "description_full": self.description_full,
            "has_applied": self.has_applied,

            # Campo original UTC
            "applied_on": self.applied_on.isoformat() if self.applied_on else None,

            # NOVO CAMPO BRL 🇧🇷
            "applied_at_brt": applied_at_brt,

            "company_urn": self.company_urn,

            "applicants": self.applicants,
            "applicants_velocity": self.applicants_velocity,
            "competition_level": self.competition_level,

            "seniority_distribution": self.seniority_distribution or [],
            "education_distribution": self.education_distribution or [],
            "premium_title": self.premium_title,

            "job_state": self.job_state,
            "experience_level": self.experience_level,
            "employment_status": self.employment_status,
            "application_closed": self.application_closed,
            "expire_at": self.expire_at.isoformat() if self.expire_at else None,
            "days_until_expire": days_until_expire,
            "application_status": self.application_status,
        }

        if include_company and self.company:
            data["company"] = self.company.to_dict(include_jobs=False)

        return data
