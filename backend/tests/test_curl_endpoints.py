import json
import pytest
from unittest.mock import MagicMock, patch
from app import app
from models import FetchCurl

# --- THE INPUT DATA (Exactly what frontend sends) ---
PAGINATION_PAYLOAD = {
    "curl": r"""curl 'https://www.linkedin.com/voyager/api/graphql?variables=(count:24,jobCollectionSlug:recommended,query:(origin:GENERIC_JOB_COLLECTIONS_LANDING),start:96)&queryId=voyagerJobsDashJobCards.93590893e4adb90623f00d61719b838c' \
  --compressed \
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0' \
  -H 'Accept: application/vnd.linkedin.normalized+json+2.1' \
  -H 'csrf-token: ajax:2911536425343488140' \
  -H 'Cookie: bcookie="v=2&test_cookie"; JSESSIONID="ajax:2911536425343488140";'"""
}

INDIVIDUAL_JOB_PAYLOAD = {
    "curl": r"""curl 'https://www.linkedin.com/voyager/api/graphql?variables=(jobPostingDetailDescription_start:0,jobPostingDetailDescription_count:5,jobCardPrefetchQuery:(prefetchJobPostingCardUrns:List(urn%3Ali%3Afsd_jobPostingCard%3A%284314156884%2CJOB_DETAILS%29),jobUseCase:JOB_DETAILS,count:5),jobDetailsContext:(isJobSearch:false))&queryId=voyagerJobsDashJobCards.174f05382121bd73f2f133da2e4af893' \
  --compressed \
  -H 'csrf-token: ajax:2911536425343488140' \
  -H 'Cookie: bcookie="v=2&test_cookie";'"""
}

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_pagination_curl_parsing(client):
    """
    Safety Net: Ensures the Pagination cURL is parsed into specific columns (slug, start, count).
    """
    # 1. Mock the DB Session so we don't touch real SQLite
    with patch('controllers.job_curls_controller.get_db_session') as mock_get_db:

        # Setup the Mock DB
        mock_session = MagicMock()
        mock_get_db.return_value = mock_session

        # Simulate: Database query returns None (so the controller creates a NEW record)
        mock_session.query.return_value.filter.return_value.first.return_value = None

        # 2. Fire the Request
        response = client.put(
            '/fetch-jobs/pagination-curl',
            data=json.dumps(PAGINATION_PAYLOAD),
            content_type='application/json'
        )

        # 3. Assertions
        assert response.status_code == 201

        # Verify DB interactions
        # We want to see what object was passed to db.add()
        args, _ = mock_session.add.call_args
        saved_record = args[0]

        # --- THE SAFETY CHECK ---
        # Did our parser extract the right numbers from that messy string?
        assert isinstance(saved_record, FetchCurl)
        assert saved_record.name == "Pagination"
        assert saved_record.variables_job_collection_slug == "recommended"  # <--- CRITICAL
        assert saved_record.variables_count == 24                           # <--- CRITICAL
        assert saved_record.variables_start == 96                           # <--- CRITICAL

        # Check Cookies & Tokens
        headers = json.loads(saved_record.headers)
        assert "JSESSIONID" in headers['Cookie']
        print("\n✅ Pagination Logic Verified!")


def test_individual_job_curl_parsing(client):
    """
    Safety Net: Ensures the Individual Job cURL is parsed (specifically JOB_DETAILS use case).
    """
    with patch('controllers.job_curls_controller.get_db_session') as mock_get_db:
        mock_session = MagicMock()
        mock_get_db.return_value = mock_session
        mock_session.query.return_value.filter.return_value.first.return_value = None

        response = client.put(
            '/fetch-jobs/individual-job-curl',
            data=json.dumps(INDIVIDUAL_JOB_PAYLOAD),
            content_type='application/json'
        )

        assert response.status_code == 201

        args, _ = mock_session.add.call_args
        saved_record = args[0]

        # --- THE SAFETY CHECK ---
        assert saved_record.name == "SingleJob"
        # In the regex logic, we look for 'count' inside the variables string
        # The individual URL has "count:5" inside.
        assert saved_record.variables_count == 5

        # Verify base URL matches
        assert "voyager/api/graphql" in saved_record.base_url
        print("\n✅ Individual Job Logic Verified!")