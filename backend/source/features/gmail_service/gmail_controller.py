import imaplib
import email
import json
from email.header import decode_header
from email.utils import parsedate_to_datetime
from datetime import datetime
from flask import Blueprint, jsonify, request
from sqlalchemy import desc

from database.database_connection import get_db_session
from models.user_models import Profile
from models.email_models import Email  # Import the new generic model

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
            # Prioritize plain text, skip attachments
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
    """Returns (Full String, Email Only)"""
    # e.g. "Google <no-reply@google.com>" -> ("Google <no-reply@google.com>", "no-reply@google.com")
    if not raw_header: return "", ""
    clean_header = decode_mime_words(raw_header)
    email_only = clean_header
    if "<" in clean_header and ">" in clean_header:
        email_only = clean_header.split("<")[-1].strip(">")
    return clean_header, email_only

# --- Endpoints ---

@gmail_bp.route("/sync", methods=["POST"])
def sync_emails():
    """
    Generic Sync.
    Body: { "label": "Job fails" } or { "label": "Sent" }
    """
    session = get_db_session()
    try:
        data = request.get_json() or {}
        target_label = data.get("label", "Job fails")  # Default to failures

        profile = session.query(Profile).first()
        if not profile or not profile.email or not profile.email_app_password:
            return jsonify({"error": "Credentials missing"}), 400

        # 1. Connect
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(profile.email, profile.email_app_password)

        # Quote label to handle spaces
        status, _ = mail.select(f'"{target_label}"')
        if status != "OK":
            return jsonify({"error": f"Label '{target_label}' not found in Gmail"}), 404

        # 2. Fetch All IDs
        _, search_data = mail.search(None, "ALL")
        email_ids = search_data[0].split()

        synced_count = 0

        # 3. Iterate
        for e_id in email_ids:
            # optimize: fetch headers only first to check existence?
            # For now, fetching RFC822 is safer to get Message-ID reliably
            _, msg_data = mail.fetch(e_id, "(RFC822)")
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)

            msg_id = msg.get("Message-ID", "").strip()

            # Idempotency Check: Don't save if we already have it
            exists = session.query(Email).filter_by(message_id=msg_id).first()
            if exists:
                continue

            # Parse
            subject = decode_mime_words(msg["Subject"])
            sender_full, sender_email = parse_email_address(msg["From"])

            # Date
            try:
                received_dt = parsedate_to_datetime(msg["Date"])
            except:
                received_dt = datetime.now()

            # Content
            full_body = get_body_text(msg)
            snippet = " ".join(full_body.split())[:120] + "..."

            # Raw Headers (for max details)
            headers_dict = dict(msg.items())

            new_email = Email(
                profile_id=profile.id,
                message_id=msg_id,
                thread_id=msg.get("X-GM-THRID") or msg.get("Thread-Topic"), # Attempt to get thread ID
                folder=target_label,
                category="rejection" if target_label == "Job fails" else "general", # logic can be expanded
                subject=subject,
                sender=sender_full,
                sender_email=sender_email,
                recipient=decode_mime_words(msg["To"]),
                body_text=full_body,
                snippet=snippet,
                received_at=received_dt,
                created_at=datetime.now(),
                headers_json=headers_dict, # Saving all SMTP headers
                is_read=True
            )
            session.add(new_email)
            synced_count += 1

        session.commit()
        mail.logout()
        return jsonify({"message": f"Synced {synced_count} emails from '{target_label}'"}), 200

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@gmail_bp.route("/", methods=["GET"])
def get_stored_emails():
    """
    Get emails from DB with optional filtering.
    Query Params: page=1, limit=10, folder="Job fails"
    """
    session = get_db_session()
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    folder_filter = request.args.get('folder', None) # e.g.,