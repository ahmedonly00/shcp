"""Unit tests for the care pathway engine."""
import pytest
from app.services.pathway import determine_pathway, CarePathway


class TestEmergencyPathway:

    def test_chest_pain_requires_immediate_care(self):
        p = determine_pathway("EMERGENCY", ["chest_pain"])
        assert p.requires_immediate_care is True

    def test_emergency_recommends_er(self):
        p = determine_pathway("EMERGENCY", ["shortness_of_breath"])
        assert "emergency" in p.recommended_action.lower()

    def test_emergency_specialist_is_emergency_medicine(self):
        p = determine_pathway("EMERGENCY", ["chest_pain"])
        assert p.specialist_type == "Emergency Medicine"

    def test_emergency_follow_up_days_is_none(self):
        p = determine_pathway("EMERGENCY", ["chest_pain"])
        assert p.follow_up_days is None


class TestUrgentPathway:

    def test_urgent_recommended_within_24h(self):
        p = determine_pathway("URGENT", ["fever"])
        assert p.follow_up_days == 1

    def test_urgent_not_immediate_care(self):
        p = determine_pathway("URGENT", ["vomiting"])
        assert p.requires_immediate_care is False

    def test_urgent_has_specialist(self):
        p = determine_pathway("URGENT", ["fever"])
        assert p.specialist_type is not None

    def test_urgent_self_care_tips_not_empty(self):
        p = determine_pathway("URGENT", ["fever"])
        assert len(p.self_care_tips) > 0


class TestRoutinePathway:

    def test_routine_follow_up_3_days(self):
        p = determine_pathway("ROUTINE", ["headache"])
        assert p.follow_up_days == 3

    def test_routine_picks_specialist_by_symptom(self):
        p = determine_pathway("ROUTINE", ["headache"])
        assert p.specialist_type == "Neurologist"

    def test_routine_abdominal_picks_gastro(self):
        p = determine_pathway("ROUTINE", ["abdominal_pain"])
        assert p.specialist_type == "Gastroenterologist"


class TestSelfCarePathway:

    def test_self_care_follow_up_7_days(self):
        p = determine_pathway("SELF_CARE", ["fatigue"])
        assert p.follow_up_days == 7

    def test_self_care_no_specialist(self):
        p = determine_pathway("SELF_CARE", ["fatigue"])
        assert p.specialist_type is None

    def test_self_care_not_immediate_care(self):
        p = determine_pathway("SELF_CARE", ["fatigue"])
        assert p.requires_immediate_care is False


class TestUnknownPathway:

    def test_unknown_no_follow_up(self):
        p = determine_pathway("UNKNOWN", [])
        assert p.follow_up_days is None

    def test_unknown_no_immediate_care(self):
        p = determine_pathway("UNKNOWN", [])
        assert p.requires_immediate_care is False

    def test_unknown_has_generic_tips(self):
        p = determine_pathway("UNKNOWN", [])
        assert len(p.self_care_tips) > 0
