import json
from urllib.parse import parse_qs, urlsplit

import pytest
import requests

from tests.linkedin_http_fixtures import (
    FAKE_CSRF,
    FAKE_LI_AT,
    CapturedRequest,
    FakeResponse,
    fake_linkedin_records,
    patch_linkedin_db,
)


@pytest.fixture(autouse=True)
def block_linkedin_network(monkeypatch):
    def blocked(*args, **kwargs):
        raise AssertionError("unexpected real LinkedIn request in offline contract tests")

    monkeypatch.setattr(requests.Session, "request", blocked)
    monkeypatch.setattr(requests.Session, "get", blocked)
    monkeypatch.setattr(requests.Session, "send", blocked)
    monkeypatch.setattr(requests, "request", blocked)
    monkeypatch.setattr(requests, "get", blocked)


def _capture_session_request(monkeypatch, response: FakeResponse | None = None):
    captured: list[CapturedRequest] = []
    response = response or FakeResponse(json_data={"ok": True})

    def fake_request(self, method, url, headers=None, **kwargs):
        captured.append(CapturedRequest(method, url, headers, kwargs))
        return response

    monkeypatch.setattr(requests.Session, "request", fake_request)
    return captured


def test_linkedin_client_hydrates_cookies_derives_csrf_and_slim_filters(monkeypatch):
    patch_linkedin_db(monkeypatch)

    from source.features.fetch_curl.linkedin_http_client import LinkedInClient

    client = LinkedInClient("SavedJobs", slim_mode=True)

    assert client.session.cookies.get("li_at") == FAKE_LI_AT
    assert client.session.cookies.get("JSESSIONID") == FAKE_CSRF
    assert client.session.headers["csrf-token"] == FAKE_CSRF
    assert client.session.headers["Cookie"] == f'li_at={FAKE_LI_AT}; JSESSIONID="{FAKE_CSRF}"'
    assert "X-Li-Track" not in client.session.headers


def test_extract_linkedin_identity_from_cookie_header_normalizes_jsessionid():
    from source.features.fetch_curl.linkedin_http_client import extract_linkedin_identity

    identity = extract_linkedin_identity(
        {
            "Cookie": 'bcookie=DROP_ME; li_at=SOURCE_LI_AT; JSESSIONID="ajax:SOURCE_CSRF"',
            "User-Agent": "source-user-agent",
            "csrf-token": "stale-token",
        }
    )

    assert identity.li_at == "SOURCE_LI_AT"
    assert identity.jsessionid == "ajax:SOURCE_CSRF"
    assert identity.csrf_token == "ajax:SOURCE_CSRF"
    assert identity.user_agent == "source-user-agent"


def test_strip_auth_headers_removes_cookie_and_csrf_preserves_request_headers(monkeypatch):
    from source.features.fetch_curl.linkedin_http_client import (
        get_linkedin_identity_config_name,
        strip_auth_headers,
    )

    headers = strip_auth_headers(
        {
            "Cookie": "li_at=STALE",
            "csrf-token": "stale-token",
            "Accept": "application/json",
            "X-Li-Rsc-Stream": "true",
            "Referer": "https://www.linkedin.com/jobs/",
        }
    )

    assert headers == {
        "Accept": "application/json",
        "X-Li-Rsc-Stream": "true",
        "Referer": "https://www.linkedin.com/jobs/",
    }
    assert get_linkedin_identity_config_name() == "Connections"
    monkeypatch.setenv("LINKEDIN_IDENTITY_CONFIG", "ProfileMain")
    assert get_linkedin_identity_config_name() == "ProfileMain"


def test_apply_identity_to_session_sets_cookies_cookie_header_and_csrf():
    from source.features.fetch_curl.linkedin_http_client import (
        LinkedInIdentity,
        apply_identity_to_headers,
        apply_identity_to_session,
    )

    stale_headers = apply_identity_to_headers(
        {
            "Cookie": "li_at=STALE_LI_AT; JSESSIONID=ajax:STALE_CSRF",
            "csrf-token": "ajax:STALE_CSRF",
            "Accept": "application/json",
        },
        LinkedInIdentity(
            li_at="SOURCE_LI_AT",
            jsessionid="ajax:SOURCE_CSRF",
            csrf_token="ajax:SOURCE_CSRF",
        ),
    )
    assert stale_headers["Accept"] == "application/json"
    assert stale_headers["Cookie"] == 'li_at=SOURCE_LI_AT; JSESSIONID="ajax:SOURCE_CSRF"'
    assert stale_headers["csrf-token"] == "ajax:SOURCE_CSRF"
    assert "STALE" not in stale_headers["Cookie"]

    session = requests.Session()
    apply_identity_to_session(
        session,
        LinkedInIdentity(
            li_at="SOURCE_LI_AT",
            jsessionid="ajax:SOURCE_CSRF",
            csrf_token="ajax:SOURCE_CSRF",
        ),
    )

    assert session.cookies.get("li_at") == "SOURCE_LI_AT"
    assert session.cookies.get("JSESSIONID") == "ajax:SOURCE_CSRF"
    assert session.headers["Cookie"] == 'li_at=SOURCE_LI_AT; JSESSIONID="ajax:SOURCE_CSRF"'
    assert session.headers["csrf-token"] == "ajax:SOURCE_CSRF"


def test_linkedin_client_can_apply_identity_from_another_fetch_curl_row(monkeypatch):
    records, _get_db_session = patch_linkedin_db(monkeypatch)
    records["Connections"].headers = json.dumps(
        {
            "Cookie": 'li_at=SOURCE_LI_AT; JSESSIONID="ajax:SOURCE_CSRF"',
            "User-Agent": "source-user-agent",
        }
    )
    records["SavedJobs"].headers = json.dumps(
        {
            "Cookie": 'li_at=STALE_LI_AT; JSESSIONID="ajax:STALE_CSRF"',
            "csrf-token": "ajax:STALE_CSRF",
            "Accept": "application/json",
            "Referer": "https://www.linkedin.com/jobs/tracker/",
        }
    )

    from source.features.fetch_curl.linkedin_http_client import LinkedInClient

    client = LinkedInClient("SavedJobs", identity_name="Connections")

    assert client.session.cookies.get("li_at") == "SOURCE_LI_AT"
    assert client.session.cookies.get("JSESSIONID") == "ajax:SOURCE_CSRF"
    assert client.session.headers["Cookie"] == 'li_at=SOURCE_LI_AT; JSESSIONID="ajax:SOURCE_CSRF"'
    assert client.session.headers["csrf-token"] == "ajax:SOURCE_CSRF"
    assert client.session.headers["Accept"] == "application/json"
    assert client.session.headers["Referer"] == "https://www.linkedin.com/jobs/tracker/"


def test_perform_linkedin_request_disables_redirects_and_raises_auth_expired(monkeypatch):
    patch_linkedin_db(monkeypatch)
    captured = _capture_session_request(
        monkeypatch,
        FakeResponse(
            302,
            text="",
            headers={"location": "https://www.linkedin.com/login"},
        ),
    )

    from source.features.enrich_jobs.linkedin_http_job_enricher import AuthExpiredError
    from source.features.fetch_curl.linkedin_http_client import LinkedInClient, LinkedInRequest

    client = LinkedInClient("SavedJobs")
    request = LinkedInRequest("GET", "https://www.linkedin.com/voyager/api/me")

    with pytest.raises(AuthExpiredError):
        client.execute(request)

    assert captured[0].kwargs["allow_redirects"] is False
    assert captured[0].headers["csrf-token"] == FAKE_CSRF


def test_job_cards_lite_search_request_preserves_core_params_and_updates_start_count(
    monkeypatch,
):
    records, get_db_session = patch_linkedin_db(monkeypatch)
    monkeypatch.setattr(
        "source.features.search_jobs.curl_voyager_jobs_fetch.get_db_session",
        get_db_session,
    )
    captured = _capture_session_request(monkeypatch)

    from source.features.search_jobs.curl_voyager_jobs_fetch import (
        JobSearchTuning,
        VoyagerJobsLiteFetcher,
    )

    fetcher = VoyagerJobsLiteFetcher(
        page=3,
        count=25,
        tuning=JobSearchTuning(keywords="Python Backend", geo_id="106057199"),
    )
    payload = fetcher.fetch_raw()

    assert payload == {"ok": True}
    req = captured[0]
    parsed = urlsplit(req.url)
    params = parse_qs(parsed.query, keep_blank_values=True)

    assert req.method == records["JobCardsLite"].method
    assert params["start"] == ["50"]
    assert params["count"] == ["25"]
    assert params["origin"] == ["JOB_SEARCH_PAGE_JOB_FILTER"]
    assert "keywords:Python Backend" in params["query"][0]
    assert "locationUnion:(geoId:106057199)" in params["query"][0]
    assert req.headers["Referer"].startswith("https://www.linkedin.com/jobs/search/")
    assert "keywords=Python+Backend" in req.headers["Referer"]
    assert req.kwargs["timeout"] == 15
    assert req.kwargs["allow_redirects"] is False


def test_saved_jobs_applied_request_replaces_stage_without_dropping_session_headers(
    monkeypatch,
):
    _records, get_db_session = patch_linkedin_db(monkeypatch)
    monkeypatch.setattr(
        "source.features.get_applied_jobs.new_get_applied_jobs_service.get_db_session",
        get_db_session,
    )
    captured = _capture_session_request(
        monkeypatch,
        FakeResponse(
            text='0:{"jobId":"4380000000","title":"Backend Engineer","companyName":"ACME"}',
            headers={"Content-Type": "application/octet-stream"},
        ),
    )

    from source.features.get_applied_jobs.new_get_applied_jobs_service import (
        JobTrackerFetcher,
    )

    fetcher = JobTrackerFetcher()
    jobs = fetcher.fetch_latest_applied_candidates(limit=1)

    assert jobs[0]["job_id"] == "4380000000"
    req = captured[0]
    assert "stage=applied" in req.url
    assert "applied" in req.kwargs["data"]
    assert req.headers["csrf-token"] == FAKE_CSRF
    assert FAKE_LI_AT in req.headers["Cookie"]
    assert req.headers["x-li-initial-url"] == "/jobs-tracker/?stage=applied"


def test_experience_dynamic_profile_fetch_replaces_vanity_and_sends_prepared_body(
    monkeypatch,
):
    records, get_db_session = patch_linkedin_db(monkeypatch)
    monkeypatch.setattr(
        "source.features.fetch_curl.fetch_service.get_db_session",
        get_db_session,
    )
    captured = []

    def fake_send(self, prepared, **kwargs):
        captured.append((prepared, kwargs))
        return FakeResponse(json_data={"profile": True})

    monkeypatch.setattr(requests.Session, "send", fake_send)

    from source.features.fetch_curl.fetch_service import FetchService

    result = FetchService.execute_dynamic_profile_fetch("Experience", "target-user")

    prepared, kwargs = captured[0]
    assert result == {"profile": True}
    assert prepared.method == records["Experience"].method
    assert "target-user" in prepared.body.decode("utf-8")
    assert "monicasbusatta" not in prepared.body.decode("utf-8")
    assert kwargs["timeout"] == 15


def test_connections_pagination_replaces_start_index_and_posts_body(monkeypatch):
    _records, get_db_session = patch_linkedin_db(monkeypatch)
    monkeypatch.setattr(
        "source.features.friends_connections.fetch_connections.get_db_session",
        get_db_session,
    )
    captured = _capture_session_request(
        monkeypatch,
        FakeResponse(
            json_data={
                "included": [
                    {"navigationUrl": "https://www.linkedin.com/in/example-user/?mini=true"}
                ]
            }
        ),
    )

    from source.features.friends_connections.fetch_connections import (
        LinkedInConnectionsFetcher,
    )

    events = list(LinkedInConnectionsFetcher().fetch_all(batch_size=10, max_pages=1))

    assert events[0]["status"] == "start"
    assert captured[0].method == "POST"
    assert captured[0].kwargs["data"] == b'{"start":0,"count":10}'
    assert captured[0].kwargs["timeout"] == 15
    assert captured[0].headers["csrf-token"] == FAKE_CSRF


def test_premium_insights_updates_job_id_referer_and_identity_encoding(monkeypatch):
    records, _get_db_session = patch_linkedin_db(monkeypatch)
    records["Connections"].headers = json.dumps(
        {
            "Cookie": 'li_at=SOURCE_LI_AT; JSESSIONID="ajax:SOURCE_CSRF"',
            "User-Agent": "source-user-agent",
        }
    )
    records["PremiumInsights"].headers = json.dumps(
        {
            "Cookie": 'li_at=STALE_LI_AT; JSESSIONID="ajax:STALE_CSRF"',
            "csrf-token": "ajax:STALE_CSRF",
            "Accept": "text/x-component",
            "Accept-Encoding": "br",
        }
    )
    captured = []

    def fake_request(method, url, headers=None, data=None, **kwargs):
        captured.append(
            {
                "method": method,
                "url": url,
                "headers": headers,
                "data": data,
                "kwargs": kwargs,
            }
        )
        return FakeResponse(text='{"premium_component_found":false}')

    monkeypatch.setattr(requests, "request", fake_request)

    from source.features.enrich_jobs.linkedin_http_job_enricher import LinkedInJobEnricher

    LinkedInJobEnricher().fetch_premium_insights("4387654321")

    req = captured[0]
    assert req["method"] == "POST"
    assert req["url"] == "https://www.linkedin.com/voyager/api/premium/jobInsights"
    assert '"jobId":"4387654321"' in req["data"]
    assert req["headers"]["Referer"] == "https://www.linkedin.com/jobs/view/4387654321/"
    assert req["headers"]["Accept-Encoding"] == "identity"
    assert req["headers"]["Cookie"] == 'li_at=SOURCE_LI_AT; JSESSIONID="ajax:SOURCE_CSRF"'
    assert req["headers"]["csrf-token"] == "ajax:SOURCE_CSRF"
    assert "STALE" not in req["headers"]["Cookie"]
    assert req["kwargs"]["timeout"] == 20


def test_notifications_uses_shared_identity_not_stale_target_auth(monkeypatch):
    records, _get_db_session = patch_linkedin_db(monkeypatch)
    records["Connections"].headers = json.dumps(
        {
            "Cookie": 'li_at=SOURCE_LI_AT; JSESSIONID="ajax:SOURCE_CSRF"',
            "User-Agent": "source-user-agent",
        }
    )
    records["Notifications"].headers = json.dumps(
        {
            "Cookie": 'li_at=STALE_LI_AT; JSESSIONID="ajax:STALE_CSRF"',
            "csrf-token": "ajax:STALE_CSRF",
            "Accept": "application/json",
        }
    )
    captured = []

    def fake_request(self, method, url, headers=None, **kwargs):
        captured.append({"method": method, "url": url, "headers": headers, "kwargs": kwargs})
        return FakeResponse(json_data={"included": []})

    monkeypatch.setattr(requests.Session, "request", fake_request)

    from source.features.enrich_jobs.linkedin_http_job_enricher import LinkedInJobEnricher

    LinkedInJobEnricher().fetch_notifications_for_job("4387654321")

    req = captured[0]
    assert req["method"] == "GET"
    assert req["url"] == "https://www.linkedin.com/voyager/api/notifications/dash"
    assert req["headers"]["Cookie"] == 'li_at=SOURCE_LI_AT; JSESSIONID="ajax:SOURCE_CSRF"'
    assert req["headers"]["csrf-token"] == "ajax:SOURCE_CSRF"
    assert req["headers"]["Accept"] == "application/json"
    assert "STALE" not in req["headers"]["Cookie"]


def test_job_tracker_premium_insights_uses_shared_identity_not_stale_target_auth(monkeypatch):
    records, _get_db_session = patch_linkedin_db(monkeypatch)
    records["Connections"].headers = json.dumps(
        {
            "Cookie": 'li_at=SOURCE_LI_AT; JSESSIONID="ajax:SOURCE_CSRF"',
            "User-Agent": "source-user-agent",
        }
    )
    records["PremiumInsights"].headers = json.dumps(
        {
            "Cookie": 'li_at=STALE_LI_AT; JSESSIONID="ajax:STALE_CSRF"',
            "csrf-token": "ajax:STALE_CSRF",
            "Accept": "text/x-component",
        }
    )
    captured = []

    def fake_request(method, url, headers=None, data=None, **kwargs):
        captured.append({"method": method, "url": url, "headers": headers, "data": data, "kwargs": kwargs})
        return FakeResponse(text='{"premium_component_found":false}')

    monkeypatch.setattr(requests, "request", fake_request)

    from source.features.get_applied_jobs.new_get_applied_jobs_service import JobTrackerFetcher

    JobTrackerFetcher().fetch_premium_insights("4387654321")

    req = captured[0]
    assert req["headers"]["Cookie"] == 'li_at=SOURCE_LI_AT; JSESSIONID="ajax:SOURCE_CSRF"'
    assert req["headers"]["csrf-token"] == "ajax:SOURCE_CSRF"
    assert "STALE" not in req["headers"]["Cookie"]


def test_fetch_job_details_captures_direct_session_get_and_parses_voyager(
    monkeypatch,
):
    patch_linkedin_db(monkeypatch)
    captured = []

    def fake_get(self, url, headers=None, **kwargs):
        captured.append({"url": url, "headers": headers, "kwargs": kwargs})
        return FakeResponse(
            json_data={
                "title": "Staff Backend Engineer",
                "companyDetails": {
                    "com.linkedin.voyager.jobs.JobPostingCompany": {
                        "company": "urn:li:fs_normalized_company:123",
                        "companyName": "ACME",
                    }
                },
                "formattedLocation": "Remote",
                "applyingInfo": {"applied": True, "appliedAt": 1700000000000},
                "listedAt": 1699900000000,
                "description": {"text": "Build APIs."},
                "applies": 42,
            }
        )

    monkeypatch.setattr(requests.Session, "get", fake_get)

    from source.features.enrich_jobs.linkedin_http_job_enricher import LinkedInJobEnricher

    details = LinkedInJobEnricher().fetch_job_details("4387654321")

    assert captured[0]["url"].endswith("/voyager/api/jobs/jobPostings/4387654321")
    assert captured[0]["headers"] == {"csrf-token": FAKE_CSRF, "accept": "application/json"}
    assert captured[0]["kwargs"]["allow_redirects"] is False
    assert captured[0]["kwargs"]["timeout"] == 20
    assert details["title"] == "Staff Backend Engineer"
    assert details["company"] == "ACME"
    assert details["applicants"] == 42


def test_fetch_service_internal_request_sends_prepared_request_and_parses_rsc(
    monkeypatch,
):
    records, get_db_session = patch_linkedin_db(monkeypatch)
    records["Connections"].headers = json.dumps(
        {
            "Cookie": 'li_at=SOURCE_LI_AT; JSESSIONID="ajax:SOURCE_CSRF"',
            "User-Agent": "source-user-agent",
        }
    )
    records["Pagination"].headers = json.dumps(
        {
            "Cookie": 'li_at=STALE_LI_AT; JSESSIONID="ajax:STALE_CSRF"',
            "csrf-token": "ajax:STALE_CSRF",
            "Accept": "application/json",
        }
    )
    monkeypatch.setattr(
        "source.features.fetch_curl.fetch_service.get_db_session",
        get_db_session,
    )
    captured = []

    def fake_send(self, prepared, **kwargs):
        captured.append((prepared, kwargs))
        return FakeResponse(
            headers={"Content-Type": "application/octet-stream"},
            content=b'0:{"ok":true}',
        )

    monkeypatch.setattr(requests.Session, "send", fake_send)

    from source.features.fetch_curl.fetch_service import FetchService

    result = FetchService._internal_request(
        "https://www.linkedin.com/voyager/api/graphql",
        params={"variables": "(count:1,start:0)"},
    )

    prepared, kwargs = captured[0]
    assert result == '0:{"ok":true}'
    assert prepared.method == "GET"
    assert "variables=%28count%3A1%2Cstart%3A0%29" in prepared.url
    assert prepared.headers["csrf-token"] == "ajax:SOURCE_CSRF"
    assert prepared.headers["Cookie"] == 'li_at=SOURCE_LI_AT; JSESSIONID="ajax:SOURCE_CSRF"'
    assert "STALE" not in prepared.headers["Cookie"]
    assert kwargs["timeout"] == 15


def test_job_cards_lite_strips_voyager_prefix_before_json_parse(monkeypatch):
    records, get_db_session = patch_linkedin_db(monkeypatch)
    monkeypatch.setattr(
        "source.features.search_jobs.curl_voyager_jobs_fetch.get_db_session",
        get_db_session,
    )
    _capture_session_request(
        monkeypatch,
        FakeResponse(text=")]}'\n{\"included\":[{\"jobPostingUrn\":\"urn:li:jobPosting:1\"}]}"),
    )

    from source.features.search_jobs.curl_voyager_jobs_fetch import VoyagerJobsLiteFetcher

    assert VoyagerJobsLiteFetcher(page=1).fetch_raw()["included"][0]["jobPostingUrn"].endswith(":1")


def test_connections_extract_profiles_from_representative_rsc():
    from source.features.friends_connections.fetch_connections import (
        LinkedInConnectionsFetcher,
    )

    fetcher = object.__new__(LinkedInConnectionsFetcher)
    rsc = [
        [
            {
                "navigationContext": {
                    "url": "https://www.linkedin.com/in/example-user/?miniProfileUrn=abc"
                }
            }
        ]
    ]

    profiles = fetcher._extract_from_rsc(rsc)

    assert profiles == [
        {
            "name": "div",
            "headline": "text-attr-0",
            "profile_url": "https://www.linkedin.com/in/example-user/",
            "image": None,
            "connected_time": "",
        }
    ]
