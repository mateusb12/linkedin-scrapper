import pytest
from unittest.mock import patch

# --- Module Imports for Robust Patching ---
from source.features.fetch_curl.fetch_service import FetchService
from source.features.job_population.population_service import PopulationService

@pytest.fixture
def client():
    from app import app
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_configure_pagination_curl(client):
    """
    STORY: As a user, I configure the scraper by pasting a cURL command.
    CURL (Request): PUT /config/curl/Pagination with raw cURL body.
    RESULT: 200 OK, JSON confirmation.
    """
    raw_curl_input = r"curl 'https://www.linkedin.com/...' -H 'Cookie: ...'"

    # We patch the static method on the class directly
    with patch.object(FetchService, 'upsert_curl_config', return_value=True) as mock_upsert:

        # Action
        response = client.put(
            '/config/curl/Pagination',
            data=raw_curl_input,
            content_type='text/plain'
        )

        # Expectation
        assert response.status_code == 200
        assert "updated successfully" in response.json['message']

        # Verify the service received exactly what the user sent
        mock_upsert.assert_called_with("Pagination", raw_curl_input)

def test_trigger_fetch_pipeline(client):
    """
    STORY: As a user, I want to fetch page 1 of jobs immediately.
    CURL (Request): GET /pipeline/fetch-page/1
    RESULT: 200 OK, JSON with count of saved jobs.
    """
    mock_response = {
        "success": True,
        "count": 5,
        "total_found": 25
    }

    with patch.object(PopulationService, 'fetch_and_save_page', return_value=mock_response) as mock_fetch:

        # Action
        response = client.get('/pipeline/fetch-page/1')

        # Expectation
        assert response.status_code == 200
        assert response.json['count'] == 5
        assert response.json['success'] is True

        # Verify correct page was requested
        mock_fetch.assert_called_with(1)