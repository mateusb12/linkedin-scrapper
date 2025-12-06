import imaplib
import email
from email.header import decode_header
from email.utils import parsedate_to_datetime
from datetime import datetime
from flask import Blueprint, jsonify, request
from sqlalchemy import desc

from database.database_connection import get_db_session
from models.user_models import Profile
from models.email_models import Email

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

# --- Core Logic (Reusable) ---

def _perform_gmail_sync(session, profile, target_label):
    """
    Reusable sync logic. Returns (synced_count, skipped_count).
    """
    print(f"[DEBUG] Connecting to IMAP for label: '{target_label}'...")

    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(profile.email, profile.email_app_password)

    status, _ = mail.select(f'"{target_label}"')
    if status != "OK":
        mail.logout()
        raise ValueError(f"Label '{target_label}' not found in Gmail")

    # Fetch All IDs
    _, search_data = mail.search(None, "ALL")
    email_ids = search_data[0].split()

    print(f"[DEBUG] Gmail Server found {len(email_ids)} emails.")

    synced_count = 0
    skipped_count = 0

    # Process newest first
    email_ids.reverse()

    for e_id in email_ids:
        # Optimization: Fetch headers only first to check Message-ID?
        # For now, we stick to RFC822 for robustness.
        _, msg_data = mail.fetch(e_id, "(RFC822)")
        raw_email = msg_data[0][1]
        msg = email.message_from_bytes(raw_email)

        msg_id = msg.get("Message-ID", "").strip()

        # Idempotency Check
        exists = session.query(Email).filter_by(message_id=msg_id).first()
        if exists:
            skipped_count += 1
            continue

        # Parse Content
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
        synced_count += 1

    session.commit()
    mail.logout()
    return synced_count, skipped_count

# --- Endpoints ---

@gmail_bp.route("/sync", methods=["POST"])
def sync_emails_endpoint():
    """
    Manual Sync Trigger.
    """
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


@gmail_bp.route("/", methods=["GET"])
def get_stored_emails():
    """
    Get emails from DB.
    Auto-triggers sync if 0 emails are found for the requested folder.
    """
    session = get_db_session()
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        folder_filter = request.args.get('folder', "Job fails")

        # 1. Build Query
        query = session.query(Email)
        if folder_filter:
            query = query.filter(Email.folder == folder_filter)

        total = query.count()
        print(f"[DEBUG] Initial DB Count: {total}")

        # 2. AUTO-SYNC LOGIC
        if total == 0:
            print(f"[DEBUG] 0 emails found for '{folder_filter}'. Auto-triggering Sync...")
            profile = session.query(Profile).first()

            if profile and profile.email and profile.email_app_password:
                try:
                    synced, _ = _perform_gmail_sync(session, profile, folder_filter)
                    print(f"[DEBUG] Auto-Sync finished. Found {synced} new emails.")
                    # Re-run query count after sync
                    # Query object needs to be rebuilt or re-executed?
                    # Safer to just re-filter
                    total = session.query(Email).filter(Email.folder == folder_filter).count()
                except Exception as sync_err:
                    print(f"[DEBUG] Auto-sync failed: {sync_err}")
            else:
                print("[DEBUG] Cannot auto-sync: Credentials missing.")

        # 3. Fetch Data
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