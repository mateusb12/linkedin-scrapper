# backend/database/database_connection.py

from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models

print(f"Importing ORM models... {models.__name__}")

# =====================================================
# ABSOLUTE DATABASE PATH (bulletproof)
# =====================================================

# Directory of this file → backend/database/
CURRENT_DIR = Path(__file__).resolve().parent

# Root project folder → backend/
BACKEND_DIR = CURRENT_DIR.parent

# Final SQLite DB file → backend/database/linkedin.db
DB_FILE = Path("/app/db/linkedin.db")

# Convert to proper SQLite URL
DATABASE_URL = f"sqlite:///{DB_FILE}"

# =====================================================
# SQLAlchemy Engine
# =====================================================

engine = create_engine(
    DATABASE_URL,
    echo=False,  # Set to True if you want SQL logs
    connect_args={"check_same_thread": False},  # Required for FastAPI/Flask multithreading
)

# SQLAlchemy Session Factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# =====================================================
# Database Helpers
# =====================================================

def create_db_and_tables():
    """
    Creates SQLite DB and all ORM tables.
    Safe to run multiple times (won't overwrite tables).
    """
    print(f"Creating database at: {DB_FILE}")
    models.Base.metadata.create_all(bind=engine)
    print("Database initialization complete.\n")


def get_db_session():
    """
    Returns a new SQLAlchemy session.
    Use inside routes.
    """
    return SessionLocal()
