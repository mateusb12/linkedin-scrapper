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

# --- Helpers ---

def decode_mime_words(s):
    if not s: return ""
    decoded_list = decode_header(s)
    text_parts = []
    for content, encoding in decoded_list:
        if isinstance(content, bytes):
            try:
                text_parts.append(content.decode(encoding or 'utf-8', errors='ignore'))
            except LookupError:
                text_parts.append(content.decode('utf-8', errors='ignore'))
        else:
            text_parts.append(str(content))
    return "".join(text_parts)

def get_body_text(msg):
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain" and "attachment" not in str(part.get("Content-Disposition")):
                try:
                    payload = part.get_payload(decode=True)
                    if payload: body = payload.decode(errors='ignore')
                except: pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload: body = payload.decode(errors='ignore')
        except: pass
    return body if body else "No readable content."

def parse_email_address(raw_header):
    if not raw_header: return "", ""
    clean_header = decode_mime_words(raw_header)
    email_only = clean_header
    if "<" in clean_header and ">" in clean_header:
        email_only = clean_header.split("<")[-1].strip(">")
    return clean_header, email_only

# --- Reconciliation Logic ---

def _auto_reconcile_job(session, email_obj):
    subject = (email_obj.subject or "").strip()
    sender = (email_obj.sender or "").strip()

    ignore_keywords = ["FlixBus", "GitHub", "Payment", "Google Cloud", "Booking.com", "Wizz Air", "Brainnest", "Medium"]
    if any(keyword.lower() in subject.lower() or keyword.lower() in sender.lower() for keyword in ignore_keywords):
        return False

    print(f"\n[Status Sync] Processing: '{subject}'")

    target_job = None

    # --- Strategy A: Regex Extraction ---

    # 1. "Application to [Role] at [Company]" (Standard LinkedIn/ATS)
    match_standard = re.search(r"application to (.+?) at (.+)", subject, re.IGNORECASE | re.DOTALL)

    # 2. "[Role] | [Company]" (e.g. Jeitto)
    match_pipe = re.search(r"(.+?)\s?\|\s?(.+)", subject)

    # 3. "[Company] Application Update" (e.g. Lumenalta)
    match_update = re.search(r"^(.+?) Application Update", subject, re.IGNORECASE)

    extracted_company = None

    if match_standard:
        extracted_company = match_standard.group(2).strip()
    elif match_pipe:
        # Heuristic: The shorter part is likely the company, or the 2nd part.
        # Check if group 2 looks like a company (no "Senior", "Developer" keywords)
        p1, p2 = match_pipe.group(1).strip(), match_pipe.group(2).strip()
        if len(p2) < len(p1): extracted_company = p2
        else: extracted_company = p1 # Fallback
    elif match_update:
        extracted_company = match_update.group(1).strip()

    if extracted_company:
        # CLEANUP: Remove common noise
        # "PDtec | Uma..." -> "PDtec"
        # "BeyondRisk AI-6" -> "BeyondRisk AI"
        extracted_company = extracted_company.split('|')[0].split('(')[0].split('\n')[0].strip()
        extracted_company = re.sub(r'[-\d]+$', '', extracted_company).strip() # Remove trailing " -6"
        if extracted_company.endswith('.'): extracted_company = extracted_company[:-1]

        print(f"   -> Extracted Company: '{extracted_company}'")

        # 1. Try Exact/Like Match
        potential_job = session.query(Job).join(Company).filter(
            Company.name.ilike(f"%{extracted_company}%")
        ).first()

        # 2. Fallback: Token Search (e.g. "SaQ" from "SaQ.Digital")
        if not potential_job:
            # Split by dot or space, take first part if > 3 chars
            tokens = re.split(r'[ .]', extracted_company)
            if tokens and len(tokens[0]) > 2:
                token = tokens[0]
                print(f"      ⚠️ Exact fail. Searching token: '{token}'")
                potential_job = session.query(Job).join(Company).filter(
                    Company.name.ilike(f"%{token}%")
                ).first()

        if potential_job:
            if potential_job.application_status == 'Refused':
                print(f"      ℹ️ Job for '{potential_job.company.name}' is ALREADY Refused. Skipping.")
                return False
            else:
                target_job = potential_job
        else:
            print(f"      ❌ Extracted '{extracted_company}' but found no matching company in DB.")

    # --- Strategy B: Reverse Lookup (Fallback) ---
    if not target_job:
        active_jobs = session.query(Job).join(Company).filter(
            Job.application_status.notin_(['Refused', 'Accepted']),
            Job.has_applied.is_(True)
        ).all()

        for job in active_jobs:
            if not job.company or not job.company.name: continue

            db_name = job.company.name.lower()
            if len(db_name) < 4: continue

            if db_name in subject.lower() or db_name in sender.lower():
                target_job = job
                print(f"   -> ✅ Reverse Match found: {job.company.name}")
                break

    # --- Execute Update ---
    if target_job:
        print(f"      🔄 Updating status for {target_job.company.name} to 'Refused'")
        target_job.application_status = "Refused"
        return True

    return False

# --- Core Logic & Endpoints (Same as before) ---

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
        if exists: continue

        subject = decode_mime_words(msg["Subject"])
        sender_full, sender_email = parse_email_address(msg["From"])
        try: received_dt = parsedate_to_datetime(msg["Date"])
        except: received_dt = datetime.now()

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
            is_read=True
        )
        session.add(new_email)
        if target_label == "Job fails":
            _auto_reconcile_job(session, new_email)
        synced_count += 1

    session.commit()
    mail.logout()
    return synced_count, 0

@gmail_bp.route("/sync", methods=["POST"])
def sync_emails_endpoint():
    session = get_db_session()
    try:
        data = request.get_json() or {}
        target_label = data.get("label", "Job fails")
        profile = session.query(Profile).first()
        if not profile: return jsonify({"error": "No profile"}), 400

        synced, _ = _perform_gmail_sync(session, profile, target_label)
        return jsonify({"message": f"Synced {synced} emails"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@gmail_bp.route("/reconcile-backlog", methods=["GET"])
def reconcile_backlog():
    session = get_db_session()
    try:
        emails = session.query(Email).filter(Email.folder == "Job fails").all()
        print(f"\n[Backlog] Processing {len(emails)} emails...")
        updated = 0
        for em in emails:
            if _auto_reconcile_job(session, em): updated += 1
        session.commit()
        return jsonify({"processed": len(emails), "updated": updated}), 200
    finally:
        session.close()

@gmail_bp.route("/", methods=["GET"])
def get_stored_emails():
    session = get_db_session()
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        folder_filter = request.args.get('folder', "Job fails")

        query = session.query(Email).filter(Email.folder == folder_filter)
        total = query.count()
        emails = query.order_by(desc(Email.received_at)).offset((page - 1) * limit).limit(limit).all()

        return jsonify({
            "data": [e.to_dict() for e in emails],
            "total": total,
            "page": page,
            "total_pages": (total + limit - 1) // limit
        }), 200
    finally:
        session.close()