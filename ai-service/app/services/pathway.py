"""Rule-based care pathway engine."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class CarePathway:
    recommended_action: str
    specialist_type: str | None
    self_care_tips: list[str]
    follow_up_days: int | None
    requires_immediate_care: bool


# ── Urgency → pathway rules ────────────────────────────────────────────────────

_SPECIALIST_MAP: dict[str, str] = {
    "chest_pain":          "Cardiologist",
    "shortness_of_breath": "Pulmonologist",
    "headache":            "Neurologist",
    "abdominal_pain":      "Gastroenterologist",
    "back_pain":           "Orthopedist",
    "joint_pain":          "Rheumatologist",
    "rash":                "Dermatologist",
    "sore_throat":         "ENT Specialist",
    "fever":               "General Practitioner",
    "cough":               "General Practitioner",
}

_SELF_CARE_MAP: dict[str, list[str]] = {
    "fever": [
        "Stay hydrated — drink at least 8 glasses of water per day",
        "Rest and avoid strenuous activity",
        "Take paracetamol / ibuprofen if temperature exceeds 38.5 °C",
    ],
    "headache": [
        "Rest in a quiet, dark room",
        "Apply a cold or warm compress to your forehead",
        "Stay hydrated",
    ],
    "cough": [
        "Drink warm liquids such as herbal tea or broth",
        "Use honey (1 teaspoon) to soothe the throat",
        "Avoid smoke and strong odours",
    ],
    "sore_throat": [
        "Gargle with warm salt water several times a day",
        "Drink warm liquids",
        "Avoid cold drinks",
    ],
    "nausea": [
        "Eat small, bland meals (crackers, rice, toast)",
        "Avoid strong smells and greasy foods",
        "Stay upright for at least 30 minutes after eating",
    ],
    "diarrhea": [
        "Drink oral rehydration solution (ORS) or electrolyte drinks",
        "Eat bland, low-fibre foods",
        "Avoid dairy products temporarily",
    ],
    "fatigue": [
        "Ensure 7-9 hours of sleep per night",
        "Stay hydrated and eat balanced meals",
        "Light exercise such as a 15-minute walk may help",
    ],
    "back_pain": [
        "Apply ice for the first 48 hours, then heat",
        "Gentle stretching and movement",
        "Avoid prolonged bed rest",
    ],
    "joint_pain": [
        "Rest the affected joint",
        "Apply ice to reduce swelling",
        "Over-the-counter anti-inflammatories if not contraindicated",
    ],
}

_GENERIC_SELF_CARE = [
    "Rest and monitor your symptoms",
    "Stay hydrated",
    "Seek medical attention if symptoms worsen",
]


# ── Public API ─────────────────────────────────────────────────────────────────

def determine_pathway(urgency_level: str, symptoms: list[str]) -> CarePathway:
    """Generate a care pathway from urgency level and extracted symptoms."""

    if urgency_level == "EMERGENCY":
        return CarePathway(
            recommended_action="Seek emergency medical care immediately (call 912 or go to ER)",
            specialist_type="Emergency Medicine",
            self_care_tips=["Do not delay — go to the nearest emergency room"],
            follow_up_days=None,
            requires_immediate_care=True,
        )

    if urgency_level == "URGENT":
        specialist = _pick_specialist(symptoms) or "General Practitioner"
        return CarePathway(
            recommended_action=(
                "Visit a clinic or hospital within the next 24 hours"
            ),
            specialist_type=specialist,
            self_care_tips=_collect_self_care(symptoms),
            follow_up_days=1,
            requires_immediate_care=False,
        )

    if urgency_level == "ROUTINE":
        specialist = _pick_specialist(symptoms)
        return CarePathway(
            recommended_action="Schedule an appointment with a healthcare provider within 1-3 days",
            specialist_type=specialist,
            self_care_tips=_collect_self_care(symptoms),
            follow_up_days=3,
            requires_immediate_care=False,
        )

    if urgency_level == "SELF_CARE":
        return CarePathway(
            recommended_action="Monitor symptoms at home; consult a provider if they persist beyond 3 days",
            specialist_type=None,
            self_care_tips=_collect_self_care(symptoms) or _GENERIC_SELF_CARE,
            follow_up_days=7,
            requires_immediate_care=False,
        )

    # UNKNOWN
    return CarePathway(
        recommended_action="Please provide more symptom details for a better assessment",
        specialist_type=None,
        self_care_tips=_GENERIC_SELF_CARE,
        follow_up_days=None,
        requires_immediate_care=False,
    )


def _pick_specialist(symptoms: list[str]) -> str | None:
    for sym in symptoms:
        if sym in _SPECIALIST_MAP:
            return _SPECIALIST_MAP[sym]
    return None


def _collect_self_care(symptoms: list[str]) -> list[str]:
    tips: list[str] = []
    seen: set[str] = set()
    for sym in symptoms:
        for tip in _SELF_CARE_MAP.get(sym, []):
            if tip not in seen:
                tips.append(tip)
                seen.add(tip)
    return tips or _GENERIC_SELF_CARE
