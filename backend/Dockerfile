FROM python:3.12-slim

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONPATH=/app

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -

ENV PATH="/root/.local/bin:$PATH"
ENV POETRY_VIRTUALENVS_CREATE=false \
    POETRY_VIRTUALENVS_IN_PROJECT=false \
    POETRY_NO_INTERACTION=1

# Copy only dependency files first
COPY pyproject.toml poetry.lock ./

# Install deps (no dev groups in your project)
RUN poetry install --no-root --only main --no-interaction --no-ansi

# Copy code
COPY . .

EXPOSE 5000

# Flask run command (adjust if you use FastAPI instead)
CMD ["poetry", "run", "flask", "--app", "app.py", "run", "--host=0.0.0.0", "--port=5000"]

