"""
gmail_router.py - Routing and Swagger documentation layer.
"""

from flask import Blueprint

from source.features.gmail_service.gmail_controller import (
    sync_emails_endpoint,
    reconcile_backlog,
    reconcile_backlog_dry_run,
    get_stored_emails,
)

gmail_bp = Blueprint("gmail", __name__, url_prefix="/emails")


@gmail_bp.route("/sync", methods=["POST"])
def sync_emails_endpoint_route():
    """
    Syncs emails from the configured Gmail label into the local database.
    ---
    tags:
      - Emails
    parameters:
      - in: body
        name: body
        required: false
        schema:
          type: object
          properties:
            label:
              type: string
        examples:
          application/json:
            label: "Job fails"
    responses:
      200:
        description: Emails synced successfully.
        schema:
          type: object
          properties:
            message:
              type: string
            label:
              type: string
        examples:
          application/json:
            message: "Synced 3 emails"
            label: "Job fails"
      400:
        description: Invalid profile or label configuration.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Profile not configured"
      500:
        description: Gmail authentication or server error.
        schema:
          type: object
          properties:
            error:
              type: string
        examples:
          application/json:
            error: "Gmail authentication failed"
    """
    return sync_emails_endpoint()


@gmail_bp.route("/reconcile-backlog", methods=["POST"])
def reconcile_backlog_route():
    """
    Re-runs email-to-job reconciliation for unmatched emails in the backlog.
    ---
    tags:
      - Emails
    responses:
      200:
        description: Backlog reconciliation finished.
        schema:
          type: object
          properties:
            processed:
              type: integer
            updated:
              type: integer
        examples:
          application/json:
            processed: 12
            updated: 4
    """
    return reconcile_backlog()


@gmail_bp.route("/reconcile-backlog/dry-run", methods=["GET", "POST"])
def reconcile_backlog_dry_run_route():
    """
    Reports safe email-to-job reconciliation decisions without writing changes.
    """
    return reconcile_backlog_dry_run()


@gmail_bp.route("/", methods=["GET"])
def get_stored_emails_route():
    """
    Returns stored emails with pagination and optional folder filtering.
    ---
    tags:
      - Emails
    parameters:
      - name: page
        in: query
        type: integer
        required: false
        description: Page number. Defaults to 1.
      - name: limit
        in: query
        type: integer
        required: false
        description: Items per page. Defaults to 10.
      - name: folder
        in: query
        type: string
        required: false
        description: Folder filter. Defaults to `Job fails`.
    responses:
      200:
        description: Paginated email list.
        schema:
          type: object
          properties:
            data:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  thread_id:
                    type: string
                  job_urn:
                    type: string
                  folder:
                    type: string
                  category:
                    type: string
                  sender:
                    type: string
                  sender_email:
                    type: string
                  recipient:
                    type: string
                  subject:
                    type: string
                  snippet:
                    type: string
                  body_text:
                    type: string
                  receivedAt:
                    type: string
                  createdAt:
                    type: string
                  isRead:
                    type: boolean
            total:
              type: integer
            page:
              type: integer
            total_pages:
              type: integer
        examples:
          application/json:
            data:
              - id: 1
                thread_id: "1942555689032725420"
                job_urn: null
                folder: "Job fails"
                category: "rejection"
                sender: "jobs-listings@linkedin.com"
                sender_email: "jobs-listings@linkedin.com"
                recipient: "mateus@example.com"
                subject: "Your update from ilia"
                snippet: "Your update from ilia..."
                body_text: "Your update from ilia"
                receivedAt: "2026-04-06T12:00:00"
                createdAt: "2026-04-06T12:05:00"
                isRead: true
            total: 42
            page: 1
            total_pages: 5
    """
    return get_stored_emails()
