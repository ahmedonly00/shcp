"""Rule-based care pathway engine."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class CarePathway:
    recommended_action: str
    specialist_type: str | None
    self_care_tips: list[str]
    follow_up_days: int | None
    requires_immediate_care: bool


# ── Specialist map ────────────────────────────────────────────────────────────

_SPECIALIST_MAP: dict[str, str] = {
    "chest_pain":          "Cardiologist",
    "breathlessness":      "Pulmonologist",
    "headache":            "Neurologist",
    "abdominal_pain":      "Gastroenterologist",
    "stomach_pain":        "Gastroenterologist",
    "back_pain":           "Orthopedist",
    "joint_pain":          "Rheumatologist",
    "skin_rash":           "Dermatologist",
    "throat_irritation":   "ENT Specialist",
    "high_fever":          "General Practitioner",
    "mild_fever":          "General Practitioner",
    "cough":               "General Practitioner",
}

# ── Age-bucketed self-care tips ───────────────────────────────────────────────
#
# Buckets: "infant" (age 0), "young_child" (1–4), "child" (5–12),
#          "adult" (13–64), "elderly" (65+).
# _collect_self_care() falls back to "adult" when a bucket key is absent.

_SELF_CARE_MAP: dict[str, dict[str, list[str]]] = {
    "high_fever": {
        "infant": [
            "Seek medical care immediately — fever in infants under 12 months is always a medical emergency",
            "Keep your baby lightly dressed to help cool the body",
            "Continue breastfeeding or formula-feeding frequently",
            "Do not give any medication without a doctor's instruction",
        ],
        "young_child": [
            "Give paracetamol only, following the weight-based dosage on the packaging",
            "Avoid ibuprofen in children under 6 months; use only as directed by your pediatrician",
            "Offer frequent small sips of water, diluted juice, or oral rehydration solution (ORS)",
            "Dress your child in light clothing and keep the room comfortably cool",
            "Sponge with lukewarm (not cold) water if the child is very uncomfortable",
        ],
        "child": [
            "Give paracetamol or ibuprofen at the correct weight-based dose — avoid aspirin in children",
            "Encourage drinking water or diluted juice regularly",
            "Rest at home and check temperature every 4 hours",
            "See a doctor if fever exceeds 39.5 °C or lasts more than 3 days",
        ],
        "adult": [
            "Stay hydrated — drink at least 8 glasses of water per day",
            "Rest and avoid strenuous activity",
            "Take paracetamol or ibuprofen if temperature exceeds 38.5 °C",
        ],
        "elderly": [
            "Take paracetamol as directed — avoid NSAIDs (ibuprofen) unless prescribed due to kidney and stomach risks",
            "Drink small amounts of fluid frequently throughout the day",
            "Ask a caregiver or family member to check on you regularly",
            "Seek medical attention promptly — fever in older adults can deteriorate quickly",
        ],
    },
    "mild_fever": {
        "infant": [
            "Even mild fever in infants under 12 months warrants a call to your pediatrician",
            "Continue breastfeeding or formula-feeding frequently",
            "Keep your baby lightly dressed and in a comfortable, cool environment",
        ],
        "young_child": [
            "Offer frequent small sips of water or diluted juice",
            "Dress your child lightly and keep the room cool",
            "Give paracetamol if your child is clearly uncomfortable — follow weight-based dosing",
        ],
        "child": [
            "Encourage rest and regular fluid intake",
            "Give paracetamol or ibuprofen if your child is uncomfortable — follow weight-based package dosing",
            "Monitor temperature and see a doctor if it rises above 39 °C",
        ],
        "adult": [
            "Stay hydrated — drink at least 8 glasses of water per day",
            "Rest and avoid strenuous activity",
            "Take paracetamol or ibuprofen if temperature exceeds 38.5 °C",
        ],
        "elderly": [
            "Drink fluids frequently — dehydration can develop quickly in older adults",
            "Take paracetamol if needed — check with your pharmacist about interactions with existing medications",
            "Have someone check on you regularly; seek care if you feel worse",
        ],
    },
    "headache": {
        "infant": [
            "Do not give any pain medication to an infant — seek medical attention promptly",
            "Monitor for other warning signs: bulging fontanelle, excessive crying, vomiting, or stiff neck",
        ],
        "young_child": [
            "Ensure your child is well-hydrated and rested in a quiet room",
            "Apply a cool, damp cloth to the forehead",
            "Consult your pediatrician before giving any pain relief",
        ],
        "child": [
            "Rest in a quiet, dim room",
            "Ensure adequate hydration",
            "Paracetamol at the correct weight-based dose may help — avoid aspirin in children under 16",
        ],
        "adult": [
            "Rest in a quiet, dark room",
            "Apply a cold or warm compress to your forehead",
            "Stay hydrated",
        ],
        "elderly": [
            "Rest in a quiet room with adequate hydration",
            "Use paracetamol if needed — avoid NSAIDs unless prescribed",
            "Seek urgent care for any sudden severe ('thunderclap') headache or headache with vision changes or weakness",
        ],
    },
    "cough": {
        "infant": [
            "Elevate the head of the cot slightly if safe to do so",
            "Use a cool-mist humidifier in the room",
            "Never use honey, cough drops, or over-the-counter cough medicines — they are unsafe for infants",
            "See your pediatrician if the cough is persistent, frequent, or accompanied by rapid breathing",
        ],
        "young_child": [
            "Offer warm water or diluted herbal tea in small sips",
            "For children over 12 months, one teaspoon of honey may help soothe the throat",
            "Use a cool-mist humidifier",
            "Do not use over-the-counter cough medicines in children under 6 without medical advice",
        ],
        "child": [
            "Drink warm liquids such as herbal tea",
            "One teaspoon of honey to soothe the throat",
            "Use a humidifier and avoid smoke or strong odours",
        ],
        "adult": [
            "Drink warm liquids such as herbal tea or broth",
            "Use honey (1 teaspoon) to soothe the throat",
            "Avoid smoke and strong odours",
        ],
        "elderly": [
            "Drink warm liquids frequently throughout the day",
            "Use honey if tolerated — check with your pharmacist if you have diabetes",
            "Avoid cold air and strong odours",
            "Persistent cough in older adults should be evaluated promptly to rule out serious causes",
        ],
    },
    "throat_irritation": {
        "infant": [
            "Offer frequent feeds — breastmilk or formula is soothing and provides hydration",
            "Use a cool-mist humidifier in the room",
            "Consult your pediatrician if feeding becomes difficult or breathing seems laboured",
        ],
        "young_child": [
            "Offer warm water in small sips",
            "A cool-mist humidifier can reduce irritation",
            "Avoid cold drinks and ice",
        ],
        "child": [
            "Gargle with warm salt water (only if old enough to do so safely)",
            "Drink warm liquids",
            "Avoid cold drinks",
        ],
        "adult": [
            "Gargle with warm salt water several times a day",
            "Drink warm liquids",
            "Avoid cold drinks",
        ],
        "elderly": [
            "Gargle gently with warm salt water or sip warm herbal tea",
            "Drink warm fluids frequently",
            "Seek medical attention if swallowing becomes painful or breathing is affected",
        ],
    },
    "nausea": {
        "infant": [
            "Continue breastfeeding or formula-feeding in smaller, more frequent amounts",
            "Consult your pediatrician if vomiting is persistent or your baby cannot keep fluids down",
        ],
        "young_child": [
            "Offer small amounts of clear fluids (water, diluted juice, ORS) frequently",
            "Introduce bland foods (dry toast, crackers, rice) gradually once tolerated",
            "Avoid dairy products temporarily",
        ],
        "child": [
            "Eat small, bland meals (crackers, rice, dry toast)",
            "Sip water or oral rehydration solution regularly",
            "Avoid strong smells and greasy foods",
        ],
        "adult": [
            "Eat small, bland meals (crackers, rice, toast)",
            "Avoid strong smells and greasy foods",
            "Stay upright for at least 30 minutes after eating",
        ],
        "elderly": [
            "Eat small, bland meals and sip fluids slowly throughout the day",
            "Sit upright for at least 30–45 minutes after eating",
            "Dehydration develops quickly — if nausea prevents fluid intake, seek medical attention",
        ],
    },
    "diarrhoea": {
        "infant": [
            "Continue breastfeeding or formula-feeding — do not replace feeds with ORS without medical guidance",
            "Consult your pediatrician immediately — infants dehydrate very quickly",
            "Go to the ER if you notice: dry mouth, no wet nappies for 6+ hours, or a sunken fontanelle",
        ],
        "young_child": [
            "Offer oral rehydration solution (ORS) frequently in small sips",
            "Gradually reintroduce bland foods such as rice, toast, or bananas",
            "Avoid fruit juice and sugary drinks",
            "See a doctor if the child has 6 or more episodes in 24 hours",
        ],
        "child": [
            "Drink oral rehydration solution (ORS) or electrolyte drinks",
            "Eat bland, low-fibre foods",
            "Avoid dairy products temporarily",
        ],
        "adult": [
            "Drink oral rehydration solution (ORS) or electrolyte drinks",
            "Eat bland, low-fibre foods",
            "Avoid dairy products temporarily",
        ],
        "elderly": [
            "Sip oral rehydration solution or electrolyte drinks frequently — dehydration is a serious risk",
            "Eat bland, easily digestible foods",
            "Seek medical attention if diarrhoea lasts more than 24 hours or you feel faint or confused",
        ],
    },
    "fatigue": {
        "infant": [
            "Unusual lethargy or reduced activity in an infant requires prompt medical evaluation",
        ],
        "young_child": [
            "Ensure your child gets adequate rest and sleep",
            "Offer nutritious, balanced meals and maintain fluid intake",
            "Consult your pediatrician if fatigue persists for more than a few days",
        ],
        "child": [
            "Ensure 9–11 hours of sleep per night",
            "Stay hydrated and eat balanced meals",
            "Limit screen time and encourage light outdoor activity",
        ],
        "adult": [
            "Ensure 7–9 hours of sleep per night",
            "Stay hydrated and eat balanced meals",
            "Light exercise such as a 15-minute walk may help",
        ],
        "elderly": [
            "Ensure 7–9 hours of sleep per night",
            "Stay hydrated and eat nutritious, protein-rich meals",
            "Gentle movement such as slow walking is beneficial if safe to do so",
            "Persistent fatigue in older adults should be evaluated to rule out anaemia, cardiac, or thyroid causes",
        ],
    },
    "back_pain": {
        "infant": [
            "Back pain is unusual in infants — consult your pediatrician",
        ],
        "young_child": [
            "Encourage gentle rest but avoid prolonged bed rest",
            "A warm compress may provide relief",
            "Consult your pediatrician — back pain is uncommon in young children and should be assessed",
        ],
        "child": [
            "Encourage gentle activity and stretching",
            "Apply a warm compress to the affected area",
            "Check for poor posture or a heavy school bag as a contributing factor",
        ],
        "adult": [
            "Apply ice for the first 48 hours, then heat",
            "Gentle stretching and movement",
            "Avoid prolonged bed rest",
        ],
        "elderly": [
            "Apply gentle heat to the affected area",
            "Move gently and avoid activities with fall risk",
            "Avoid NSAIDs unless prescribed — they carry higher risks in older adults",
            "See a physiotherapist or your doctor if pain is persistent",
        ],
    },
    "joint_pain": {
        "infant": [
            "Joint pain or swelling in an infant requires immediate medical evaluation",
        ],
        "young_child": [
            "Rest the affected joint and apply an ice pack wrapped in a cloth",
            "Consult your pediatrician — joint pain in young children should be evaluated to rule out infection",
        ],
        "child": [
            "Rest the affected joint",
            "Apply ice wrapped in a cloth to reduce swelling",
            "Paracetamol at the correct weight-based dose if needed — avoid aspirin in children",
        ],
        "adult": [
            "Rest the affected joint",
            "Apply ice to reduce swelling",
            "Over-the-counter anti-inflammatories if not contraindicated",
        ],
        "elderly": [
            "Rest the affected joint and apply gentle heat or ice as tolerated",
            "Avoid NSAIDs unless prescribed — discuss safer options with your doctor",
            "Use a walking aid if needed to reduce joint load and fall risk",
            "Physiotherapy can be very beneficial for chronic joint pain",
        ],
    },
}

_GENERIC_SELF_CARE: dict[str, list[str]] = {
    "infant": [
        "Monitor your baby closely and consult your pediatrician",
        "Continue breastfeeding or formula-feeding",
        "Seek immediate care if your baby seems unusually unwell or lethargic",
    ],
    "young_child": [
        "Encourage rest and offer fluids frequently",
        "Monitor symptoms and consult your pediatrician if they worsen",
        "Seek care sooner if your child refuses to eat or drink",
    ],
    "child": [
        "Rest and monitor your symptoms",
        "Stay hydrated",
        "See a doctor if symptoms worsen or persist beyond 3 days",
    ],
    "adult": [
        "Rest and monitor your symptoms",
        "Stay hydrated",
        "Seek medical attention if symptoms worsen",
    ],
    "elderly": [
        "Rest and monitor your symptoms closely",
        "Drink fluids frequently throughout the day",
        "Have a caregiver or family member check on you",
        "Seek medical attention promptly if symptoms worsen — older adults can deteriorate faster",
    ],
}


# ── Age helpers ───────────────────────────────────────────────────────────────

def _age_bucket(age: int | None) -> str:
    if age is None:
        return "adult"
    if age == 0:
        return "infant"
    if age < 5:
        return "young_child"
    if age < 13:
        return "child"
    if age >= 65:
        return "elderly"
    return "adult"


def _is_minor(age: int | None) -> bool:
    return age is not None and age < 18


# ── Public API ─────────────────────────────────────────────────────────────────

def determine_pathway(
    urgency_level: str,
    symptoms: list[str],
    age: int | None = None,
) -> CarePathway:
    """Generate an age-appropriate care pathway from urgency level and symptoms."""
    bucket = _age_bucket(age)
    minor = _is_minor(age)

    if urgency_level == "EMERGENCY":
        if age == 0:
            action = (
                "Take your infant to the nearest emergency room immediately "
                "or call emergency services — do not delay"
            )
        elif minor:
            action = (
                "Take your child to the nearest emergency room immediately "
                "or call emergency services"
            )
        else:
            action = "Seek emergency medical care immediately (call 912 or go to the nearest ER)"
        return CarePathway(
            recommended_action=action,
            specialist_type="Emergency Medicine",
            self_care_tips=["Do not delay — go to the nearest emergency room immediately"],
            follow_up_days=None,
            requires_immediate_care=True,
        )

    if urgency_level == "URGENT":
        specialist = _pick_specialist(symptoms) or "General Practitioner"
        if age == 0:
            action = (
                "Take your infant to a clinic or hospital within the next few hours — "
                "infants can deteriorate quickly"
            )
        elif minor:
            action = "Have your child seen by a doctor within the next 24 hours"
        else:
            action = "Visit a clinic or hospital within the next 24 hours"
        return CarePathway(
            recommended_action=action,
            specialist_type=specialist,
            self_care_tips=_collect_self_care(symptoms, bucket),
            follow_up_days=1,
            requires_immediate_care=False,
        )

    if urgency_level == "ROUTINE":
        specialist = _pick_specialist(symptoms)
        if minor:
            action = "Schedule an appointment with your child's pediatrician within 1–3 days"
        else:
            action = "Schedule an appointment with a healthcare provider within 1–3 days"
        return CarePathway(
            recommended_action=action,
            specialist_type=specialist,
            self_care_tips=_collect_self_care(symptoms, bucket),
            follow_up_days=3,
            requires_immediate_care=False,
        )

    if urgency_level == "SELF_CARE":
        if age == 0:
            action = (
                "Monitor your infant closely at home; consult your pediatrician "
                "if symptoms do not improve within 24 hours"
            )
        elif minor:
            action = (
                "Monitor your child's symptoms at home; consult a pediatrician "
                "if they persist beyond 2–3 days"
            )
        else:
            action = "Monitor symptoms at home; consult a provider if they persist beyond 3 days"
        follow_up = 3 if (age is not None and age < 13) else 7
        return CarePathway(
            recommended_action=action,
            specialist_type=None,
            self_care_tips=_collect_self_care(symptoms, bucket),
            follow_up_days=follow_up,
            requires_immediate_care=False,
        )

    # UNKNOWN
    return CarePathway(
        recommended_action="Please provide more symptom details for a better assessment",
        specialist_type=None,
        self_care_tips=_GENERIC_SELF_CARE[bucket],
        follow_up_days=None,
        requires_immediate_care=False,
    )


def _pick_specialist(symptoms: list[str]) -> str | None:
    for sym in symptoms:
        if sym in _SPECIALIST_MAP:
            return _SPECIALIST_MAP[sym]
    return None


def _collect_self_care(symptoms: list[str], bucket: str) -> list[str]:
    tips: list[str] = []
    seen: set[str] = set()
    for sym in symptoms:
        age_tips = _SELF_CARE_MAP.get(sym, {})
        selected = age_tips.get(bucket) or age_tips.get("adult", [])
        for tip in selected:
            if tip not in seen:
                tips.append(tip)
                seen.add(tip)
    return tips or _GENERIC_SELF_CARE[bucket]
