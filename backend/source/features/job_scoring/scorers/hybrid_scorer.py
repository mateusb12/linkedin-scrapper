from __future__ import annotations

from source.features.job_scoring.domain import JobPosting, ScoreExplanation, ScoreResult
from source.features.job_scoring.scorers.base import BaseJobScorer
from source.features.job_scoring.utils.text_utils import (
    best_fuzzy_overlap,
    count_phrase_matches,
    extract_evidence_snippets,
    normalize_text,
    tokens_near_each_other,
)

CANONICAL_SYNONYMS: dict[str, tuple[str, ...]] = {
    "python_backend": (
        "python backend",
        "backend com python",
        "backend in python",
        "api python",
        "python services",
        "python microservices",
    ),
    "databases": (
        "sql performance",
        "query tuning",
        "database modeling",
        "modelagem de dados",
        "query optimization",
        "postgresql performance",
    ),
    "cloud_devops": (
        "docker containers",
        "cloud infrastructure",
        "continuous integration",
        "continuous delivery",
        "aws deployment",
        "azure pipelines",
    ),
}


class HybridScorer(BaseJobScorer):
    scorer_name = "hybrid_scorer"

    def score_job(self, job: JobPosting) -> ScoreResult:
        profile = self.config.text_profile
        weights = self.config.weights
        combined_text = job.combined_text()
        explanation = ScoreExplanation(matched_keywords={})
        category_scores = {
            "python_primary": 0.0,
            "databases": 0.0,
            "cloud_devops": 0.0,
            "benefits": 0.0,
            "penalties": 0.0,
        }

        normalized_text = normalize_text(combined_text)
        title_text = normalize_text(job.title)

        exact_python = count_phrase_matches(
            combined_text,
            profile.python_terms + profile.strong_python_signals,
        )
        fuzzy_python, fuzzy_python_phrase = best_fuzzy_overlap(
            combined_text, CANONICAL_SYNONYMS["python_backend"]
        )
        if exact_python:
            category_scores["python_primary"] += 18.0
        if fuzzy_python >= 0.6:
            category_scores["python_primary"] += 15.0 * fuzzy_python
            explanation.bonus_reasons.append(
                f"Expressão próxima de backend Python: {fuzzy_python_phrase}."
            )
        if "python" in title_text and any(
            term in title_text
            for term in ("backend", "engineer", "engenheiro", "developer", "desenvolvedor")
        ):
            category_scores["python_primary"] += 18.0
            explanation.bonus_reasons.append(
                "Título sugere Python como parte central da função."
            )
        pure_backend_matches = count_phrase_matches(combined_text, profile.pure_backend_terms)
        if pure_backend_matches:
            category_scores["python_primary"] += min(8.0, 3.0 * len(pure_backend_matches))
        if tokens_near_each_other(
            combined_text,
            profile.python_terms,
            profile.backend_context_terms,
            window=8,
        ):
            category_scores["python_primary"] += 12.0
        if tokens_near_each_other(
            combined_text,
            profile.python_terms,
            ("flask", "fastapi", "django", "pytest"),
            window=10,
        ):
            category_scores["python_primary"] += 10.0
            explanation.bonus_reasons.append(
                "Python aparece junto de framework/testes do stack desejado."
            )
        if "python" in normalized_text and not pure_backend_matches and not tokens_near_each_other(
            combined_text,
            profile.python_terms,
            profile.backend_context_terms,
            window=8,
        ):
            category_scores["penalties"] += 6.0
            explanation.penalty_reasons.append(
                "Backend Python não aparece de forma nítida."
            )

        exact_db = count_phrase_matches(combined_text, profile.database_terms)
        fuzzy_db, fuzzy_db_phrase = best_fuzzy_overlap(
            combined_text, CANONICAL_SYNONYMS["databases"]
        )
        if exact_db:
            category_scores["databases"] += min(12.0, 2.0 * len(exact_db))
        if fuzzy_db >= 0.5:
            category_scores["databases"] += 6.0 * fuzzy_db
            explanation.bonus_reasons.append(
                f"Texto sugere foco em banco/performance: {fuzzy_db_phrase}."
            )

        exact_devops = count_phrase_matches(combined_text, profile.cloud_devops_terms)
        fuzzy_devops, fuzzy_devops_phrase = best_fuzzy_overlap(
            combined_text, CANONICAL_SYNONYMS["cloud_devops"]
        )
        if exact_devops:
            category_scores["cloud_devops"] += min(11.0, 1.8 * len(exact_devops))
        if fuzzy_devops >= 0.5:
            category_scores["cloud_devops"] += 5.0 * fuzzy_devops
            explanation.bonus_reasons.append(
                f"Texto sugere contexto cloud/devops: {fuzzy_devops_phrase}."
            )

        benefit_matches = count_phrase_matches(combined_text, profile.benefit_terms)
        if benefit_matches:
            category_scores["benefits"] += min(6.0, 1.75 * len(benefit_matches))

        ai_matches = count_phrase_matches(combined_text, profile.ai_secondary_terms)
        non_target_matches = count_phrase_matches(combined_text, profile.non_target_terms)
        mixed_stack_matches = count_phrase_matches(combined_text, profile.mixed_stack_terms)
        platform_matches = count_phrase_matches(combined_text, profile.platform_terms)
        has_python_backend_context = tokens_near_each_other(
            combined_text,
            profile.python_terms,
            profile.backend_context_terms,
            window=8,
        )
        if ai_matches and not has_python_backend_context:
            category_scores["penalties"] += min(10.0, 2.2 * len(ai_matches))
            explanation.penalty_reasons.append(
                "Contexto aponta Python mais próximo de IA/data do que backend."
            )
        if mixed_stack_matches:
            category_scores["penalties"] += min(9.0, 2.2 * len(mixed_stack_matches))
            explanation.penalty_reasons.append(
                "Há sinais de fullstack/frontend no escopo da vaga."
            )
        if non_target_matches and "python" not in title_text:
            category_scores["penalties"] += min(10.0, 1.5 * len(non_target_matches))
        if platform_matches:
            category_scores["penalties"] += min(6.0, 1.8 * len(platform_matches))
        if "python" not in normalized_text:
            category_scores["penalties"] += weights.penalties
            explanation.penalty_reasons.append("Sem menção direta a Python.")

        category_scores["python_primary"] = min(
            weights.python_primary, category_scores["python_primary"]
        )
        category_scores["databases"] = min(
            weights.databases, category_scores["databases"]
        )
        category_scores["cloud_devops"] = min(
            weights.cloud_devops, category_scores["cloud_devops"]
        )
        category_scores["benefits"] = min(
            weights.benefits, category_scores["benefits"]
        )
        category_scores["penalties"] = min(
            weights.penalties, category_scores["penalties"]
        )

        explanation.matched_keywords = {
            "python_primary": exact_python[:8] + ([fuzzy_python_phrase] if fuzzy_python_phrase else []),
            "databases": exact_db[:8] + ([fuzzy_db_phrase] if fuzzy_db_phrase else []),
            "cloud_devops": exact_devops[:8] + ([fuzzy_devops_phrase] if fuzzy_devops_phrase else []),
            "benefits": benefit_matches[:8],
            "penalties": (ai_matches + non_target_matches + mixed_stack_matches + platform_matches)[:8],
        }
        evidence_terms = exact_python + exact_db + exact_devops + benefit_matches
        explanation.evidence = extract_evidence_snippets(
            combined_text,
            evidence_terms[:10],
        )
        return self.build_result(
            job=job,
            category_scores=category_scores,
            explanation=explanation,
            metadata={
                "fuzzy_python_overlap": round(fuzzy_python, 3),
                "fuzzy_db_overlap": round(fuzzy_db, 3),
                "fuzzy_devops_overlap": round(fuzzy_devops, 3),
            },
        )
