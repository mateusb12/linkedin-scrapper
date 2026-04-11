from __future__ import annotations

from source.features.job_scoring.evaluation.benchmark import BenchmarkService
from source.features.job_scoring.scripts.common import build_parser


def main() -> None:
    parser = build_parser("Run all local job scorers and export benchmark artifacts.")
    args = parser.parse_args()

    service = BenchmarkService.from_db_path(args.db_path)
    jobs = service.load_jobs()
    if args.limit:
        jobs = jobs[: args.limit]

    runs = service.run_all(jobs)
    artifacts = service.export_benchmark_artifacts(runs, output_dir=args.output_dir)
    print(f"runs={len(runs)} jobs={len(jobs)}")
    for key, path in artifacts.items():
        print(f"{key}={path}")


if __name__ == "__main__":
    main()
