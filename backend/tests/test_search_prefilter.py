from source.features.search_jobs.search_prefilter import JobSearchPrefilter, build_prefilter_audit


def test_prefilter_accepts_job_with_required_keyword_in_description():
    prefilter = JobSearchPrefilter(
        must_have_keywords=["python"],
        negative_keywords=["php"],
    )

    result = prefilter.evaluate({
        "title": "Backend Developer",
        "description_full": "Build APIs using Python, FastAPI, and PostgreSQL.",
    })

    assert result["accepted"] is True
    assert result["missing_must_have_keywords"] == []
    assert result["matched_negative_keywords"] == []


def test_prefilter_rejects_missing_required_keyword():
    prefilter = JobSearchPrefilter(must_have_keywords=["python"])

    result = prefilter.evaluate({
        "title": "Senior Full-Stack Engineer (React.js / Node.js)",
        "description_full": "Build product features with React and Node.js.",
    })

    assert result["accepted"] is False
    assert result["missing_must_have_keywords"] == ["python"]
    assert "missing_must_have" in result["reason_codes"]


def test_prefilter_rejects_negative_keyword_with_diacritic_normalization():
    prefilter = JobSearchPrefilter(
        must_have_keywords=["python"],
        negative_keywords=["estagio"],
    )

    result = prefilter.evaluate({
        "title": "Python Developer",
        "description_full": "Vaga de estágio para desenvolvimento Python.",
    })

    assert result["accepted"] is False
    assert result["matched_negative_keywords"] == ["estagio"]
    assert "negative_keyword" in result["reason_codes"]


def test_prefilter_audit_includes_all_rejected_jobs():
    prefilter = JobSearchPrefilter(must_have_keywords=["python"])
    rejected = []

    for index in range(12):
        rejected.append({
            "job_id": str(index),
            "title": f"React job {index}",
            "company_name": "Example",
            "prefilter_evaluation": {
                "accepted": False,
                "reasons": ["Missing: python"],
                "reason_codes": ["missing_must_have"],
                "missing_must_have_keywords": ["python"],
                "matched_negative_keywords": [],
            },
        })

    audit = build_prefilter_audit(
        total=12,
        accepted=[],
        rejected=rejected,
        prefilter=prefilter,
    )

    assert len(audit["sample_rejected"]) == 10
    assert len(audit["rejected_jobs"]) == 12
    assert audit["rejected_jobs"][11]["job_id"] == "11"
