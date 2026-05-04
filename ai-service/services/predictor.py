"""
predictor.py
------------
Loads the trained RandomForest model and returns a disease
prediction + urgency classification for a given symptom vector.
"""
from __future__ import annotations

import json
import logging
import os
import pickle
from datetime import datetime, timezone

import numpy as np

from app.services.pathway import determine_pathway

logger = logging.getLogger(__name__)

# ── paths ──────────────────────────────────────────────────────────────────────
_BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_MODELS_DIR = os.path.join(_BASE_DIR, "models")

# ── model version (written by training/train_model.py on each retrain) ────────
def _read_model_version() -> str:
    path = os.path.join(_MODELS_DIR, "model_version.json")
    try:
        with open(path) as f:
            return json.load(f).get("version", "RandomForest-v2")
    except FileNotFoundError:
        return "RandomForest-v2"

MODEL_VERSION = _read_model_version()

# ── SHAP (optional — degrades gracefully if not installed) ────────────────────
try:
    import shap as _shap
    _SHAP_AVAILABLE = True
except ImportError:
    _SHAP_AVAILABLE = False
    logger.warning("shap not installed — explaining_factors will be empty. Run: pip install shap")

# ── lazy-loaded globals (populated on first predict() call) ───────────────────
_clf             = None
_le              = None
_symptom_columns = None
_urgency_map     = None
_explainer       = None
_loaded          = False


def _load_models() -> None:
    global _clf, _le, _symptom_columns, _urgency_map, _explainer, _loaded
    if _loaded:
        return

    with open(os.path.join(_MODELS_DIR, "disease_classifier.pkl"), "rb") as f:
        _clf = pickle.load(f)
    with open(os.path.join(_MODELS_DIR, "label_encoder.pkl"), "rb") as f:
        _le = pickle.load(f)
    with open(os.path.join(_MODELS_DIR, "symptom_columns.json")) as f:
        _symptom_columns = json.load(f)
    with open(os.path.join(_MODELS_DIR, "urgency_map.json")) as f:
        _urgency_map = json.load(f)

    if _SHAP_AVAILABLE:
        try:
            _explainer = _shap.TreeExplainer(_clf)
        except Exception as exc:
            logger.warning("SHAP explainer init failed: %s", exc)

    _loaded = True


# ── care messages ──────────────────────────────────────────────────────────────
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
    return [{"name": s, "severity": None, "duration": None} for s in symptoms]


def _explain(X: np.ndarray, class_idx: int, top_n: int = 5) -> list[dict]:
    """Return the top-N symptoms driving the prediction via SHAP TreeExplainer."""
    if not _SHAP_AVAILABLE or _explainer is None or _symptom_columns is None:
        return []
    try:
        sv_raw = _explainer.shap_values(X)
        # sklearn RF multi-class: list[ndarray], each element shape (n_samples, n_features)
        if isinstance(sv_raw, list):
            vals = sv_raw[class_idx][0]
        else:
            # newer shap: 3-D array (n_samples, n_features, n_classes)
            vals = sv_raw[0, :, class_idx]

        indices = np.argsort(np.abs(vals))[-top_n:][::-1]
        return [
            {
                "symptom":      _symptom_columns[i],
                "contribution": round(float(vals[i]), 4),
                "direction":    "positive" if vals[i] > 0 else "negative",
                "present":      bool(int(X[0, i])),
            }
            for i in indices
        ]
    except Exception as exc:
        logger.warning("SHAP explanation failed: %s", exc)
        return []


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


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
        dict with status, disease, icd10, confidence, urgency, explaining_factors, etc.
    """
    _load_models()

    # ── 1. numpy reshape ──────────────────────────────────────────────────────
    X = np.array(symptom_vector, dtype=int).reshape(1, -1)

    # ── 2. probabilities + top-3 ─────────────────────────────────────────────
    proba        = _clf.predict_proba(X)[0]
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
    symptom_set      = set(detected_symptoms)
    override_urgency: str | None = None

    # Neonatal / infant (<1 year, age==0): any fever or breathing difficulty is
    # a medical emergency. AAP/AAFP: fever ≥38°C in infants <3 months requires
    # immediate emergency evaluation; age==0 covers the full 0–11-month range.
    if age is not None and age == 0:
        if "high_fever" in symptom_set or "mild_fever" in symptom_set:
            override_urgency = "EMERGENCY"
        elif "breathlessness" in symptom_set:
            override_urgency = "EMERGENCY"

    # Cardiac: chest pain + breathlessness or cardiac arrest pattern
    if override_urgency is None and (
        "chest_pain" in symptom_set and "breathlessness" in symptom_set
    ):
        override_urgency = "EMERGENCY"
    if override_urgency is None and (
        "chest_pain" in symptom_set
        and "fast_heart_rate" in symptom_set
        and "sweating" in symptom_set
    ):
        override_urgency = "EMERGENCY"
    # Neuro: altered consciousness, coma, or meningitis
    if override_urgency is None and (
        "altered_sensorium" in symptom_set or "coma" in symptom_set
    ):
        override_urgency = "EMERGENCY"
    if override_urgency is None and (
        "high_fever" in symptom_set and "stiff_neck" in symptom_set
    ):
        override_urgency = "EMERGENCY"
    # Stroke: sudden-onset severe headache + vision/speech/weakness cluster
    if override_urgency is None and (
        "headache" in symptom_set
        and "blurred_and_distorted_vision" in symptom_set
        and "weakness_in_limbs" in symptom_set
    ):
        override_urgency = "EMERGENCY"
    # Anaphylaxis: rash + swelling + breathlessness
    if override_urgency is None and (
        "skin_rash" in symptom_set
        and "breathlessness" in symptom_set
        and "swollen_extremeties" in symptom_set
    ):
        override_urgency = "EMERGENCY"
    # Sepsis: high fever + altered sensorium + fast heart rate
    if override_urgency is None and (
        "high_fever" in symptom_set
        and "fast_heart_rate" in symptom_set
        and "altered_sensorium" in symptom_set
    ):
        override_urgency = "EMERGENCY"
    # Pulmonary embolism: chest pain + breathlessness + swollen legs
    if override_urgency is None and (
        "chest_pain" in symptom_set
        and "breathlessness" in symptom_set
        and "swollen_legs" in symptom_set
    ):
        override_urgency = "EMERGENCY"
    # Severe dehydration with altered consciousness
    if override_urgency is None and (
        "dehydration" in symptom_set and "altered_sensorium" in symptom_set
    ):
        override_urgency = "EMERGENCY"

    if override_urgency:
        _entry = _urgency_map.get(disease_name, {})
        _icd10 = _entry.get("icd10") if isinstance(_entry, dict) else None
        pw     = determine_pathway(override_urgency, detected_symptoms, age=age)
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
            "explaining_factors":  _explain(X, int(top3_indices[0])),
            "detected_symptoms":   detected_symptoms,
            "symptom_count":       len(detected_symptoms),
            "patient_age":         age,
            "patient_sex":         sex,
            "model_version":       MODEL_VERSION,
            "disclaimer":          _DISCLAIMER,
            "processed_at":        _now(),
        }

    # ── 4. low-confidence early return ───────────────────────────────────────
    if confidence < 40.0:
        _entry   = _urgency_map.get(disease_name, {})
        _icd10   = _entry.get("icd10") if isinstance(_entry, dict) else None
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
            "message": (
                "Add more symptoms or describe them in detail for a more "
                "accurate AI assessment."
            ),
            "top_3_predictions":  top3,
            "explaining_factors": [],
            "detected_symptoms":  detected_symptoms,
            "symptom_count":      len(detected_symptoms),
            "model_version":      MODEL_VERSION,
            "disclaimer":         _DISCLAIMER,
            "processed_at":       _now(),
        }

    # ── 5. urgency + ICD-10 from map ─────────────────────────────────────────
    disease_entry = _urgency_map.get(disease_name, {})
    if isinstance(disease_entry, dict):
        urgency = disease_entry.get("urgency", "ROUTINE")
        icd10   = disease_entry.get("icd10")
    else:
        urgency = disease_entry if disease_entry else "ROUTINE"
        icd10   = None

    # ── 6. severity hint adjustments (never override safety-critical levels) ──
    if severity_hint == "severe" and urgency == "ROUTINE":
        urgency = "URGENT"
    elif severity_hint == "severe" and urgency == "SELF_CARE":
        urgency = "ROUTINE"
    elif severity_hint == "mild" and urgency == "URGENT":
        urgency = "ROUTINE"

    # ── 7. duration hint adjustments ─────────────────────────────────────────
    if duration_hint == "less-than-1-day" and urgency == "ROUTINE":
        urgency = "URGENT"
    elif duration_hint == "more-than-2-weeks" and urgency == "URGENT":
        urgency = "ROUTINE"

    # ── 8. age/sex-aware adjustments (never override safety levels) ──────────
    if age is not None and age >= 65:
        if "chest_pain" in symptom_set and urgency in ("ROUTINE", "SELF_CARE"):
            urgency = "URGENT"
        if "breathlessness" in symptom_set and urgency == "SELF_CARE":
            urgency = "ROUTINE"
        if "dizziness" in symptom_set and urgency == "SELF_CARE":
            urgency = "ROUTINE"

    if age is not None and 0 < age < 5:
        if "high_fever" in symptom_set and urgency == "ROUTINE":
            urgency = "URGENT"
        if "dehydration" in symptom_set and urgency in ("ROUTINE", "SELF_CARE"):
            urgency = "URGENT"

    if sex == "female":
        if {"fatigue", "nausea", "sweating"}.issubset(symptom_set) and urgency == "SELF_CARE":
            urgency = "ROUTINE"

    # ── 9. build response ─────────────────────────────────────────────────────
    pw = determine_pathway(urgency, detected_symptoms, age=age)
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
        "explaining_factors":  _explain(X, int(top3_indices[0])),
        "detected_symptoms":   detected_symptoms,
        "symptom_count":       len(detected_symptoms),
        "patient_age":         age,
        "patient_sex":         sex,
        "model_version":       MODEL_VERSION,
        "disclaimer":          _DISCLAIMER,
        "processed_at":        _now(),
    }
