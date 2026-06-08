"""POST /analyze and GET /health routes."""
from __future__ import annotations

import logging
import re

from flask import Blueprint, jsonify, request

from services.symptom_extractor import extract_symptoms
from services.predictor import predict, MODEL_VERSION, is_model_ready
from app.extensions import limiter
from app.services.nlp_service import extract_symptoms as nlp_extract
from app.services.prediction_logger import log_prediction, prediction_stats
from app.utils.validators import validate_analyze_request

logger = logging.getLogger(__name__)

analysis_bp = Blueprint("analysis", __name__)


@analysis_bp.post("/analyze")
@limiter.limit("30 per minute")
def analyze():
    """
    Analyze patient symptoms and return an AI prediction.
    ---
    tags:
      - Symptom Analysis
    consumes:
      - application/json
    produces:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - symptom_text
          properties:
            symptom_text:
              type: string
              minLength: 3
              maxLength: 2000
              example: "I have high fever, headache and body aches"
            language:
              type: string
              enum: [en, fr, rw]
              default: en
            symptoms:
              type: array
              items:
                type: string
              example: ["high_fever", "headache"]
            body_map_data:
              type: object
              properties:
                regions:
                  type: array
                  items:
                    type: string
                severity:
                  type: integer
                  minimum: 1
                  maximum: 10
            severity:
              type: string
              enum: [mild, moderate, severe]
            duration:
              type: string
              enum: [less-than-1-day, 1-3-days, 3-7-days, 1-2-weeks, more-than-2-weeks]
            patient_age:
              type: integer
              example: 35
            patient_sex:
              type: string
              enum: [male, female, other]
            patient_id:
              type: string
              example: "uuid-here"
    responses:
      200:
        description: Prediction result
        schema:
          type: object
          properties:
            status:
              type: string
              enum: [OK, LOW_CONFIDENCE, NO_SYMPTOMS_DETECTED]
            disease:
              type: string
              example: "Malaria"
            icd10:
              type: string
              example: "B54"
            confidence:
              type: number
              example: 87.45
            urgency:
              type: string
              enum: [EMERGENCY, URGENT, ROUTINE, SELF_CARE, UNKNOWN]
            pathway:
              type: string
              enum: [emergency, teleconsult, appointment, self-care]
            care_recommendation:
              type: string
            specialist_type:
              type: string
            self_care_tips:
              type: array
              items:
                type: string
            follow_up_days:
              type: integer
            top_3_predictions:
              type: array
              items:
                type: object
            explaining_factors:
              type: array
              description: Top SHAP-derived symptoms driving the prediction
              items:
                type: object
                properties:
                  symptom:
                    type: string
                  contribution:
                    type: number
                  direction:
                    type: string
                    enum: [positive, negative]
                  present:
                    type: boolean
            model_version:
              type: string
            disclaimer:
              type: string
      400:
        description: Validation error
        schema:
          type: object
          properties:
            errors:
              type: array
              items:
                type: string
      429:
        description: Rate limit exceeded
      500:
        description: Internal server error
    """
    data = request.get_json(silent=True) or {}

    # ── validation ──────────────────────────────────────────────────────────
    errors = validate_analyze_request(data)
    if errors:
        return jsonify({"errors": errors}), 400

    symptom_text = str(data["symptom_text"]).strip()
    language     = (data.get("language") or "en").strip()

    body_map_data = data.get("body_map_data")
    if body_map_data is not None and not isinstance(body_map_data, dict):
        body_map_data = {}

    structured_symptoms = data.get("symptoms")
    if not isinstance(structured_symptoms, list):
        structured_symptoms = None

    severity_hint = data.get("severity")
    duration_hint = data.get("duration")

    patient_age = data.get("patient_age")
    if patient_age is not None:
        try:
            patient_age = int(patient_age)
        except (TypeError, ValueError):
            patient_age = None

    patient_sex = data.get("patient_sex")
    if patient_sex is not None:
        patient_sex = str(patient_sex).lower().strip()

    patient_id = data.get("patient_id")

    # ── NLP duration fallback ────────────────────────────────────────────────
    duration_inferred = False
    if duration_hint is None:
        try:
            nlp_result = nlp_extract(symptom_text, language)
            raw_dur    = nlp_result.get("duration_hint")
            if raw_dur:
                duration_hint     = _normalise_duration(raw_dur)
                duration_inferred = duration_hint is not None
        except Exception:
            pass

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

        # ── audit log ────────────────────────────────────────────────────────
        log_prediction(
            patient_id=patient_id,
            patient_age=patient_age,
            patient_sex=patient_sex,
            language=language,
            symptom_text=symptom_text,
            result=result,
            severity_hint=severity_hint,
            duration_hint=duration_hint,
        )

        return jsonify(result), 200

    except Exception as exc:
        logger.exception("Unhandled error in /analyze: %s", exc)
        return jsonify({"error": "Internal server error. Please try again."}), 500


def _normalise_duration(raw: str) -> str | None:
    raw = raw.lower().strip()
    m = re.match(r"(\d+)\s*(hour|hours|day|days|week|weeks|month|months)", raw)
    if not m:
        return None
    value, unit = int(m.group(1)), m.group(2)
    if unit in ("hour", "hours"):
        return "less-than-1-day"
    if unit in ("day", "days"):
        if value == 0:
            return "less-than-1-day"
        if value <= 3:
            return "1-3-days"
        if value <= 7:
            return "3-7-days"
        if value <= 14:
            return "1-2-weeks"
        return "more-than-2-weeks"
    if unit in ("week", "weeks"):
        return "1-2-weeks" if value <= 2 else "more-than-2-weeks"
    if unit in ("month", "months"):
        return "more-than-2-weeks"
    return None


@analysis_bp.get("/health")
def health():
    """
    Service liveness probe and model metadata.
    ---
    tags:
      - Health
    produces:
      - application/json
    responses:
      200:
        description: Service is healthy
        schema:
          type: object
          properties:
            status:
              type: string
              example: ok
            service:
              type: string
            model_version:
              type: string
            diseases_supported:
              type: integer
            symptoms_tracked:
              type: integer
            languages:
              type: array
              items:
                type: string
            stats:
              type: object
    """
    ready = is_model_ready()
    # Always return HTTP 200 so Docker's health-check (urlopen) succeeds once
    # the Flask server is up. The model_ready flag tells callers whether
    # predictions are available without blocking container orchestration.
    return jsonify({
        "status":             "ok" if ready else "starting",
        "model_ready":        ready,
        "service":            "SHCP AI Symptom Checker",
        "model_version":      MODEL_VERSION,
        "diseases_supported": 41,
        "symptoms_tracked":   132,
        "languages":          ["en", "fr", "rw"],
        "stats":              prediction_stats(),
    }), 200
