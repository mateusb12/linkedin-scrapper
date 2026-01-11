import pytest
from unittest.mock import patch, MagicMock

# --- Module Imports for Robust Patching ---
from source.features.job_population.job_repository import JobRepository

@pytest.fixture
def client():
    from app import app
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_mark_job_as_applied(client):
    """
    STORY: As a user, I manually mark a job as applied.
    CURL (Request): PATCH /jobs/<urn>/mark_applied
    RESULT: 200 OK, Job object returned with has_applied=True.
    """
    target_urn = "urn:li:job:999"

    # Setup Mock Job
    mock_job = MagicMock()
    mock_job.to_dict.return_value = {
        "urn": target_urn,
        "title": "Software Engineer",
        "has_applied": True
    }

    # We need to mock 'mark_applied', 'commit', and 'get_by_urn' on the repo
    with patch.object(JobRepository, 'mark_applied') as mock_mark, \
            patch.object(JobRepository, 'commit'), \
            patch.object(JobRepository, 'get_by_urn', return_value=mock_job):

        # Action
        response = client.patch(f'/jobs/{target_urn}/mark_applied')

        # Expectation
        assert response.status_code == 200
        assert response.json['job']['has_applied'] is True

        # Verify the repository was instructed to update the specific URN
        mock_mark.assert_called_with(target_urn)