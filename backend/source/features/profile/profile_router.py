"""
profiles_router.py - Routing and Swagger documentation layer.

Imports controller logic and defines routes with Flasgger (Swagger 2.0)
specifications via docstrings.
"""

from flask import Blueprint

from source.features.profile.profile_controller import (
    create_profile,
    get_all_profiles,
    get_profile,
    update_profile,
    delete_profile,
    update_smtp_password,
    test_smtp_connection,
)

profile_bp = Blueprint("profiles", __name__, url_prefix="/profiles")


@profile_bp.route("/", methods=["POST"])
def create_profile_route():
    """
    Creates a new profile record.
    ---
    tags:
      - Profiles
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email
          properties:
            name:
              type: string
            email:
              type: string
            phone:
              type: string
            location:
              type: string
            linkedin:
              type: string
            github:
              type: string
            portfolio:
              type: string
            languages:
              type: array
              items:
                type: string
            positive_keywords:
              type: array
              items:
                type: string
            negative_keywords:
              type: array
              items:
                type: string
            education:
              type: array
              items:
                type: object
        examples:
          application/json:
            name: "Mateus Bessa Mauricio"
            email: "mateus@example.com"
            phone: "5585999999999"
            location: "Fortaleza, Brazil"
            linkedin: "https://www.linkedin.com/in/mateus-bessa-m/"
            github: "https://github.com/mateusb12/"
            portfolio: "https://mateusb12.dev"
            languages:
              - "Portuguese"
            positive_keywords:
              - "Python"
            negative_keywords:
              - "On-site only"
            education:
              - school: "Federal University of Ceara"
                degree: "Computer Science"
    responses:
      201:
        description: Profile created successfully.
        schema:
          type: object
          properties:
            message:
              type: string
            id:
              type: integer
        examples:
          application/json:
            message: "Profile created"
            id: 2
      400:
        description: Missing JSON body.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Missing JSON body"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "UNIQUE constraint failed: profile.email"
    """
    return create_profile()


@profile_bp.route("/", methods=["GET"])
def get_all_profiles_route():
    """
    Returns all saved profiles.
    ---
    tags:
      - Profiles
    responses:
      200:
        description: List of profiles.
        schema:
          type: array
          items:
            type: object
            properties:
              id:
                type: integer
              name:
                type: string
              email:
                type: string
              phone:
                type: string
              location:
                type: string
              linkedin:
                type: string
              github:
                type: string
              portfolio:
                type: string
              languages:
                type: array
                items:
                  type: string
              positive_keywords:
                type: array
                items:
                  type: string
              negative_keywords:
                type: array
                items:
                  type: string
              education:
                type: array
                items:
                  type: object
              resumes:
                type: array
                items:
                  type: string
              email_app_password:
                type: string
        examples:
          application/json:
            - id: 1
              name: "Mateus Bessa Mauricio"
              email: "mateus@example.com"
              phone: "5585999999999"
              location: "Fortaleza, Brazil"
              linkedin: "https://www.linkedin.com/in/mateus-bessa-m/"
              github: "https://github.com/mateusb12/"
              portfolio: "https://mateusb12.dev"
              languages:
                - "Portuguese"
              positive_keywords:
                - "Python"
              negative_keywords:
                - "On-site only"
              education: []
              resumes:
                - "Backend Resume"
              email_app_password: "abcd efgh ijkl mnop"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "database unavailable"
    """
    return get_all_profiles()


@profile_bp.route("/<int:profile_id>", methods=["GET"])
def get_profile_route(profile_id):
    """
    Returns a single profile by ID.
    ---
    tags:
      - Profiles
    parameters:
      - name: profile_id
        in: path
        type: integer
        required: true
        description: Profile ID.
    responses:
      200:
        description: Profile found.
        schema:
          type: object
          properties:
            id:
              type: integer
            name:
              type: string
            email:
              type: string
            phone:
              type: string
            location:
              type: string
            linkedin:
              type: string
            github:
              type: string
            portfolio:
              type: string
            languages:
              type: array
              items:
                type: string
            positive_keywords:
              type: array
              items:
                type: string
            negative_keywords:
              type: array
              items:
                type: string
            education:
              type: array
              items:
                type: object
            resumes:
              type: array
              items:
                type: string
            email_app_password:
              type: string
        examples:
          application/json:
            id: 1
            name: "Mateus Bessa Mauricio"
            email: "mateus@example.com"
            phone: "5585999999999"
            location: "Fortaleza, Brazil"
            linkedin: "https://www.linkedin.com/in/mateus-bessa-m/"
            github: "https://github.com/mateusb12/"
            portfolio: "https://mateusb12.dev"
            languages:
              - "Portuguese"
            positive_keywords:
              - "Python"
            negative_keywords:
              - "On-site only"
            education: []
            resumes: []
            email_app_password: "abcd efgh ijkl mnop"
      404:
        description: Profile not found.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Profile not found"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "database unavailable"
    """
    return get_profile(profile_id)


@profile_bp.route("/<int:profile_id>", methods=["PUT"])
def update_profile_route(profile_id):
    """
    Updates an existing profile.
    ---
    tags:
      - Profiles
    parameters:
      - name: profile_id
        in: path
        type: integer
        required: true
        description: Profile ID.
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name:
              type: string
            email:
              type: string
            phone:
              type: string
            location:
              type: string
            linkedin:
              type: string
            github:
              type: string
            portfolio:
              type: string
            languages:
              type: array
              items:
                type: string
            positive_keywords:
              type: array
              items:
                type: string
            negative_keywords:
              type: array
              items:
                type: string
            education:
              type: array
              items:
                type: object
        examples:
          application/json:
            location: "Remote"
            positive_keywords:
              - "Flask"
    responses:
      200:
        description: Profile updated successfully.
        schema:
          type: object
          properties:
            message:
              type: string
        examples:
          application/json:
            message: "Profile 1 updated successfully"
      404:
        description: Profile not found.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Profile not found"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "'NoneType' object has no attribute 'get'"
    """
    return update_profile(profile_id)


@profile_bp.route("/<int:profile_id>", methods=["DELETE"])
def delete_profile_route(profile_id):
    """
    Deletes a profile.
    ---
    tags:
      - Profiles
    parameters:
      - name: profile_id
        in: path
        type: integer
        required: true
        description: Profile ID.
    responses:
      200:
        description: Profile deleted successfully.
        schema:
          type: object
          properties:
            message:
              type: string
        examples:
          application/json:
            message: "Profile deleted successfully"
      404:
        description: Profile not found.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Profile not found"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "database unavailable"
    """
    return delete_profile(profile_id)


@profile_bp.route("/<int:profile_id>/smtp-password", methods=["PATCH"])
def update_smtp_password_route(profile_id):
    """
    Updates only the SMTP app password for a profile.
    ---
    tags:
      - Profiles
    parameters:
      - name: profile_id
        in: path
        type: integer
        required: true
        description: Profile ID.
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email_app_password
          properties:
            email_app_password:
              type: string
        examples:
          application/json:
            email_app_password: "abcd efgh ijkl mnop"
    responses:
      200:
        description: SMTP password updated successfully.
        schema:
          type: object
          properties:
            message:
              type: string
        examples:
          application/json:
            message: "SMTP password updated successfully"
      400:
        description: Missing required field.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Missing 'email_app_password' in request body"
      404:
        description: Profile not found.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Profile not found"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "database unavailable"
    """
    return update_smtp_password(profile_id)


@profile_bp.route("/<int:profile_id>/test-smtp", methods=["POST"])
def test_smtp_connection_route(profile_id):
    """
    Sends a test email using the profile's stored SMTP credentials.
    ---
    tags:
      - Profiles
    parameters:
      - name: profile_id
        in: path
        type: integer
        required: true
        description: Profile ID.
    responses:
      200:
        description: Test email sent successfully.
        schema:
          type: object
          properties:
            message:
              type: string
        examples:
          application/json:
            message: "Test email sent successfully! Check your inbox."
      400:
        description: Missing email or app password.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Missing email or App Password. Please configure them first."
      401:
        description: SMTP authentication failed.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Authentication failed. Check your App Password."
      404:
        description: Profile not found.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Profile not found"
      500:
        description: SMTP or server error.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "SMTP Error: [Errno 101] Network is unreachable"
    """
    return test_smtp_connection(profile_id)
