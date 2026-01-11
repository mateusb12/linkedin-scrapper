import pytest
from unittest.mock import patch, MagicMock

# --- Module Imports for Robust Patching ---
from source.features.job_population.job_repository import JobRepository
# Note: We patch the Repository class itself, so any instance created in the controller is mocked.

@pytest.fixture
def client():
    from app import app
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_browse_fetched_jobs(client):
    """
    STORY: As a user, I browse the dashboard to see my fetched jobs.
    CURL (Request): GET /jobs/all
    RESULT: 200 OK, List of jobs with 'status' flag computed.
    """
    # Create a dummy Job object that mimics the SQLAlchemy model
    mock_job = MagicMock()
    mock_job.urn = "urn:li:job:123"
    mock_job.to_dict.return_value = {
        "urn": "urn:li:job:123",
        "title": "Senior Python Engineer",
        "company": {"name": "Tech Corp"},
    }
    # Simulate DB attributes accessed by the controller's helper `get_job_status`
    mock_job.processed = True
    mock_job.description_full = "Full text here"
    mock_job.has_applied = False

    with patch.object(JobRepository, 'get_all', return_value=[mock_job]):

        # Action
        response = client.get('/jobs/all')

        # Expectation
        assert response.status_code == 200
        data = response.json
        assert isinstance(data, list)
        assert data[0]['title'] == "Senior Python Engineer"

        # Critical: Verify controller logic added the UI-specific 'status' field
        assert data[0]['status'] == "complete"