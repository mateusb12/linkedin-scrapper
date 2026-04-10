import pathlib
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app import app
from source.features.get_applied_jobs.linkedin_http_proxy import LinkedInProxy
from source.features.get_applied_jobs.utils_proxy import LinkedInAppliedJobsEmptyError


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


def _build_proxy(response_text: str, status_code: int = 200) -> LinkedInProxy:
    proxy = LinkedInProxy.__new__(LinkedInProxy)
    proxy.debug = False
    proxy.saved_url = "https://www.linkedin.com/flagship-web/jobs-tracker/?stage=saved"
    proxy.saved_method = "POST"
    proxy.saved_body = '{"stage":"saved"}'
    proxy.client = MagicMock()
    proxy.client.execute.return_value = MagicMock(
        status_code=status_code,
        text=response_text,
    )
    proxy.batch_enricher = MagicMock()
    proxy.batch_enricher.enrich_base_jobs.return_value = []
    proxy._prepare_body = lambda body, page_index=0: body
    return proxy


def test_fetch_jobs_listing_raises_degraded_payload_for_applied_http_200_empty():
    proxy = _build_proxy(
        '0:["$","div",null,{"screenId":"OpportunityTrackerPage","actor":"$undefined"}]'
    )

    with pytest.raises(LinkedInAppliedJobsEmptyError) as exc_info:
        proxy.fetch_jobs_listing(stage="applied")

    assert str(exc_info.value) == LinkedInAppliedJobsEmptyError.default_message


def test_fetch_jobs_listing_allows_legitimate_empty_saved_result():
    proxy = _build_proxy("{}")

    result = proxy.fetch_jobs_listing(stage="saved")

    assert result.stage == "saved"
    assert result.count == 0
    assert result.jobs == []


def test_applied_live_returns_explicit_error_json_for_degraded_payload(client):
    with patch(
        "source.features.get_applied_jobs.applied_jobs_controller.LinkedInProxy"
    ) as mock_proxy_class:
        mock_proxy_class.return_value.fetch_jobs_listing.side_effect = LinkedInAppliedJobsEmptyError()

        response = client.get("/job-tracker/applied-live")

    assert response.status_code == 502
    payload = response.get_json()
    assert payload["status"] == "error"
    assert payload["error"] == LinkedInAppliedJobsEmptyError.default_message


def test_sync_applied_smart_returns_explicit_error_json_for_degraded_payload(client):
    with patch(
        "source.features.get_applied_jobs.applied_jobs_controller.JobSyncService"
    ) as mock_service_class:
        mock_service_class.return_value.sync_smart.side_effect = LinkedInAppliedJobsEmptyError()

        response = client.post("/job-tracker/sync-applied-smart")

    assert response.status_code == 502
    payload = response.get_json()
    assert payload["status"] == "error"
    assert payload["error"] == LinkedInAppliedJobsEmptyError.default_message
