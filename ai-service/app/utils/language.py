"""Language detection utilities."""
import logging

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {"rw", "en", "fr"}


def detect_language(text: str) -> str:
    """
    Detects the language of *text*.
    Uses langdetect when available; falls back to a simple heuristic.
    Always returns one of: 'rw', 'en', 'fr'.
    """
    if not text or not text.strip():
        return "rw"

    try:
        from langdetect import detect
        detected = detect(text)
        if detected in SUPPORTED_LANGUAGES:
            return detected
        # Map common ISO codes to supported ones
        mapping = {"fr-ca": "fr", "en-us": "en", "en-gb": "en"}
        return mapping.get(detected, "rw")
    except ImportError:
        logger.debug("langdetect not installed — using heuristic language detection")
        return _heuristic_detect(text)
    except Exception:
        return "rw"


# ── Simple heuristic fallback ─────────────────────────────────────────────────

_FRENCH_MARKERS  = {"je", "ma", "mon", "le", "la", "les", "du", "des", "est", "fièvre"}
_ENGLISH_MARKERS = {"i", "my", "the", "have", "pain", "feel", "head", "chest", "fever"}


def _heuristic_detect(text: str) -> str:
    words = set(text.lower().split())
    fr_score = len(words & _FRENCH_MARKERS)
    en_score = len(words & _ENGLISH_MARKERS)
    if fr_score > en_score:
        return "fr"
    if en_score > fr_score:
        return "en"
    return "rw"
