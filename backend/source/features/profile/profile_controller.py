# backend/source/features/profile/profile_controller.py

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Blueprint, request, jsonify
from database.database_connection import get_db_session
from models.user_models import Profile

profile_bp = Blueprint("profiles", __name__, url_prefix="/profiles")

# --- CRUD Operations ---

@profile_bp.route("/", methods=["POST"])
def create_profile():
    session = get_db_session()
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing JSON body"}), 400

        profile = Profile(
            name=data.get("name", "Unnamed Profile"),
            email=data.get("email"),
            phone=data.get("phone"),
            location=data.get("location"),
            linkedin=data.get("linkedin"),
            github=data.get("github"),
            portfolio=data.get("portfolio"),
            languages=data.get("languages", []),
            positive_keywords=data.get("positive_keywords", []),
            negative_keywords=data.get("negative_keywords", []),
            education=data.get("education", [])
        )

        session.add(profile)
        session.commit()
        return jsonify({"message": "Profile created", "id": profile.id}), 201

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@profile_bp.route("/", methods=["GET"])
def get_all_profiles():
    session = get_db_session()
    try:
        profiles = session.query(Profile).all()
        return jsonify([p.to_dict() for p in profiles]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@profile_bp.route("/<int:profile_id>", methods=["GET"])
def get_profile(profile_id):
    session = get_db_session()
    try:
        profile = session.query(Profile).filter_by(id=profile_id).first()
        if not profile:
            return jsonify({"error": "Profile not found"}), 404
        return jsonify(profile.to_dict()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@profile_bp.route("/<int:profile_id>", methods=["PUT"])
def update_profile(profile_id):
    session = get_db_session()
    try:
        data = request.get_json()
        profile = session.query(Profile).filter_by(id=profile_id).first()
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        profile.name = data.get("name", profile.name)
        profile.email = data.get("email", profile.email)
        profile.phone = data.get("phone", profile.phone)
        profile.location = data.get("location", profile.location)
        profile.linkedin = data.get("linkedin", profile.linkedin)
        profile.github = data.get("github", profile.github)
        profile.portfolio = data.get("portfolio", profile.portfolio)
        profile.languages = data.get("languages", profile.languages)
        profile.positive_keywords = data.get("positive_keywords", profile.positive_keywords)
        profile.negative_keywords = data.get("negative_keywords", profile.negative_keywords)
        profile.education = data.get("education", profile.education)

        session.commit()
        return jsonify({"message": f"Profile {profile_id} updated successfully"}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@profile_bp.route("/<int:profile_id>", methods=["DELETE"])
def delete_profile(profile_id):
    session = get_db_session()
    try:
        profile = session.query(Profile).filter_by(id=profile_id).first()
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        session.delete(profile)
        session.commit()
        return jsonify({"message": "Profile deleted successfully"}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


# --- Special Features ---

@profile_bp.route("/<int:profile_id>/smtp-password", methods=["PATCH"])
def update_smtp_password(profile_id):
    session = get_db_session()
    try:
        data = request.get_json()
        if not data or "email_app_password" not in data:
            return jsonify({"error": "Missing 'email_app_password' in request body"}), 400

        profile = session.query(Profile).filter_by(id=profile_id).first()
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        # Update only the SMTP password
        profile.email_app_password = data["email_app_password"]

        session.commit()
        return jsonify({"message": "SMTP password updated successfully"}), 200

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@profile_bp.route("/<int:profile_id>/test-smtp", methods=["POST"])
def test_smtp_connection(profile_id):
    """
    Tries to send a test email to the user's own email address 
    using the credentials stored in the DB.
    """
    session = get_db_session()
    try:
        profile = session.query(Profile).filter_by(id=profile_id).first()

        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        if not profile.email or not profile.email_app_password:
            return jsonify({"error": "Missing email or App Password. Please configure them first."}), 400

        sender_email = profile.email
        receiver_email = profile.email # Send to self
        password = profile.email_app_password

        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = "Test Email from Job Matcher"
        message["From"] = sender_email
        message["To"] = receiver_email

        text = "Congratulations! Your Gmail SMTP integration is working correctly."
        part1 = MIMEText(text, "plain")
        message.attach(part1)

        # Connect to Gmail SMTP
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(sender_email, password)
            server.sendmail(sender_email, receiver_email, message.as_string())

        return jsonify({"message": "Test email sent successfully! Check your inbox."}), 200

    except smtplib.SMTPAuthenticationError:
        return jsonify({"error": "Authentication failed. Check your App Password."}), 401
    except Exception as e:
        return jsonify({"error": f"SMTP Error: {str(e)}"}), 500
    finally:
        session.close()