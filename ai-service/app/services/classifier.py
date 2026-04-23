"""Urgency classifier: TensorFlow SavedModel with heuristic fallback."""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── Urgency levels (matches AIAnalysisResponse.UrgencyLevel in Spring) ────────

URGENCY_EMERGENCY = "EMERGENCY"
URGENCY_URGENT    = "URGENT"
URGENCY_MODERATE  = "MODERATE"
URGENCY_LOW       = "LOW"
URGENCY_UNKNOWN   = "UNKNOWN"

_URGENCY_LABELS = [URGENCY_LOW, URGENCY_MODERATE, URGENCY_URGENT, URGENCY_EMERGENCY]

# ── Rule-based urgency thresholds ─────────────────────────────────────────────

_EMERGENCY_SYMPTOMS = frozenset({
    "chest_pain", "shortness_of_breath",
})
_URGENT_SYMPTOMS = frozenset({
    "fever", "vomiting", "diarrhea", "dizziness",
})
_MODERATE_SYMPTOMS = frozenset({
    "headache", "abdominal_pain", "back_pain", "joint_pain",
})


# ── Public API ─────────────────────────────────────────────────────────────────

def classify_urgency(
    symptoms: list[str],
    nlp_result: dict[str, Any],
    model_loader: Any,
) -> dict[str, Any]:
    """
    Classify symptom urgency.

    Tries TF model first; falls back to rule-based heuristic on any failure.

    Returns:
        {
            "urgency_level": str,
            "confidence":    float,
            "degraded":      bool,
        }
    """
    if model_loader is not None and model_loader.is_ready():
        try:
            return _tf_classify(symptoms, nlp_result, model_loader)
        except Exception as exc:  # noqa: BLE001
            logger.warning("TF classification failed (%s); using heuristic", exc)

    return _heuristic_classify(symptoms)


# ── TensorFlow path ────────────────────────────────────────────────────────────

def _tf_classify(
    symptoms: list[str],
    nlp_result: dict[str, Any],
    model_loader: Any,
) -> dict[str, Any]:
    import numpy as np  # type: ignore[import]

    vector = _vectorize(symptoms, model_loader)
    predictions = model_loader.predict(vector)           # shape (1, num_classes)
    idx = int(np.argmax(predictions[0]))
    confidence = float(predictions[0][idx])
    urgency = _URGENCY_LABELS[min(idx, len(_URGENCY_LABELS) - 1)]

    return {"urgency_level": urgency, "confidence": confidence, "degraded": False}


def _vectorize(symptoms: list[str], model_loader: Any):
    """Convert symptom list to a fixed-length binary vector."""
    import numpy as np  # type: ignore[import]

    vocab: dict[str, int] = model_loader.get_vocab() or {}
    size = max(len(vocab), 64)
    vec = np.zeros((1, size), dtype="float32")
    for sym in symptoms:
        idx = vocab.get(sym)
        if idx is not None and idx < size:
            vec[0, idx] = 1.0
    return vec


# ── Heuristic path ─────────────────────────────────────────────────────────────

def _heuristic_classify(symptoms: list[str]) -> dict[str, Any]:
    symptom_set = frozenset(symptoms)

    if symptom_set & _EMERGENCY_SYMPTOMS:
        urgency = URGENCY_EMERGENCY
    elif symptom_set & _URGENT_SYMPTOMS:
        urgency = URGENCY_URGENT
    elif symptom_set & _MODERATE_SYMPTOMS:
        urgency = URGENCY_MODERATE
    elif symptom_set:
        urgency = URGENCY_LOW
    else:
        urgency = URGENCY_UNKNOWN

    return {"urgency_level": urgency, "confidence": 0.6, "degraded": True}
