"""
predictor.py
------------
Loads the trained RandomForest model and returns a disease
prediction + urgency classification for a given symptom vector.
"""
from __future__ import annotations

import json
import os
import pickle
from datetime import datetime, timezone
from typing import Any

import numpy as np

from app.services.pathway import determine_pathway

# ── paths ──────────────────────────────────────────────────────────────────────
_BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_MODELS_DIR = os.path.join(_BASE_DIR, "models")

# ── lazy-loaded globals (populated on first predict() call) ───────────────────
_clf              = None
_le               = None
_symptom_columns  = None
_urgency_map      = None
_loaded           = False


def _load_models():
    global _clf, _le, _symptom_columns, _urgency_map, _loaded
    if _loaded:
        return

    model_path   = os.path.join(_MODELS_DIR, "disease_classifier.pkl")
    enc_path     = os.path.join(_MODELS_DIR, "label_encoder.pkl")
    cols_path    = os.path.join(_MODELS_DIR, "symptom_columns.json")
    urgency_path = os.path.join(_MODELS_DIR, "urgency_map.json")

    with open(model_path, "rb") as f:
        _clf = pickle.load(f)
    with open(enc_path, "rb") as f:
        _le = pickle.load(f)
    with open(cols_path) as f:
        _symptom_columns = json.load(f)
    with open(urgency_path) as f:
        _urgency_map = json.load(f)

    _loaded = True


# ── care messages ──────────────────────────────────────────────────────────────
_CARE_MESSAGES = {
    "EMERGENCY": (
        "Your symptoms may indicate a life-threatening condition. "
        "Go to the nearest emergency room immediately or call emergency services."
    ),
    "URGENT": (
        "Your symptoms need medical attention today. "
        "Book an urgent teleconsultation with a doctor now."
    ),
    "ROUTINE": (
        "Your symptoms should be evaluated by a doctor within 1–3 days. "
        "Schedule a consultation at your convenience."
    ),
    "SELF_CARE": (
        "Your symptoms can likely be managed at home. "
        "Follow self-care guidelines and monitor for worsening symptoms. "
        "See a doctor if symptoms persist beyond 3 days."
    ),
    "UNKNOWN": (
        "Unable to assess urgency. Please consult a healthcare provider directly."
    ),
}

_PATHWAY_MAP = {
    "EMERGENCY": "emergency",
    "URGENT":    "teleconsult",
    "ROUTINE":   "appointment",
    "SELF_CARE": "self-care",
    "UNKNOWN":   None,
}

_DISCLAIMER = (
    "This is an AI-generated preliminary screening, not a medical diagnosis. "
    "Always consult a qualified healthcare provider for proper diagnosis and treatment."
)


# ── helpers ────────────────────────────────────────────────────────────────────

def _to_symptom_dicts(symptoms: list[str]) -> list[dict]:
    """Convert canonical symptom strings to AIAnalysisResponse.symptoms contract."""
    return [{"name": s, "severity": None, "duration": None} for s in symptoms]


# ── public API ─────────────────────────────────────────────────────────────────

def predict(
    symptom_vector: list,
    detected_symptoms: list,
    severity_hint: str | None = None,
    duration_hint: str | None = None,
    age: int | None = None,
    sex: str | None = None,
) -> dict:
    """
    Predict disease and urgency from a binary symptom vector.

    Args:
        symptom_vector    : list[int] of length 132
        detected_symptoms : list[str] of canonical symptom names
        severity_hint     : "mild" | "moderate" | "severe" from frontend
        duration_hint     : e.g. "less-than-1-day" | "1-3-days" from frontend
        age               : patient age in years (from profile)
        sex               : "male" | "female" | "other" (from profile)

    Returns:
        dict with status, disease, confidence, urgency, pathway, etc.
    """
    _load_models()

    # ── 1. numpy reshape ──────────────────────────────────────────────────────
    X = np.array(symptom_vector, dtype=int).reshape(1, -1)

    # ── 2. probabilities + top-3 ─────────────────────────────────────────────
    proba       = _clf.predict_proba(X)[0]
    top3_indices = np.argsort(proba)[-3:][::-1]

    disease_name = _le.inverse_transform([top3_indices[0]])[0]
    confidence   = round(float(proba[top3_indices[0]]) * 100, 2)

    top3 = [
        {
            "disease":     _le.inverse_transform([idx])[0],
            "probability": round(float(proba[idx]) * 100, 2),
        }
        for idx in top3_indices
    ]

    # ── 3. hard safety overrides (applied regardless of confidence) ──────────
    symptom_set = set(detected_symptoms)
    override_urgency: str | None = None

    # Cardiac: chest pain + breathlessness or cardiac arrest pattern
    if "chest_pain" in symptom_set and "breathlessness" in symptom_set:
        override_urgency = "EMERGENCY"
    elif (
        "chest_pain" in symptom_set
        and "fast_heart_rate" in symptom_set
        and "sweating" in symptom_set
    ):
        override_urgency = "EMERGENCY"
    # Neuro: altered consciousness, coma, or meningitis
    elif "altered_sensorium" in symptom_set or "coma" in symptom_set:
        override_urgency = "EMERGENCY"
    elif "high_fever" in symptom_set and "stiff_neck" in symptom_set:
        override_urgency = "EMERGENCY"
    # Stroke: sudden-onset severe headache + vision/speech/weakness cluster
    elif (
        "headache" in symptom_set
        and "blurred_and_distorted_vision" in symptom_set
        and "weakness_in_limbs" in symptom_set
    ):
        override_urgency = "EMERGENCY"
    # Anaphylaxis: rash + swelling + breathlessness
    elif (
        "skin_rash" in symptom_set
        and "breathlessness" in symptom_set
        and "swollen_extremeties" in symptom_set
    ):
        override_urgency = "EMERGENCY"
    # Sepsis: high fever + altered sensorium + fast heart rate
    elif (
        "high_fever" in symptom_set
        and "fast_heart_rate" in symptom_set
        and "altered_sensorium" in symptom_set
    ):
        override_urgency = "EMERGENCY"
    # Pulmonary embolism: chest pain + breathlessness + swollen legs
    elif (
        "chest_pain" in symptom_set
        and "breathlessness" in symptom_set
        and "swollen_legs" in symptom_set
    ):
        override_urgency = "EMERGENCY"
    # Severe dehydration with altered consciousness
    elif "dehydration" in symptom_set and "altered_sensorium" in symptom_set:
        override_urgency = "EMERGENCY"

    if override_urgency:
        # Look up ICD-10 for the predicted disease even during a safety override
        _entry  = _urgency_map.get(disease_name, {})
        _icd10  = _entry.get("icd10") if isinstance(_entry, dict) else None
        pw = determine_pathway(override_urgency, detected_symptoms)
        return {
            "status":              "OK",
            "disease":             disease_name,
            "icd10":               _icd10,
            "confidence":          confidence,
            "urgency":             override_urgency,
            "pathway":             _PATHWAY_MAP[override_urgency],
            "symptoms":            _to_symptom_dicts(detected_symptoms),
            "care_recommendation": pw.recommended_action,
            "specialist_type":     pw.specialist_type,
            "self_care_tips":      pw.self_care_tips,
            "follow_up_days":      pw.follow_up_days,
            "top_3_predictions":   top3,
            "detected_symptoms":   detected_symptoms,
            "symptom_count":       len(detected_symptoms),
            "patient_age":         age,
            "patient_sex":         sex,
            "disclaimer":          _DISCLAIMER,
            "processed_at":        _now(),
        }

    # ── 4. low-confidence early return ───────────────────────────────────────
    if confidence < 40.0:
        # Still resolve ICD-10 and urgency for the top prediction so the frontend
        # can show the differential diagnosis bars even at low confidence.
        _entry   = _urgency_map.get(disease_name, {})
        _icd10   = _entry.get("icd10") if isinstance(_entry, dict) else None
        _urgency = _entry.get("urgency", "ROUTINE") if isinstance(_entry, dict) else "ROUTINE"
        return {
            "status":              "LOW_CONFIDENCE",
            "disease":             disease_name,
            "icd10":               _icd10,
            "urgency":             "UNKNOWN",
            "confidence":          confidence,
            "pathway":             None,
            "symptoms":            _to_symptom_dicts(detected_symptoms),
            "care_recommendation": (
                "The AI identified possible conditions (see below) but needs "
                f"more symptoms to be confident (current confidence: {confidence:.0f}%). "
                "Try adding more specific symptoms or describing them in more detail. "
                "Consult a healthcare provider for a proper diagnosis."
            ),
            "message":             (
                "Add more symptoms or describe them in detail for a more "
                "accurate AI assessment."
            ),
            "top_3_predictions":   top3,
            "detected_symptoms":   detected_symptoms,
            "symptom_count":       len(detected_symptoms),
            "disclaimer":          _DISCLAIMER,
            "processed_at":        _now(),
        }

    # ── 5. urgency + ICD-10 from map ─────────────────────────────────────────
    # urgency_map values are now dicts: {"urgency": "...", "icd10": "..."}
    disease_entry = _urgency_map.get(disease_name, {})
    if isinstance(disease_entry, dict):
        urgency  = disease_entry.get("urgency", "ROUTINE")
        icd10    = disease_entry.get("icd10")
    else:
        # Backwards-compat: plain string values still work
        urgency  = disease_entry if disease_entry else "ROUTINE"
        icd10    = None

    # ── 6. severity hint adjustments (never override safety-critical levels) ──
    if severity_hint == "severe" and urgency == "ROUTINE":
        urgency = "URGENT"
    elif severity_hint == "severe" and urgency == "SELF_CARE":
        urgency = "ROUTINE"
    elif severity_hint == "mild" and urgency == "URGENT":
        urgency = "ROUTINE"

    # ── 7. duration hint adjustments ─────────────────────────────────────────
    # Chronic symptoms (>2 weeks) that aren't already urgent → keep routine;
    # Acute onset (<1 day) that is currently ROUTINE → escalate to URGENT
    if duration_hint == "less-than-1-day" and urgency == "ROUTINE":
        urgency = "URGENT"
    elif duration_hint == "more-than-2-weeks" and urgency == "URGENT":
        urgency = "ROUTINE"

    # ── 8. age/sex-aware adjustments (never override safety levels) ───────────
    #
    # Older patients (≥60) have higher baseline risk for cardiovascular and
    # respiratory conditions — escalate if the current urgency is still low.
    if age is not None and age >= 60:
        if "chest_pain" in symptom_set and urgency in ("ROUTINE", "SELF_CARE"):
            urgency = "URGENT"
        if "breathlessness" in symptom_set and urgency == "SELF_CARE":
            urgency = "ROUTINE"

    # Young children (<5) are at higher risk from high fever and dehydration.
    if age is not None and age < 5:
        if "high_fever" in symptom_set and urgency == "ROUTINE":
            urgency = "URGENT"
        if "dehydration" in symptom_set and urgency in ("ROUTINE", "SELF_CARE"):
            urgency = "URGENT"

    # Female patients have higher rates of atypical cardiac presentation:
    # fatigue + nausea + sweating without classic chest pain can still be
    # cardiac — escalate from SELF_CARE to ROUTINE so a provider reviews it.
    if sex == "female":
        cardiac_atypical = {"fatigue", "nausea", "sweating"}
        if cardiac_atypical.issubset(symptom_set) and urgency == "SELF_CARE":
            urgency = "ROUTINE"

    # ── 9. build response ─────────────────────────────────────────────────────
    pw = determine_pathway(urgency, detected_symptoms)
    return {
        "status":              "OK",
        "disease":             disease_name,
        "icd10":               icd10,
        "confidence":          confidence,
        "urgency":             urgency,
        "pathway":             _PATHWAY_MAP[urgency],
        "symptoms":            _to_symptom_dicts(detected_symptoms),
        "care_recommendation": pw.recommended_action,
        "specialist_type":     pw.specialist_type,
        "self_care_tips":      pw.self_care_tips,
        "follow_up_days":      pw.follow_up_days,
        "top_3_predictions":   top3,
        "detected_symptoms":   detected_symptoms,
        "symptom_count":       len(detected_symptoms),
        "patient_age":         age,
        "patient_sex":         sex,
        "disclaimer":          _DISCLAIMER,
        "processed_at":        _now(),
    }


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
