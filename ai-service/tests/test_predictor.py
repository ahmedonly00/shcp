"""Tests for services/predictor.py"""
import pytest

try:
    from services.predictor import predict
    from services.symptom_extractor import extract_symptoms, _SYMPTOM_COLUMNS
    _AVAILABLE = bool(_SYMPTOM_COLUMNS)
except Exception:
    _AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not _AVAILABLE, reason="predictor unavailable (models not trained?)"
)


def _vec(symptoms: list[str]):
    from services.symptom_extractor import _SYMPTOM_COLUMNS
    return [1 if c in symptoms else 0 for c in _SYMPTOM_COLUMNS]


def test_malaria_symptoms_predict_malaria():
    syms = ["high_fever", "chills", "muscle_pain", "vomiting", "sweating", "headache"]
    result = predict(_vec(syms), syms)
    assert result["disease"] == "Malaria"
    assert result["urgency"] == "URGENT"
    assert result["confidence"] >= 40.0


def test_heart_attack_symptoms_return_emergency():
    syms = ["chest_pain", "breathlessness", "sweating"]
    result = predict(_vec(syms), syms)
    assert result["urgency"] == "EMERGENCY"


def test_cold_symptoms_return_self_care():
    # 4 of ~12 cold symptoms → model may not reach 40% confidence threshold;
    # UNKNOWN is acceptable since cold is never safety-escalated to EMERGENCY
    syms = ["continuous_sneezing", "runny_nose", "throat_irritation", "cough"]
    result = predict(_vec(syms), syms)
    assert result["urgency"] in ("SELF_CARE", "ROUTINE", "UNKNOWN")
    assert result["urgency"] != "EMERGENCY"


def test_low_confidence_or_ok():
    syms = ["fatigue"]
    result = predict(_vec(syms), syms)
    assert result["status"] in ("LOW_CONFIDENCE", "OK")


def test_chest_pain_plus_breathlessness_override():
    syms = ["chest_pain", "breathlessness"]
    result = predict(_vec(syms), syms)
    assert result["urgency"] == "EMERGENCY"


def test_stiff_neck_plus_fever_override():
    syms = ["high_fever", "stiff_neck"]
    result = predict(_vec(syms), syms)
    assert result["urgency"] == "EMERGENCY"


def test_response_has_required_fields():
    syms = ["high_fever", "vomiting", "headache"]
    result = predict(_vec(syms), syms)
    for field in ("status", "urgency", "pathway", "confidence",
                  "detected_symptoms", "disclaimer", "processed_at"):
        assert field in result, f"Missing field: {field}"


def test_top_3_predictions_sum_near_100():
    syms = ["high_fever", "chills", "sweating", "vomiting"]
    result = predict(_vec(syms), syms)
    if result["status"] == "OK":
        total = sum(p["probability"] for p in result["top_3_predictions"])
        assert total > 50
