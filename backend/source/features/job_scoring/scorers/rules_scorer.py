from __future__ import annotations

from source.features.job_scoring.domain import JobPosting, ScoreExplanation, ScoreResult
from source.features.job_scoring.scorers.base import BaseJobScorer
from source.features.job_scoring.utils.text_utils import (
    count_phrase_matches,
    extract_evidence_snippets,
    normalize_text,
    tokens_near_each_other,
)


class RulesScorer(BaseJobScorer):
    scorer_name = "rules_scorer"

    def score_job(self, job: JobPosting) -> ScoreResult:
        profile = self.config.text_profile
        weights = self.config.weights
        parts = job.combined_text_parts()
        combined_text = job.combined_text()
        normalized_title = normalize_text(job.title)
        normalized_text = normalize_text(combined_text)

        explanation = ScoreExplanation(matched_keywords={})
        category_scores = {
            "python_primary": 0.0,
            "databases": 0.0,
            "cloud_devops": 0.0,
            "benefits": 0.0,
            "penalties": 0.0,
        }

        python_matches = count_phrase_matches(
            combined_text,
            profile.python_terms + profile.strong_python_signals,
        )
        backend_matches = count_phrase_matches(combined_text, profile.backend_context_terms)
        strong_python_matches = count_phrase_matches(
            combined_text,
            profile.strong_python_signals,
        )

        if "python" in normalized_title:
            category_scores["python_primary"] += 18.0
            explanation.bonus_reasons.append("Título explicita Python.")
        if "backend" in normalized_title:
            category_scores["python_primary"] += 12.0
            explanation.bonus_reasons.append("Título explicita backend.")
        pure_backend_matches = count_phrase_matches(combined_text, profile.pure_backend_terms)
        if pure_backend_matches:
            category_scores["python_primary"] += min(10.0, 4.0 * len(pure_backend_matches))
            explanation.bonus_reasons.append("Há indícios de backend mais puro.")
        if strong_python_matches:
            category_scores["python_primary"] += min(20.0, 6.0 * len(strong_python_matches))
            explanation.bonus_reasons.append(
                "Stack Python/backend explícita no texto."
            )
        if python_matches:
            category_scores["python_primary"] += min(12.0, 3.0 * len(python_matches))
        if tokens_near_each_other(
            combined_text,
            profile.python_terms,
            profile.backend_context_terms,
            window=6,
        ):
            category_scores["python_primary"] += 12.0
            explanation.bonus_reasons.append(
                "Python aparece próximo de contexto backend/API."
            )
        if "python" in normalized_text and not backend_matches and not pure_backend_matches:
            category_scores["penalties"] += 6.0
            explanation.penalty_reasons.append(
                "A vaga não deixa backend Python claramente explícito."
            )
        if "python" in normalized_text and not backend_matches:
            category_scores["penalties"] += 5.0
            explanation.penalty_reasons.append(
                "Python aparece sem contexto backend claro."
            )

        db_matches = count_phrase_matches(combined_text, profile.database_terms)
        if db_matches:
            category_scores["databases"] += min(18.0, 2.5 * len(db_matches))
            explanation.bonus_reasons.append("Há sinais relevantes de banco de dados.")

        devops_matches = count_phrase_matches(combined_text, profile.cloud_devops_terms)
        if devops_matches:
            category_scores["cloud_devops"] += min(16.0, 2.3 * len(devops_matches))
            explanation.bonus_reasons.append("Há sinais de Docker/cloud/CI-CD.")

        benefit_matches = count_phrase_matches(combined_text, profile.benefit_terms)
        if benefit_matches:
            category_scores["benefits"] += min(6.0, 2.0 * len(benefit_matches))
            explanation.bonus_reasons.append(
                "Benefícios de alimentação aparecem na vaga."
            )

        generic_benefits = count_phrase_matches(combined_text, profile.generic_benefit_terms)
        if generic_benefits and not benefit_matches:
            explanation.penalty_reasons.append(
                "Benefícios citados são genéricos e pouco relevantes."
            )

        ai_matches = count_phrase_matches(combined_text, profile.ai_secondary_terms)
        ai_evaluation_matches = count_phrase_matches(
            combined_text, profile.ai_evaluation_terms
        )
        contractor_style_matches = count_phrase_matches(
            combined_text, profile.contractor_style_terms
        )
        engineering_ownership_matches = count_phrase_matches(
            combined_text, profile.engineering_ownership_terms
        )
        non_target_matches = count_phrase_matches(combined_text, profile.non_target_terms)
        mixed_stack_matches = count_phrase_matches(combined_text, profile.mixed_stack_terms)
        platform_matches = count_phrase_matches(combined_text, profile.platform_terms)

        if ai_matches and "python" in normalized_text and not backend_matches:
            category_scores["penalties"] += min(10.0, 2.5 * len(ai_matches))
            explanation.penalty_reasons.append(
                "Python parece secundário para IA/data/automação."
            )
        if ai_evaluation_matches:
            ai_eval_penalty = min(14.0, 3.0 * len(ai_evaluation_matches))
            if contractor_style_matches:
                ai_eval_penalty += min(4.0, 1.5 * len(contractor_style_matches))
            if engineering_ownership_matches:
                ai_eval_penalty -= min(5.0, 1.0 * len(engineering_ownership_matches))
            if ai_eval_penalty > 0:
                category_scores["penalties"] += min(16.0, ai_eval_penalty)
                explanation.penalty_reasons.append(
                    "Python aparece em trabalho de avaliação/treino de IA, não em ownership de software."
                )

        if mixed_stack_matches:
            category_scores["penalties"] += min(9.0, 2.5 * len(mixed_stack_matches))
            explanation.penalty_reasons.append(
                "A vaga parece misturar backend com frontend/fullstack."
            )

        if non_target_matches and "python" not in normalized_title:
            category_scores["penalties"] += min(10.0, 1.8 * len(non_target_matches))
            explanation.penalty_reasons.append(
                "A vaga indica stack principal fora do alvo."
            )
        if platform_matches:
            category_scores["penalties"] += min(6.0, 2.0 * len(platform_matches))
            explanation.penalty_reasons.append(
                "A vaga parece mais ligada a plataforma/ERP do que backend puro."
            )

        if "python" not in normalized_text:
            category_scores["penalties"] += weights.penalties
            explanation.penalty_reasons.append("Não há evidência real de Python.")

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
            "python_primary": strong_python_matches or python_matches[:8],
            "databases": db_matches[:8],
            "cloud_devops": devops_matches[:8],
            "benefits": benefit_matches[:8],
            "penalties": (
                ai_matches
                + ai_evaluation_matches
                + contractor_style_matches
                + non_target_matches
                + mixed_stack_matches
                + platform_matches
            )[:10],
        }
        evidence_terms = python_matches + db_matches + devops_matches + benefit_matches
        explanation.evidence = extract_evidence_snippets(
            " ".join(parts.values()),
            evidence_terms[:10],
        )
        return self.build_result(
            job=job,
            category_scores=category_scores,
            explanation=explanation,
            metadata={"normalized_title": normalized_title},
        )
