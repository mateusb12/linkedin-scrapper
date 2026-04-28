import json
from dataclasses import dataclass
from typing import Any

from models.fetch_models import FetchCurl

FAKE_LI_AT = "FAKE_LI_AT"
FAKE_CSRF = "ajax:FAKE_CSRF"
FAKE_COOKIE_HEADER = f'li_at={FAKE_LI_AT}; JSESSIONID="{FAKE_CSRF}"; bcookie=DROP_ME'


def linkedin_headers(**overrides: str) -> dict[str, str]:
    headers = {
        "User-Agent": "pytest-linkedin-http-contract",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Cookie": FAKE_COOKIE_HEADER,
        "csrf-token": "stale-token",
        "Referer": "https://www.linkedin.com/jobs/search/?keywords=python",
        "X-Li-Track": "remove-in-slim-mode",
    }
    headers.update(overrides)
    return headers


def make_fetch_curl(
    name: str,
    *,
    base_url: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: str = "",
    referer: str = "",
    query_id: str = "",
    variables_count: int | None = None,
    cookies: dict[str, str] | None = None,
) -> FetchCurl:
    record = FetchCurl(name=name)
    record.id = abs(hash(name)) % 100000
    record.base_url = base_url
    record.method = method
    record.headers = json.dumps(headers or linkedin_headers())
    record.body = body
    record.referer = referer
    record.query_id = query_id
    record.variables_count = variables_count
    record.cookies = json.dumps(cookies or {})
    return record


def fake_linkedin_records() -> dict[str, FetchCurl]:
    return {
        "Pagination": make_fetch_curl(
            "Pagination",
            base_url="https://www.linkedin.com/voyager/api/graphql",
            method="GET",
            query_id="voyagerJobsDashJobCards.pagination",
            variables_count=24,
        ),
        "JobCardsLite": make_fetch_curl(
            "JobCardsLite",
            base_url=(
                "https://www.linkedin.com/voyager/api/voyagerJobsDashJobCards"
                "?decorationId=oldDecoration&count=7&q=jobSearch"
                "&query=(keywords:Old%20Search,locationUnion:(geoId:92000000),"
                "selectedFilters:(sortBy:List(R)))&servedEventEnabled=true&start=0"
                "&origin=JOB_SEARCH_PAGE_JOB_FILTER"
            ),
            method="GET",
            body="",
            referer="https://www.linkedin.com/jobs/search/?keywords=Old+Search",
        ),
        "SavedJobs": make_fetch_curl(
            "SavedJobs",
            base_url="https://www.linkedin.com/voyager/api/voyagerJobsDashJobCards?stage=saved",
            method="POST",
            body='{"stage":"saved","requestedArguments":{"states":[]}}',
        ),
        "PremiumInsights": make_fetch_curl(
            "PremiumInsights",
            base_url="https://www.linkedin.com/voyager/api/premium/jobInsights",
            method="POST",
            headers=linkedin_headers(Accept="text/x-component", **{"Accept-Encoding": "br"}),
            body='{"jobId":"1111111111","surface":"job-details"}',
        ),
        "Notifications": make_fetch_curl(
            "Notifications",
            base_url="https://www.linkedin.com/voyager/api/notifications/dash",
            method="GET",
        ),
        "Experience": make_fetch_curl(
            "Experience",
            base_url="https://www.linkedin.com/voyager/api/graphql?action=execute",
            method="POST",
            body='{"vanityName":"monicasbusatta","locale":"en-US"}',
        ),
        "Connections": make_fetch_curl(
            "Connections",
            base_url="https://www.linkedin.com/voyager/api/graphql?action=execute",
            method="POST",
            body='{"start":{START_INDEX},"count":10}',
        ),
    }


class FakeQuery:
    def __init__(self, records: dict[str, FetchCurl]):
        self.records = records
        self.name: str | None = None

    def filter_by(self, **kwargs: Any) -> "FakeQuery":
        self.name = kwargs.get("name")
        return self

    def filter(self, *criteria: Any) -> "FakeQuery":
        for criterion in criteria:
            right = getattr(criterion, "right", None)
            value = getattr(right, "value", None)
            if value in self.records:
                self.name = value
        return self

    def first(self) -> FetchCurl | None:
        return self.records.get(self.name)

    def order_by(self, *args: Any) -> "FakeQuery":
        return self


class FakeDbSession:
    def __init__(self, records: dict[str, FetchCurl]):
        self.records = records
        self.closed = False

    def query(self, _model: Any) -> FakeQuery:
        return FakeQuery(self.records)

    def close(self) -> None:
        self.closed = True

    def add(self, _obj: Any) -> None:
        return None

    def commit(self) -> None:
        return None

    def rollback(self) -> None:
        return None


def patch_linkedin_db(monkeypatch, records: dict[str, FetchCurl] | None = None):
    records = records or fake_linkedin_records()

    def get_db_session():
        return FakeDbSession(records)

    monkeypatch.setattr("database.database_connection.get_db_session", get_db_session)
    return records, get_db_session


@dataclass
class CapturedRequest:
    method: str
    url: str
    headers: dict[str, str] | None
    kwargs: dict[str, Any]


class FakeResponse:
    def __init__(
        self,
        status_code: int = 200,
        *,
        json_data: Any = None,
        text: str = "",
        headers: dict[str, str] | None = None,
        content: bytes | None = None,
    ):
        self.status_code = status_code
        self._json_data = json_data
        self.text = text
        self.headers = headers or {"Content-Type": "application/json"}
        if content is not None:
            self.content = content
        elif text:
            self.content = text.encode("utf-8")
        elif json_data is not None:
            self.content = json.dumps(json_data).encode("utf-8")
        else:
            self.content = b""

    def json(self):
        if self._json_data is None:
            raise ValueError("no json payload")
        return self._json_data

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")
