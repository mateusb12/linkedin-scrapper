from flask import Blueprint, request, jsonify

from database.database_connection import get_db_session
from models import Resume

resume_bp = Blueprint("resumes", __name__, url_prefix="/jobs")


@resume_bp.route("/", methods=["POST"])
def create_resume():
    session = get_db_session()
    try:
        data = request.get_json()

        name = data.get("name")
        if not name:
            return jsonify({"error": "Resume name is required"}), 400

        resume = Resume(
            name=name,
            hard_skills=data.get("hard_skills", []),
            professional_experience=data.get("professional_experience", []),
            education=data.get("education", [])
        )

        session.add(resume)
        session.commit()

        return jsonify({"message": "Resume created", "id": resume.id, "name": resume.name}), 201

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        session.close()


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


@resume_bp.route("/", methods=["GET"])
def get_all_resumes():
    """
    Fetches all resumes with their IDs and names.
    This replaces the old '/ids' endpoint for better frontend integration.
    """
    session = get_db_session()
    try:
        resumes = session.query(Resume.id, Resume.name).all()
        resume_list = [{"id": r_id, "name": r_name} for r_id, r_name in resumes]
        return jsonify(resume_list), 200

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

        # Update fields if they are present in the request
        resume.name = data.get("name", resume.name)
        resume.hard_skills = data.get("hard_skills", resume.hard_skills)
        resume.professional_experience = data.get("professional_experience", resume.professional_experience)
        resume.education = data.get("education", resume.education)

        session.commit()

        return jsonify({"message": f"Resume '{resume.name}' updated successfully"}), 200

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

        return jsonify({"message": "Resume deleted successfully"}), 200

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        session.close()