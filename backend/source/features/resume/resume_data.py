from flask import Blueprint, request, jsonify
from database.database_connection import get_db_session
from models import Resume
from models.user_models import Profile
from services.job_prompts import build_tailor_resume_prompt
from services.model_orchestrator import LLMOrchestrator

resume_bp = Blueprint("resumes", __name__, url_prefix="/resumes")

@resume_bp.route("/", methods=["POST"])
def create_resume():
    session = get_db_session()
    try:
        data = request.get_json()

        # 1. Determine Profile ID
        # If provided in JSON, use it. If not, try to find the first profile in DB.
        profile_id = data.get("profile_id")
        if not profile_id:
            first_profile = session.query(Profile).first()
            if first_profile:
                profile_id = first_profile.id

        # 2. Determine Name
        profile_data = data.get("profile", {})
        internal_name = data.get("internal_name") or profile_data.get("name") or "Novo Currículo"

        # 3. Create Resume
        # Note: We purposely might pass 'None' for fields like contact_info if we want
        # to inherit from the profile dynamically.
        resume = Resume(
            name=internal_name,
            meta=data.get("meta", {}),
            contact_info=profile_data.get("contacts", None), # Pass None to allow fallback to Profile

            professional_experience=data.get("experience", []),
            education=data.get("education", []),
            projects=data.get("projects", []),
            hard_skills=data.get("skills", {}),
            languages=data.get("languages", []),

            profile_id=profile_id
        )

        session.add(resume)
        session.commit()

        # Return to_dict() which now contains the merged data (Profile + Resume)
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

        # Update Logic
        # If the frontend sends specific data, we save it to the Resume (overriding Profile).
        # If the frontend sends null/empty, we save it as such (and to_dict will fallback).

        if "meta" in data: resume.meta = data["meta"]
        if "internal_name" in data: resume.name = data["internal_name"]

        if "profile" in data:
            profile_section = data["profile"]
            if "name" in profile_section: resume.name = profile_section["name"]
            if "contacts" in profile_section: resume.contact_info = profile_section["contacts"]

        if "experience" in data: resume.professional_experience = data["experience"]
        if "education" in data: resume.education = data["education"]
        if "projects" in data: resume.projects = data["projects"]
        if "skills" in data: resume.hard_skills = data["skills"]
        if "languages" in data: resume.languages = data["languages"]

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