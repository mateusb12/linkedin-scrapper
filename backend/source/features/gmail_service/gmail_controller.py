import imaplib
import email
import re
from email.header import decode_header
from email.utils import parsedate_to_datetime
from datetime import datetime

from flask import jsonify, request
from sqlalchemy import desc

from database.database_connection import get_db_session
from models.user_models import Profile
from models.email_models import Email
from models.job_models import Job, Company
from source.features.gmail_service.safe_reconciliation import (
    reconcile_email_backlog_report,
    reconcile_email_to_job,
)

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
    decision = reconcile_email_to_job(session, email_obj, dry_run=False)
    print(
        "[Status Sync] "
        f"email_id={decision['email_id']} decision={decision['decision']} "
        f"job_urn={decision['job_urn']} reasons={decision['reasons']} "
        f"score={decision['score']}"
    )
    return decision.get("wrote") is True


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


def reconcile_backlog_dry_run():
    session = get_db_session()

    try:
        report = reconcile_email_backlog_report(session)
        return jsonify({
            "processed": len(report),
            "dry_run": True,
            "results": report,
        })

    finally:
        session.close()


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
