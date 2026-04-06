"""
resume_router.py - Routing and Swagger documentation layer.

Imports controller logic and defines routes with Flasgger (Swagger 2.0)
specifications via docstrings.
"""

from flask import Blueprint

from source.features.resume.resume_data import (
    create_resume,
    get_resume,
    get_all_resumes,
    update_resume,
    delete_resume,
    tailor_resume_endpoint,
)

resume_bp = Blueprint("resumes", __name__, url_prefix="/resumes")


@resume_bp.route("/", methods=["POST"])
def create_resume_route():
    """
    Creates a new resume.
    ---
    tags:
      - Resumes
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            internal_name:
              type: string
            summary:
              type: string
            meta:
              type: object
            profile:
              type: object
              properties:
                contacts:
                  type: object
            languages:
              type: array
              items:
                type: object
            skills:
              type: object
            experience:
              type: array
              items:
                type: object
            education:
              type: array
              items:
                type: object
            projects:
              type: array
              items:
                type: object
            profile_id:
              type: integer
        examples:
          application/json:
            internal_name: "Backend Resume"
            summary: "Python backend developer with Flask and FastAPI experience."
            meta:
              language: "en-US"
            profile:
              contacts:
                email: "mateus@example.com"
            languages:
              - name: "English"
                level: "C2"
            skills:
              languages:
                - "Python"
            experience:
              - role: "Backend Developer"
                company: "Rovester AI"
            education:
              - institution: "Unifor"
                degree: "Computer Science"
            projects:
              - name: "Job Matcher"
            profile_id: 1
    responses:
      201:
        description: Resume created successfully.
        schema:
          type: object
          properties:
            id:
              type: integer
            internal_name:
              type: string
            meta:
              type: object
            profile:
              type: object
            experience:
              type: array
              items:
                type: object
            projects:
              type: array
              items:
                type: object
            education:
              type: array
              items:
                type: object
            skills:
              type: object
            languages:
              type: array
              items:
                type: object
        examples:
          application/json:
            id: 3
            internal_name: "Backend Resume"
            meta:
              language: "en-US"
              page:
                size: "letter"
                font_size: 11
            profile:
              name: "Backend Resume"
              contacts:
                email: "mateus@example.com"
            experience:
              - role: "Backend Developer"
                company: "Rovester AI"
            projects:
              - name: "Job Matcher"
            education:
              - institution: "Unifor"
                degree: "Computer Science"
            skills:
              languages:
                - "Python"
            languages:
              - name: "English"
                level: "C2"
      400:
        description: Resume name is required.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Resume name is required"
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
    return create_resume()


@resume_bp.route("/<int:resume_id>", methods=["GET"])
def get_resume_route(resume_id):
    """
    Returns a single resume by ID.
    ---
    tags:
      - Resumes
    parameters:
      - name: resume_id
        in: path
        type: integer
        required: true
        description: Resume ID.
    responses:
      200:
        description: Resume found.
        schema:
          type: object
          properties:
            id:
              type: integer
            internal_name:
              type: string
            meta:
              type: object
            profile:
              type: object
            experience:
              type: array
              items:
                type: object
            projects:
              type: array
              items:
                type: object
            education:
              type: array
              items:
                type: object
            skills:
              type: object
            languages:
              type: array
              items:
                type: object
        examples:
          application/json:
            id: 1
            internal_name: "PTBR"
            meta:
              language: "pt-BR"
              page:
                size: "letter"
                font_size: 11
            profile:
              name: "PTBR"
              contacts:
                email: "mateus@example.com"
            experience:
              - role: "IoT & Full Stack Developer"
                company: "Rovester AI"
            projects: []
            education:
              - institution: "Unifor"
                degree: "Bacharelado em Ciencias da Computacao"
            skills:
              languages:
                - "Python"
            languages:
              - name: "Ingles"
                level: "C2"
      404:
        description: Resume not found.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Resume not found"
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
    return get_resume(resume_id)


@resume_bp.route("/", methods=["GET"])
def get_all_resumes_route():
    """
    Returns all saved resumes.
    ---
    tags:
      - Resumes
    responses:
      200:
        description: List of resumes.
        schema:
          type: array
          items:
            type: object
            properties:
              id:
                type: integer
              internal_name:
                type: string
              meta:
                type: object
              profile:
                type: object
              experience:
                type: array
                items:
                  type: object
              projects:
                type: array
                items:
                  type: object
              education:
                type: array
                items:
                  type: object
              skills:
                type: object
              languages:
                type: array
                items:
                  type: object
        examples:
          application/json:
            - id: 1
              internal_name: "PTBR"
              meta:
                language: "pt-BR"
                page:
                  size: "letter"
                  font_size: 11
              profile:
                name: "PTBR"
                contacts:
                  email: "mateus@example.com"
              experience:
                - role: "IoT & Full Stack Developer"
                  company: "Rovester AI"
              projects: []
              education:
                - institution: "Unifor"
                  degree: "Bacharelado em Ciencias da Computacao"
              skills:
                languages:
                  - "Python"
              languages:
                - name: "Ingles"
                  level: "C2"
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
    return get_all_resumes()


@resume_bp.route("/<int:resume_id>", methods=["PUT"])
def update_resume_route(resume_id):
    """
    Updates an existing resume.
    ---
    tags:
      - Resumes
    parameters:
      - name: resume_id
        in: path
        type: integer
        required: true
        description: Resume ID.
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            internal_name:
              type: string
            summary:
              type: string
            meta:
              type: object
            profile:
              type: object
              properties:
                contacts:
                  type: object
            languages:
              type: array
              items:
                type: object
            skills:
              type: object
            experience:
              type: array
              items:
                type: object
            education:
              type: array
              items:
                type: object
            projects:
              type: array
              items:
                type: object
        examples:
          application/json:
            summary: "Python backend developer focused on APIs."
            skills:
              frameworks:
                - "Flask"
    responses:
      200:
        description: Resume updated successfully.
        schema:
          type: object
          properties:
            id:
              type: integer
            internal_name:
              type: string
            meta:
              type: object
            profile:
              type: object
            experience:
              type: array
              items:
                type: object
            projects:
              type: array
              items:
                type: object
            education:
              type: array
              items:
                type: object
            skills:
              type: object
            languages:
              type: array
              items:
                type: object
        examples:
          application/json:
            id: 1
            internal_name: "PTBR"
            meta:
              language: "pt-BR"
              page:
                size: "letter"
                font_size: 11
            profile:
              name: "PTBR"
              contacts:
                email: "mateus@example.com"
            experience:
              - role: "IoT & Full Stack Developer"
                company: "Rovester AI"
            projects: []
            education:
              - institution: "Unifor"
                degree: "Bacharelado em Ciencias da Computacao"
            skills:
              frameworks:
                - "Flask"
            languages:
              - name: "Ingles"
                level: "C2"
      404:
        description: Resume not found.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Resume not found"
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
    return update_resume(resume_id)


@resume_bp.route("/<int:resume_id>", methods=["DELETE"])
def delete_resume_route(resume_id):
    """
    Deletes a resume.
    ---
    tags:
      - Resumes
    parameters:
      - name: resume_id
        in: path
        type: integer
        required: true
        description: Resume ID.
    responses:
      200:
        description: Resume deleted successfully.
        schema:
          type: object
          properties:
            message:
              type: string
        examples:
          application/json:
            message: "Resume deleted successfully"
      404:
        description: Resume not found.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Resume not found"
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
    return delete_resume(resume_id)


@resume_bp.route("/tailor", methods=["POST"])
def tailor_resume_route():
    """
    Uses the configured LLM orchestrator to rewrite a resume for a job description.
    ---
    tags:
      - Resumes
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - raw_job_description
            - raw_resume
          properties:
            raw_job_description:
              type: string
            raw_resume:
              type: string
            extracted_job_keywords:
              type: array
              items:
                type: string
            extracted_resume_keywords:
              type: array
              items:
                type: string
            current_cosine_similarity:
              type: number
        examples:
          application/json:
            raw_job_description: "Looking for a backend engineer with AWS experience."
            raw_resume: "Backend developer with Linux and Flask experience."
            extracted_job_keywords:
              - "AWS"
            extracted_resume_keywords:
              - "Flask"
            current_cosine_similarity: 0.5
    responses:
      200:
        description: Tailored resume generated successfully.
        schema:
          type: object
          properties:
            tailored_resume:
              type: string
        examples:
          application/json:
            tailored_resume: "# Backend Resume\n\nExperience with Flask and AWS."
      400:
        description: Missing required input.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Request must include ['raw_job_description', 'raw_resume']"
      502:
        description: Upstream model returned an error payload.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "provider unavailable"
      500:
        description: Unexpected server error.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "An internal server error occurred."
    """
    return tailor_resume_endpoint()
