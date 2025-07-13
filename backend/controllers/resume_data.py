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


@resume_bp.route("/<int:resume_id>", methods=["GET"])
def get_resume(resume_id):
    session = get_db_session()
    try:
        resume = session.query(Resume).filter_by(id=resume_id).first()
        if not resume:
            return jsonify({"error": "Resume not found"}), 404

        return jsonify(resume.to_dict()), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        session.close()


@resume_bp.route("/<int:resume_id>", methods=["PUT"])
def update_resume(resume_id):
    session = get_db_session()
    try:
        data = request.get_json()

        resume = session.query(Resume).filter_by(id=resume_id).first()
        if not resume:
            return jsonify({"error": "Resume not found"}), 404

        resume.hard_skills = data.get("hard_skills", resume.hard_skills)
        resume.professional_experience = data.get("professional_experience", resume.professional_experience)
        resume.education = data.get("education", resume.education)

        session.commit()

        return jsonify({"message": "Resume updated"}), 200

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        session.close()


@resume_bp.route("/<int:resume_id>", methods=["DELETE"])
def delete_resume(resume_id):
    session = get_db_session()
    try:
        resume = session.query(Resume).filter_by(id=resume_id).first()
        if not resume:
            return jsonify({"error": "Resume not found"}), 404

        session.delete(resume)
        session.commit()

        return jsonify({"message": "Resume deleted"}), 200

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        session.close()
