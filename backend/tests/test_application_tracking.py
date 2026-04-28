from unittest.mock import patch, MagicMock

# --- Import Services/Repositories to Patch ---
# We patch the class/method where it is DEFINED or IMPORTED by the controller.
from source.features.job_population.population_service import PopulationService

# ============================================================================
# 📊 1. Applied Jobs Endpoint Tests
# ============================================================================

def test_get_applied_jobs_paginated(client):
    """
    STORY: The dashboard requests applied jobs.
    ENDPOINT: GET /services/applied
    MOCK: JobRepository.get_applied_jobs
    """
    mock_job = {
        "urn": "urn:li:job:123",
        "title": "Backend Dev",
        "company": {"name": "Tech Corp"}
    }

    with patch(
        "source.features.get_applied_jobs.applied_jobs_controller.JobRepository.get_applied_jobs",
        return_value=[mock_job],
    ) as mock_fetch:
        response = client.get('/services/applied?page=1&limit=10')

        assert response.status_code == 200
        data = response.json

        assert data["status"] == "success"
        assert data["data"]["count"] == 1
        assert data["data"]["jobs"][0]["title"] == "Backend Dev"
        mock_fetch.assert_called_once_with()


# ============================================================================
# 🔀 2. Reconciliation Endpoint Tests
# ============================================================================

def test_reconcile_job_statuses(client):
    """
    STORY: User clicks 'Reconcile' to cross-check emails vs database jobs.
    ENDPOINT: POST /services/reconcile
    MOCK: PopulationService.reconcile_failures
    """
    # 1. Mock Data
    mock_result = {
        "success": True,
        "updated_count": 3,
        "jobs_fixed": ["Google - SWE", "Meta - Data Eng"]
    }

    # 2. Patch the Service
    with patch.object(PopulationService, 'reconcile_failures', return_value=mock_result) as mock_service:

        # 3. Action
        response = client.post('/services/reconcile', json={})

        # 4. Assertions
        assert response.status_code == 200
        data = response.json

        assert data["success"] is True
        assert data["updated_count"] == 3
        assert len(data["jobs_fixed"]) == 2

        mock_service.assert_called_once()


# ============================================================================
# ❌ 3. Failures / Rejections (Emails) Tests
# ============================================================================

def test_get_failure_emails(client):
    """
    STORY: Dashboard views the 'Job fails' email tab.
    ENDPOINT: GET /emails/?folder=Job fails
    MOCK: Real gmail_controller database dependency.
    """
    mock_email = MagicMock()
    mock_email.to_dict.return_value = {
        "id": 1,
        "subject": "Thank you for applying",
        "folder": "Job fails"
    }

    with patch('source.features.gmail_service.gmail_controller.get_db_session') as mock_get_db:
        mock_session = MagicMock()
        mock_get_db.return_value = mock_session

        mock_query = mock_session.query.return_value
        mock_filter = mock_query.filter.return_value
        mock_filter.count.return_value = 1
        mock_order = mock_filter.order_by.return_value
        mock_offset = mock_order.offset.return_value
        mock_limit = mock_offset.limit.return_value
        mock_limit.all.return_value = [mock_email]

        response = client.get('/emails/?folder=Job fails&page=1&limit=10')

        assert response.status_code == 200
        data = response.json
        assert data["data"][0]["subject"] == "Thank you for applying"
        assert data["total"] == 1
        assert data["page"] == 1
        assert data["total_pages"] == 1
        mock_session.close.assert_called_once()


def test_sync_failure_emails(client):
    """
    STORY: User clicks 'Sync Emails'.
    ENDPOINT: POST /emails/sync
    MOCK: Real gmail_controller dependencies.
    """
    mock_payload = {"label": "Job fails"}

    mock_profile = MagicMock()
    mock_profile.email = "mateus@example.com"
    mock_profile.email_app_password = "app-password"
    mock_session = MagicMock()
    mock_session.query.return_value.first.return_value = mock_profile

    with patch('source.features.gmail_service.gmail_controller.get_db_session', return_value=mock_session), \
         patch('source.features.gmail_service.gmail_controller._perform_gmail_sync', return_value=5) as mock_sync:
        response = client.post('/emails/sync', json=mock_payload)

        assert response.status_code == 200
        assert response.json == {
            "message": "Synced 5 emails",
            "label": "Job fails",
        }
        mock_sync.assert_called_once_with(mock_session, mock_profile, "Job fails")
        mock_session.close.assert_called_once()


# ============================================================================
# 📈 4. Dashboard Insights Tests
# ============================================================================

def test_get_dashboard_insights(client):
    """
    STORY: Dashboard loads summary charts.
    ENDPOINT: GET /services/insights?time_range=30d
    MOCK: Database session returning applied jobs.
    """
    active_job = MagicMock()
    active_job.application_closed = False
    active_job.job_state = "LISTED"
    active_job.applicants = 40
    active_job.application_status = "Waiting"
    active_job.title = "Backend Dev"

    closed_job = MagicMock()
    closed_job.application_closed = True
    closed_job.job_state = "CLOSED"
    closed_job.applicants = 250
    closed_job.application_status = "Refused"
    closed_job.title = "Platform Engineer"

    mock_session = MagicMock()
    mock_query = mock_session.query.return_value
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = [active_job, closed_job]

    with patch('source.features.get_applied_jobs.services_controller.get_db_session', return_value=mock_session):
        response = client.get('/services/insights?time_range=30d')

    assert response.status_code == 200
    data = response.json
    assert data["overview"] == {
        "total": 2,
        "active": 1,
        "paused": 0,
        "closed": 1,
        "unknown": 0,
    }
    assert data["competition"]["low"] == 1
    assert data["competition"]["high"] == 1
    assert data["competition"]["avg_applicants"] == 145
    assert len(data["competition_raw"]) == 2
    mock_session.close.assert_called_once()
