# database/orm_models.py

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
    applicants = Column(Integer, default=0)
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

    company_urn = Column(String, ForeignKey('companies.urn'))
    company = relationship("Company", back_populates="jobs")

    def __repr__(self):
        return f"<Job(title='{self.title}', company='{self.company.name if self.company else None}')>"

    def to_dict(self, *, include_company: bool = True):
        from datetime import datetime

        days_until_expire = None
        if self.expire_at:
            delta = self.expire_at - datetime.utcnow()
            days_until_expire = delta.days

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
            "applied_on": self.applied_on.isoformat() if self.applied_on else None,
            "applied_on_formatted": self.applied_on.strftime("%d-%b-%Y") if self.applied_on else None,
            "company_urn": self.company_urn,
            "company": self.company.to_dict() if self.company else None,
            "applicants": self.applicants,
            "description_snippet": self.description_snippet,
            "easy_apply": self.easy_apply,
            "language": self.language,
            "responsibilities": self.responsibilities or [],
            "qualifications": self.qualifications or [],
            "job_type": self.job_type or "Full-stack",
            "programming_languages": self.programming_languages or [],
            "keywords": self.keywords or [],
            "disabled": self.disabled,
            "application_status": self.application_status or "Waiting",

            "job_state": self.job_state,
            "experience_level": self.experience_level,
            "employment_status": self.employment_status,
            "application_closed": self.application_closed,
            "expire_at": self.expire_at.isoformat() if self.expire_at else None,
            "days_until_expire": days_until_expire,
        }

        if include_company and self.company is not None:
            data["company"] = self.company.to_dict(include_jobs=False)

        return data
