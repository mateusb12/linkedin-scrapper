import imaplib
import email
from email.header import decode_header
from email.utils import parsedate_to_datetime
from datetime import datetime
from flask import Blueprint, jsonify, request
from database.database_connection import get_db_session
from models.user_models import Profile

gmail_bp = Blueprint("gmail", __name__, url_prefix="/emails")

def decode_mime_words(s):
    """
    Decodes MIME-encoded headers (e.g., '=?utf-8?q?...?=') into a readable string.
    """
    if not s:
        return ""

    decoded_list = decode_header(s)
    text_parts = []

    for content, encoding in decoded_list:
        if isinstance(content, bytes):
            if encoding:
                try:
                    text_parts.append(content.decode(encoding))
                except LookupError:
                    # Fallback if encoding is unknown
                    text_parts.append(content.decode('utf-8', errors='ignore'))
            else:
                # Assume utf-8 if no encoding specified
                text_parts.append(content.decode('utf-8', errors='ignore'))
        else:
            text_parts.append(str(content))

    return "".join(text_parts)

def get_body_snippet(msg):
    """
    Extracts a short text snippet from the email body (preferring plain text).
    """
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))

            # Look for text/plain and skip attachments
            if content_type == "text/plain" and "attachment" not in content_disposition:
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode(errors='ignore')
                        break
                except:
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode(errors='ignore')
        except:
            pass

    if not body:
        return "No content preview available."

    # clean whitespace and truncate
    clean_body = " ".join(body.split())
    return clean_body[:120] + "..." if len(clean_body) > 120 else clean_body

@gmail_bp.route("/failures", methods=["GET"])
def get_job_failures():
    """
    Connects to Gmail via IMAP, selects the 'Job fails' label,
    and returns paginated emails formatted for the UI.
    """
    session = get_db_session()

    # Pagination parameters
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))

    try:
        # 1. Retrieve Credentials from Profile
        profile = session.query(Profile).first()
        if not profile or not profile.email or not profile.email_app_password:
            return jsonify({
                "error": "Gmail credentials not configured. Please add your Email and App Password in settings."
            }), 400

        user_email = profile.email
        password = profile.email_app_password

        # 2. Connect to Gmail IMAP
        # Using a context manager ensures connection is closed if errors occur
        mail = imaplib.IMAP4_SSL("imap.gmail.com")

        try:
            mail.login(user_email, password)
        except imaplib.IMAP4.error:
            return jsonify({"error": "Failed to login to Gmail. Check your App Password."}), 401

        # 3. Select the 'Job fails' Label
        # Quotes are required if the label name has spaces
        status, _ = mail.select('"Job fails"')

        if status != "OK":
            return jsonify({
                "error": "Label 'Job fails' not found. Please create this label in Gmail and tag your rejection emails."
            }), 404

        # 4. Search for all emails in this label
        status, search_data = mail.search(None, "ALL")
        if status != "OK" or not search_data[0]:
            # No emails found
            mail.logout()
            return jsonify({
                "data": [], "total": 0, "page": page, "total_pages": 0
            }), 200

        # IDs come as a byte string list e.g. [b'1 2 3']
        all_email_ids = search_data[0].split()
        total_emails = len(all_email_ids)

        # Reverse to show newest first
        all_email_ids.reverse()

        # 5. Apply Pagination
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paged_ids = all_email_ids[start_idx:end_idx]

        results = []

        # 6. Fetch details for the specific page
        for e_id in paged_ids:
            # Fetch the email headers and body (RFC822)
            _, msg_data = mail.fetch(e_id, "(RFC822)")

            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])

                    # -- Parse Headers --
                    subject = decode_mime_words(msg["Subject"])
                    from_header = decode_mime_words(msg["From"])
                    date_header = msg["Date"]

                    # Separate Name and Email (e.g., "Google <noreply@google.com>")
                    sender_name = from_header
                    sender_email = from_header
                    if "<" in from_header and ">" in from_header:
                        parts = from_header.split("<")
                        sender_name = parts[0].strip().strip('"')
                        sender_email = parts[1].strip(">")

                    # Parse Date
                    try:
                        dt = parsedate_to_datetime(date_header)
                        iso_date = dt.isoformat()
                    except:
                        iso_date = datetime.now().isoformat()

                    # -- Get Snippet --
                    snippet = get_body_snippet(msg)

                    results.append({
                        "id": int(e_id),
                        "sender": sender_name,
                        "sender_email": sender_email,
                        "subject": subject,
                        "snippet": snippet,
                        "receivedAt": iso_date,
                        "isRead": True # IMAP doesn't strictly track 'read' state unless we check \Seen flag
                    })

        mail.close()
        mail.logout()

        return jsonify({
            "data": results,
            "total": total_emails,
            "page": page,
            "total_pages": (total_emails + limit - 1) // limit
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()