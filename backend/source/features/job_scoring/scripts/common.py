from __future__ import annotations

import argparse
from pathlib import Path

from source.features.job_scoring.repository.sqlite_job_repository import DEFAULT_DB_PATH

DEFAULT_OUTPUT_DIR = Path("/app/source/features/job_scoring/outputs")


def build_parser(description: str) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--db-path", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--limit", type=int, default=None)
    return parser

