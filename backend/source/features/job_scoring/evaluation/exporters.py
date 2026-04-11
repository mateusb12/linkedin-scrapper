from __future__ import annotations

import csv
import json
from collections.abc import Iterable
from pathlib import Path

from source.features.job_scoring.domain import ScoreResult


def ensure_output_dir(path: str | Path) -> Path:
    output_dir = Path(path)
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def export_results_json(results: Iterable[ScoreResult], path: str | Path) -> Path:
    target = Path(path)
    target.write_text(
        json.dumps([result.to_dict() for result in results], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return target


def export_results_csv(results: Iterable[ScoreResult], path: str | Path) -> Path:
    target = Path(path)
    flat_rows = [result.to_flat_dict() for result in results]
    if not flat_rows:
        target.write_text("", encoding="utf-8")
        return target
    with target.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(flat_rows[0].keys()))
        writer.writeheader()
        writer.writerows(flat_rows)
    return target


def export_markdown(content: str, path: str | Path) -> Path:
    target = Path(path)
    target.write_text(content, encoding="utf-8")
    return target

