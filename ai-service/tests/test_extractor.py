"""Tests for services/symptom_extractor.py"""
import pytest

# Ensure models exist before running; skip gracefully if not
try:
    from services.symptom_extractor import extract_symptoms
    _AVAILABLE = True
except Exception:
    _AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not _AVAILABLE, reason="symptom_extractor unavailable (models not trained?)"
)


def test_detects_fever_from_english():
    result = extract_symptoms("I have a high fever")
    assert "high_fever" in result["detected_symptoms"]


def test_detects_vomiting_synonym():
    result = extract_symptoms("I keep throwing up")
    assert "vomiting" in result["detected_symptoms"]


def test_detects_kinyarwanda_fever():
    result = extract_symptoms("Mfite umuriro", language="rw")
    assert "high_fever" in result["detected_symptoms"]


def test_detects_french_cough():
    result = extract_symptoms("J'ai une toux", language="fr")
    assert "cough" in result["detected_symptoms"]


def test_empty_input_returns_zero_symptoms():
    result = extract_symptoms("")
    assert result["symptom_count"] == 0


def test_returns_correct_vector_length():
    result = extract_symptoms("I have fever")
    assert len(result["symptom_vector"]) == 132


def test_vector_values_are_binary():
    result = extract_symptoms("I have fever and cough")
    assert all(v in (0, 1) for v in result["symptom_vector"])


def test_body_map_chest_adds_chest_pain():
    result = extract_symptoms("", body_map_data={"regions": ["chest"]})
    assert "chest_pain" in result["detected_symptoms"]
