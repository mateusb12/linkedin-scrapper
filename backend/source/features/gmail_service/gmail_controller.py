import imaplib
import email
import re
from difflib import get_close_matches
from email.header import decode_header
from email.utils import parsedate_to_datetime
from datetime import datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import desc

from database.database_connection import get_db_session
from models.user_models import Profile
from models.email_models import Email
from models.job_models import Job, Company

gmail_bp = Blueprint("gmail", __name__, url_prefix="/emails")

JOB_KEYWORDS = [
    "application",
    "processo seletivo",
    "hiring",
    "candidate",
    "vaga",
    "position",
]

IGNORE_KEYWORDS = [
    "github",
    "payment",
    "booking",
    "trip",
    "health insurance",
    "rating",
    "confirmation",
]


# ---------------------------------------------------
# Helpers
# ---------------------------------------------------

def decode_mime_words(s):
    if not s:
        return ""

    decoded_list = decode_header(s)
    text_parts = []

    for content, encoding in decoded_list:
        if isinstance(content, bytes):
            try:
                text_parts.append(content.decode(encoding or "utf-8", errors="ignore"))
            except LookupError:
                text_parts.append(content.decode("utf-8", errors="ignore"))
        else:
            text_parts.append(str(content))

    return "".join(text_parts)


def get_body_text(msg):
    body = ""

    if msg.is_multipart():
        for part in msg.walk():
            if (
                    part.get_content_type() == "text/plain"
                    and "attachment" not in str(part.get("Content-Disposition"))
            ):
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode(errors="ignore")
                        break
                except Exception:
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode(errors="ignore")
        except Exception:
            pass

    return body if body else "No readable content."


def parse_email_address(raw_header):
    if not raw_header:
        return "", ""

    clean_header = decode_mime_words(raw_header)

    email_only = clean_header
    if "<" in clean_header and ">" in clean_header:
        email_only = clean_header.split("<")[-1].strip(">")

    return clean_header, email_only


def normalize_text(value: str) -> str:
    if not value:
        return ""
    return " ".join(str(value).split())


def normalize_company_name(value: str) -> str:
    value = normalize_text(value).lower()
    value = value.split("|")[0].strip()
    value = re.sub(r"-\d+$", "", value).strip()
    value = re.sub(r"[^\w\s&.+/-]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def cleanup_company(company: str) -> str:
    company = normalize_text(company)
    company = company.split("|")[0].strip()
    company = re.sub(r"-\d+$", "", company).strip()
    return company


# ---------------------------------------------------
# Subject parsing
# ---------------------------------------------------

def extract_role_company(subject: str):
    subject = normalize_text(subject)

    role = None
    company = None

    # 1) Most reliable pattern
    match = re.search(r"your application to (.+?) at (.+)", subject, re.IGNORECASE)
    if match:
        role = match.group(1).strip()
        company = match.group(2).strip()
        return role, cleanup_company(company)

    # 2) "X Application Update"
    match = re.search(r"^(.+?) application update$", subject, re.IGNORECASE)
    if match:
        company = match.group(1).strip()
        return None, cleanup_company(company)

    # 3) Pipe pattern
    # Ex:
    # "Retorno Processo Seletivo | Neogrid"
    # "Job Application Update | Velozient"
    # "Atualização sobre seu processo na Makasí | Back-End Engineer"
    match = re.search(r"^(.+?)\|\s*(.+)$", subject)
    if match:
        left = match.group(1).strip()
        right = match.group(2).strip()

        left_lower = left.lower()

        if (
                "processo" in left_lower
                or "application update" in left_lower
                or "update" in left_lower
                or "retorno" in left_lower
                or "feedback" in left_lower
        ):
            return None, cleanup_company(right)

        return right, cleanup_company(left)

    # 4) "Company - Processo seletivo - Role"
    match = re.search(
        r"^(.+?)\s*-\s*processo seletivo(?:\s*-\s*(.+))?$",
        subject,
        re.IGNORECASE,
    )
    if match:
        company = match.group(1).strip()
        role = (match.group(2) or "").strip() or None
        return role, cleanup_company(company)

    # 5) Generic dash fallback
    match = re.search(r"^(.+?)\s*-\s*(.+)$", subject)
    if match:
        left = match.group(1).strip()
        right = match.group(2).strip()

        right_lower = right.lower()

        if "mateus" in right_lower or "agradecimento" in right_lower:
            return None, cleanup_company(left)

        return left, cleanup_company(right)

    return None, None


# ---------------------------------------------------
# Reconciliation logic
# ---------------------------------------------------

def _auto_reconcile_job(session, email_obj):
    raw_subject = email_obj.subject or ""
    subject_clean = normalize_text(raw_subject)
    subject = subject_clean.lower()
    sender = normalize_text(email_obj.sender or "").lower()

    if any(k in subject or k in sender for k in IGNORE_KEYWORDS):
        print(f"\n[Status Sync] Skipping ignored email: '{subject_clean}'")
        return False

    if not any(k in subject for k in JOB_KEYWORDS):
        print(f"\n[Status Sync] Skipping non-job email: '{subject_clean}'")
        return False

    print(f"\n[Status Sync] Processing: '{subject_clean}'")

    role, company = extract_role_company(subject_clean)

    print(f"   -> Extracted role: {role}")
    print(f"   -> Extracted company: {company}")

    target_job = None

    applied_jobs = (
        session.query(Job)
        .join(Company)
        .filter(Job.has_applied.is_(True))
        .order_by(Job.applied_on.desc())
        .all()
    )

    print(f"   -> Applied jobs universe: {len(applied_jobs)}")

    if company:
        normalized_company = normalize_company_name(company)
        print(f"   -> Normalized extracted company: '{normalized_company}'")

        company_candidates = [
            job
            for job in applied_jobs
            if job.company and normalize_company_name(job.company.name) == normalized_company
        ]

        print(f"   -> Exact normalized company candidates: {len(company_candidates)}")

        if company_candidates:
            print(
                "   -> Candidate companies: "
                f"{[job.company.name for job in company_candidates[:10]]}"
            )

        if not company_candidates:
            company_tokens = [t for t in normalized_company.split() if len(t) >= 3]

            token_hits = []
            for job in applied_jobs:
                if not job.company or not job.company.name:
                    continue

                db_company_norm = normalize_company_name(job.company.name)

                if any(token in db_company_norm for token in company_tokens):
                    token_hits.append(job.company.name)

            unique_token_hits = sorted(set(token_hits))
            print(f"   -> Token hits: {unique_token_hits[:10]}")

            db_company_names_norm = sorted(
                set(
                    normalize_company_name(job.company.name)
                    for job in applied_jobs
                    if job.company and job.company.name
                )
            )

            close_matches = get_close_matches(
                normalized_company,
                db_company_names_norm,
                n=5,
                cutoff=0.5,
            )
            print(f"   -> Close normalized company matches: {close_matches}")

            if close_matches:
                close_originals = sorted(
                    set(
                        job.company.name
                        for job in applied_jobs
                        if job.company
                        and job.company.name
                        and normalize_company_name(job.company.name) in close_matches
                    )
                )
                print(f"   -> Close original company matches: {close_originals}")

        if len(company_candidates) == 1:
            target_job = company_candidates[0]
            print(
                f"   -> Single company match: {target_job.title} @ {target_job.company.name}"
            )

        elif len(company_candidates) > 1 and role:
            role_lower = normalize_text(role).lower()
            print(f"   -> Trying title refinement with role: '{role_lower}'")

            for job in company_candidates:
                db_title = normalize_text(job.title or "").lower()
                print(f"      - Candidate title: '{db_title}'")

                if role_lower in db_title or db_title in role_lower:
                    target_job = job
                    print(
                        f"      ✅ Title-refined match: {job.title} @ {job.company.name}"
                    )
                    break

            if not target_job:
                target_job = company_candidates[0]
                print(
                    f"   -> Falling back to first company candidate: "
                    f"{target_job.title} @ {target_job.company.name}"
                )

    if not target_job:
        print("   -> Starting reverse company lookup in subject/sender")

        normalized_subject = normalize_company_name(subject_clean)
        normalized_sender = normalize_company_name(sender)

        for job in applied_jobs:
            if not job.company or not job.company.name:
                continue

            db_name = normalize_company_name(job.company.name)

            if db_name and (db_name in normalized_subject or db_name in normalized_sender):
                target_job = job
                print(f"   -> Reverse match: {job.company.name} / {job.title}")
                break

    if target_job:
        email_obj.job_urn = target_job.urn
        print(f"   -> Linked email to job_urn: {target_job.urn}")

        if target_job.application_status not in ["Refused", "Accepted"]:
            print(
                f"      🔄 Updating {target_job.title} at "
                f"{target_job.company.name} -> Refused"
            )
            target_job.application_status = "Refused"
            return True

        print(
            f"      ℹ️ Matched {target_job.title} at {target_job.company.name}, "
            f"status already {target_job.application_status}"
        )
        return False

    print("      ❌ No job match found")
    return False


# ---------------------------------------------------
# Gmail sync
# ---------------------------------------------------

def _perform_gmail_sync(session, profile, target_label):
    print(f"[DEBUG] Connecting to IMAP for label: '{target_label}'...")

    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(profile.email, profile.email_app_password)

    status, _ = mail.select(f'"{target_label}"')

    if status != "OK":
        mail.logout()
        raise ValueError(f"Label '{target_label}' not found")

    _, search_data = mail.search(None, "ALL")
    email_ids = search_data[0].split()

    print(f"[DEBUG] Gmail Server found {len(email_ids)} emails.")

    synced_count = 0
    email_ids.reverse()

    for e_id in email_ids:
        _, msg_data = mail.fetch(e_id, "(RFC822)")
        raw_email = msg_data[0][1]
        msg = email.message_from_bytes(raw_email)

        msg_id = msg.get("Message-ID", "").strip()

        exists = session.query(Email).filter_by(message_id=msg_id).first()
        if exists:
            continue

        subject = decode_mime_words(msg["Subject"])
        sender_full, sender_email = parse_email_address(msg["From"])

        try:
            received_dt = parsedate_to_datetime(msg["Date"])
        except Exception:
            received_dt = datetime.now()

        full_body = get_body_text(msg)

        new_email = Email(
            profile_id=profile.id,
            message_id=msg_id,
            thread_id=msg.get("X-GM-THRID"),
            folder=target_label,
            category="rejection" if target_label == "Job fails" else "general",
            subject=subject,
            sender=sender_full,
            sender_email=sender_email,
            recipient=decode_mime_words(msg["To"]),
            body_text=full_body,
            snippet=" ".join(full_body.split())[:120] + "...",
            received_at=received_dt,
            created_at=datetime.now(),
            headers_json=dict(msg.items()),
            is_read=True,
        )

        session.add(new_email)
        synced_count += 1

    session.flush()

    if target_label == "Job fails":
        unmatched_count = session.query(Email).filter(
            Email.folder == "Job fails",
            Email.job_urn.is_(None),
        ).count()

        linked_count = session.query(Email).filter(
            Email.folder == "Job fails",
            Email.job_urn.is_not(None),
        ).count()

        applied_jobs_count = session.query(Job).filter(
            Job.has_applied.is_(True)
        ).count()

        applied_company_names = (
            session.query(Company.name)
            .join(Job, Job.company_urn == Company.urn)
            .filter(Job.has_applied.is_(True))
            .distinct()
            .all()
        )
        applied_company_names = sorted(name for (name,) in applied_company_names)

        print("\n[Reconciliation] Running full email → job sync")
        print(f"[Reconciliation] Unmatched emails before run: {unmatched_count}")
        print(f"[Reconciliation] Already linked emails: {linked_count}")
        print(f"[Reconciliation] Applied jobs in DB: {applied_jobs_count}")
        print(f"[Reconciliation] Applied companies sample: {applied_company_names[:20]}")

        emails = session.query(Email).filter(
            Email.folder == "Job fails",
            Email.job_urn.is_(None),
        ).all()

        updated = 0

        for em in emails:
            if _auto_reconcile_job(session, em):
                updated += 1

        print(f"[Reconciliation] Updated {updated} jobs")

    session.commit()
    mail.logout()

    return synced_count


# ---------------------------------------------------
# Endpoints
# ---------------------------------------------------

@gmail_bp.route("/sync", methods=["POST"])
def sync_emails_endpoint():
    session = get_db_session()

    try:
        data = request.get_json(silent=True) or {}
        target_label = (data.get("label") or "Job fails").strip()
        profile = session.query(Profile).first()

        if not profile:
            return jsonify({"error": "Profile not configured"}), 400

        if not profile.email:
            return jsonify({"error": "Profile email is missing"}), 400

        if not profile.email_app_password:
            return jsonify({"error": "Gmail app password not configured"}), 400

        synced = _perform_gmail_sync(session, profile, target_label)

        return jsonify(
            {
                "message": f"Synced {synced} emails",
                "label": target_label,
            }
        ), 200

    except imaplib.IMAP4.error:
        import traceback
        print("\n🔥 IMAP ERROR")
        traceback.print_exc()
        return jsonify({"error": "Gmail authentication failed"}), 500

    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    except Exception:
        import traceback
        print("\n🔥 ERROR DURING EMAIL SYNC")
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

    finally:
        session.close()


@gmail_bp.route("/reconcile-backlog", methods=["POST"])
def reconcile_backlog():
    session = get_db_session()

    try:

        emails = session.query(Email).filter(
            Email.folder == "Job fails",
            Email.job_urn.is_(None)
        ).all()

        print(f"\n[Backlog] Processing {len(emails)} unmatched emails")

        updated = 0

        for em in emails:
            if _auto_reconcile_job(session, em):
                updated += 1

        session.commit()

        return jsonify({
            "processed": len(emails),
            "updated": updated
        })

    finally:
        session.close()


@gmail_bp.route("/", methods=["GET"])
def get_stored_emails():
    session = get_db_session()

    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 10))
        folder_filter = request.args.get("folder", "Job fails")

        query = session.query(Email).filter(Email.folder == folder_filter)
        total = query.count()

        emails = (
            query.order_by(desc(Email.received_at))
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )

        return jsonify(
            {
                "data": [e.to_dict() for e in emails],
                "total": total,
                "page": page,
                "total_pages": (total + limit - 1) // limit,
            }
        ), 200

    finally:
        session.close()
