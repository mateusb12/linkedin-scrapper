from flask import Blueprint, request, jsonify

from database.database_connection import get_db_session
from models import Resume

resume_bp = Blueprint("resumes", __name__, url_prefix="/jobs")


@resume_bp.route("/", methods=["POST"])
def create_resume():
    session = get_db_session()
    try:
        data = request.get_json()

        resume = Resume(
            hard_skills=data.get("hard_skills", []),
            professional_experience=data.get("professional_experience", []),
            education=data.get("education", [])
        )

        session.add(resume)
        session.commit()

        return jsonify({"message": "Resume saved", "id": resume.id}), 201

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
