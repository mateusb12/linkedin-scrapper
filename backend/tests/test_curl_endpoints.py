import json
import pytest
from unittest.mock import MagicMock, patch
from app import app
from models import FetchCurl

# 1. IMPORT THE MODULE WHERE 'get_db_session' IS USED
# We import the 'fetch_service' module object itself.
# This allows us to use patch.object(fetch_service, 'get_db_session') safely.
from source.features.fetch_curl import fetch_service

# --- THE INPUT DATA ---
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
    Safety Net: Ensures the Pagination cURL is parsed into specific columns.
    """
    # FIX: Use patch.object on the imported module
    # This patches 'source.features.fetch_curl.fetch_service.get_db_session'
    # but does so using the object reference, which allows IDE refactoring.
    with patch.object(fetch_service, 'get_db_session') as mock_get_db:

        # Mock Setup
        mock_session = MagicMock()
        mock_get_db.return_value = mock_session

        # Robust Chain: db.query().filter().first() -> None
        mock_query_chain = MagicMock()
        mock_session.query.return_value = mock_query_chain
        mock_query_chain.filter.return_value = mock_query_chain
        mock_query_chain.first.return_value = None  # Force Creation logic

        # Fire Request
        response = client.put(
            '/fetch-jobs/pagination-curl',
            data=json.dumps(PAGINATION_PAYLOAD),
            content_type='application/json'
        )

        # Assertions (New Controller returns 200)
        assert response.status_code == 200

        # Verify Parser Logic
        args, _ = mock_session.add.call_args
        saved_record = args[0]

        assert isinstance(saved_record, FetchCurl)
        assert saved_record.name == "Pagination"
        assert saved_record.variables_job_collection_slug == "recommended"
        assert saved_record.variables_count == 24
        assert saved_record.variables_start == 96

        headers = json.loads(saved_record.headers)
        assert "JSESSIONID" in headers['Cookie']
        print("\n✅ Pagination Logic Verified!")


def test_individual_job_curl_parsing(client):
    """
    Safety Net: Ensures the Individual Job cURL is parsed.
    """
    # FIX: Same here, patch the module object directly
    with patch.object(fetch_service, 'get_db_session') as mock_get_db:
        mock_session = MagicMock()
        mock_get_db.return_value = mock_session

        mock_query_chain = MagicMock()
        mock_session.query.return_value = mock_query_chain
        mock_query_chain.filter.return_value = mock_query_chain
        mock_query_chain.first.return_value = None

        response = client.put(
            '/fetch-jobs/individual-job-curl',
            data=json.dumps(INDIVIDUAL_JOB_PAYLOAD),
            content_type='application/json'
        )

        # Assertions
        assert response.status_code == 200

        args, _ = mock_session.add.call_args
        saved_record = args[0]

        assert saved_record.name == "SingleJob"
        assert saved_record.variables_count == 5
        assert "voyager/api/graphql" in saved_record.base_url
        print("\n✅ Individual Job Logic Verified!")