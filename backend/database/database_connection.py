# database/database_setup.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.job_models import Base

# The database file path
DATABASE_URL = "sqlite:///linkedin.db"

# Create the database engine
engine = create_engine(DATABASE_URL, echo=False)  # Set echo=True to see generated SQL

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_db_and_tables():
    """
    Creates the database and all tables defined in orm_models.py.
    This is safe to run multiple times; it won't recreate existing tables.
    """
    print("Creating database and tables...")
    Base.metadata.create_all(bind=engine)
    print("Done.")


def get_db_session():
    """
    Provides a new database session.
    """
    return SessionLocal()
