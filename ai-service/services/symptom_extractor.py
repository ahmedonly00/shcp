"""
symptom_extractor.py
--------------------
Converts patient free-text into the 132-column binary vector
expected by the RandomForest disease classifier.

Three extraction methods are combined:
  1. Direct column-name substring matching
  2. Synonym dictionary matching (English / French / Kinyarwanda)
  3. Body-map region → symptom expansion
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

# Negation window: look back up to 40 characters before a matched phrase
_NEG_RE = re.compile(r"\b(no|not|don'?t|without|sans|nta|never|aucun)\b")

# ── load symptom column order once at import time ──────────────────────────────
_BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_COLS_PATH  = os.path.join(_BASE_DIR, "models", "symptom_columns.json")

_SYMPTOM_COLUMNS: list[str] = []
if os.path.exists(_COLS_PATH):
    with open(_COLS_PATH) as _f:
        _SYMPTOM_COLUMNS = json.load(_f)

# ── synonym map (sorted by key length DESC at build-time) ─────────────────────
_RAW_SYNONYMS: dict[str, str] = {
    # English
    "sore throat":             "throat_irritation",
    "shortness of breath":     "breathlessness",
    "muscle aches":            "muscle_pain",
    "burning up":              "high_fever",
    "burning micturition":     "burning_micturition",
    "spotting urination":      "spotting_urination",
    "irregular urination":     "spotting_urination",
    "spotting":                "spotting_urination",
    "dischromic patches":      "dischromic_patches",
    "discoloured patches":     "dischromic_patches",
    "skin patches":            "dischromic_patches",
    "foul smell of urine":     "foul_smell_of_urine",
    "smelly urine":            "foul_smell_of_urine",
    "pain during bowel":       "pain_during_bowel_movements",
    "pain in anal":            "pain_in_anal_region",
    "bloody stool":            "bloody_stool",
    "blood in stool":          "bloody_stool",
    "blurred vision":          "blurred_and_distorted_vision",
    "cant see clearly":        "blurred_and_distorted_vision",
    "cannot see clearly":      "blurred_and_distorted_vision",
    "loss of appetite":        "loss_of_appetite",
    "no appetite":             "loss_of_appetite",
    "not hungry":              "loss_of_appetite",
    "cant eat":                "loss_of_appetite",
    "cannot eat":              "loss_of_appetite",
    "difficulty breathing":    "breathlessness",
    "short of breath":         "breathlessness",
    "hard to breathe":         "breathlessness",
    "cant breathe":            "breathlessness",
    "cannot breathe":          "breathlessness",
    "loss of smell":           "loss_of_smell",
    "cant smell":              "loss_of_smell",
    "cannot smell":            "loss_of_smell",
    "frequent urination":      "polyuria",
    "urinating a lot":         "polyuria",
    "night sweats":            "sweating",
    "feeling cold":            "chills",
    "feeling depressed":       "depression",
    "chest tightness":         "chest_pain",
    "chest pressure":          "chest_pain",
    "chest pain":              "chest_pain",
    "heart racing":            "fast_heart_rate",
    "fast heartbeat":          "fast_heart_rate",
    "loose stool":             "diarrhoea",
    "watery stool":            "diarrhoea",
    "runny stomach":           "diarrhoea",
    "stomach ache":            "stomach_pain",
    "stomach pain":            "stomach_pain",
    "abdominal pain":          "abdominal_pain",
    "tummy pain":              "abdominal_pain",
    "belly pain":              "belly_pain",
    "joint ache":              "joint_pain",
    "joint pain":              "joint_pain",
    "painful joints":          "joint_pain",
    "joint swelling":          "swelling_joints",
    "swollen joints":          "swelling_joints",
    "swollen legs":            "swollen_legs",
    "legs swollen":            "swollen_legs",
    "skin turned yellow":      "yellowish_skin",
    "yellow skin":             "yellowish_skin",
    "eyes turned yellow":      "yellowing_of_eyes",
    "yellow eyes":             "yellowing_of_eyes",
    "back pain":               "back_pain",
    "neck pain":               "neck_pain",
    "stiff neck":              "stiff_neck",
    "muscle pain":             "muscle_pain",
    "body aches":              "muscle_pain",
    "body pain":               "muscle_pain",
    "muscles hurt":            "muscle_pain",
    "weight gain":             "weight_gain",
    "gaining weight":          "weight_gain",
    "weight loss":             "weight_loss",
    "losing weight":           "weight_loss",
    "throwing up":             "vomiting",
    "threw up":                "vomiting",
    "skin peeling":            "skin_peeling",
    "skin rash":               "skin_rash",
    "red eyes":                "redness_of_eyes",
    "watery eyes":             "watering_from_eyes",
    "runny nose":              "runny_nose",
    "nose running":            "runny_nose",
    "blocked nose":            "congestion",
    "dark urine":              "dark_urine",
    "brown urine":             "dark_urine",
    "no energy":               "fatigue",
    "head ache":               "headache",
    "head pain":               "headache",
    "acid reflux":             "acidity",
    "increased hunger":        "excessive_hunger",
    "always hungry":           "excessive_hunger",
    "family history":          "family_history",
    "pus filled":              "pus_filled_pimples",
    "slight fever":            "mild_fever",
    "low fever":               "mild_fever",
    "breathless":              "breathlessness",
    "exhausted":               "fatigue",
    "tiredness":               "fatigue",
    "weakness":                "fatigue",
    "spinning":                "dizziness",
    "lightheaded":             "dizziness",
    "dizziness":               "dizziness",
    "constipation":            "constipation",
    "indigestion":             "indigestion",
    "heartburn":               "indigestion",
    "palpitations":            "palpitations",
    "blackheads":              "blackheads",
    "bruising":                "bruising",
    "bruises":                 "bruising",
    "dehydration":             "dehydration",
    "very thirsty":            "dehydration",
    "temperature":             "high_fever",
    "coughing":                "cough",
    "sneezing":                "continuous_sneezing",
    "shivering":               "shivering",
    "trembling":               "shivering",
    "shaking":                 "shivering",
    "sweating":                "sweating",
    "sweaty":                  "sweating",
    "jaundice":                "yellowish_skin",
    "migraine":                "headache",
    "anxious":                 "anxiety",
    "congestion":              "congestion",
    "phlegm":                  "phlegm",
    "mucus":                   "phlegm",
    "sputum":                  "phlegm",
    "vomit":                   "vomiting",
    "nausea":                  "nausea",
    "queasy":                  "nausea",
    "rash":                    "skin_rash",
    "itchy":                   "itching",
    "fever":                   "high_fever",
    "tired":                   "fatigue",
    "diarrhea":                "diarrhoea",
    "diarrhoea":               "diarrhoea",
    "cough":                   "cough",
    "itching":                 "itching",
    "itch":                    "itching",
    "chills":                  "chills",
    "anxiety":                 "anxiety",
    "depression":              "depression",
    "obesity":                 "obesity",
    "acidity":                 "acidity",
    "headache":                "headache",
    "dizzy":                   "dizziness",
    "backache":                "back_pain",
    "feel sick":               "nausea",
    "pus":                     "pus_filled_pimples",
    "insomnia":                "restlessness",
    "can't sleep":             "restlessness",
    "cannot sleep":            "restlessness",
    "trouble sleeping":        "restlessness",
    "sleep problems":          "restlessness",
    "ear pain":                "pain_behind_the_eyes",
    "earache":                 "pain_behind_the_eyes",
    "ear ache":                "pain_behind_the_eyes",
    "pain in ear":             "pain_behind_the_eyes",
    "throat pain":             "throat_irritation",
    "painful throat":          "throat_irritation",
    "muscle weakness":         "muscle_weakness",
    "weak muscles":            "muscle_weakness",
    "loss of balance":         "loss_of_balance",
    "unsteady":                "unsteadiness",

    # French
    "forte fièvre":            "high_fever",
    "douleur thoracique":      "chest_pain",
    "douleur poitrine":        "chest_pain",
    "douleurs musculaires":    "muscle_pain",
    "douleurs articulaires":   "joint_pain",
    "perte de poids":          "weight_loss",
    "perte appétit":           "loss_of_appetite",
    "yeux jaunes":             "yellowing_of_eyes",
    "peau jaune":              "yellowish_skin",
    "nez qui coule":           "runny_nose",
    "mal de gorge":            "throat_irritation",
    "urine foncée":            "dark_urine",
    "maux de tête":            "headache",
    "vomissements":            "vomiting",
    "essoufflement":           "breathlessness",
    "éruption cutanée":        "skin_rash",
    "céphalée":                "headache",
    "diarrhée":                "diarrhoea",
    "constipation":            "constipation",
    "nausées":                 "nausea",
    "frissons":                "chills",
    "fatigue":                 "fatigue",
    "vertiges":                "dizziness",
    "sueurs":                  "sweating",
    "fièvre":                  "high_fever",
    "vomir":                   "vomiting",
    "toux":                    "cough",

    # ── Kinyarwanda ───────────────────────────────────────────────────────────
    # Fever & temperature
    "umuriro mwinshi":         "high_fever",
    "umuriro muke":            "mild_fever",
    "umuriro":                 "high_fever",
    "ubushyuhe":               "high_fever",

    # Respiratory
    "ibibazo byo guhumeka":    "breathlessness",
    "guhumeka nabi":           "breathlessness",
    "guhumeka bigoye":         "breathlessness",
    "inkorora isuwe":          "cough",
    "inkorora":                "cough",
    "amaflegm":                "phlegm",
    "ibyango":                 "congestion",
    "guhuha kenshi":           "continuous_sneezing",
    "guhuha":                  "continuous_sneezing",

    # Head & neuro
    "kuribwa umutwe bikabije": "headache",
    "kuribwa umutwe":          "headache",
    "ikiribwa":                "headache",
    "umutwe uribwa":           "headache",
    "umutwe":                  "headache",
    "guhindagirana":           "dizziness",
    "gusimbagira":             "dizziness",
    "kurindagira":             "dizziness",
    "gusahurana":              "altered_sensorium",
    "gutakaza ubwenge":        "altered_sensorium",

    # Chest & cardiac
    "ububabare bw'igituza":    "chest_pain",
    "kubabara igituza":        "chest_pain",
    "ubuganga":                "chest_pain",
    "umutima ugenda vuba":     "fast_heart_rate",
    "umutima utera vuba":      "fast_heart_rate",
    "ubukangurambaga":         "palpitations",

    # GI — upper
    "isesemi":                 "nausea",
    "kuririmba":               "nausea",
    "guseseka":                "vomiting",
    "gutura":                  "vomiting",
    "kuruka":                  "vomiting",
    "gutera umurego":          "vomiting",
    "kuribwa igifu":           "stomach_pain",
    "inda iribwa":             "abdominal_pain",
    "kubabara inda":           "abdominal_pain",
    "ububabare bw'inda":       "abdominal_pain",

    # GI — lower
    "guhitwa":                 "diarrhoea",
    "gusurura":                "diarrhoea",
    "gucurika":                "diarrhoea",
    "amaraso mu nkari":        "bloody_stool",
    "inkari y'amaraso":        "bloody_stool",
    "kunena":                  "constipation",

    # Musculoskeletal
    "ububabare bw'ingingo":    "joint_pain",
    "uburibwe bw'ingingo":     "joint_pain",
    "kubabara ingingo":        "joint_pain",
    "amenyo":                  "joint_pain",
    "ububabare bw'umubiri":    "muscle_pain",
    "uburibwe bw'umubiri":     "muscle_pain",
    "uburirane":               "muscle_pain",
    "kubabara umugongo":       "back_pain",
    "kuribwa umugongo":        "back_pain",
    "ububabare bw'umugongo":   "back_pain",
    "kubabara izosi":          "neck_pain",
    "izosi iboze":             "stiff_neck",
    "inshinge y'izosi":        "stiff_neck",

    # Skin & eyes
    "impanga":                 "skin_rash",
    "gukangara":               "skin_rash",
    "ubukangara":              "skin_rash",
    "gushyitwa":               "itching",
    "kuribwa ubwoya":          "itching",
    "ibara ry'umuhondo":       "yellowish_skin",
    "indwara y'uruyuki":       "yellowish_skin",
    "amaso y'umuhondo":        "yellowing_of_eyes",
    "amaso akunze guribwa":    "redness_of_eyes",

    # Kinyarwanda — additional coverage
    "guhangayika":             "anxiety",
    "kwiheba":                 "depression",
    "agahinda":                "depression",
    "amaso atareba neza":      "blurred_and_distorted_vision",
    "kubona nabi":             "blurred_and_distorted_vision",
    "gukorwa umuhogo":         "throat_irritation",
    "umuhogo uribwa":          "throat_irritation",
    "uburibwe bw'imishikaro":  "muscle_pain",
    "kutidindira":             "restlessness",
    "nzoka y'amazuru":         "runny_nose",
    "kubabara ugutwi":         "pain_behind_the_eyes",  # closest proxy; ear_pain not in model

    # Systemic
    "kunanirwa":               "fatigue",
    "guhebuka":                "fatigue",
    "uburuhe":                 "fatigue",
    "umunaniro":               "fatigue",
    "gucika intege":           "fatigue",
    "uburwayi":                "fatigue",
    "guterera":                "shivering",
    "gukangarika":             "shivering",
    "kurota cyane":            "sweating",
    "gukonja":                 "chills",
    "gutakaza inzara":         "loss_of_appetite",
    "kutagira inzara":         "loss_of_appetite",
    "kugabanuka ibiro":        "weight_loss",
    "kongera ibiro":           "weight_gain",
    "gukenyera":               "dehydration",
    "inyota ikabije":          "dehydration",
}

# Sort by key length descending so longer phrases match first
_SYNONYMS: list[tuple[str, str]] = sorted(
    _RAW_SYNONYMS.items(), key=lambda kv: len(kv[0]), reverse=True
)

# ── body map → symptom expansion ─────────────────────────────────────────────
_BODY_MAP: dict[str, str] = {
    "chest":   "chest_pain",
    "head":    "headache",
    "stomach": "stomach_pain",
    "abdomen": "abdominal_pain",
    "back":    "back_pain",
    "joints":  "joint_pain",
    "skin":    "skin_rash",
    "eyes":    "redness_of_eyes",
    "throat":  "throat_irritation",
    "legs":    "swollen_legs",
}


# ── public API ─────────────────────────────────────────────────────────────────

def extract_symptoms(
    text: str,
    language: str = "en",
    body_map_data: dict[str, Any] | None = None,
    structured_symptoms: list[str] | None = None,
) -> dict:
    """
    Extract symptoms from free text + optional body-map regions + optional
    pre-parsed symptom list from the frontend.

    Returns:
        {
            'symptom_vector'    : list[int]  (length == 132),
            'detected_symptoms' : list[str],
            'symptom_count'     : int,
        }
    """
    if not _SYMPTOM_COLUMNS:
        _load_columns()

    detected: set[str] = set()
    lower_text = text.lower() if text else ""

    # ── Method 0 — structured symptom list from frontend (highest priority) ───
    if structured_symptoms:
        for sym in structured_symptoms:
            # Normalise: lowercase + spaces → underscores
            col = str(sym).lower().replace(" ", "_")
            if col in _SYMPTOM_COLUMNS:
                detected.add(col)
            else:
                # Try synonym lookup for frontend display labels
                for phrase, mapped_col in _SYNONYMS:
                    if phrase == str(sym).lower() and mapped_col in _SYMPTOM_COLUMNS:
                        detected.add(mapped_col)
                        break

    # ── Method 1 + 2 combined (synonyms first, then direct names) ─────────────
    # Work on a copy of the text we progressively "consume" to avoid double-hits
    working = lower_text
    negated: set[str] = set()

    # Method 2 — synonym matching (longer keys first)
    for phrase, col_name in _SYNONYMS:
        if phrase in working and col_name in _SYMPTOM_COLUMNS:
            idx = working.find(phrase)
            prefix = working[max(0, idx - 40): idx]
            if _NEG_RE.search(prefix):
                negated.add(col_name)
            else:
                detected.add(col_name)
            # blank out matched phrase to avoid double-matching substrings
            working = working.replace(phrase, " " * len(phrase), 1)

    # Method 1 — direct column-name matching (spaces replaced by underscores)
    for col in _SYMPTOM_COLUMNS:
        col_spaced = col.replace("_", " ")      # e.g. "high_fever" → "high fever"
        if col in lower_text or col_spaced in lower_text:
            idx = lower_text.find(col_spaced if col_spaced in lower_text else col)
            prefix = lower_text[max(0, idx - 40): idx]
            if _NEG_RE.search(prefix):
                negated.add(col)
            else:
                detected.add(col)

    # Remove anything explicitly negated
    detected -= negated

    # ── Method 3 — body map ───────────────────────────────────────────────────
    if body_map_data:
        # Support both flat {"chest": true} and {"regions": ["chest"]} formats
        regions_list = body_map_data.get("regions")
        if isinstance(regions_list, list):
            regions = regions_list
        else:
            # Flat dict: extract keys whose value is truthy (skip "severity" meta key)
            regions = [k for k, v in body_map_data.items() if v and k != "severity"]
        for region in regions:
            mapped = _BODY_MAP.get(str(region).lower())
            if mapped and mapped in _SYMPTOM_COLUMNS:
                detected.add(mapped)

    # ── build 132-element binary vector ──────────────────────────────────────
    symptom_set = detected
    vector = [1 if col in symptom_set else 0 for col in _SYMPTOM_COLUMNS]

    return {
        "symptom_vector":    vector,
        "detected_symptoms": sorted(symptom_set),
        "symptom_count":     len(symptom_set),
    }


def _load_columns():
    """Lazy reload in case columns weren't available at import time."""
    global _SYMPTOM_COLUMNS
    if os.path.exists(_COLS_PATH):
        with open(_COLS_PATH) as f:
            _SYMPTOM_COLUMNS = json.load(f)
