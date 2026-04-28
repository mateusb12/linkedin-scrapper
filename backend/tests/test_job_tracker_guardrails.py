from unittest.mock import MagicMock, patch

import pytest

from source.features.get_applied_jobs.linkedin_http_proxy import LinkedInProxy
from source.features.get_applied_jobs.utils_proxy import JobPost, LinkedInAppliedJobsEmptyError


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


def test_fetch_jobs_listing_saved_falls_back_to_regex_when_json_candidates_are_action_payloads():
    proxy = _build_proxy(
        '1:{"jobId":"4361386726","currentJobStage":"SeekerJobStage_SAVED"}'
    )
    proxy.batch_enricher.enrich_base_jobs.side_effect = lambda base_jobs: [
        JobPost.from_dict(base_job) for base_job in base_jobs
    ]

    result = proxy.fetch_jobs_listing(stage="saved")

    assert result.stage == "saved"
    assert result.count == 1
    assert result.jobs[0].job_id == "4361386726"
    assert result.jobs[0].job_url == "https://www.linkedin.com/jobs/view/4361386726/"
    proxy.batch_enricher.enrich_base_jobs.assert_called_once()


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
