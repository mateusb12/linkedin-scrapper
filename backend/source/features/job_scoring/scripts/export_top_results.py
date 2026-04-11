from __future__ import annotations

import json
from pathlib import Path

from source.features.job_scoring.evaluation.exporters import ensure_output_dir
from source.features.job_scoring.repository.sqlite_job_repository import (
    SQLiteJobRepository,
)
from source.features.job_scoring.scorers.embeddings_scorer import EmbeddingsScorer
from source.features.job_scoring.scorers.hybrid_scorer import HybridScorer
from source.features.job_scoring.scorers.rules_scorer import RulesScorer
from source.features.job_scoring.scripts.common import build_parser

SCORERS = {
    "rules": RulesScorer,
    "hybrid": HybridScorer,
    "embeddings": EmbeddingsScorer,
}


def main() -> None:
    parser = build_parser("Export top results from one scorer.")
    parser.add_argument("--scorer", choices=sorted(SCORERS), default="rules")
    parser.add_argument("--top-k", type=int, default=10)
    args = parser.parse_args()

    repository = SQLiteJobRepository(args.db_path)
    jobs = repository.fetch_jobs()
    scorer = SCORERS[args.scorer]()
    results = sorted(
        (scorer.score_job(job) for job in jobs),
        key=lambda result: result.total_score,
        reverse=True,
    )[: args.top_k]

    output_dir = ensure_output_dir(args.output_dir)
    target = Path(output_dir) / f"{args.scorer}_top_{args.top_k}.json"
    target.write_text(
        json.dumps([result.to_dict() for result in results], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(target)


if __name__ == "__main__":
    main()

