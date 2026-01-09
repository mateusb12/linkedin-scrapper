from flask import Blueprint, request, jsonify
from database.database_connection import get_db_session
from models import Resume
from models.user_models import Profile
from services.job_prompts import build_tailor_resume_prompt
from services.model_orchestrator import LLMOrchestrator

resume_bp = Blueprint("resumes", __name__, url_prefix="/resumes")

def extract_resume_data(data):
    """Helper to extract data from the specific JSON template structure"""
    profile_section = data.get("profile", {})

    return {
        "name": data.get("internal_name") or data.get("name"),
        "summary": data.get("summary"),
        "meta": data.get("meta"),

        # Flatten profile.contacts -> contact_info column
        "contact_info": profile_section.get("contacts", {}),

        "languages": data.get("languages", []),
        "hard_skills": data.get("skills", {}),
        "professional_experience": data.get("experience", []),
        "education": data.get("education", []),
        "projects": data.get("projects", []),
        "profile_id": data.get("profile_id")
    }

@resume_bp.route("/", methods=["POST"])
def create_resume():
    session = get_db_session()
    try:
        data = request.get_json()
        clean_data = extract_resume_data(data)

        if not clean_data["name"]:
            return jsonify({"error": "Resume name is required"}), 400

        resume = Resume(**clean_data)
        session.add(resume)
        session.commit()
        return jsonify(resume.to_dict()), 201
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@resume_bp.route("/<int:resume_id>", methods=["GET"])
def get_resume(resume_id):
    session = get_db_session()
    try:
        # Use joinedload if you want to be efficient, but lazy loading works too
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
    session = get_db_session()
    try:
        resumes = session.query(Resume).all()
        # The to_dict() logic in the model handles the merging now.
        result = [resume.to_dict() for resume in resumes]
        return jsonify(result), 200

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

        clean_data = extract_resume_data(data)

        # Update fields
        for key, value in clean_data.items():
            if key != "profile_id": # Don't typically change profile ownership on edit
                setattr(resume, key, value)

        session.commit()
        return jsonify(resume.to_dict()), 200
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
    data = request.get_json()

    # Validation
    required_params = ["raw_job_description", "raw_resume"]
    if not data or not all(param in data for param in required_params):
        return jsonify({"error": f"Request must include {required_params}"}), 400

    raw_job_description = data.get('raw_job_description')
    raw_resume = data.get('raw_resume')

    extracted_job_keywords = data.get('extracted_job_keywords', [])
    extracted_resume_keywords = data.get('extracted_resume_keywords', [])
    current_cosine_similarity = data.get('current_cosine_similarity', 0.0)

    try:
        orchestrator = LLMOrchestrator()
        prompt = build_tailor_resume_prompt(
            raw_job_description=raw_job_description,
            raw_resume=raw_resume,
            extracted_job_keywords=extracted_job_keywords,
            extracted_resume_keywords=extracted_resume_keywords,
            current_cosine_similarity=current_cosine_similarity
        )

        tailored_data = orchestrator.run_prompt(prompt)

        if 'error' in tailored_data:
            return jsonify(tailored_data), 502

        return jsonify(tailored_data), 200

    except Exception as e:
        print(f"Error in tailor_resume: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500