from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from source.features.job_scoring.domain import JobPosting, ScoreResult
from source.features.job_scoring.evaluation.exporters import (
    ensure_output_dir,
    export_markdown,
    export_results_csv,
    export_results_json,
)
from source.features.job_scoring.repository.sqlite_job_repository import (
    DEFAULT_DB_PATH,
    SQLiteJobRepository,
)
from source.features.job_scoring.scorers.base import BaseJobScorer
from source.features.job_scoring.scorers.embeddings_scorer import EmbeddingsScorer
from source.features.job_scoring.scorers.hybrid_scorer import HybridScorer
from source.features.job_scoring.scorers.rules_scorer import RulesScorer


@dataclass(slots=True)
class BenchmarkRun:
    scorer_name: str
    results: list[ScoreResult]

    @property
    def top_10(self) -> list[ScoreResult]:
        return self.results[:10]

    @property
    def bottom_10(self) -> list[ScoreResult]:
        return list(reversed(self.results[-10:]))

    @property
    def suspicious_high(self) -> list[ScoreResult]:
        suspicious = [result for result in self.results if result.suspicious]
        return suspicious[:10]

    @property
    def applied_average(self) -> float | None:
        applied = [result.total_score for result in self.results if result.job.has_applied]
        if not applied:
            return None
        return sum(applied) / len(applied)


class BenchmarkService:
    def __init__(
        self,
        repository: SQLiteJobRepository | None = None,
        scorers: list[BaseJobScorer] | None = None,
    ) -> None:
        self.repository = repository or SQLiteJobRepository(DEFAULT_DB_PATH)
        self.scorers = scorers or [
            RulesScorer(),
            HybridScorer(),
            EmbeddingsScorer(),
        ]

    @classmethod
    def from_db_path(cls, db_path: str | Path) -> BenchmarkService:
        return cls(repository=SQLiteJobRepository(db_path))

    def load_jobs(self) -> list[JobPosting]:
        return self.repository.fetch_jobs()

    def run_single(self, scorer: BaseJobScorer, jobs: list[JobPosting]) -> BenchmarkRun:
        results = sorted(
            (scorer.score_job(job) for job in jobs),
            key=lambda result: result.total_score,
            reverse=True,
        )
        return BenchmarkRun(scorer_name=scorer.scorer_name, results=results)

    def run_all(self, jobs: list[JobPosting] | None = None) -> list[BenchmarkRun]:
        loaded_jobs = jobs or self.load_jobs()
        return [self.run_single(scorer, loaded_jobs) for scorer in self.scorers]

    @staticmethod
    def build_comparison_rows(runs: list[BenchmarkRun]) -> list[dict]:
        comparisons: dict[str, dict] = {}
        for run in runs:
            for index, result in enumerate(run.results, start=1):
                row = comparisons.setdefault(
                    result.job.urn,
                    {
                        "urn": result.job.urn,
                        "title": result.job.title,
                        "location": result.job.location,
                        "has_applied": result.job.has_applied,
                    },
                )
                row[f"{run.scorer_name}_rank"] = index
                row[f"{run.scorer_name}_score"] = round(result.total_score, 2)
        return sorted(
            comparisons.values(),
            key=lambda row: min(
                row.get("rules_scorer_rank", 9999),
                row.get("hybrid_scorer_rank", 9999),
                row.get("embeddings_scorer_rank", 9999),
            ),
        )

    @staticmethod
    def build_markdown_summary(runs: list[BenchmarkRun], jobs_count: int) -> str:
        lines = [
            "# Job Scoring Benchmark Summary",
            "",
            f"- Jobs avaliadas: {jobs_count}",
            f"- Abordagens: {', '.join(run.scorer_name for run in runs)}",
            "",
        ]
        for run in runs:
            lines.extend(
                [
                    f"## {run.scorer_name}",
                    "",
                    f"- Média de score em vagas aplicadas: {round(run.applied_average, 2) if run.applied_average is not None else 'N/A'}",
                    "",
                    "### Top 10",
                    "",
                ]
            )
            for result in run.top_10:
                lines.append(
                    f"- {result.total_score:.2f} | {result.job.title} | {result.job.urn}"
                )
            lines.extend(["", "### Bottom 10", ""])
            for result in run.bottom_10:
                lines.append(
                    f"- {result.total_score:.2f} | {result.job.title} | {result.job.urn}"
                )
            lines.extend(["", "### Casos suspeitos", ""])
            if run.suspicious_high:
                for result in run.suspicious_high:
                    lines.append(
                        f"- {result.total_score:.2f} | {result.job.title} | {'; '.join(result.suspicious_reasons)}"
                    )
            else:
                lines.append("- Nenhum caso suspeito pelo heurístico atual.")
            lines.append("")
        return "\n".join(lines).strip() + "\n"

    def export_run_artifacts(
        self,
        run: BenchmarkRun,
        output_dir: str | Path,
    ) -> dict[str, Path]:
        target_dir = ensure_output_dir(output_dir)
        base = target_dir / run.scorer_name
        return {
            "all_json": export_results_json(run.results, base.with_suffix(".json")),
            "all_csv": export_results_csv(run.results, base.with_suffix(".csv")),
            "top_10_json": export_results_json(
                run.top_10, target_dir / f"{run.scorer_name}_top_10.json"
            ),
            "bottom_10_json": export_results_json(
                run.bottom_10, target_dir / f"{run.scorer_name}_bottom_10.json"
            ),
            "suspicious_json": export_results_json(
                run.suspicious_high, target_dir / f"{run.scorer_name}_suspicious.json"
            ),
        }

    def export_benchmark_artifacts(
        self,
        runs: list[BenchmarkRun],
        *,
        output_dir: str | Path,
    ) -> dict[str, Path]:
        target_dir = ensure_output_dir(output_dir)
        artifacts: dict[str, Path] = {}
        for run in runs:
            artifacts.update(
                {
                    f"{run.scorer_name}_{key}": value
                    for key, value in self.export_run_artifacts(run, target_dir).items()
                }
            )

        comparison_rows = self.build_comparison_rows(runs)
        comparison_path = target_dir / "approach_comparison.csv"
        if comparison_rows:
            import csv

            with comparison_path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=list(comparison_rows[0].keys()))
                writer.writeheader()
                writer.writerows(comparison_rows)
        else:
            comparison_path.write_text("", encoding="utf-8")
        artifacts["comparison_csv"] = comparison_path

        summary = self.build_markdown_summary(
            runs,
            jobs_count=sum(1 for _ in self.load_jobs()),
        )
        artifacts["summary_md"] = export_markdown(summary, target_dir / "benchmark_summary.md")
        return artifacts
