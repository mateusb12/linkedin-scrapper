# database/orm_models.py

from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from models.base_model import Base


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

    # Columns based on the top-level job objects in the JSON
    urn = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    location = Column(String)
    workplace_type = Column(String)
    employment_type = Column(String)
    posted_on = Column(String)
    job_url = Column(String)
    description_full = Column(Text)

    # Foreign Key to link to the 'companies' table
    company_urn = Column(String, ForeignKey('companies.urn'))

    # This links a Job back to its one Company
    company = relationship("Company", back_populates="jobs")

    def __repr__(self):
        return f"<Job(title='{self.title}', company='{self.company.name if self.company else None}')>"

    def to_dict(self, *, include_company: bool = True):
        data = {
            "urn": self.urn,
            "title": self.title,
            "location": self.location,
            "workplace_type": self.workplace_type,
            "employment_type": self.employment_type,
            "posted_on": self.posted_on,
            "job_url": self.job_url,
            "description_full": self.description_full,
            "company_urn": self.company_urn,
            "company": self.company.to_dict() if self.company else None
        }
        if include_company and self.company is not None:
            data["company"] = self.company.to_dict(include_jobs=False)
        return data
