import json
from pathlib import Path
from unittest.mock import patch

from source.features.fetch_curl.fetch_service import FetchService
from source.features.job_population.linkedin_parser import parse_job_entries
from source.features.job_population.population_service import PopulationService
from source.features.job_population.search_spec import PipelineSearchSpec


FIXTURE_PATH = (
    Path(__file__).resolve().parents[1]
    / "source"
    / "features"
    / "search_jobs"
    / "linkedin_graphql_response.json"
)


def load_search_fixture():
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_parse_job_entries_supports_jobcardslite_payload():
    payload = load_search_fixture()

    jobs = parse_job_entries(payload)

    assert jobs
    assert jobs[0]["job_id"]
    assert jobs[0]["job_url"].startswith("https://www.linkedin.com/jobs/view/")
    assert "company_name" in jobs[0]


def test_inspect_pagination_payload_supports_jobcardslite_shape():
    payload = load_search_fixture()

    inspection = PopulationService._inspect_pagination_payload(payload)

    assert inspection["ok"] is True
    assert inspection["source"] == "JobCardsLite"
    assert inspection["paging"]["count"] == 10
    assert inspection["paging"]["total"] > 0


def test_validate_search_mode_uses_jobcardslite_reference_gate():
    payload = load_search_fixture()
    search_spec = PipelineSearchSpec(
        keywords="Python",
        excluded_keywords=["Junior", "Intern"],
        geo_id="106057199",
        distance=25,
        count=10,
    )

    with patch.object(FetchService, "validate_search_reference", return_value={
        "success": True,
        "page": 1,
        "curl": "JobCardsLite",
        "status": 200,
        "data": payload,
    }):
        result = PopulationService.validate_search_mode(search_spec)

    assert result["success"] is True
    assert result["mode"] == "search"
    assert result["curl"] == "JobCardsLite"
    assert result["parsed_entries"] > 0


def test_validate_search_mode_fails_when_reference_replay_fails():
    search_spec = PipelineSearchSpec(keywords="Python")

    with patch.object(FetchService, "validate_search_reference", return_value={
        "success": False,
        "curl": "JobCardsLite",
        "error_type": "auth_error",
        "error": "Stored JobCardsLite reference replay failed",
        "details": "HTTP 403",
    }):
        result = PopulationService.validate_search_mode(search_spec)

    assert result["success"] is False
    assert result["step"] == "validate_search_reference"
    assert result["curl"] == "JobCardsLite"
