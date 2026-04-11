from __future__ import annotations

from source.features.job_scoring.evaluation.benchmark import BenchmarkService
from source.features.job_scoring.scorers.embeddings_scorer import EmbeddingsScorer
from source.features.job_scoring.scripts.common import build_parser


def main() -> None:
    parser = build_parser("Run local embeddings scorer against local jobs.")
    args = parser.parse_args()

    service = BenchmarkService.from_db_path(args.db_path)
    jobs = service.load_jobs()
    if args.limit:
        jobs = jobs[: args.limit]

    run = service.run_single(EmbeddingsScorer(), jobs)
    artifacts = service.export_run_artifacts(run, args.output_dir)
    print(f"scorer={run.scorer_name} jobs={len(run.results)}")
    for key, path in artifacts.items():
        print(f"{key}={path}")


if __name__ == "__main__":
    main()
