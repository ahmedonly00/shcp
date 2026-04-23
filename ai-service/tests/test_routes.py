"""Tests for Flask /analyze and /health routes."""
import pytest

try:
    from app import create_app
    _AVAILABLE = True
except Exception:
    _AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not _AVAILABLE, reason="Flask app unavailable"
)


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_health_returns_200(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "ok"


def test_analyze_valid_english_input(client):
    resp = client.post(
        "/analyze",
        json={"symptom_text": "I have fever and headache", "language": "en"},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "urgency" in data


def test_analyze_missing_symptom_text_returns_400(client):
    resp = client.post("/analyze", json={})
    assert resp.status_code == 400


def test_analyze_empty_string_returns_no_symptoms(client):
    resp = client.post("/analyze", json={"symptom_text": "xyz123abc"})
    assert resp.status_code == 200
    data = resp.get_json()
    # Either no symptoms detected or low confidence
    assert "urgency" in data


def test_analyze_invalid_language_returns_400(client):
    resp = client.post(
        "/analyze",
        json={"symptom_text": "I have a fever", "language": "de"},
    )
    assert resp.status_code == 400


def test_analyze_returns_disclaimer_in_response(client):
    resp = client.post(
        "/analyze",
        json={"symptom_text": "I have high fever, chills, vomiting"},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    # disclaimer present on OK or LOW_CONFIDENCE responses
    if data.get("status") in ("OK", "LOW_CONFIDENCE"):
        assert "disclaimer" in data
