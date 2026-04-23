"""Unit tests for request validators."""
import pytest
from app.utils.validators import validate_analyze_request


class TestValidateAnalyzeRequest:

    def test_valid_minimal_request(self):
        errors = validate_analyze_request({"symptom_text": "I have a fever"})
        assert errors == []

    def test_valid_full_request(self):
        errors = validate_analyze_request({
            "symptom_text": "I have chest pain",
            "language": "en",
            "body_map_data": {"chest": True}
        })
        assert errors == []

    def test_missing_symptom_text_returns_error(self):
        errors = validate_analyze_request({})
        assert any("symptom_text" in e for e in errors)

    def test_empty_symptom_text_returns_error(self):
        errors = validate_analyze_request({"symptom_text": "  "})
        assert len(errors) > 0

    def test_too_short_symptom_text_returns_error(self):
        errors = validate_analyze_request({"symptom_text": "hi"})
        assert len(errors) > 0

    def test_symptom_text_too_long_returns_error(self):
        errors = validate_analyze_request({"symptom_text": "x" * 2001})
        assert any("exceed" in e for e in errors)

    def test_non_string_symptom_text_returns_error(self):
        errors = validate_analyze_request({"symptom_text": 12345})
        assert len(errors) > 0

    def test_valid_language_en(self):
        errors = validate_analyze_request({"symptom_text": "I feel sick", "language": "en"})
        assert errors == []

    def test_valid_language_rw(self):
        errors = validate_analyze_request({"symptom_text": "I feel sick", "language": "rw"})
        assert errors == []

    def test_valid_language_fr(self):
        errors = validate_analyze_request({"symptom_text": "I feel sick", "language": "fr"})
        assert errors == []

    def test_invalid_language_returns_error(self):
        errors = validate_analyze_request({"symptom_text": "I feel sick", "language": "es"})
        assert any("language" in e for e in errors)

    def test_non_dict_body_map_returns_error(self):
        errors = validate_analyze_request({
            "symptom_text": "I feel sick",
            "body_map_data": ["chest"]
        })
        assert any("body_map_data" in e for e in errors)

    def test_none_language_is_allowed(self):
        """Language is optional — None means auto-detect."""
        errors = validate_analyze_request({"symptom_text": "I feel sick", "language": None})
        assert errors == []

    def test_multiple_errors_returned_together(self):
        """All validation errors returned in one call."""
        errors = validate_analyze_request({"symptom_text": "hi", "language": "zz"})
        assert len(errors) >= 2
