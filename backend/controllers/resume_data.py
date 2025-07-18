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
    Fetches all resumes with full details (id, name, hard_skills, experience, education).
    """
    session = get_db_session()
    try:
        resumes = session.query(Resume).all()
        resume_list = [resume.to_dict() for resume in resumes]
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


@resume_bp.route("/tailor", methods=["POST"])
def tailor_resume_endpoint():
    """
    Receives resume markdown and a job description, then uses the Gemini
    service to return a tailored JSON representation of the resume.
    """
    # 1. Get and validate the request data
    data = request.get_json()
    if not data or 'resume_markdown' not in data or 'job_description' not in data:
        return jsonify({"error": "Request must include 'resume_markdown' and 'job_description'"}), 400

    resume_markdown = data.get('resume_markdown')
    job_description = data.get('job_description')

    # 2. Call the AI service to tailor the resume
    try:
        tailored_data = tailor_resume_for_job(
            resume_markdown=resume_markdown,
            job_description=job_description
        )

        if 'error' in tailored_data:
            # The service layer encountered an issue (e.g., API or parsing error)
            # 502 Bad Gateway is an appropriate status for an upstream error.
            return jsonify(tailored_data), 502

        # 3. Return the successfully tailored data from the service
        return jsonify(tailored_data), 200

    except Exception as e:
        # Catch any other unexpected errors
        print(f"An unexpected error occurred in the tailor_resume endpoint: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500
