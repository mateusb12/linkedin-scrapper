import pytest
import importlib
import importlib.util
from pathlib import Path
from unittest.mock import patch

# --- Module Imports for Robust Patching ---
# We import the specific instances or classes used in the controllers
from source.features.job_population import core_instances
from source.integrations.llm.model_orchestrator import LLMOrchestrator


@pytest.fixture
def client():
    app_path = Path(__file__).resolve().parents[1] / "app.py"
    spec = importlib.util.spec_from_file_location("backend_app_module", app_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    flask_app = module.app
    flask_app.config['TESTING'] = True
    with flask_app.test_client() as client:
        yield client


def test_calculate_match_score(client):
    """
    STORY: As a user, I want a 0-100% score for a job vs. my resume.
    CURL (Request): POST /jobs/match-score
    RESULT: 200 OK, JSON with 'match_score'.
    """
    payload = {
        "resume_text": "I am a Python Expert",
        "job_description": "We need a Python Expert"
    }

    # Patch the instance method on the global object imported by the controller
    with patch.object(core_instances.embedding_calculator, 'compute_similarity', return_value=0.98) as mock_calc:
        # Action
        response = client.post('/jobs/match-score', json=payload)

        # Expectation
        assert response.status_code == 200
        assert response.json['match_score'] == 0.98

        # Verify correct arguments were passed to the engine
        mock_calc.assert_called_with(
            resume_text=payload['resume_text'],
            job_text=payload['job_description']
        )


def test_tailor_resume_with_ai(client):
    """
    STORY: As a user, I want AI to rewrite my resume for a specific job.
    CURL (Request): POST /resumes/tailor
    RESULT: 200 OK, JSON with the new markdown resume.
    """
    payload = {
        "raw_job_description": "Must know AWS",
        "raw_resume": "I know Linux",
        "extracted_job_keywords": ["AWS"],
        "extracted_resume_keywords": ["Linux"],
        "current_cosine_similarity": 0.5
    }

    mock_llm_response = {
        "tailored_resume": "# My Tailored Resume\nNow I know AWS."
    }

    # Patch the LLM Orchestrator class
    with patch.object(LLMOrchestrator, 'run_prompt', return_value=mock_llm_response) as mock_orchestrator:
        # Action
        response = client.post('/resumes/tailor', json=payload)

        # Expectation
        assert response.status_code == 200
        assert response.json['tailored_resume'] == mock_llm_response['tailored_resume']
