import imaplib
import email
import re  # <--- Added for Regex
from email.header import decode_header
from email.utils import parsedate_to_datetime
from datetime import datetime
from flask import Blueprint, jsonify, request
from sqlalchemy import desc

from database.database_connection import get_db_session
from models.user_models import Profile
from models.email_models import Email
from models.job_models import Job, Company # <--- Added for Job linking

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

# --- Reconciliation Logic (The Fix) ---

def _auto_reconcile_job(session, email_obj):
    """
    Robustly links rejection emails to jobs using fuzzy matching with DEEP DEBUGGING.
    """
    subject = email_obj.subject or ""
    print(f"\n[Status Sync] Processing Email Subject: '{subject}'")

    # 1. Improved Regex: Handles newlines (DOTALL) and varied formats
    match = re.search(r"application to (.+?) at (.+)", subject, re.IGNORECASE | re.DOTALL)

    if not match:
        print(f"   -> ❌ Regex match FAILED for subject: '{subject}'")
        return False

    role_name = match.group(1).strip()
    company_name_raw = match.group(2).strip()

    # Clean up company name (remove trailing punctuation/newlines often found in emails)
    # Example: "PDtec | Uma\n empresa B3" -> "PDtec"
    company_name = company_name_raw.split('|')[0].split('(')[0].split('\n')[0].strip()

    print(f"   -> Extracted Role: '{role_name}'")
    print(f"   -> Extracted Company: '{company_name}'")

    # 2. Strategy A: Direct Search
    print(f"   -> Strategy A: Searching DB for exact company match: '%{company_name}%'...")
    target_job = session.query(Job).join(Company).filter(
        Company.name.ilike(f"%{company_name}%"),
        Job.application_status != 'Refused'
    ).first()

    if target_job:
        print(f"      ✅ EXACT MATCH FOUND! Job URN: {target_job.urn}")
    else:
        print(f"      ⚠️ No exact match. Trying fuzzy search...")

        # 3. Strategy B: The "First Word" Fallback
        if " " in company_name:
            first_word = company_name.split(' ')[0]
            if len(first_word) > 2: # Safety check
                print(f"   -> Strategy B: Fuzzy searching for first word: '%{first_word}%' with role '%{role_name[:10]}%'...")

                target_job = session.query(Job).join(Company).filter(
                    Company.name.ilike(f"%{first_word}%"),
                    # We add title check to ensure we don't match a different job at a similar company name
                    Job.title.ilike(f"%{role_name[:15]}%"),
                    Job.application_status != 'Refused'
                ).first()

                if target_job:
                    print(f"      ✅ FUZZY MATCH FOUND! Job URN: {target_job.urn}")
                else:
                    print(f"      ❌ Fuzzy match failed.")
            else:
                print(f"      ⚠️ First word '{first_word}' too short for fuzzy search.")
        else:
            print(f"      ℹ️ Company name '{company_name}' is single word, skipping fuzzy split.")

    # 4. Execute Update
    if target_job:
        print(f"   -> 🔄 Updating status for {target_job.company.name} from '{target_job.application_status}' to 'Refused'")
        target_job.application_status = "Refused"
        return True

    print(f"   -> 🛑 FINAL RESULT: No matching active job found for '{company_name}'.")
    return False

# --- Core Logic (Reusable) ---

def _perform_gmail_sync(session, profile, target_label):
    print(f"[DEBUG] Connecting to IMAP for label: '{target_label}'...")

    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(profile.email, profile.email_app_password)

    status, _ = mail.select(f'"{target_label}"')
    if status != "OK":
        mail.logout()
        raise ValueError(f"Label '{target_label}' not found in Gmail")

    _, search_data = mail.search(None, "ALL")
    email_ids = search_data[0].split()

    print(f"[DEBUG] Gmail Server found {len(email_ids)} emails.")

    synced_count = 0
    skipped_count = 0

    email_ids.reverse()

    for e_id in email_ids:
        _, msg_data = mail.fetch(e_id, "(RFC822)")
        raw_email = msg_data[0][1]
        msg = email.message_from_bytes(raw_email)
        msg_id = msg.get("Message-ID", "").strip()

        exists = session.query(Email).filter_by(message_id=msg_id).first()
        if exists:
            skipped_count += 1
            continue

        subject = decode_mime_words(msg["Subject"])
        sender_full, sender_email = parse_email_address(msg["From"])

        try:
            received_dt = parsedate_to_datetime(msg["Date"])
        except:
            received_dt = datetime.now()

        full_body = get_body_text(msg)
        snippet = " ".join(full_body.split())[:120] + "..."
        headers_dict = dict(msg.items())

        new_email = Email(
            profile_id=profile.id,
            message_id=msg_id,
            thread_id=msg.get("X-GM-THRID") or msg.get("Thread-Topic"),
            folder=target_label,
            category="rejection" if target_label == "Job fails" else "general",
            subject=subject,
            sender=sender_full,
            sender_email=sender_email,
            recipient=decode_mime_words(msg["To"]),
            body_text=full_body,
            snippet=snippet,
            received_at=received_dt,
            created_at=datetime.now(),
            headers_json=headers_dict,
            is_read=True
        )
        session.add(new_email)

        # Trigger reconciliation on NEW emails
        if target_label == "Job fails":
            _auto_reconcile_job(session, new_email)

        synced_count += 1

    session.commit()
    mail.logout()
    return synced_count, skipped_count

# --- Endpoints ---

@gmail_bp.route("/sync", methods=["POST"])
def sync_emails_endpoint():
    session = get_db_session()
    try:
        data = request.get_json() or {}
        target_label = data.get("label", "Job fails")

        profile = session.query(Profile).first()
        if not profile or not profile.email or not profile.email_app_password:
            return jsonify({"error": "Credentials missing"}), 400

        synced, skipped = _perform_gmail_sync(session, profile, target_label)

        return jsonify({"message": f"Synced {synced} new emails from '{target_label}'"}), 200

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

# 🔥 NEW ENDPOINT TO FORCE UPDATE ON EXISTING EMAILS 🔥
@gmail_bp.route("/reconcile-backlog", methods=["GET"])
def reconcile_backlog():
    session = get_db_session()
    try:
        # Fetch all rejection emails
        emails = session.query(Email).filter(Email.folder == "Job fails").all()
        print(f"\n[Backlog] Found {len(emails)} rejection emails to process.")

        updated_count = 0
        for em in emails:
            if _auto_reconcile_job(session, em):
                updated_count += 1

        session.commit()
        return jsonify({
            "message": f"Processed {len(emails)} emails.",
            "jobs_updated": updated_count
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@gmail_bp.route("/", methods=["GET"])
def get_stored_emails():
    session = get_db_session()
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        folder_filter = request.args.get('folder', "Job fails")

        query = session.query(Email)
        if folder_filter:
            query = query.filter(Email.folder == folder_filter)

        total = query.count()

        if total == 0:
            profile = session.query(Profile).first()
            if profile and profile.email and profile.email_app_password:
                try:
                    synced, _ = _perform_gmail_sync(session, profile, folder_filter)
                    total = session.query(Email).filter(Email.folder == folder_filter).count()
                except Exception: pass

        emails = query.order_by(desc(Email.received_at)).offset((page - 1) * limit).limit(limit).all()

        return jsonify({
            "data": [e.to_dict() for e in emails],
            "total": total,
            "page": page,
            "total_pages": (total + limit - 1) // limit
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()