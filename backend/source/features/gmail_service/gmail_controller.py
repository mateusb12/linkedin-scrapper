import imaplib
import email
import re
from email.header import decode_header
from email.utils import parsedate_to_datetime
from datetime import datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser

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


class ReadableHTMLParser(HTMLParser):
    block_tags = {
        "address",
        "article",
        "aside",
        "br",
        "div",
        "footer",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "header",
        "li",
        "main",
        "p",
        "section",
        "table",
        "td",
        "th",
        "tr",
    }
    ignored_tags = {"script", "style", "noscript"}

    def __init__(self):
        super().__init__()
        self.parts = []
        self.ignored_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.ignored_tags:
            self.ignored_depth += 1
            return

        if tag in self.block_tags:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.ignored_tags:
            self.ignored_depth = max(0, self.ignored_depth - 1)
            return

        if tag in self.block_tags:
            self.parts.append("\n")

    def handle_data(self, data):
        if self.ignored_depth:
            return

        text = unescape(data)
        if text.strip():
            self.parts.append(text)

    def text(self):
        value = "".join(self.parts)
        value = value.replace("\xa0", " ")
        value = re.sub(r"[ \t]+\n", "\n", value)
        value = re.sub(r"\n[ \t]+", "\n", value)
        value = re.sub(r"[ \t]{2,}", " ", value)
        value = re.sub(r"\n{3,}", "\n\n", value)
        return value.strip()


def decode_part_payload(part):
    payload = part.get_payload(decode=True)
    if not payload:
        return ""

    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def html_to_readable_text(html):
    parser = ReadableHTMLParser()
    parser.feed(html or "")
    return parser.text()


def clean_readable_text(text):
    if not text:
        return ""

    text = re.sub(
        r"[\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]",
        "",
        text,
    )
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def is_attachment(part):
    disposition = str(part.get("Content-Disposition") or "").lower()
    return "attachment" in disposition


def is_linkedin_footer_only(text):
    normalized = normalize_text(text).lower()
    if not normalized:
        return True

    has_footer = (
        "this email was intended for" in normalized
        and "you are receiving linkedin notification emails" in normalized
    )
    has_rejection_signal = any(
        phrase in normalized
        for phrase in [
            "will not be moving forward",
            "moved forward with other candidates",
            "no longer considering",
            "decided not to proceed",
            "not selected",
            "not be progressing",
            "seguimos com outro",
            "não seguiremos",
            "nao seguiremos",
            "não avançará",
            "nao avancara",
        ]
    )

    return has_footer and not has_rejection_signal


def get_body_text(msg):
    plain_parts = []
    html_parts = []

    if msg.is_multipart():
        for part in msg.walk():
            if is_attachment(part):
                continue

            content_type = part.get_content_type()
            try:
                if content_type == "text/plain":
                    text = decode_part_payload(part).strip()
                    if text:
                        plain_parts.append(text)
                elif content_type == "text/html":
                    text = html_to_readable_text(decode_part_payload(part))
                    if text:
                        html_parts.append(text)
            except Exception:
                pass
    else:
        try:
            if msg.get_content_type() == "text/html":
                html_parts.append(html_to_readable_text(decode_part_payload(msg)))
            else:
                text = decode_part_payload(msg).strip()
                if text:
                    plain_parts.append(text)
        except Exception:
            pass

    plain_body = "\n\n".join(plain_parts).strip()
    html_body = "\n\n".join(html_parts).strip()

    if html_body and (not plain_body or is_linkedin_footer_only(plain_body)):
        return clean_readable_text(html_body)

    return clean_readable_text(plain_body or html_body) or "No readable content."


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

        subject = decode_mime_words(msg["Subject"])
        sender_full, sender_email = parse_email_address(msg["From"])

        try:
            received_dt = parsedate_to_datetime(msg["Date"])
        except Exception:
            received_dt = datetime.now()

        full_body = get_body_text(msg)
        exists = session.query(Email).filter_by(message_id=msg_id).first()
        if exists:
            existing_body = exists.body_text or ""
            if (
                is_linkedin_footer_only(existing_body)
                and full_body
                and not is_linkedin_footer_only(full_body)
            ):
                exists.body_text = full_body
                exists.snippet = " ".join(full_body.split())[:120] + "..."
                exists.subject = subject or exists.subject
                exists.sender = sender_full or exists.sender
                exists.sender_email = sender_email or exists.sender_email
                exists.recipient = decode_mime_words(msg["To"]) or exists.recipient
                exists.headers_json = dict(msg.items())
                synced_count += 1

            continue

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


def _datetime_to_brt_iso(value):
    if not value:
        return None

    dt_utc = value
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)

    return dt_utc.astimezone(timezone(timedelta(hours=-3))).isoformat()


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
        linked_jobs = {}
        job_urns = [
            email_obj.job_urn
            for email_obj in emails
            if isinstance(getattr(email_obj, "job_urn", None), str) and email_obj.job_urn
        ]
        job_urn_candidates = set(job_urns)
        for job_urn in job_urns:
            if ":" not in job_urn:
                job_urn_candidates.add(f"urn:li:jobPosting:{job_urn}")
                job_urn_candidates.add(f"urn:li:fsd_jobPosting:{job_urn}")

        if job_urns:
            jobs = session.query(Job).filter(Job.urn.in_(job_urn_candidates)).all()
            linked_jobs = {job.urn: job for job in jobs}
            for job in jobs:
                linked_jobs[job.urn.split(":")[-1]] = job

        email_payload = []
        for email_obj in emails:
            email_data = email_obj.to_dict()
            linked_job = linked_jobs.get(email_obj.job_urn)

            if linked_job:
                company_name = linked_job.company.name if linked_job.company else None
                email_data["job"] = {
                    "urn": linked_job.urn,
                    "title": linked_job.title,
                    "company": company_name,
                    "company_name": company_name,
                    "description_full": linked_job.description_full,
                    "description": linked_job.description_full,
                    "description_snippet": linked_job.description_snippet,
                    "applied_on": linked_job.applied_on.isoformat() if linked_job.applied_on else None,
                    "applied_at_brt": _datetime_to_brt_iso(linked_job.applied_on),
                    "applicants": linked_job.applicants,
                }
                email_data["appliedAt"] = email_data["job"]["applied_at_brt"] or email_data["job"]["applied_on"]
                email_data["linked_job"] = email_data["job"]

            email_payload.append(email_data)

        return jsonify(
            {
                "data": email_payload,
                "total": total,
                "page": page,
                "total_pages": (total + limit - 1) // limit,
            }
        ), 200

    finally:
        session.close()


def update_email_improvement_backlog(email_id):
    session = get_db_session()

    try:
        data = request.get_json(silent=True) or {}
        improvement_backlog = data.get("improvement_backlog", data.get("improvementBacklog"))

        if improvement_backlog is not None and not isinstance(improvement_backlog, str):
            return jsonify({"error": "improvement_backlog must be a string"}), 400

        email_obj = session.query(Email).filter(Email.id == email_id).first()

        if not email_obj:
            return jsonify({"error": "Email not found"}), 404

        email_obj.improvement_backlog = improvement_backlog or None
        session.commit()

        return jsonify(email_obj.to_dict()), 200

    except Exception as exc:
        session.rollback()
        return jsonify({"error": str(exc)}), 500

    finally:
        session.close()
