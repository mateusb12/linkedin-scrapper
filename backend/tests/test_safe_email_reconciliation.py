from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models import Base, Company, Email, Job
from source.features.get_applied_jobs import services_controller
from source.features.gmail_service.safe_reconciliation import (
    BLOCK,
    LINK,
    REVIEW,
    ALREADY_LINKED,
    EMAIL_BEFORE_APPLICATION,
    EMAIL_ALREADY_LINKED,
    TERMINAL_STATUS,
    TITLE_MISMATCH,
    WEAK_COMPANY_ONLY_MATCH,
    reconcile_email_to_job,
)
from source.features.job_population import population_service
from source.features.job_population.population_service import PopulationService


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


def add_job(session, urn, title, company_name, applied_on, status="Waiting"):
    company = Company(urn=f"company:{urn}", name=company_name)
    job = Job(
        urn=urn,
        title=title,
        company=company,
        has_applied=True,
        applied_on=applied_on,
        application_status=status,
    )
    session.add(job)
    session.flush()
    return job


def add_email(session, subject, received_at, body_text="", folder="Job fails"):
    email = Email(
        profile_id=None,
        message_id=f"message:{subject}:{received_at}",
        folder=folder,
        category="Rejection",
        subject=subject,
        sender="LinkedIn <jobs-noreply@linkedin.com>",
        sender_email="jobs-noreply@linkedin.com",
        body_text=body_text,
        snippet=body_text[:120],
        received_at=received_at,
    )
    session.add(email)
    session.flush()
    return email


def test_pasquali_false_positive_is_blocked(db_session):
    job = add_job(
        db_session,
        "4407447331",
        "Desenvolvedor Python",
        "Pasquali Solution",
        datetime(2026, 4, 27),
    )
    email = add_email(
        db_session,
        "Your application to Desenvolvedor Fullstack at Pasquali Solution",
        datetime(2025, 12, 10),
    )

    result = reconcile_email_to_job(db_session, email, dry_run=False)

    assert result["decision"] == BLOCK
    assert EMAIL_BEFORE_APPLICATION in result["reasons"]
    assert TITLE_MISMATCH in result["reasons"]
    assert email.job_urn is None
    assert job.application_status == "Waiting"


def test_email_before_application_is_always_blocked(db_session):
    job = add_job(
        db_session,
        "job:late",
        "Python Developer",
        "LaTeam Partners",
        datetime(2026, 4, 27),
    )
    email = add_email(
        db_session,
        "Your application to Python Developer at LaTeam Partners",
        datetime(2026, 4, 26),
    )

    result = reconcile_email_to_job(db_session, email, dry_run=False)

    assert result["decision"] == BLOCK
    assert EMAIL_BEFORE_APPLICATION in result["reasons"]
    assert email.job_urn is None
    assert job.application_status == "Waiting"


def test_company_only_match_is_not_auto_linked(db_session):
    job = add_job(
        db_session,
        "job:company-only",
        "Data Engineer",
        "Tiny DB",
        datetime(2026, 4, 20),
    )
    email = add_email(
        db_session,
        "Application update",
        datetime(2026, 4, 22),
        body_text="Tiny DB reviewed your application. Thank you.",
    )

    result = reconcile_email_to_job(db_session, email, dry_run=False)

    assert result["decision"] in {REVIEW, BLOCK}
    assert WEAK_COMPANY_ONLY_MATCH in result["reasons"] or "NO_ROLE_EXTRACTED" in result["reasons"]
    assert email.job_urn is None
    assert job.application_status == "Waiting"


def test_short_company_only_match_is_not_a_candidate_or_linked(db_session):
    job = add_job(
        db_session,
        "job:short-company",
        "Backend Developer",
        "DB",
        datetime(2026, 4, 20),
    )
    email = add_email(
        db_session,
        "Application update",
        datetime(2026, 4, 22),
        body_text="The callback URL contains /db/status and unrelated text.",
    )

    result = reconcile_email_to_job(db_session, email, dry_run=False)

    assert result["decision"] in {REVIEW, BLOCK}
    assert result["decision"] != LINK
    assert result["job_urn"] is None
    assert result["wrote"] is False
    assert email.job_urn is None
    assert job.application_status == "Waiting"


def test_valid_linkedin_rejection_links_email_and_refuses_job(db_session):
    job = add_job(
        db_session,
        "job:valid",
        "Python Developer - Odoo",
        "LaTeam Partners",
        datetime(2026, 4, 20),
    )
    email = add_email(
        db_session,
        "Your application to Python Developer at LaTeam Partners",
        datetime(2026, 4, 22),
    )

    result = reconcile_email_to_job(db_session, email, dry_run=False)

    assert result["decision"] == LINK
    assert result["wrote"] is True
    assert email.job_urn == job.urn
    assert job.application_status == "Refused"


def test_ats_rejection_body_fallback_links_sigma_style_email(db_session):
    job = add_job(
        db_session,
        "4393903370",
        "Full Stack Engineer",
        "Sigma Software Group",
        datetime(2026, 4, 22, 22, 43, 50),
    )
    email = add_email(
        db_session,
        "Thank you for your interest in Sigma Software",
        datetime(2026, 4, 24, 12, 18, 53),
        body_text=(
            "Dear Mr./Ms. Mateus,\n\n"
            "Thank you for your interest in the Senior Full-Stack Developer "
            "(interior design) position at Sigma Software. While your skills "
            "and background are impressive, we have decided to proceed with "
            "other candidates."
        ),
    )

    result = reconcile_email_to_job(db_session, email, dry_run=False)

    assert result["decision"] == LINK
    assert result["parsed_role"] == "Senior Full-Stack Developer (interior design)"
    assert result["parsed_company"] == "Sigma Software"
    assert result["wrote"] is True
    assert email.job_urn == job.urn
    assert job.application_status == "Refused"


def test_dry_run_does_not_write_refused_or_link_email(db_session):
    job = add_job(
        db_session,
        "job:dry-run",
        "Python Developer - Odoo",
        "LaTeam Partners",
        datetime(2026, 4, 20),
    )
    email = add_email(
        db_session,
        "Your application to Python Developer at LaTeam Partners",
        datetime(2026, 4, 22),
    )

    result = reconcile_email_to_job(db_session, email, dry_run=True)

    assert result["decision"] == LINK
    assert result["wrote"] is False
    assert email.job_urn is None
    assert job.application_status == "Waiting"


@pytest.mark.parametrize("terminal_status", ["Accepted", "Hired", "Offer"])
def test_terminal_status_is_not_overwritten(db_session, terminal_status):
    job = add_job(
        db_session,
        f"job:terminal:{terminal_status}",
        "Python Developer - Odoo",
        "LaTeam Partners",
        datetime(2026, 4, 20),
        status=terminal_status,
    )
    email = add_email(
        db_session,
        "Your application to Python Developer at LaTeam Partners",
        datetime(2026, 4, 22),
    )

    result = reconcile_email_to_job(db_session, email, dry_run=False)

    assert result["decision"] in {BLOCK, REVIEW}
    assert TERMINAL_STATUS in result["reasons"]
    assert email.job_urn is None
    assert job.application_status == terminal_status


def test_email_linked_to_another_job_is_not_relinked(db_session):
    original_job = add_job(
        db_session,
        "job:original",
        "Backend Developer",
        "Original Company",
        datetime(2026, 4, 19),
    )
    target_job = add_job(
        db_session,
        "job:target",
        "Python Developer - Odoo",
        "LaTeam Partners",
        datetime(2026, 4, 20),
    )
    email = add_email(
        db_session,
        "Your application to Python Developer at LaTeam Partners",
        datetime(2026, 4, 22),
    )
    email.job_urn = original_job.urn

    result = reconcile_email_to_job(db_session, email, dry_run=False)

    assert result["decision"] == REVIEW
    assert EMAIL_ALREADY_LINKED in result["reasons"]
    assert email.job_urn == original_job.urn
    assert target_job.application_status == "Waiting"


def test_email_already_linked_to_same_job_is_not_rewritten(db_session):
    job = add_job(
        db_session,
        "job:already-linked",
        "Python Developer - Odoo",
        "LaTeam Partners",
        datetime(2026, 4, 20),
        status="Refused",
    )
    email = add_email(
        db_session,
        "Your application to Python Developer at LaTeam Partners",
        datetime(2026, 4, 22),
    )
    email.job_urn = job.urn

    result = reconcile_email_to_job(db_session, email, dry_run=False)

    assert result["decision"] == LINK
    assert ALREADY_LINKED in result["reasons"]
    assert result["wrote"] is False
    assert email.job_urn == job.urn
    assert job.application_status == "Refused"


def test_linkedin_subject_with_newline_before_at_is_parsed(db_session):
    job = add_job(
        db_session,
        "job:newline-subject",
        "Desenvolvedor Fullstack Python React",
        "Jaya Tech",
        datetime(2026, 4, 20),
    )
    email = add_email(
        db_session,
        "Your application to Desenvolvedor Fullstack (Python/React) Senior\n at Jaya Tech",
        datetime(2026, 4, 22),
    )

    result = reconcile_email_to_job(db_session, email, dry_run=True)

    assert result["decision"] == LINK
    assert result["parsed_role"] == "Desenvolvedor Fullstack (Python/React) Senior"
    assert result["parsed_company"] == "Jaya Tech"
    assert email.job_urn is None
    assert job.application_status == "Waiting"


def test_sync_application_status_uses_safe_matcher(flask_app, db_session, monkeypatch):
    job = add_job(
        db_session,
        "job:sync-safe",
        "Desenvolvedor Python",
        "Pasquali Solution",
        datetime(2026, 4, 27),
    )
    email = add_email(
        db_session,
        "Your application to Desenvolvedor Fullstack at Pasquali Solution",
        datetime(2025, 12, 10),
    )
    monkeypatch.setattr(services_controller, "get_db_session", lambda: db_session)

    with flask_app.app_context():
        response, status_code = services_controller.sync_application_status()

    assert status_code == 200
    assert response.json["updated_count"] == 0
    assert email.job_urn is None
    assert job.application_status == "Waiting"


def test_sync_application_status_skips_already_linked_emails(flask_app, db_session, monkeypatch):
    linked_job = add_job(
        db_session,
        "job:sync-linked",
        "Python Developer",
        "LaTeam Partners",
        datetime(2026, 4, 20),
        status="Refused",
    )
    linked_email = add_email(
        db_session,
        "Your application to Python Developer at LaTeam Partners",
        datetime(2026, 4, 22),
    )
    linked_email.job_urn = linked_job.urn
    unlinked_job = add_job(
        db_session,
        "job:sync-unlinked",
        "Desenvolvedor Python",
        "Pasquali Solution",
        datetime(2026, 4, 27),
    )
    unlinked_email = add_email(
        db_session,
        "Your application to Desenvolvedor Fullstack at Pasquali Solution",
        datetime(2025, 12, 10),
    )
    monkeypatch.setattr(services_controller, "get_db_session", lambda: db_session)

    with flask_app.app_context():
        response, status_code = services_controller.sync_application_status()

    assert status_code == 200
    assert response.json["updated_count"] == 0
    assert len(response.json["results"]) == 1
    assert response.json["results"][0]["email_id"] == unlinked_email.id
    assert linked_email.job_urn == linked_job.urn
    assert unlinked_email.job_urn is None
    assert unlinked_job.application_status == "Waiting"


def test_reconcile_failures_uses_safe_matcher(db_session, monkeypatch):
    job = add_job(
        db_session,
        "job:population-safe",
        "Desenvolvedor Python",
        "Pasquali Solution",
        datetime(2026, 4, 27),
    )
    email = add_email(
        db_session,
        "Your application to Desenvolvedor Fullstack at Pasquali Solution",
        datetime(2025, 12, 10),
    )
    monkeypatch.setattr(population_service, "get_db_session", lambda: db_session)

    result = PopulationService.reconcile_failures()

    assert result["success"] is True
    assert result["updated_count"] == 0
    assert email.job_urn is None
    assert job.application_status == "Waiting"


def test_reconcile_failures_skips_already_linked_emails(db_session, monkeypatch):
    linked_job = add_job(
        db_session,
        "job:population-linked",
        "Python Developer",
        "LaTeam Partners",
        datetime(2026, 4, 20),
        status="Refused",
    )
    linked_email = add_email(
        db_session,
        "Your application to Python Developer at LaTeam Partners",
        datetime(2026, 4, 22),
    )
    linked_email.job_urn = linked_job.urn
    unlinked_job = add_job(
        db_session,
        "job:population-unlinked",
        "Desenvolvedor Python",
        "Pasquali Solution",
        datetime(2026, 4, 27),
    )
    unlinked_email = add_email(
        db_session,
        "Your application to Desenvolvedor Fullstack at Pasquali Solution",
        datetime(2025, 12, 10),
    )
    monkeypatch.setattr(population_service, "get_db_session", lambda: db_session)

    result = PopulationService.reconcile_failures()

    assert result["success"] is True
    assert result["updated_count"] == 0
    assert len(result["results"]) == 1
    assert result["results"][0]["email_id"] == unlinked_email.id
    assert linked_email.job_urn == linked_job.urn
    assert unlinked_email.job_urn is None
    assert unlinked_job.application_status == "Waiting"
