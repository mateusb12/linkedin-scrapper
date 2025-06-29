# database/orm_models.py

from sqlalchemy import create_engine, Column, String, Text, ForeignKey
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# Base class for our models to inherit from
Base = declarative_base()


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