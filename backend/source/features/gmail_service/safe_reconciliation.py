import logging
import re
import unicodedata
from dataclasses import dataclass
from datetime import timezone
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

from models import Company, Email, Job

logger = logging.getLogger(__name__)

LINK = "LINK"
BLOCK = "BLOCK"
REVIEW = "REVIEW"

EMAIL_BEFORE_APPLICATION = "EMAIL_BEFORE_APPLICATION"
TITLE_MISMATCH = "TITLE_MISMATCH"
COMPANY_MISMATCH = "COMPANY_MISMATCH"
MISSING_DATES = "MISSING_DATES"
NO_ROLE_EXTRACTED = "NO_ROLE_EXTRACTED"
MULTIPLE_CANDIDATES = "MULTIPLE_CANDIDATES"
WEAK_COMPANY_ONLY_MATCH = "WEAK_COMPANY_ONLY_MATCH"
NO_CANDIDATES = "NO_CANDIDATES"
TERMINAL_STATUS = "TERMINAL_STATUS"
EMAIL_ALREADY_LINKED = "EMAIL_ALREADY_LINKED"
ALREADY_LINKED = "ALREADY_LINKED"

TERMINAL_APPLICATION_STATUSES = {
    "accepted",
    "hired",
    "offer",
}

GENERIC_ROLE_TOKENS = {
    "developer",
    "desenvolvedor",
    "desenvolvedora",
    "dev",
    "software",
    "engineer",
    "engenheiro",
    "engenheira",
    "pessoa",
    "pleno",
    "senior",
    "sênior",
    "junior",
    "júnior",
    "remoto",
    "remote",
}


@dataclass
class Candidate:
    job: Job
    reasons: List[str]
    score: float
    company_score: float
    title_score: float


def normalize_match_text(value: Optional[str]) -> str:
    if not value:
        return ""

    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def parse_linkedin_application_subject(subject: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    subject_norm = " ".join(str(subject or "").split())
    match = re.search(r"^your application to (.+?) at (.+?)\.?$", subject_norm, re.IGNORECASE)
    if not match:
        return None, None

    return match.group(1).strip(), match.group(2).strip()


def parse_application_body(body: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    body_norm = " ".join(str(body or "").split())
    match = re.search(
        r"interest in (?:the |our )?(.+?) position at ([^.]+?)(?:\.|,| while|$)",
        body_norm,
        re.IGNORECASE,
    )
    if not match:
        return None, None

    return match.group(1).strip(), match.group(2).strip()


def _role_tokens(value: Optional[str]) -> set[str]:
    tokens = set(normalize_match_text(value).split())
    return {token for token in tokens if len(token) >= 2 and token not in GENERIC_ROLE_TOKENS}


def role_title_similarity(role: Optional[str], title: Optional[str]) -> float:
    role_relevant = _role_tokens(role)
    title_relevant = _role_tokens(title)

    if role_relevant and title_relevant:
        overlap = role_relevant & title_relevant
        if not overlap:
            return 0.0
        if len(overlap) >= 2 and title_relevant.issubset(role_relevant):
            return 1.0
        return min(
            len(overlap) / len(role_relevant),
            len(overlap) / min(len(role_relevant), len(title_relevant)),
        )

    role_norm = normalize_match_text(role)
    title_norm = normalize_match_text(title)
    if not role_norm or not title_norm:
        return 0.0
    return SequenceMatcher(None, role_norm, title_norm).ratio()


def company_similarity(left: Optional[str], right: Optional[str]) -> float:
    left_norm = normalize_match_text(left)
    right_norm = normalize_match_text(right)
    if not left_norm or not right_norm:
        return 0.0
    if left_norm == right_norm:
        return 1.0
    return SequenceMatcher(None, left_norm, right_norm).ratio()


def company_token_similarity(left: Optional[str], right: Optional[str]) -> float:
    left_tokens = set(normalize_match_text(left).split())
    right_tokens = set(normalize_match_text(right).split())
    if not left_tokens or not right_tokens:
        return 0.0

    overlap = left_tokens & right_tokens
    if not overlap:
        return 0.0

    return len(overlap) / min(len(left_tokens), len(right_tokens))


def _date_for_compare(value):
    if not value:
        return None
    if getattr(value, "tzinfo", None) is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _email_blob(email_obj: Email) -> str:
    return normalize_match_text(
        " ".join(
            [
                email_obj.subject or "",
                email_obj.body_text or "",
                email_obj.snippet or "",
                email_obj.sender or "",
                email_obj.sender_email or "",
            ]
        )
    )


def _candidate_payload(candidate: Optional[Candidate]) -> Dict[str, Any]:
    if not candidate:
        return {
            "job_urn": None,
            "candidate_job_title": None,
            "candidate_company": None,
            "applied_on": None,
            "score": 0.0,
        }

    job = candidate.job
    return {
        "job_urn": job.urn,
        "candidate_job_title": job.title,
        "candidate_company": job.company.name if job.company else None,
        "applied_on": job.applied_on.isoformat() if job.applied_on else None,
        "score": round(candidate.score, 3),
    }


def _decision(
    decision: str,
    email_obj: Email,
    reasons: List[str],
    candidate: Optional[Candidate] = None,
    parsed_role: Optional[str] = None,
    parsed_company: Optional[str] = None,
    wrote: bool = False,
) -> Dict[str, Any]:
    payload = {
        "decision": decision,
        "email_id": email_obj.id,
        "subject": email_obj.subject,
        "received_at": email_obj.received_at.isoformat() if email_obj.received_at else None,
        "reasons": sorted(set(reasons)),
        "parsed_role": parsed_role,
        "parsed_company": parsed_company,
        "wrote": wrote,
    }
    payload.update(_candidate_payload(candidate))
    return payload


def _strong_body_title_match(email_obj: Email, job: Job) -> bool:
    blob = _email_blob(email_obj)
    title = normalize_match_text(job.title)
    company = normalize_match_text(job.company.name if job.company else None)
    return bool(title and company and title in blob and company in blob)


def _company_appears_in_email(email_obj: Email, job: Job) -> bool:
    company = normalize_match_text(job.company.name if job.company else None)
    if not company or len(company) < 4:
        return False

    company_tokens = set(company.split())
    if any(len(token) < 4 for token in company_tokens):
        return False

    blob_tokens = set(_email_blob(email_obj).split())
    return company_tokens.issubset(blob_tokens)


def _build_candidate(email_obj: Email, job: Job, parsed_role: Optional[str], parsed_company: Optional[str]) -> Candidate:
    reasons: List[str] = []
    received_at = _date_for_compare(email_obj.received_at)
    applied_on = _date_for_compare(job.applied_on)

    if not received_at or not applied_on:
        reasons.append(MISSING_DATES)
    elif received_at < applied_on:
        reasons.append(EMAIL_BEFORE_APPLICATION)

    company_name = job.company.name if job.company else None
    company_score = max(
        company_similarity(parsed_company, company_name),
        company_token_similarity(parsed_company, company_name),
    )
    if company_score < 0.9:
        reasons.append(COMPANY_MISMATCH)

    title_score = role_title_similarity(parsed_role, job.title)
    if parsed_role:
        if title_score < 0.66:
            reasons.append(TITLE_MISMATCH)
    elif not _strong_body_title_match(email_obj, job):
        reasons.extend([NO_ROLE_EXTRACTED, WEAK_COMPANY_ONLY_MATCH])
        title_score = 0.0
    else:
        title_score = 1.0

    if normalize_match_text(job.application_status) in TERMINAL_APPLICATION_STATUSES:
        reasons.append(TERMINAL_STATUS)

    score = (company_score * 0.45) + (title_score * 0.45)
    if received_at and applied_on and received_at >= applied_on:
        score += 0.10

    return Candidate(job=job, reasons=reasons, score=score, company_score=company_score, title_score=title_score)


def reconcile_email_to_job(session, email_obj: Email, dry_run: bool = False) -> Dict[str, Any]:
    parsed_role, parsed_company = parse_linkedin_application_subject(email_obj.subject)
    if not parsed_role and not parsed_company:
        parsed_role, parsed_company = parse_application_body(email_obj.body_text)
    reasons: List[str] = []

    jobs_query = (
        session.query(Job)
        .join(Company)
        .filter(Job.has_applied.is_(True))
        .order_by(Job.applied_on.desc())
    )

    applied_jobs = jobs_query.all()
    if not applied_jobs:
        return _decision(REVIEW, email_obj, [NO_CANDIDATES], None, parsed_role, parsed_company)

    if not parsed_company:
        reasons.append(COMPANY_MISMATCH)
        if not parsed_role:
            reasons.append(NO_ROLE_EXTRACTED)

    company_candidates = [
        _build_candidate(email_obj, job, parsed_role, parsed_company)
        for job in applied_jobs
        if parsed_company
        and max(
            company_similarity(parsed_company, job.company.name if job.company else None),
            company_token_similarity(parsed_company, job.company.name if job.company else None),
        )
        >= 0.9
    ]

    if not company_candidates and parsed_company:
        return _decision(BLOCK, email_obj, [COMPANY_MISMATCH], None, parsed_role, parsed_company)

    if not company_candidates:
        strong_candidates = [
            _build_candidate(email_obj, job, parsed_role, job.company.name if job.company else None)
            for job in applied_jobs
            if _strong_body_title_match(email_obj, job)
        ]
        if not strong_candidates:
            company_only_candidates = [
                _build_candidate(email_obj, job, parsed_role, job.company.name if job.company else None)
                for job in applied_jobs
                if _company_appears_in_email(email_obj, job)
            ]
            if company_only_candidates:
                best_company_only = sorted(
                    company_only_candidates,
                    key=lambda item: item.score,
                    reverse=True,
                )[0]
                return _decision(
                    REVIEW,
                    email_obj,
                    best_company_only.reasons or [NO_ROLE_EXTRACTED, WEAK_COMPANY_ONLY_MATCH],
                    best_company_only,
                    parsed_role,
                    parsed_company,
                )
            return _decision(REVIEW, email_obj, reasons or [NO_ROLE_EXTRACTED], None, parsed_role, parsed_company)
        company_candidates = strong_candidates

    viable = [
        candidate
        for candidate in company_candidates
        if EMAIL_BEFORE_APPLICATION not in candidate.reasons
        and MISSING_DATES not in candidate.reasons
        and COMPANY_MISMATCH not in candidate.reasons
        and TITLE_MISMATCH not in candidate.reasons
        and WEAK_COMPANY_ONLY_MATCH not in candidate.reasons
        and TERMINAL_STATUS not in candidate.reasons
    ]

    blocked = sorted(company_candidates, key=lambda item: item.score, reverse=True)
    best = sorted(viable, key=lambda item: item.score, reverse=True)[0] if viable else (blocked[0] if blocked else None)

    if not viable:
        decision_reasons = list(best.reasons if best else reasons)
        decision = BLOCK if any(reason in decision_reasons for reason in [EMAIL_BEFORE_APPLICATION, MISSING_DATES, TITLE_MISMATCH, COMPANY_MISMATCH]) else REVIEW
        for reason in sorted(set(decision_reasons)):
            logger.info("Email %s blocked/reviewed for job %s: %s", email_obj.id, best.job.urn if best else None, reason)
        return _decision(decision, email_obj, decision_reasons, best, parsed_role, parsed_company)

    top_score = viable[0].score
    top_candidates = [candidate for candidate in viable if abs(candidate.score - top_score) < 0.001]
    if len(top_candidates) > 1:
        return _decision(REVIEW, email_obj, [MULTIPLE_CANDIDATES], top_candidates[0], parsed_role, parsed_company)

    best = viable[0]
    if email_obj.job_urn:
        if email_obj.job_urn == best.job.urn:
            return _decision(LINK, email_obj, [ALREADY_LINKED], best, parsed_role, parsed_company)
        return _decision(REVIEW, email_obj, [EMAIL_ALREADY_LINKED], best, parsed_role, parsed_company)

    wrote = False
    if not dry_run:
        email_obj.job_urn = best.job.urn
        best.job.application_status = "Refused"
        wrote = True

    return _decision(LINK, email_obj, [], best, parsed_role, parsed_company, wrote=wrote)


def reconcile_email_backlog_report(session) -> List[Dict[str, Any]]:
    emails = session.query(Email).filter(
        Email.folder == "Job fails",
        Email.job_urn.is_(None),
    ).all()
    return [reconcile_email_to_job(session, email_obj, dry_run=True) for email_obj in emails]
