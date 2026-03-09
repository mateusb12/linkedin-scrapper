import imaplib
import email
import re
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
            if part.get_content_type() == "text/plain" and "attachment" not in str(
                    part.get("Content-Disposition")
            ):
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode(errors="ignore")
                except:
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode(errors="ignore")
        except:
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


def extract_role_company(subject: str):
    role = None
    company = None

    match = re.search(
        r"application to (.+?) at (.+)",
        subject,
        re.IGNORECASE
    )

    if match:
        role = match.group(1).strip()
        company = match.group(2).strip()

    if not company:
        match = re.search(r"(.+?)\s?\|\s?(.+)", subject)
        if match:
            company = match.group(1).strip()
            role = match.group(2).strip()

    if not company:
        match = re.search(r"(.+?)\s*-\s*(.+)", subject)
        if match:
            role = match.group(1).strip()
            company = match.group(2).strip()

    if company:
        company = company.split("|")[0]
        company = company.split("(")[0]
        company = company.strip()

    return role, company


def _auto_reconcile_job(session, email_obj):
    subject = (email_obj.subject or "").lower()
    sender = (email_obj.sender or "").lower()

    if any(k in subject or k in sender for k in IGNORE_KEYWORDS):
        return False

    if not any(k in subject for k in JOB_KEYWORDS):
        return False

    print(f"\n[Status Sync] Processing: '{email_obj.subject}'")

    role, company = extract_role_company(email_obj.subject)

    print(f"   -> Extracted role: {role}")
    print(f"   -> Extracted company: {company}")

    target_job = None

    if company:

        query = (
            session.query(Job)
            .join(Company)
            .filter(
                Job.has_applied.is_(True),
                Job.application_status.notin_(["Refused", "Accepted"]),
                Company.name.ilike(f"%{company}%")
            )
        )

        if role:
            query = query.filter(Job.title.ilike(f"%{role}%"))

        potential_job = query.order_by(Job.applied_on.desc()).first()

        if potential_job:
            target_job = potential_job

    if not target_job:

        active_jobs = (
            session.query(Job)
            .join(Company)
            .filter(
                Job.has_applied.is_(True),
                Job.application_status.notin_(["Refused", "Accepted"]),
            )
            .all()
        )

        for job in active_jobs:

            if not job.company or not job.company.name:
                continue

            name = job.company.name.lower()

            if name in subject or name in sender:
                target_job = job
                print(f"   -> Reverse match: {job.company.name}")
                break

    if target_job:
        print(f"      🔄 Updating {target_job.company.name} -> Refused")

        target_job.application_status = "Refused"

        return True

    print("      ❌ No job match found")

    return False


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
        except:
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

        if target_label == "Job fails":
            _auto_reconcile_job(session, new_email)

        synced_count += 1

    session.commit()

    mail.logout()

    return synced_count


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
        )

    except Exception as e:

        import traceback

        print("\n🔥 ERROR DURING EMAIL SYNC")
        traceback.print_exc()

        return jsonify({"error": "Internal server error"}), 500

    finally:
        session.close()


@gmail_bp.route("/reconcile-backlog", methods=["GET"])
def reconcile_backlog():
    session = get_db_session()

    try:

        emails = session.query(Email).filter(Email.folder == "Job fails").all()
        updated = 0

        for em in emails:
            if _auto_reconcile_job(session, em):
                updated += 1

        session.commit()

        return jsonify(
            {
                "processed": len(emails),
                "updated": updated,
            }
        )

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
        )

    finally:
        session.close()
