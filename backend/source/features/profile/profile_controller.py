from flask import Blueprint, request, jsonify
from database.database_connection import get_db_session
from models.user_models import Profile

profile_bp = Blueprint("profiles", __name__, url_prefix="/profiles")


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
            education=data.get("education", []) # Add this line
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


@profile_bp.route("/search", methods=["GET"])
def search_profiles_by_name():
    session = get_db_session()
    try:
        name_query = request.args.get("name")
        if not name_query:
            return jsonify({"error": "Missing 'name' query parameter"}), 400

        # Case-insensitive search using ILIKE (if using PostgreSQL) or LIKE for others
        profiles = session.query(Profile).filter(Profile.name.ilike(f"%{name_query}%")).all()

        if not profiles:
            return jsonify({"message": "No profiles found matching the name"}), 404

        return jsonify([p.to_dict() for p in profiles]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()
