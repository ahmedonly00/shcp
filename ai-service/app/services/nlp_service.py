"""NLP extraction service using spaCy with heuristic fallback."""
from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ── Symptom keyword banks (multilingual) ─────────────────────────────────────

_SYMPTOM_KEYWORDS: dict[str, list[str]] = {
    "fever": ["fever", "fièvre", "ubushyuhe", "temperature", "hot"],
    "headache": ["headache", "head pain", "mal de tête", "ububabare bw'umutwe"],
    "cough": ["cough", "toux", "inkorora"],
    "chest_pain": ["chest pain", "douleur thoracique", "ububabare bw'igituza"],
    "shortness_of_breath": [
        "shortness of breath", "difficulty breathing", "trouble breathing",
        "dyspnea", "essoufflement", "guhumeka nabi",
    ],
    "nausea": ["nausea", "nausée", "feel sick", "kugira isesemi"],
    "vomiting": ["vomiting", "vomit", "vomissements", "gutapura"],
    "diarrhea": ["diarrhea", "diarrhoea", "diarrhée", "guhitwa"],
    "fatigue": ["fatigue", "tired", "weakness", "faiblesse", "uburuhe"],
    "abdominal_pain": [
        "abdominal pain", "stomach pain", "belly pain", "douleur abdominale",
        "ububabare bw'inda",
    ],
    "dizziness": ["dizziness", "dizzy", "vertige", "guhindagirana"],
    "sore_throat": ["sore throat", "throat pain", "mal de gorge", "kongorora"],
    "back_pain": ["back pain", "douleur dorsale", "ububabare bw'umugongo"],
    "joint_pain": ["joint pain", "arthralgie", "ububabare bw'ingingo"],
    "rash": ["rash", "eruption", "éruption", "ubukangara"],
}

# Body-area → canonical symptom mapping used when body-map data is provided
_BODY_MAP_SYMPTOM: dict[str, str] = {
    "head": "headache",
    "chest": "chest_pain",
    "abdomen": "abdominal_pain",
    "back": "back_pain",
    "throat": "sore_throat",
    "joints": "joint_pain",
}

# ── spaCy loader (lazy) ───────────────────────────────────────────────────────

_nlp: Any = None          # spaCy model
_spacy_available = True   # set to False after first import failure


def _load_spacy() -> Any | None:
    global _nlp, _spacy_available
    if not _spacy_available:
        return None
    if _nlp is not None:
        return _nlp
    try:
        import spacy  # type: ignore[import]
        try:
            _nlp = spacy.load("en_core_web_sm")
            logger.info("spaCy model 'en_core_web_sm' loaded")
        except OSError:
            # Model not downloaded — try blank pipeline
            _nlp = spacy.blank("en")
            logger.warning("spaCy model not found; using blank pipeline")
        return _nlp
    except ImportError:
        logger.warning("spaCy not installed — using heuristic NLP")
        _spacy_available = False
        return None


# ── Public API ────────────────────────────────────────────────────────────────

def extract_symptoms(
    text: str,
    language: str = "en",
    body_map_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Extract structured symptom information from raw text.

    Returns a dict with:
    - ``symptoms``      : list[str] — canonical symptom identifiers
    - ``entities``      : list[dict] — NER-style entities (text, label)
    - ``negated``       : list[str] — symptoms explicitly denied by patient
    - ``duration_hint`` : str | None — e.g. "3 days"
    """
    nlp = _load_spacy()

    if nlp is not None:
        result = _spacy_extract(text, nlp)
    else:
        result = _heuristic_extract(text)

    # Merge body-map regions as additional symptom signals
    if body_map_data:
        for region, present in body_map_data.items():
            if present and region in _BODY_MAP_SYMPTOM:
                sym = _BODY_MAP_SYMPTOM[region]
                if sym not in result["symptoms"]:
                    result["symptoms"].append(sym)

    return result


# ── spaCy-based extraction ────────────────────────────────────────────────────

def _spacy_extract(text: str, nlp: Any) -> dict[str, Any]:
    doc = nlp(text)

    entities = [
        {"text": ent.text, "label": ent.label_}
        for ent in doc.ents
    ]

    symptoms: list[str] = []
    negated: list[str] = []
    lower = text.lower()

    for canonical, keywords in _SYMPTOM_KEYWORDS.items():
        for kw in keywords:
            if kw in lower:
                # Naïve negation check: look for "no", "not", "don't" within 30 chars before
                idx = lower.find(kw)
                prefix = lower[max(0, idx - 30): idx]
                if re.search(r"\b(no|not|don'?t|without|sans|nta)\b", prefix):
                    if canonical not in negated:
                        negated.append(canonical)
                else:
                    if canonical not in symptoms:
                        symptoms.append(canonical)
                break

    duration_hint = _extract_duration(text)

    return {
        "symptoms": symptoms,
        "entities": entities,
        "negated": negated,
        "duration_hint": duration_hint,
    }


# ── Heuristic fallback ────────────────────────────────────────────────────────

def _heuristic_extract(text: str) -> dict[str, Any]:
    lower = text.lower()
    symptoms: list[str] = []
    negated: list[str] = []

    for canonical, keywords in _SYMPTOM_KEYWORDS.items():
        for kw in keywords:
            if kw in lower:
                idx = lower.find(kw)
                prefix = lower[max(0, idx - 30): idx]
                if re.search(r"\b(no|not|don'?t|without|sans|nta)\b", prefix):
                    negated.append(canonical)
                else:
                    symptoms.append(canonical)
                break

    return {
        "symptoms": symptoms,
        "entities": [],
        "negated": negated,
        "duration_hint": _extract_duration(text),
    }


# ── Duration heuristic ────────────────────────────────────────────────────────

_DURATION_RE = re.compile(
    r"\b(\d+\s*(?:day|days|week|weeks|hour|hours|month|months))\b",
    re.IGNORECASE,
)


def _extract_duration(text: str) -> str | None:
    m = _DURATION_RE.search(text)
    return m.group(1) if m else None
