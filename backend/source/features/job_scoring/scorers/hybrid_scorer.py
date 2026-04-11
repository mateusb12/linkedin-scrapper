from __future__ import annotations

from dataclasses import dataclass

from source.features.job_scoring.domain import JobPosting, ScoreExplanation, ScoreResult
from source.features.job_scoring.scorers.base import BaseJobScorer
from source.features.job_scoring.utils.text_utils import (
    best_fuzzy_overlap,
    count_phrase_matches,
    count_phrase_occurrences,
    extract_evidence_snippets,
    normalize_text,
    split_text_clauses,
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
        "backend engineer python",
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

PART_WEIGHTS: dict[str, float] = {
    "title": 4.5,
    "premium_title": 3.5,
    "description_snippet": 1.3,
    "qualifications": 1.35,
    "responsibilities": 1.6,
    "keywords": 1.1,
    "programming_languages": 0.8,
    "description_full": 1.0,
    "premium_description": 1.0,
}

HIGH_MISMATCH_ARCHETYPES = {
    "fullstack_python",
    "data_platform_python",
    "ai_or_llm_python",
    "platform_or_internal_systems_python",
}


@dataclass(slots=True)
class ArchetypeAssessment:
    archetype: str
    backend_core: float
    frontend_core: float
    data_platform_core: float
    ai_core: float
    platform_core: float
    adjacent_frontend: float
    adjacent_data: float
    adjacent_ai: float
    structural_penalty: float
    reasons: list[str]


class HybridScorer(BaseJobScorer):
    scorer_name = "hybrid_scorer"

    def score_job(self, job: JobPosting) -> ScoreResult:
        profile = self.config.text_profile
        weights = self.config.weights
        combined_text = job.combined_text()
        normalized_text = normalize_text(combined_text)
        normalized_parts = {
            name: normalize_text(value)
            for name, value in job.combined_text_parts().items()
        }
        title_text = normalized_parts["title"]
        clauses = split_text_clauses(combined_text)

        explanation = ScoreExplanation(matched_keywords={})
        category_scores = {
            "python_primary": 0.0,
            "databases": 0.0,
            "cloud_devops": 0.0,
            "benefits": 0.0,
            "penalties": 0.0,
        }

        exact_python = count_phrase_matches(
            combined_text,
            profile.python_terms + profile.strong_python_signals,
        )
        fuzzy_python, fuzzy_python_phrase = best_fuzzy_overlap(
            combined_text, CANONICAL_SYNONYMS["python_backend"]
        )
        exact_db = count_phrase_matches(combined_text, profile.database_terms)
        fuzzy_db, fuzzy_db_phrase = best_fuzzy_overlap(
            combined_text, CANONICAL_SYNONYMS["databases"]
        )
        exact_devops = count_phrase_matches(combined_text, profile.cloud_devops_terms)
        fuzzy_devops, fuzzy_devops_phrase = best_fuzzy_overlap(
            combined_text, CANONICAL_SYNONYMS["cloud_devops"]
        )

        assessment = self._assess_archetype(
            normalized_parts=normalized_parts,
            clauses=clauses,
        )

        if exact_python:
            category_scores["python_primary"] += 14.0
        if fuzzy_python >= 0.6:
            category_scores["python_primary"] += 10.0 * fuzzy_python
            explanation.bonus_reasons.append(
                f"Expressão próxima de backend Python: {fuzzy_python_phrase}."
            )
        if "python" in title_text:
            category_scores["python_primary"] += 8.0
        if count_phrase_matches(job.title, profile.pure_backend_terms):
            category_scores["python_primary"] += 14.0
            explanation.bonus_reasons.append(
                "Título aponta backend Python como centro da função."
            )
        elif count_phrase_matches(job.title, profile.backend_title_terms):
            category_scores["python_primary"] += 8.0
        if tokens_near_each_other(
            combined_text,
            profile.python_terms,
            profile.backend_context_terms,
            window=8,
        ):
            category_scores["python_primary"] += 10.0
        if tokens_near_each_other(
            combined_text,
            profile.python_terms,
            ("flask", "fastapi", "django", "pytest"),
            window=10,
        ):
            category_scores["python_primary"] += 8.0
            explanation.bonus_reasons.append(
                "Python aparece junto de framework/testes do stack desejado."
            )

        if assessment.archetype == "backend_python_pure":
            category_scores["python_primary"] += 12.0
            explanation.bonus_reasons.append(
                "Heurística estrutural indica backend Python puro."
            )
        elif assessment.archetype == "backend_python_with_minor_cross_functional_signals":
            category_scores["python_primary"] += 8.0
            explanation.bonus_reasons.append(
                "Núcleo backend Python preservado apesar de sinais laterais."
            )
        elif assessment.archetype == "generic_python":
            category_scores["python_primary"] -= 6.0
            category_scores["penalties"] += 4.0
            explanation.penalty_reasons.append(
                "Python aparece sem backend claramente dominante."
            )
        else:
            category_scores["python_primary"] -= 12.0
            explanation.penalty_reasons.append(
                "A função principal parece diferente de backend Python puro."
            )

        if exact_db:
            category_scores["databases"] += min(12.0, 2.0 * len(exact_db))
        if fuzzy_db >= 0.5:
            category_scores["databases"] += 5.0 * fuzzy_db
            explanation.bonus_reasons.append(
                f"Texto sugere foco em banco/performance: {fuzzy_db_phrase}."
            )

        if exact_devops:
            category_scores["cloud_devops"] += min(10.0, 1.6 * len(exact_devops))
        if fuzzy_devops >= 0.5:
            category_scores["cloud_devops"] += 4.0 * fuzzy_devops
            explanation.bonus_reasons.append(
                f"Texto sugere contexto cloud/devops: {fuzzy_devops_phrase}."
            )

        benefit_matches = count_phrase_matches(combined_text, profile.benefit_terms)
        if benefit_matches:
            category_scores["benefits"] += min(4.0, 1.2 * len(benefit_matches))

        ai_matches = count_phrase_matches(combined_text, profile.ai_secondary_terms)
        mixed_stack_matches = count_phrase_matches(combined_text, profile.mixed_stack_terms)
        platform_matches = count_phrase_matches(combined_text, profile.platform_terms)
        non_target_matches = count_phrase_matches(combined_text, profile.non_target_terms)

        if assessment.structural_penalty:
            category_scores["penalties"] += assessment.structural_penalty
            explanation.penalty_reasons.extend(assessment.reasons)

        if "python" not in normalized_text:
            category_scores["penalties"] += weights.penalties
            explanation.penalty_reasons.append("Sem menção direta a Python.")

        category_scores["python_primary"] = min(
            weights.python_primary, max(0.0, category_scores["python_primary"])
        )
        category_scores["databases"] = min(weights.databases, category_scores["databases"])
        category_scores["cloud_devops"] = min(
            weights.cloud_devops, category_scores["cloud_devops"]
        )
        category_scores["benefits"] = min(weights.benefits, category_scores["benefits"])
        category_scores["penalties"] = min(weights.penalties, category_scores["penalties"])

        evidence_terms = (
            exact_python
            + exact_db
            + exact_devops
            + benefit_matches
            + assessment.reasons
        )
        explanation.matched_keywords = {
            "python_primary": exact_python[:8] + ([fuzzy_python_phrase] if fuzzy_python_phrase else []),
            "databases": exact_db[:8] + ([fuzzy_db_phrase] if fuzzy_db_phrase else []),
            "cloud_devops": exact_devops[:8] + ([fuzzy_devops_phrase] if fuzzy_devops_phrase else []),
            "benefits": benefit_matches[:8],
            "penalties": (mixed_stack_matches + ai_matches + platform_matches + non_target_matches)[:10],
        }
        explanation.evidence = extract_evidence_snippets(combined_text, evidence_terms[:10])

        return self.build_result(
            job=job,
            category_scores=category_scores,
            explanation=explanation,
            metadata={
                "archetype": assessment.archetype,
                "archetype_signals": {
                    "backend_core": round(assessment.backend_core, 2),
                    "frontend_core": round(assessment.frontend_core, 2),
                    "data_platform_core": round(assessment.data_platform_core, 2),
                    "ai_core": round(assessment.ai_core, 2),
                    "platform_core": round(assessment.platform_core, 2),
                    "adjacent_frontend": round(assessment.adjacent_frontend, 2),
                    "adjacent_data": round(assessment.adjacent_data, 2),
                    "adjacent_ai": round(assessment.adjacent_ai, 2),
                },
                "structural_penalty": round(assessment.structural_penalty, 2),
                "fuzzy_python_overlap": round(fuzzy_python, 3),
                "fuzzy_db_overlap": round(fuzzy_db, 3),
                "fuzzy_devops_overlap": round(fuzzy_devops, 3),
            },
        )

    def _assess_archetype(
        self,
        *,
        normalized_parts: dict[str, str],
        clauses: list[str],
    ) -> ArchetypeAssessment:
        profile = self.config.text_profile
        title_text = normalized_parts.get("title", "")

        backend_core = self._weighted_match_score(
            normalized_parts,
            profile.strong_python_signals + profile.pure_backend_terms + profile.backend_title_terms,
        )
        backend_core += 1.8 * self._contextual_clause_hits(
            clauses,
            primary_terms=profile.python_terms,
            secondary_terms=profile.backend_context_terms + ("flask", "fastapi", "django", "pytest"),
            target_terms=profile.pure_backend_terms,
            adjacent_terms=profile.adjacent_context_terms,
        )

        frontend_core = self._weighted_match_score(
            normalized_parts,
            profile.mixed_stack_terms + profile.frontend_core_terms,
        )
        frontend_core += 2.4 * self._contextual_clause_hits(
            clauses,
            primary_terms=profile.frontend_core_terms,
            secondary_terms=profile.responsibility_verbs + ("frontend systems", "ui", "ux"),
            adjacent_terms=profile.adjacent_context_terms,
        )
        adjacent_frontend = self._adjacent_clause_hits(
            clauses,
            target_terms=profile.frontend_core_terms,
            adjacent_terms=profile.adjacent_context_terms,
        )
        frontend_core = max(0.0, frontend_core - (1.1 * adjacent_frontend))

        data_platform_core = self._weighted_match_score(
            normalized_parts,
            profile.data_platform_terms,
        )
        data_platform_core += 2.2 * self._contextual_clause_hits(
            clauses,
            primary_terms=profile.data_platform_terms,
            secondary_terms=profile.responsibility_verbs + ("scale", "reliability", "observability"),
            adjacent_terms=profile.adjacent_context_terms,
        )
        adjacent_data = self._adjacent_clause_hits(
            clauses,
            target_terms=profile.data_platform_terms,
            adjacent_terms=profile.adjacent_context_terms,
        )
        data_platform_core = max(0.0, data_platform_core - (0.8 * adjacent_data))

        ai_core = self._weighted_match_score(
            normalized_parts,
            profile.ai_core_terms,
        )
        ai_core += 2.0 * self._contextual_clause_hits(
            clauses,
            primary_terms=profile.ai_core_terms,
            secondary_terms=profile.responsibility_verbs + ("product", "workflows", "automation"),
            adjacent_terms=profile.adjacent_context_terms,
        )
        adjacent_ai = self._adjacent_clause_hits(
            clauses,
            target_terms=profile.ai_core_terms,
            adjacent_terms=profile.adjacent_context_terms,
        )
        ai_core = max(0.0, ai_core - (1.1 * adjacent_ai))

        platform_core = self._weighted_match_score(
            normalized_parts,
            profile.platform_terms,
        )

        if count_phrase_matches(title_text, ("fullstack", "full stack", "full-stack", "fusll stack")):
            frontend_core += 8.0
        if count_phrase_matches(title_text, profile.frontend_core_terms):
            frontend_core += 4.0
        if count_phrase_matches(title_text, profile.data_platform_terms):
            data_platform_core += 9.0
        if count_phrase_matches(title_text, profile.ai_core_terms):
            ai_core += 8.0
        if count_phrase_matches(title_text, profile.platform_terms):
            platform_core += 7.0

        backend_dominance = backend_core - max(frontend_core, data_platform_core, ai_core, platform_core)
        reasons: list[str] = []
        structural_penalty = 0.0

        if backend_core >= 15.0 and backend_dominance >= 4.0:
            archetype = "backend_python_pure"
        elif frontend_core >= max(14.0, backend_core * 0.72):
            archetype = "fullstack_python"
            structural_penalty = min(18.0, 7.0 + (frontend_core * 0.45))
            reasons.append("Sinais estruturais de fullstack/frontend dominam o escopo.")
        elif data_platform_core >= max(14.0, backend_core * 0.72):
            archetype = "data_platform_python"
            structural_penalty = min(17.0, 6.5 + (data_platform_core * 0.42))
            reasons.append("Sinais estruturais de data/platform dominam o escopo.")
        elif ai_core >= max(12.0, backend_core * 0.65):
            archetype = "ai_or_llm_python"
            structural_penalty = min(15.0, 6.0 + (ai_core * 0.4))
            reasons.append("Sinais estruturais de IA/LLM parecem centrais na função.")
        elif platform_core >= max(10.0, backend_core * 0.7):
            archetype = "platform_or_internal_systems_python"
            structural_penalty = min(14.0, 5.5 + (platform_core * 0.45))
            reasons.append("Escopo parece mais plataforma/sistemas internos do que backend puro.")
        elif backend_core >= 14.0 and backend_dominance >= 0.0:
            archetype = "backend_python_with_minor_cross_functional_signals"
        else:
            archetype = "generic_python"

        if archetype == "backend_python_with_minor_cross_functional_signals":
            reasons.append("Sinais desalinhados aparecem como contexto lateral, não como núcleo.")

        return ArchetypeAssessment(
            archetype=archetype,
            backend_core=backend_core,
            frontend_core=frontend_core,
            data_platform_core=data_platform_core,
            ai_core=ai_core,
            platform_core=platform_core,
            adjacent_frontend=adjacent_frontend,
            adjacent_data=adjacent_data,
            adjacent_ai=adjacent_ai,
            structural_penalty=structural_penalty,
            reasons=reasons,
        )

    def _weighted_match_score(
        self,
        normalized_parts: dict[str, str],
        phrases: tuple[str, ...],
    ) -> float:
        score = 0.0
        for part_name, text in normalized_parts.items():
            if not text:
                continue
            occurrences = count_phrase_occurrences(text, phrases)
            if not occurrences:
                continue
            score += PART_WEIGHTS.get(part_name, 1.0) * sum(
                min(count, 2) for count in occurrences.values()
            )
        return score

    def _contextual_clause_hits(
        self,
        clauses: list[str],
        *,
        primary_terms: tuple[str, ...],
        secondary_terms: tuple[str, ...],
        target_terms: tuple[str, ...] = (),
        adjacent_terms: tuple[str, ...],
    ) -> float:
        hits = 0.0
        for clause in clauses:
            primary = count_phrase_matches(clause, primary_terms)
            if not primary:
                continue
            clause_weight = 1.0
            if count_phrase_matches(clause, secondary_terms):
                clause_weight += 0.8
            if target_terms and count_phrase_matches(clause, target_terms):
                clause_weight += 0.6
            if count_phrase_matches(clause, adjacent_terms):
                clause_weight *= 0.25
            hits += clause_weight
        return hits

    def _adjacent_clause_hits(
        self,
        clauses: list[str],
        *,
        target_terms: tuple[str, ...],
        adjacent_terms: tuple[str, ...],
    ) -> float:
        hits = 0.0
        for clause in clauses:
            if not count_phrase_matches(clause, target_terms):
                continue
            if count_phrase_matches(clause, adjacent_terms):
                hits += 1.0
        return hits

    def mark_suspicious(self, result: ScoreResult) -> ScoreResult:
        result = super().mark_suspicious(result)
        if result.total_score < self.config.suspicious_score_threshold:
            return result

        archetype = result.metadata.get("archetype")
        structural_penalty = float(result.metadata.get("structural_penalty", 0.0))
        archetype_signals = result.metadata.get("archetype_signals", {})
        frontend_core = float(archetype_signals.get("frontend_core", 0.0))
        data_core = float(archetype_signals.get("data_platform_core", 0.0))

        if archetype in HIGH_MISMATCH_ARCHETYPES:
            result.suspicious = True
            result.suspicious_reasons.append(
                f"score alto para archetype {archetype}"
            )
        if structural_penalty >= 8.0 and "score alto apesar de penalidades relevantes" not in result.suspicious_reasons:
            result.suspicious = True
            result.suspicious_reasons.append(
                "score alto apesar de penalidades estruturais relevantes"
            )
        if frontend_core >= 14.0:
            result.suspicious = True
            result.suspicious_reasons.append(
                "score alto com sinais fortes de fullstack/frontend"
            )
        if data_core >= 14.0:
            result.suspicious = True
            result.suspicious_reasons.append(
                "score alto com sinais fortes de data/platform"
            )
        if result.suspicious_reasons:
            result.suspicious_reasons = list(dict.fromkeys(result.suspicious_reasons))
        return result
