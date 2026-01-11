FROM python:3.12-slim

# ===============================
# SYSTEM DEPS
# ===============================
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ===============================
# WORKDIR
# ===============================
WORKDIR /app
ENV PYTHONPATH=/app

# ===============================
# POETRY
# ===============================
RUN curl -sSL https://install.python-poetry.org | python3 -

ENV PATH="/root/.local/bin:$PATH"
ENV POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

# ===============================
# INSTALL DEPS (DEV OR PROD)
# ===============================
ARG INSTALL_DEV=false

COPY pyproject.toml poetry.lock ./

RUN if [ "$INSTALL_DEV" = "true" ]; then \
        poetry install --no-root --with dev ; \
    else \
        poetry install --no-root ; \
    fi

# ===============================
# APP CODE
# ===============================
COPY . .

EXPOSE 5000

# ===============================
# DEFAULT CMD (DEV OVERRIDES IN COMPOSE)
# ===============================
CMD ["poetry", "run", "flask", "run", "--host=0.0.0.0", "--port=5000"]
