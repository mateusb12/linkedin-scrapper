from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from source.features.job_scoring.domain import JobPosting, ScoreExplanation, ScoreResult
from source.features.job_scoring.scorers.base import BaseJobScorer
from source.features.job_scoring.scorers.rules_scorer import RulesScorer
from source.features.job_scoring.utils.text_utils import (
    cosine_similarity,
    count_phrase_matches,
    extract_evidence_snippets,
    stable_hash_embedding,
)


@dataclass(slots=True)
class AnchorSet:
    positive: list[np.ndarray]
    negative: list[np.ndarray]


class EmbeddingsScorer(BaseJobScorer):
    scorer_name = "embeddings_scorer"

    def __init__(self, config=None) -> None:
        super().__init__(config=config)
        anchors = self.config.embedding_anchors
        self.rules_scorer = RulesScorer(config=self.config)
        self.anchor_sets = {
            "python_primary": AnchorSet(
                positive=[stable_hash_embedding(text) for text in anchors.python_primary_positive],
                negative=[stable_hash_embedding(text) for text in anchors.python_primary_negative],
            ),
            "databases": AnchorSet(
                positive=[stable_hash_embedding(text) for text in anchors.databases_positive],
                negative=[],
            ),
            "cloud_devops": AnchorSet(
                positive=[stable_hash_embedding(text) for text in anchors.cloud_devops_positive],
                negative=[],
            ),
            "benefits": AnchorSet(
                positive=[stable_hash_embedding(text) for text in anchors.benefits_positive],
                negative=[],
            ),
        }

    def _semantic_score(self, text: str, category: str, max_weight: float) -> tuple[float, dict]:
        vector = stable_hash_embedding(text)
        anchor_set = self.anchor_sets[category]
        positive = max(
            (cosine_similarity(vector, anchor) for anchor in anchor_set.positive),
            default=0.0,
        )
        negative = max(
            (cosine_similarity(vector, anchor) for anchor in anchor_set.negative),
            default=0.0,
        )
        blended = max(0.0, positive - (negative * 0.7))
        score = max_weight * blended
        return score, {
            "positive_similarity": round(positive, 3),
            "negative_similarity": round(negative, 3),
        }

    def score_job(self, job: JobPosting) -> ScoreResult:
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

        semantic_meta: dict[str, dict] = {}
        for category, max_weight in (
            ("python_primary", weights.python_primary),
            ("databases", weights.databases),
            ("cloud_devops", weights.cloud_devops),
            ("benefits", weights.benefits),
        ):
            score, meta = self._semantic_score(combined_text, category, max_weight)
            category_scores[category] = score
            semantic_meta[category] = meta

        rules_result = self.rules_scorer.score_job(job)
        for category in ("python_primary", "databases", "cloud_devops", "benefits"):
            category_scores[category] = (
                category_scores[category] * 0.6
                + rules_result.category_scores.get(category, 0.0) * 0.4
            )
        category_scores["penalties"] = (
            rules_result.category_scores.get("penalties", 0.0) * 0.75
        )

        profile = self.config.text_profile
        explanation.matched_keywords = {
            "python_primary": count_phrase_matches(
                combined_text,
                profile.python_terms + profile.strong_python_signals,
            )[:8],
            "databases": count_phrase_matches(combined_text, profile.database_terms)[:8],
            "cloud_devops": count_phrase_matches(
                combined_text, profile.cloud_devops_terms
            )[:8],
            "benefits": count_phrase_matches(combined_text, profile.benefit_terms)[:8],
            "penalties": count_phrase_matches(
                combined_text, profile.ai_secondary_terms + profile.non_target_terms
            )[:8],
        }
        explanation.bonus_reasons.append(
            "Score semântico local combinado com regras explícitas."
        )
        explanation.bonus_reasons.extend(rules_result.explanation.bonus_reasons[:3])
        explanation.penalty_reasons.extend(rules_result.explanation.penalty_reasons[:3])
        evidence_terms = (
            explanation.matched_keywords["python_primary"]
            + explanation.matched_keywords["databases"]
            + explanation.matched_keywords["cloud_devops"]
            + explanation.matched_keywords["benefits"]
        )
        explanation.evidence = extract_evidence_snippets(
            combined_text,
            evidence_terms[:10],
        )
        return self.build_result(
            job=job,
            category_scores=category_scores,
            explanation=explanation,
            metadata={
                "semantic_similarity": semantic_meta,
                "rules_total_score": round(rules_result.total_score, 2),
            },
        )

