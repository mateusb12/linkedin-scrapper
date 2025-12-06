import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# --- FIX START: Add project root to path ---
# This ensures python can find 'database', 'models', etc.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# --- FIX START: Import from correct locations ---
# Old: from source.db import Base, engine as app_engine
# New:
from database.database_connection import engine as app_engine
from models.base_model import Base
import models.user_models  # Import models so Alembic detects the new column
import models.job_models
import models.fetch_models
# --- FIX END ---

# Alembic Config object
config = context.config

# Logging configuration
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set SQLAlchemy database URL
config.set_main_option("sqlalchemy.url", str(app_engine.url))

# Metadata for autogenerate support
target_metadata = Base.metadata

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""
    # Use the existing engine from your app
    connectable = app_engine

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()