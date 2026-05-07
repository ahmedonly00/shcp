"""NLP extraction service using spaCy with heuristic fallback."""
from __future__ import annotations

import logging
import re
import unicodedata
from typing import Any

logger = logging.getLogger(__name__)

# ── Symptom keyword banks (multilingual) ─────────────────────────────────────
# Values are lists of surface forms AND their common lemmas/variants.
# spaCy path also matches on token lemmas, so "aching" matches "ache", etc.

_SYMPTOM_KEYWORDS: dict[str, list[str]] = {
    "high_fever":           ["high fever", "fever", "fièvre", "ubushyuhe", "temperature", "febrile", "pyrexia", "umuriro"],
    "headache":             ["headache", "head ache", "head pain", "migraine", "cephalgia", "mal de tête", "ububabare bw'umutwe"],
    "cough":                ["cough", "coughing", "toux", "inkorora"],
    "chest_pain":           ["chest pain", "chest ache", "chest tightness", "douleur thoracique", "ububabare bw'igituza"],
    "breathlessness":       ["shortness of breath", "difficulty breathing", "trouble breathing", "breathless",
                             "dyspnea", "dyspnoea", "can't breathe", "cannot breathe",
                             "essoufflement", "guhumeka nabi"],
    "nausea":               ["nausea", "nauseous", "feel sick", "feeling sick", "nausée", "kugira isesemi", "isesemi"],
    "vomiting":             ["vomiting", "vomit", "throwing up", "threw up", "vomissements", "gutapura"],
    "diarrhoea":            ["diarrhea", "diarrhoea", "loose stool", "loose stools", "watery stool",
                             "diarrhée", "guhitwa"],
    "fatigue":              ["fatigue", "tired", "tiredness", "exhausted", "exhaustion", "weakness", "weak",
                             "faiblesse", "uburuhe", "umunaniro"],
    "abdominal_pain":       ["abdominal pain", "stomach pain", "stomach ache", "belly pain", "tummy pain",
                             "douleur abdominale", "ububabare bw'inda"],
    "dizziness":            ["dizziness", "dizzy", "lightheaded", "lightheadedness", "spinning", "vertigo",
                             "vertige", "guhindagirana"],
    "sore_throat":          ["sore throat", "throat pain", "throat ache", "painful throat", "scratchy throat",
                             "mal de gorge", "kongorora"],
    "back_pain":            ["back pain", "back ache", "backache", "lower back pain",
                             "douleur dorsale", "ububabare bw'umugongo"],
    "joint_pain":           ["joint pain", "arthralgia", "arthralgie", "aching joints", "swollen joints",
                             "ububabare bw'ingingo"],
    "muscle_pain":          ["muscle pain", "muscle ache", "myalgia", "body ache", "body aches",
                             "douleur musculaire", "ububabare bw'imishikaro"],
    "skin_rash":            ["rash", "skin rash", "eruption", "hives", "urticaria",
                             "éruption cutanée", "ubukangara"],
    "itching":              ["itch", "itching", "itchy", "pruritus", "démangeaisons", "gushyitwa"],
    "loss_of_appetite":     ["loss of appetite", "no appetite", "not hungry", "can't eat", "perte d'appétit", "gutakaza inzara"],
    "sweating":             ["sweating", "sweat", "night sweats", "transpiration", "perspiration", "sueur"],
    "chills":               ["chills", "shivering", "shiver", "rigors", "frissons"],
    "mild_fever":           ["mild fever", "low fever", "low grade fever", "slight fever", "slightly warm"],
    "malaise":              ["malaise", "unwell", "not feeling well", "feeling unwell", "off", "ill"],
    "runny_nose":           ["runny nose", "nasal discharge", "rhinorrhoea", "rhinorrhea", "nez qui coule"],
    "sneezing":             ["sneezing", "sneeze", "éternuement"],
    "loss_of_smell":        ["loss of smell", "anosmia", "can't smell"],
    "loss_of_taste":        ["loss of taste", "ageusia", "can't taste"],
    "swollen_lymph_nodes":  ["swollen glands", "swollen lymph", "lymphadenopathy"],
    "blurred_and_distorted_vision": ["blurred vision", "blurry vision", "double vision", "vision problems",
                                     "trouble seeing", "vue floue"],
    "dehydration":          ["dehydration", "dehydrated", "very thirsty", "dry mouth"],
    "jaundice":             ["jaundice", "yellow skin", "yellow eyes", "yellowing", "ictère"],
}

# Body-area → canonical symptom mapping used when body-map data is provided
_BODY_MAP_SYMPTOM: dict[str, str] = {
    "head":    "headache",
    "chest":   "chest_pain",
    "abdomen": "abdominal_pain",
    "back":    "back_pain",
    "throat":  "sore_throat",
    "joints":  "joint_pain",
}

# Negation cues checked in the token dependency window (spaCy path)
# and as prefix words (heuristic path)
_NEGATION_WORDS = {"no", "not", "without", "deny", "denies", "denied",
                   "absent", "sans", "nta", "n't"}

# ── spaCy loader (lazy) ───────────────────────────────────────────────────────

_nlp: Any = None
_spacy_ok = True


def _load_spacy() -> Any | None:
    global _nlp, _spacy_ok
    if not _spacy_ok:
        return None
    if _nlp is not None:
        return _nlp
    try:
        import spacy                                    # type: ignore[import]
        try:
            _nlp = spacy.load("en_core_web_sm")
            logger.info("spaCy model 'en_core_web_sm' loaded")
        except OSError:
            _nlp = spacy.blank("en")
            logger.warning("spaCy en_core_web_sm not found; using blank pipeline")
        return _nlp
    except ImportError:
        logger.warning("spaCy not installed — using heuristic NLP")
        _spacy_ok = False
        return None


# ── Pre-build lemma → canonical lookup for spaCy path ────────────────────────

def _build_lemma_index(nlp: Any) -> dict[str, str]:
    """Map every keyword lemma -> canonical symptom name."""
    index: dict[str, str] = {}
    for canonical, keywords in _SYMPTOM_KEYWORDS.items():
        for phrase in keywords:
            # Lemmatize multi-word phrase using the first content token
            doc = nlp(phrase)
            tokens = [t for t in doc if not t.is_stop and not t.is_punct]
            if tokens:
                index[tokens[0].lemma_.lower()] = canonical
            # Also store the full surface form lower-cased
            index[phrase.lower()] = canonical
    return index


_lemma_index: dict[str, str] = {}


def _norm(text: str) -> str:
    """Lowercase + strip accents so 'fièvre' matches 'fievre'."""
    return unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode()


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
    global _lemma_index
    if not _lemma_index:
        _lemma_index = _build_lemma_index(nlp)

    doc = nlp(text)

    # Named entities from the model (informational)
    entities = [{"text": ent.text, "label": ent.label_} for ent in doc.ents]

    symptoms: list[str] = []
    negated:  list[str] = []
    lower = _norm(text)

    # ── Pass 1: multi-word phrase scan (longest match first) ─────────────────
    # Sort keywords by length desc so "high fever" is matched before "fever"
    all_phrases = sorted(
        ((_norm(phrase), canonical)
         for canonical, phrases in _SYMPTOM_KEYWORDS.items()
         for phrase in phrases),
        key=lambda x: len(x[0]),
        reverse=True,
    )
    matched_spans: list[tuple[int, int]] = []   # track covered char spans

    for phrase, canonical in all_phrases:
        if canonical in symptoms or canonical in negated:
            continue
        idx = lower.find(phrase)
        if idx == -1:
            continue
        # Skip if this span is already covered by a longer match
        end = idx + len(phrase)
        if any(s <= idx < e or s < end <= e for s, e in matched_spans):
            continue

        # Negation check using dependency tree of surrounding tokens
        if _is_negated_spacy(doc, idx, end, lower):
            negated.append(canonical)
        else:
            symptoms.append(canonical)
        matched_spans.append((idx, end))

    # ── Pass 2: per-token lemma scan (catches morphological variants) ─────────
    for token in doc:
        if token.is_stop or token.is_punct or token.is_space:
            continue
        lemma = token.lemma_.lower()
        canonical = _lemma_index.get(lemma)
        if canonical is None or canonical in symptoms or canonical in negated:
            continue
        if _token_is_negated(token):
            negated.append(canonical)
        else:
            symptoms.append(canonical)

    return {
        "symptoms":      symptoms,
        "entities":      entities,
        "negated":       negated,
        "duration_hint": _extract_duration(text),
    }


def _is_negated_spacy(doc: Any, char_start: int, char_end: int, norm_text: str) -> bool:
    """Check for negation using both dependency tree and prefix window."""
    # Dependency tree: look for negation tokens governing tokens in the span
    for token in doc:
        if token.idx >= char_start and token.idx < char_end:
            for child in token.children:
                if child.dep_ == "neg" or child.lemma_.lower() in _NEGATION_WORDS:
                    return True
            if token.head.lemma_.lower() in _NEGATION_WORDS:
                return True

    # Prefix window fallback (30 normalized chars before the phrase)
    prefix = norm_text[max(0, char_start - 30): char_start]
    return bool(re.search(r"\b(no|not|don'?t|without|sans|nta|denies?|absent)\b", prefix))


def _token_is_negated(token: Any) -> bool:
    """Check if a single token is governed by a negation dependency."""
    for child in token.children:
        if child.dep_ == "neg":
            return True
    for child in token.head.children:
        if child.dep_ == "neg":
            return True
    return False


# ── Heuristic fallback ────────────────────────────────────────────────────────

def _heuristic_extract(text: str) -> dict[str, Any]:
    lower = _norm(text)
    symptoms: list[str] = []
    negated:  list[str] = []

    # Longest match first, same as spaCy path
    all_phrases = sorted(
        ((_norm(phrase), canonical)
         for canonical, phrases in _SYMPTOM_KEYWORDS.items()
         for phrase in phrases),
        key=lambda x: len(x[0]),
        reverse=True,
    )
    matched_spans: list[tuple[int, int]] = []

    for phrase, canonical in all_phrases:
        if canonical in symptoms or canonical in negated:
            continue
        idx = lower.find(phrase)
        if idx == -1:
            continue
        end = idx + len(phrase)
        if any(s <= idx < e or s < end <= e for s, e in matched_spans):
            continue

        prefix = lower[max(0, idx - 30): idx]
        if re.search(r"\b(no|not|don'?t|without|sans|nta|denies?|absent)\b", prefix):
            negated.append(canonical)
        else:
            symptoms.append(canonical)
        matched_spans.append((idx, end))

    return {
        "symptoms":      symptoms,
        "entities":      [],
        "negated":       negated,
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
