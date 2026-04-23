"""Unit tests for classifier.py."""
import pytest
from app.services.classifier import classify_urgency


class TestClassifyUrgency:
    """Tests use heuristic path (no model loader)."""

    def _classify(self, symptoms):
        return classify_urgency(symptoms, {}, model_loader=None)

    def test_chest_pain_is_emergency(self):
        result = self._classify(["chest_pain"])
        assert result["urgency_level"] == "EMERGENCY"

    def test_shortness_of_breath_is_emergency(self):
        result = self._classify(["shortness_of_breath"])
        assert result["urgency_level"] == "EMERGENCY"

    def test_fever_is_urgent(self):
        result = self._classify(["fever"])
        assert result["urgency_level"] == "URGENT"

    def test_headache_is_moderate(self):
        result = self._classify(["headache"])
        assert result["urgency_level"] == "MODERATE"

    def test_fatigue_is_low(self):
        result = self._classify(["fatigue"])
        assert result["urgency_level"] == "LOW"

    def test_empty_symptoms_is_unknown(self):
        result = self._classify([])
        assert result["urgency_level"] == "UNKNOWN"

    def test_emergency_overrides_low_symptom(self):
        result = self._classify(["fatigue", "chest_pain"])
        assert result["urgency_level"] == "EMERGENCY"

    def test_heuristic_sets_degraded_true(self):
        result = self._classify(["fever"])
        assert result["degraded"] is True

    def test_confidence_is_float(self):
        result = self._classify(["cough"])
        assert isinstance(result["confidence"], float)


class TestModelLoaderFallback:

    def test_failing_model_loader_falls_back_to_heuristic(self):
        class BrokenLoader:
            def is_ready(self):
                return True
            def predict(self, vec):
                raise RuntimeError("model broken")
            def get_vocab(self):
                return {}

        result = classify_urgency(["fever"], {}, model_loader=BrokenLoader())
        # Should fall back to heuristic without raising
        assert result["urgency_level"] == "URGENT"
        assert result["degraded"] is True
