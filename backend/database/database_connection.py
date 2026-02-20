from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models
import os

print(f"Importing ORM models... {models.__name__}")

# ============================================================
# Detectar se está rodando em Docker
# ============================================================

def running_in_docker() -> bool:
    return Path("/.dockerenv").exists() or os.environ.get("RUNNING_IN_DOCKER") == "1"

# ============================================================
# Definir caminho do DB dependendo do ambiente
# ============================================================

if running_in_docker():
    # Caminho dentro do contêiner
    DB_FILE = Path("/app/db/linkedin.db")
else:
    # Caminho local no ambiente do desenvolvedor
    CURRENT_DIR = Path(__file__).resolve().parent
    BACKEND_DIR = CURRENT_DIR.parent
    DB_FILE = BACKEND_DIR / "db" / "linkedin.db"

# Garantir que o diretório existe
DB_FILE.parent.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_FILE}"

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

def create_db_and_tables():
    print(f"Creating database at: {DB_FILE}")
    models.Base.metadata.create_all(bind=engine)
    print("Database initialization complete.\n")

def get_db_session():
    return SessionLocal()