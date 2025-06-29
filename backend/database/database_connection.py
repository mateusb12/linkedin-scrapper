# database/database_setup.py
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import models

print(f"Importing ORM models... {models.__name__}")

# The database file path
root_dir = Path(__file__).parent.parent
db_path = root_dir / "database" / "linkedin.db"


DATABASE_URL = f"sqlite:///{db_path}"

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
    models.Base.metadata.create_all(bind=engine)
    print("Done.")


def get_db_session():
    """
    Provides a new database session.
    """
    return SessionLocal()
