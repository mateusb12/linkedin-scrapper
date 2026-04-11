from __future__ import annotations

import csv
from pathlib import Path

from source.features.job_scoring.evaluation.benchmark import BenchmarkService
from source.features.job_scoring.scripts.common import build_parser


def main() -> None:
    parser = build_parser("Compare scorer rankings side by side.")
    args = parser.parse_args()

    service = BenchmarkService.from_db_path(args.db_path)
    jobs = service.load_jobs()
    if args.limit:
        jobs = jobs[: args.limit]

    runs = service.run_all(jobs)
    rows = service.build_comparison_rows(runs)
    target = Path(args.output_dir) / "approach_comparison_only.csv"
    target.parent.mkdir(parents=True, exist_ok=True)
    if rows:
        with target.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
    else:
        target.write_text("", encoding="utf-8")
    print(target)


if __name__ == "__main__":
    main()
