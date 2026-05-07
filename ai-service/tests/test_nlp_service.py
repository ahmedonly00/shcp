"""Unit tests for nlp_service.py."""
import pytest
from app.services.nlp_service import extract_symptoms


class TestExtractSymptoms:

    def test_detects_fever_and_headache(self):
        result = extract_symptoms("I have a fever and a bad headache")
        assert "high_fever" in result["symptoms"]
        assert "headache" in result["symptoms"]

    def test_detects_chest_pain(self):
        result = extract_symptoms("I am having chest pain and trouble breathing")
        assert "chest_pain" in result["symptoms"]
        assert "breathlessness" in result["symptoms"]

    def test_negation_is_excluded(self):
        result = extract_symptoms("I have no fever and no headache")
        assert "high_fever" not in result["symptoms"]
        assert "headache" not in result["symptoms"]
        assert "high_fever" in result["negated"]

    def test_body_map_data_adds_symptom(self):
        result = extract_symptoms(
            "I feel unwell",
            body_map_data={"chest": True, "head": True},
        )
        assert "chest_pain" in result["symptoms"]
        assert "headache" in result["symptoms"]

    def test_duration_hint_extracted(self):
        result = extract_symptoms("I have had a cough for 3 days")
        assert result["duration_hint"] == "3 days"

    def test_no_duration_hint_returns_none(self):
        result = extract_symptoms("I feel sick")
        assert result["duration_hint"] is None

    def test_empty_text_returns_empty_symptoms(self):
        result = extract_symptoms("   ")
        assert result["symptoms"] == []

    def test_french_symptom_detected(self):
        result = extract_symptoms("J'ai de la fièvre et une toux", language="fr")
        assert "high_fever" in result["symptoms"]
        assert "cough" in result["symptoms"]

    def test_body_map_false_does_not_add_symptom(self):
        result = extract_symptoms("I feel fine", body_map_data={"chest": False})
        assert "chest_pain" not in result["symptoms"]
