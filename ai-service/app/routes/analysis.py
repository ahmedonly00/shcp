"""POST /analyze and GET /health routes."""
from __future__ import annotations

import logging
import re

from flask import Blueprint, jsonify, request

from services.symptom_extractor import extract_symptoms
from services.predictor import predict
from app.services.nlp_service import extract_symptoms as nlp_extract

logger = logging.getLogger(__name__)

analysis_bp = Blueprint("analysis", __name__)

_VALID_LANGS = {"en", "fr", "rw"}


@analysis_bp.post("/analyze")
def analyze():
    """
    Analyze patient symptoms and return a disease prediction + urgency.

    Request JSON:
      {
        "symptom_text": "I have fever and headache",
        "language":     "en",          // optional, default "en"
        "body_map_data": {             // optional
            "regions": ["chest"],
            "severity": 7
        },
        "patient_id": "uuid"           // optional
      }
    """
    data = request.get_json(silent=True) or {}

    # ── validation ──────────────────────────────────────────────────────────
    symptom_text = data.get("symptom_text", "")
    if not symptom_text or not str(symptom_text).strip():
        return jsonify({"error": "symptom_text is required"}), 400

    symptom_text = str(symptom_text).strip()
    if len(symptom_text) < 3:
        return jsonify({"error": "symptom_text must be at least 3 characters"}), 400

    language = data.get("language", "en")
    if language is None:
        language = "en"
    if language not in _VALID_LANGS:
        return jsonify({
            "error": f"language must be one of {sorted(_VALID_LANGS)}"
        }), 400

    body_map_data = data.get("body_map_data")
    if body_map_data is not None and not isinstance(body_map_data, dict):
        body_map_data = {}

    # Optional structured hints from frontend
    structured_symptoms = data.get("symptoms")  # list of symptom name strings
    if not isinstance(structured_symptoms, list):
        structured_symptoms = None

    severity_hint = data.get("severity")        # "mild" | "moderate" | "severe"
    duration_hint = data.get("duration")        # e.g. "1-3-days"

    # Demographics — sent by the backend from the patient profile
    patient_age = data.get("patient_age")       # int, e.g. 45
    if patient_age is not None:
        try:
            patient_age = int(patient_age)
        except (TypeError, ValueError):
            patient_age = None

    patient_sex = data.get("patient_sex")       # "male" | "female" | "other"
    if patient_sex is not None:
        patient_sex = str(patient_sex).lower().strip()

    # ── NLP fallback: extract duration from text when frontend omitted it ────
    # nlp_service parses "3 days", "2 weeks", etc. from free text.
    # We normalise that to the same enum the predictor understands.
    duration_inferred = False
    if duration_hint is None:
        try:
            nlp_result   = nlp_extract(symptom_text, language)
            raw_duration = nlp_result.get("duration_hint")  # e.g. "3 days"
            if raw_duration:
                duration_hint     = _normalise_duration(raw_duration)
                duration_inferred = duration_hint is not None
        except Exception:
            pass  # NLP failure is non-fatal

    # ── process ─────────────────────────────────────────────────────────────
    try:
        extraction = extract_symptoms(
            symptom_text, language, body_map_data,
            structured_symptoms=structured_symptoms,
        )

        if extraction["symptom_count"] == 0:
            return jsonify({
                "status":  "NO_SYMPTOMS_DETECTED",
                "message": (
                    "No recognizable symptoms detected. Please try describing "
                    "your symptoms differently. Example: "
                    "\"I have fever, headache and vomiting\""
                ),
                "urgency": "UNKNOWN",
            }), 200

        result = predict(
            extraction["symptom_vector"],
            extraction["detected_symptoms"],
            severity_hint=severity_hint,
            duration_hint=duration_hint,
            age=patient_age,
            sex=patient_sex,
        )
        if duration_inferred:
            result["duration_inferred"] = True
        return jsonify(result), 200

    except Exception as exc:
        logger.exception("Unhandled error in /analyze: %s", exc)
        return jsonify({"error": "Internal server error. Please try again."}), 500


def _normalise_duration(raw: str) -> str | None:
    """
    Map a free-text duration string extracted by the NLP service to the
    enum values the predictor understands:
      less-than-1-day | 1-3-days | 3-7-days | 1-2-weeks | more-than-2-weeks
    """
    raw = raw.lower().strip()
    # Extract the leading number and unit
    m = re.match(r"(\d+)\s*(hour|hours|day|days|week|weeks|month|months)", raw)
    if not m:
        return None

    value = int(m.group(1))
    unit  = m.group(2)

    if unit in ("hour", "hours"):
        return "less-than-1-day"
    if unit in ("day", "days"):
        if value < 1:
            return "less-than-1-day"
        if value <= 3:
            return "1-3-days"
        if value <= 7:
            return "3-7-days"
        if value <= 14:
            return "1-2-weeks"
        return "more-than-2-weeks"
    if unit in ("week", "weeks"):
        if value <= 1:
            return "1-2-weeks"
        if value == 2:
            return "1-2-weeks"
        return "more-than-2-weeks"
    if unit in ("month", "months"):
        return "more-than-2-weeks"
    return None


@analysis_bp.get("/health")
def health():
    """Liveness probe."""
    return jsonify({
        "status":             "ok",
        "service":            "SHCP AI Symptom Checker",
        "model":              "RandomForest-v1",
        "diseases_supported": 41,
        "symptoms_tracked":   132,
        "languages":          ["en", "fr", "rw"],
    }), 200
