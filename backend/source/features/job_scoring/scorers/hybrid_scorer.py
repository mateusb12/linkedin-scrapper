from __future__ import annotations

from dataclasses import dataclass

from source.features.job_scoring.domain import (
    JobPosting,
    ScoreBreakdown,
    ScoreBreakdownItem,
    ScoreExplanation,
    ScoreResult,
)
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
    "ai_training_or_evaluation_python",
    "platform_or_internal_systems_python",
}


@dataclass(slots=True)
class ArchetypeAssessment:
    archetype: str
    backend_core: float
    frontend_core: float
    data_platform_core: float
    ai_core: float
    ai_evaluation_core: float
    platform_core: float
    engineering_ownership: float
    contractor_style: float
    adjacent_frontend: float
    adjacent_data: float
    adjacent_ai: float
    structural_penalty: float
    structural_breakdown: list[ScoreBreakdownItem]
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
        score_breakdown = ScoreBreakdown()
        category_scores = {
            "python_primary": 0.0,
            "databases": 0.0,
            "cloud_devops": 0.0,
            "benefits": 0.0,
            "penalties": 0.0,
        }
        category_caps = {
            "python_primary": weights.python_primary,
            "databases": weights.databases,
            "cloud_devops": weights.cloud_devops,
            "benefits": weights.benefits,
            "penalties": weights.penalties,
        }

        def apply_delta(
            *,
            category: str,
            requested_delta: float,
            label: str,
            source: str,
            reason: str | None = None,
        ) -> float:
            if requested_delta == 0:
                return 0.0
            current = category_scores[category]
            cap = category_caps[category]
            next_value = max(0.0, min(cap, current + requested_delta))
            actual_delta = next_value - current
            if abs(actual_delta) < 1e-9:
                return 0.0

            category_scores[category] = next_value
            item = ScoreBreakdownItem(
                label=label,
                points=(-actual_delta if category == "penalties" else actual_delta),
                source=source,
            )
            if item.points > 0:
                score_breakdown.positive.append(item)
                if reason:
                    explanation.bonus_reasons.append(reason)
            else:
                score_breakdown.negative.append(item)
                if reason:
                    explanation.penalty_reasons.append(reason)
            return actual_delta

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
            apply_delta(
                category="python_primary",
                requested_delta=14.0,
                label="Python core match",
                source=f"Python terms matched: {', '.join(exact_python[:4])}.",
            )
        if fuzzy_python >= 0.6:
            apply_delta(
                category="python_primary",
                requested_delta=10.0 * fuzzy_python,
                label="Python/backend phrase match",
                source=f"Fuzzy overlap {fuzzy_python:.2f} with '{fuzzy_python_phrase}'.",
                reason=f"Expressão próxima de backend Python: {fuzzy_python_phrase}.",
            )
        if "python" in title_text:
            apply_delta(
                category="python_primary",
                requested_delta=8.0,
                label="Python title signal",
                source="Title contains 'Python'.",
            )
        if count_phrase_matches(job.title, profile.pure_backend_terms):
            apply_delta(
                category="python_primary",
                requested_delta=14.0,
                label="Backend title signal",
                source=f"Title matched backend terms: {', '.join(count_phrase_matches(job.title, profile.pure_backend_terms)[:3])}.",
                reason="Título aponta backend Python como centro da função.",
            )
        elif count_phrase_matches(job.title, profile.backend_title_terms):
            apply_delta(
                category="python_primary",
                requested_delta=8.0,
                label="Backend title signal",
                source=f"Title matched backend terms: {', '.join(count_phrase_matches(job.title, profile.backend_title_terms)[:3])}.",
            )

        if assessment.archetype == "backend_python_pure":
            apply_delta(
                category="python_primary",
                requested_delta=12.0,
                label="Backend ownership boost",
                source=(
                    "Structural assessment favored backend Python pure "
                    f"(backend_core={assessment.backend_core:.2f})."
                ),
                reason="Heurística estrutural indica backend Python puro.",
            )
        elif (
            assessment.archetype == "ai_or_llm_python"
            and self._has_strong_ai_backend_ownership(
                backend_core=assessment.backend_core,
                engineering_ownership=assessment.engineering_ownership,
            )
        ):
            apply_delta(
                category="python_primary",
                requested_delta=8.0,
                label="LLM backend ownership boost",
                source=(
                    f"LLM archetype kept strong backend ownership "
                    f"(backend_core={assessment.backend_core:.2f}, "
                    f"ownership={assessment.engineering_ownership:.2f})."
                ),
                reason="Contexto de LLM aparece sobre uma função ainda ancorada em ownership backend.",
            )
        elif assessment.archetype == "backend_python_with_minor_cross_functional_signals":
            apply_delta(
                category="python_primary",
                requested_delta=8.0,
                label="Backend core preserved",
                source=(
                    "Structural assessment kept backend dominant despite side signals "
                    f"(backend_core={assessment.backend_core:.2f})."
                ),
                reason="Núcleo backend Python preservado apesar de sinais laterais.",
            )
        elif assessment.archetype == "generic_python":
            apply_delta(
                category="python_primary",
                requested_delta=-6.0,
                label="Generic Python dilution",
                source="Archetype resolved to generic_python instead of backend-focused.",
                reason="Python aparece sem backend claramente dominante.",
            )
            apply_delta(
                category="penalties",
                requested_delta=4.0,
                label="Generic Python penalty",
                source="Generic Python archetype adds a structural mismatch penalty.",
                reason="Python aparece sem backend claramente dominante.",
            )
        else:
            apply_delta(
                category="python_primary",
                requested_delta=-12.0,
                label="Non-backend role penalty",
                source=f"Archetype '{assessment.archetype}' displaced backend Python as the main role.",
                reason="A função principal parece diferente de backend Python puro.",
            )

        if tokens_near_each_other(
            combined_text,
            profile.python_terms,
            profile.backend_context_terms,
            window=8,
        ):
            apply_delta(
                category="python_primary",
                requested_delta=10.0,
                label="Python/backend proximity",
                source="Python appears near backend/API/service terms.",
            )
        if tokens_near_each_other(
            combined_text,
            profile.python_terms,
            ("flask", "fastapi", "django", "pytest"),
            window=10,
        ):
            framework_hits = count_phrase_matches(
                combined_text,
                ("flask", "fastapi", "django", "pytest"),
            )
            apply_delta(
                category="python_primary",
                requested_delta=8.0,
                label="Framework/test stack boost",
                source=f"Python appears near stack terms: {', '.join(framework_hits[:4])}.",
                reason="Python aparece junto de framework/testes do stack desejado.",
            )

        if exact_db:
            apply_delta(
                category="databases",
                requested_delta=min(12.0, 2.0 * len(exact_db)),
                label="Database stack boost",
                source=f"Database terms matched: {', '.join(exact_db[:5])}.",
            )
        if fuzzy_db >= 0.5:
            apply_delta(
                category="databases",
                requested_delta=5.0 * fuzzy_db,
                label="Database/performance signal",
                source=f"Fuzzy overlap {fuzzy_db:.2f} with '{fuzzy_db_phrase}'.",
                reason=f"Texto sugere foco em banco/performance: {fuzzy_db_phrase}.",
            )

        if exact_devops:
            apply_delta(
                category="cloud_devops",
                requested_delta=min(10.0, 1.6 * len(exact_devops)),
                label="Cloud/DevOps stack boost",
                source=f"Cloud/DevOps terms matched: {', '.join(exact_devops[:5])}.",
            )
        if fuzzy_devops >= 0.5:
            apply_delta(
                category="cloud_devops",
                requested_delta=4.0 * fuzzy_devops,
                label="Cloud/DevOps context signal",
                source=f"Fuzzy overlap {fuzzy_devops:.2f} with '{fuzzy_devops_phrase}'.",
                reason=f"Texto sugere contexto cloud/devops: {fuzzy_devops_phrase}.",
            )

        benefit_matches = count_phrase_matches(combined_text, profile.benefit_terms)
        if benefit_matches:
            apply_delta(
                category="benefits",
                requested_delta=min(4.0, 1.2 * len(benefit_matches)),
                label="Relevant benefits boost",
                source=f"Benefit terms matched: {', '.join(benefit_matches[:4])}.",
            )

        ai_matches = count_phrase_matches(combined_text, profile.ai_secondary_terms)
        mixed_stack_matches = count_phrase_matches(combined_text, profile.mixed_stack_terms)
        platform_matches = count_phrase_matches(combined_text, profile.platform_terms)
        non_target_matches = count_phrase_matches(combined_text, profile.non_target_terms)

        if assessment.structural_breakdown:
            for item in assessment.structural_breakdown:
                apply_delta(
                    category="penalties",
                    requested_delta=-item.points,
                    label=item.label,
                    source=item.source,
                )
            for reason in assessment.reasons:
                if reason not in explanation.penalty_reasons:
                    explanation.penalty_reasons.append(reason)

        if "python" not in normalized_text:
            apply_delta(
                category="penalties",
                requested_delta=weights.penalties,
                label="Missing Python penalty",
                source="No direct 'Python' term was found in the job text.",
                reason="Sem menção direta a Python.",
            )

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
        explanation.bonus_reasons = list(dict.fromkeys(explanation.bonus_reasons))
        explanation.penalty_reasons = list(dict.fromkeys(explanation.penalty_reasons))

        score_breakdown.category_totals = {
            key: round(value, 2)
            for key, value in category_scores.items()
        }
        score_breakdown.final_score = max(
            0.0,
            min(
                100.0,
                sum(score for key, score in category_scores.items() if key != "penalties")
                - category_scores.get("penalties", 0.0),
            ),
        )

        return self.build_result(
            job=job,
            category_scores=category_scores,
            explanation=explanation,
            score_breakdown=score_breakdown,
            metadata={
                "archetype": assessment.archetype,
                "archetype_signals": {
                    "backend_core": round(assessment.backend_core, 2),
                    "frontend_core": round(assessment.frontend_core, 2),
                    "data_platform_core": round(assessment.data_platform_core, 2),
                    "ai_core": round(assessment.ai_core, 2),
                    "ai_evaluation_core": round(assessment.ai_evaluation_core, 2),
                    "platform_core": round(assessment.platform_core, 2),
                    "engineering_ownership": round(assessment.engineering_ownership, 2),
                    "contractor_style": round(assessment.contractor_style, 2),
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

        ai_evaluation_core = self._weighted_match_score(
            normalized_parts,
            profile.ai_evaluation_terms,
        )
        ai_evaluation_core += 2.4 * self._contextual_clause_hits(
            clauses,
            primary_terms=profile.ai_evaluation_terms,
            secondary_terms=(
                profile.ai_evaluation_support_terms + profile.contractor_style_terms
            ),
            adjacent_terms=profile.adjacent_context_terms,
        )

        contractor_style = self._weighted_match_score(
            normalized_parts,
            profile.contractor_style_terms,
        )

        engineering_ownership = self._weighted_match_score(
            normalized_parts,
            profile.engineering_ownership_terms,
        )
        engineering_ownership += 2.0 * self._contextual_clause_hits(
            clauses,
            primary_terms=profile.engineering_ownership_terms,
            secondary_terms=(
                profile.backend_context_terms
                + profile.responsibility_verbs
                + ("production", "services", "systems", "architecture")
            ),
            adjacent_terms=profile.adjacent_context_terms,
        )

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
        if count_phrase_matches(title_text, profile.ai_evaluation_terms):
            ai_evaluation_core += 9.0
        if count_phrase_matches(title_text, profile.platform_terms):
            platform_core += 7.0

        strong_ai_backend_ownership = self._has_strong_ai_backend_ownership(
            backend_core=backend_core,
            engineering_ownership=engineering_ownership,
        )
        backend_dominance = backend_core - max(
            frontend_core,
            data_platform_core,
            ai_core,
            ai_evaluation_core,
            platform_core,
        )
        reasons: list[str] = []
        structural_penalty = 0.0
        structural_breakdown: list[ScoreBreakdownItem] = []

        if (
            backend_core >= 15.0
            and backend_dominance >= 4.0
            and ai_evaluation_core < max(10.0, backend_core * 0.45)
        ):
            archetype = "backend_python_pure"
        elif (
            ai_evaluation_core + (0.35 * contractor_style)
            >= max(12.0, backend_core * 0.68)
            and engineering_ownership
            <= max(10.0, ai_evaluation_core * 0.78)
        ):
            archetype = "ai_training_or_evaluation_python"
            structural_penalty = min(
                20.0,
                max(
                    9.0,
                    8.0
                    + (ai_evaluation_core * 0.42)
                    + min(4.0, contractor_style * 0.25)
                    - min(4.0, engineering_ownership * 0.2),
                ),
            )
            contractor_penalty = min(4.0, contractor_style * 0.25)
            ownership_relief = min(4.0, engineering_ownership * 0.2)
            base_penalty = max(0.0, structural_penalty - contractor_penalty + ownership_relief)
            structural_breakdown.append(
                ScoreBreakdownItem(
                    label="AI evaluation labor penalty",
                    points=-base_penalty,
                    source=(
                        "AI evaluation signals dominated the archetype "
                        f"(ai_evaluation_core={ai_evaluation_core:.2f})."
                    ),
                )
            )
            if contractor_penalty > 0:
                structural_breakdown.append(
                    ScoreBreakdownItem(
                        label="Contractor/task-based penalty",
                        points=-contractor_penalty,
                        source=(
                            "Contractor-style language reinforced the mismatch "
                            f"(contractor_style={contractor_style:.2f})."
                        ),
                    )
                )
            if ownership_relief > 0:
                structural_breakdown.append(
                    ScoreBreakdownItem(
                        label="Backend ownership relief",
                        points=ownership_relief,
                        source=(
                            "Engineering ownership softened the AI evaluation penalty "
                            f"(engineering_ownership={engineering_ownership:.2f})."
                        ),
                    )
                )
            reasons.append(
                "Responsabilidades centrais parecem avaliar/treinar respostas de IA, não construir sistemas backend."
            )
            if contractor_style >= 4.0:
                reasons.append(
                    "Linguagem de contractor/task-based reforça trabalho de avaliação, não ownership de produto."
                )
        elif frontend_core >= max(14.0, backend_core * 0.72):
            archetype = "fullstack_python"
            structural_penalty = min(18.0, 7.0 + (frontend_core * 0.45))
            frontend_penalty = max(0.0, structural_penalty - 7.0)
            structural_breakdown.append(
                ScoreBreakdownItem(
                    label="Fullstack/frontend penalty",
                    points=-7.0,
                    source="Fullstack/frontend archetype triggered a structural mismatch base penalty.",
                )
            )
            if frontend_penalty > 0:
                structural_breakdown.append(
                    ScoreBreakdownItem(
                        label="Frontend dominance penalty",
                        points=-frontend_penalty,
                        source=(
                            f"Frontend core remained high relative to backend "
                            f"(frontend_core={frontend_core:.2f}, backend_core={backend_core:.2f})."
                        ),
                    )
                )
            reasons.append("Sinais estruturais de fullstack/frontend dominam o escopo.")
        elif data_platform_core >= max(14.0, backend_core * 0.72):
            archetype = "data_platform_python"
            structural_penalty = min(17.0, 6.5 + (data_platform_core * 0.42))
            data_penalty = max(0.0, structural_penalty - 6.5)
            structural_breakdown.append(
                ScoreBreakdownItem(
                    label="Platform/data penalty",
                    points=-6.5,
                    source="Data/platform archetype triggered a structural mismatch base penalty.",
                )
            )
            if data_penalty > 0:
                structural_breakdown.append(
                    ScoreBreakdownItem(
                        label="Data/platform dominance penalty",
                        points=-data_penalty,
                        source=(
                            "Data/platform core remained high relative to backend "
                            f"(data_platform_core={data_platform_core:.2f}, backend_core={backend_core:.2f})."
                        ),
                    )
                )
            reasons.append("Sinais estruturais de data/platform dominam o escopo.")
        elif ai_core >= max(12.0, backend_core * 0.65):
            archetype = "ai_or_llm_python"
            if strong_ai_backend_ownership:
                structural_penalty = min(4.0, max(0.0, 1.5 + max(0.0, ai_core - backend_core) * 0.18))
                if structural_penalty > 0:
                    structural_breakdown.append(
                        ScoreBreakdownItem(
                            label="AI/LLM context penalty",
                            points=-structural_penalty,
                            source=(
                                "AI/LLM signals were present but backend ownership stayed strong "
                                f"(ai_core={ai_core:.2f}, backend_core={backend_core:.2f}, "
                                f"engineering_ownership={engineering_ownership:.2f})."
                            ),
                        )
                    )
                reasons.append("LLM aparece como domínio do produto, mas com ownership backend forte.")
            else:
                structural_penalty = min(15.0, 6.0 + (ai_core * 0.4))
                ai_penalty = max(0.0, structural_penalty - 6.0)
                structural_breakdown.append(
                    ScoreBreakdownItem(
                        label="AI/LLM mismatch penalty",
                        points=-6.0,
                        source="AI/LLM archetype triggered a structural mismatch base penalty.",
                    )
                )
                if ai_penalty > 0:
                    structural_breakdown.append(
                        ScoreBreakdownItem(
                            label="AI/LLM dominance penalty",
                            points=-ai_penalty,
                            source=(
                                f"AI core remained high relative to backend "
                                f"(ai_core={ai_core:.2f}, backend_core={backend_core:.2f})."
                            ),
                        )
                    )
                reasons.append("Sinais estruturais de IA/LLM parecem centrais na função.")
        elif platform_core >= max(10.0, backend_core * 0.7):
            archetype = "platform_or_internal_systems_python"
            structural_penalty = min(14.0, 5.5 + (platform_core * 0.45))
            platform_penalty = max(0.0, structural_penalty - 5.5)
            structural_breakdown.append(
                ScoreBreakdownItem(
                    label="Platform/internal systems penalty",
                    points=-5.5,
                    source="Platform/internal systems archetype triggered a structural mismatch base penalty.",
                )
            )
            if platform_penalty > 0:
                structural_breakdown.append(
                    ScoreBreakdownItem(
                        label="Internal platform dominance penalty",
                        points=-platform_penalty,
                        source=(
                            f"Platform core remained high relative to backend "
                            f"(platform_core={platform_core:.2f}, backend_core={backend_core:.2f})."
                        ),
                    )
                )
            reasons.append("Escopo parece mais plataforma/sistemas internos do que backend puro.")
        elif (
            backend_core >= 14.0
            and backend_dominance >= 0.0
            and ai_evaluation_core < max(10.0, backend_core * 0.55)
        ):
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
            ai_evaluation_core=ai_evaluation_core,
            platform_core=platform_core,
            engineering_ownership=engineering_ownership,
            contractor_style=contractor_style,
            adjacent_frontend=adjacent_frontend,
            adjacent_data=adjacent_data,
            adjacent_ai=adjacent_ai,
            structural_penalty=structural_penalty,
            structural_breakdown=structural_breakdown,
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

    @staticmethod
    def _has_strong_ai_backend_ownership(
        *,
        backend_core: float,
        engineering_ownership: float,
    ) -> bool:
        return engineering_ownership >= 10.0 and (
            backend_core >= 13.0
            or (backend_core + engineering_ownership) >= 23.0
        )

    def mark_suspicious(self, result: ScoreResult) -> ScoreResult:
        result = super().mark_suspicious(result)

        archetype = result.metadata.get("archetype")
        structural_penalty = float(result.metadata.get("structural_penalty", 0.0))
        archetype_signals = result.metadata.get("archetype_signals", {})
        backend_core = float(archetype_signals.get("backend_core", 0.0))
        frontend_core = float(archetype_signals.get("frontend_core", 0.0))
        data_core = float(archetype_signals.get("data_platform_core", 0.0))
        ai_evaluation_core = float(archetype_signals.get("ai_evaluation_core", 0.0))
        engineering_ownership = float(archetype_signals.get("engineering_ownership", 0.0))
        strong_ai_backend_ownership = (
            archetype == "ai_or_llm_python"
            and self._has_strong_ai_backend_ownership(
                backend_core=backend_core,
                engineering_ownership=engineering_ownership,
            )
        )

        if archetype in HIGH_MISMATCH_ARCHETYPES and not strong_ai_backend_ownership:
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
        if archetype == "ai_training_or_evaluation_python":
            result.suspicious = True
            result.suspicious_reasons.append(
                "vaga usa Python mais para avaliação/treino de IA do que para engenharia backend"
            )
        if ai_evaluation_core >= 12.0 and engineering_ownership < 10.0:
            result.suspicious = True
            result.suspicious_reasons.append(
                "sinais fortes de AI evaluation labor com pouco ownership de engenharia"
            )
        if result.suspicious_reasons:
            result.suspicious_reasons = list(dict.fromkeys(result.suspicious_reasons))
        return result
