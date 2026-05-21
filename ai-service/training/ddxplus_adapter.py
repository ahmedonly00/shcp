"""
ddxplus_adapter.py
------------------
Converts the DDXPlus dataset (1.6 M synthetic patient cases, 49 diseases) and
the Columbia EHR disease-symptom matrix into our 132-column binary training format.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATASET 1 — DDXPlus  (Intelia / Intel Labs, 2022)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source   : https://huggingface.co/datasets/Neko-Nik/DDXPlus
Format   : CSV with columns AGE, SEX, PATHOLOGY, EVIDENCES, INITIAL_EVIDENCE
           EVIDENCES is a stringified list of evidence tokens such as
           "['E_10_V_1', 'E_42_V_0', 'E_7_V_1']"
           V_1 = symptom present, V_0 = absent, V_? = unknown.
           A companion file release_evidences.json maps evidence IDs to names.

Download:
  pip install datasets huggingface_hub
  python -c "
  from datasets import load_dataset
  ds = load_dataset('Neko-Nik/DDXPlus', split='train')
  ds.to_csv('data/raw/ddxplus_train.csv', index=False)
  "
  # Also download the evidence/pathology lookup files from the DDXPlus GitHub:
  # https://github.com/intelai/ddxplus/tree/main/data
  # Place release_evidences.json and release_conditions.json in data/raw/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATASET 2 — Columbia EHR  (Rotmensch et al., 2017)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source   : https://figshare.com/articles/dataset/Disease_Symptom_and_Patient_Profile_Dataset/4272893
Format   : A disease × symptom probability matrix (CSV). Each cell is
           P(symptom | disease) derived from 270 k de-identified EHR records.
           Column 0 is Disease, remaining columns are symptoms.

Download:
  wget -O data/raw/columbia_ehr.csv \
       "https://figshare.com/ndownloader/files/6629366"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Usage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  # Convert DDXPlus (after downloading files above):
  python training/ddxplus_adapter.py --source ddxplus

  # Convert Columbia EHR (after downloading):
  python training/ddxplus_adapter.py --source columbia

  # Convert both:
  python training/ddxplus_adapter.py --source all

  Outputs land in data/raw/ and are automatically picked up by data_pipeline.py.
"""
from __future__ import annotations

import argparse
import ast
import json
import os

import numpy as np
import pandas as pd

BASE_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR      = os.path.join(BASE_DIR, "data", "raw")
ANCHOR_PATH  = os.path.join(BASE_DIR, "data", "raw", "symbipredict_2022.csv")

_DDXPLUS_CSV       = os.path.join(RAW_DIR, "ddxplus_train.csv")
_DDXPLUS_EVIDENCES = os.path.join(RAW_DIR, "release_evidences.json")
_DDXPLUS_CONDITIONS= os.path.join(RAW_DIR, "release_conditions.json")
_COLUMBIA_CSV      = os.path.join(RAW_DIR, "columbia_ehr.csv")

_DDXPLUS_OUT  = os.path.join(RAW_DIR, "ddxplus_compatible.csv")
_COLUMBIA_OUT = os.path.join(RAW_DIR, "columbia_compatible.csv")

# Minimum symptoms a row must have to be included
_MIN_SYMPTOMS = 3

# ── DDXPlus: pathology name → our canonical disease name ─────────────────────
# DDXPlus pathology names come from release_conditions.json ("cond_name" field).
# Longer/more specific patterns first.
_DDXPLUS_DISEASE_MAP: list[tuple[str, str]] = [
    ("pneumonia",                               "Pneumonia"),
    ("bronchitis",                              "Bronchial Asthma"),
    ("asthma",                                  "Bronchial Asthma"),
    ("tuberculosis",                            "Tuberculosis"),
    ("hiv",                                     "AIDS"),
    ("dengue",                                  "Dengue"),
    ("typhoid",                                 "Typhoid"),
    ("malaria",                                 "Malaria"),
    ("chickenpox",                              "Chickenpox"),
    ("varicella",                               "Chickenpox"),
    ("viral pharyngitis",                       "Common Cold"),
    ("upper respiratory",                       "Common Cold"),
    ("urti",                                    "Common Cold"),
    ("influenza",                               "Common Cold"),
    ("gastroenteritis",                         "Gastroenteritis"),
    ("gerd",                                    "GERD"),
    ("gastroesophageal reflux",                 "GERD"),
    ("peptic ulcer",                            "Peptic Ulcer Disease"),
    ("myocardial infarction",                   "Heart Attack"),
    ("heart attack",                            "Heart Attack"),
    ("pericarditis",                            "Heart Attack"),
    ("myocarditis",                             "Heart Attack"),
    ("hypertension",                            "Hypertension"),
    ("diabetes",                                "Diabetes"),
    ("hypoglycemia",                            "Hypoglycemia"),
    ("hypothyroidism",                          "Hypothyroidism"),
    ("hyperthyroidism",                         "Hyperthyroidism"),
    ("migraine",                                "Migraine"),
    ("stroke",                                  "Paralysis (brain hemorrhage)"),
    ("intracranial hemorrhage",                 "Paralysis (brain hemorrhage)"),
    ("urinary tract infection",                 "Urinary Tract Infection"),
    ("uti",                                     "Urinary Tract Infection"),
    ("rheumatoid arthritis",                    "Arthritis"),
    ("osteoarthritis",                          "Osteoarthritis"),
    ("arthritis",                               "Arthritis"),
    ("hepatitis a",                             "Hepatitis A"),
    ("hepatitis b",                             "Hepatitis B"),
    ("hepatitis c",                             "Hepatitis C"),
    ("jaundice",                                "Jaundice"),
    ("chickenpox",                              "Chickenpox"),
    ("psoriasis",                               "Psoriasis"),
    ("acne",                                    "Acne"),
    ("impetigo",                                "Impetigo"),
    ("fungal",                                  "Fungal Infection"),
    ("drug reaction",                           "Drug Reaction"),
    ("allergy",                                 "Allergy"),
    ("fibromyalgia",                            "Arthritis"),
    ("vertigo",                                 "Vertigo"),
]

# ── DDXPlus: evidence name → our canonical symptom column name ────────────────
# Evidence names come from release_evidences.json ("question_en" or "name" field).
# Map the lowercased name to our exact symptom column name.
_DDXPLUS_SYMPTOM_MAP: dict[str, str] = {
    # Fever / temperature
    "fever":                         "high_fever",
    "high fever":                    "high_fever",
    "mild fever":                    "mild_fever",
    "low-grade fever":               "mild_fever",
    "chills":                        "chills",
    "sweating":                      "sweating",
    "night sweats":                  "sweating",

    # Respiratory
    "cough":                         "cough",
    "dry cough":                     "cough",
    "productive cough":              "cough",
    "shortness of breath":           "breathlessness",
    "dyspnea":                       "breathlessness",
    "breathing difficulty":          "breathlessness",
    "wheezing":                      "breathlessness",
    "runny nose":                    "runny_nose",
    "nasal discharge":               "runny_nose",
    "congestion":                    "congestion",
    "sneezing":                      "continuous_sneezing",
    "sore throat":                   "throat_irritation",
    "throat pain":                   "throat_irritation",
    "phlegm":                        "phlegm",
    "mucus":                         "phlegm",

    # Pain
    "chest pain":                    "chest_pain",
    "headache":                      "headache",
    "abdominal pain":                "stomach_pain",
    "belly pain":                    "abdominal_pain",
    "back pain":                     "back_pain",
    "neck pain":                     "neck_pain",
    "joint pain":                    "joint_pain",
    "muscle pain":                   "muscle_pain",
    "muscle aches":                  "muscle_pain",
    "myalgia":                       "muscle_pain",
    "knee pain":                     "knee_pain",
    "hip pain":                      "hip_joint_pain",
    "burning sensation":             "burning_micturition",
    "burning urination":             "burning_micturition",

    # GI
    "nausea":                        "nausea",
    "vomiting":                      "vomiting",
    "diarrhea":                      "diarrhoea",
    "loose stools":                  "diarrhoea",
    "constipation":                  "constipation",
    "bloating":                      "stomach_bleeding",
    "loss of appetite":              "loss_of_appetite",
    "heartburn":                     "acidity",
    "indigestion":                   "indigestion",
    "blood in stool":                "bloody_stool",
    "rectal bleeding":               "bloody_stool",

    # Skin / appearance
    "rash":                          "skin_rash",
    "skin rash":                     "skin_rash",
    "itching":                       "itching",
    "pruritus":                      "itching",
    "jaundice":                      "yellowing_of_eyes",
    "yellow skin":                   "yellowish_skin",
    "yellow eyes":                   "yellowing_of_eyes",
    "pale skin":                     "pale_skin",
    "bluish skin":                   "bluish_discolouration",
    "swelling":                      "swelling_joints",
    "edema":                         "fluid_overload",

    # Neurological
    "dizziness":                     "dizziness",
    "vertigo":                       "spinning_movements",
    "altered consciousness":         "altered_sensorium",
    "confusion":                     "altered_sensorium",
    "stiff neck":                    "stiff_neck",
    "blurred vision":                "blurred_and_distorted_vision",
    "visual disturbance":            "blurred_and_distorted_vision",
    "weakness":                      "weakness_in_limbs",
    "limb weakness":                 "weakness_in_limbs",
    "numbness":                      "loss_of_balance",
    "loss of balance":               "loss_of_balance",

    # Cardiovascular
    "fast heart rate":               "fast_heart_rate",
    "tachycardia":                   "fast_heart_rate",
    "palpitations":                  "palpitations",
    "swollen legs":                  "swollen_legs",
    "swollen extremities":           "swollen_extremeties",

    # Urinary
    "frequent urination":            "polyuria",
    "dark urine":                    "dark_urine",

    # General
    "fatigue":                       "fatigue",
    "tiredness":                     "fatigue",
    "malaise":                       "malaise",
    "weight loss":                   "weight_loss",
    "weight gain":                   "weight_gain",
    "loss of appetite":              "loss_of_appetite",
    "dehydration":                   "dehydration",
    "anxiety":                       "anxiety",
    "mood swings":                   "mood_swings",
    "irritability":                  "irritability",
    "depression":                    "depression",
    "restlessness":                  "restlessness",
    "enlarged thyroid":              "enlarged_thyroid",
}

# ── Columbia EHR: raw symptom name → our canonical symptom column name ────────
_COLUMBIA_SYMPTOM_MAP: dict[str, str] = {
    "Fever":                "high_fever",
    "Chills":               "chills",
    "Cough":                "cough",
    "Dyspnea":              "breathlessness",
    "Headache":             "headache",
    "Nausea":               "nausea",
    "Vomiting":             "vomiting",
    "Diarrhea":             "diarrhoea",
    "Abdominal Pain":       "stomach_pain",
    "Chest Pain":           "chest_pain",
    "Fatigue":              "fatigue",
    "Weight Loss":          "weight_loss",
    "Weight Gain":          "weight_gain",
    "Joint Pain":           "joint_pain",
    "Back Pain":            "back_pain",
    "Rash":                 "skin_rash",
    "Itching":              "itching",
    "Jaundice":             "yellowing_of_eyes",
    "Sweating":             "sweating",
    "Dizziness":            "dizziness",
    "Confusion":            "altered_sensorium",
    "Blurred Vision":       "blurred_and_distorted_vision",
    "Weakness":             "weakness_in_limbs",
    "Swelling":             "swelling_joints",
    "Dehydration":          "dehydration",
    "Constipation":         "constipation",
    "Runny Nose":           "runny_nose",
    "Sore Throat":          "throat_irritation",
    "Muscle Aches":         "muscle_pain",
    "Palpitations":         "palpitations",
    "Frequent Urination":   "polyuria",
    "Dark Urine":           "dark_urine",
    "Anxiety":              "anxiety",
    "Loss of Appetite":     "loss_of_appetite",
}

# Columbia EHR: raw disease name → our canonical disease name
_COLUMBIA_DISEASE_MAP: list[tuple[str, str]] = [
    ("diabetes",            "Diabetes"),
    ("hypertension",        "Hypertension"),
    ("pneumonia",           "Pneumonia"),
    ("heart attack",        "Heart Attack"),
    ("myocardial",          "Heart Attack"),
    ("asthma",              "Bronchial Asthma"),
    ("influenza",           "Common Cold"),
    ("common cold",         "Common Cold"),
    ("tuberculosis",        "Tuberculosis"),
    ("hiv",                 "AIDS"),
    ("aids",                "AIDS"),
    ("dengue",              "Dengue"),
    ("malaria",             "Malaria"),
    ("typhoid",             "Typhoid"),
    ("hepatitis",           "Hepatitis A"),
    ("migraine",            "Migraine"),
    ("arthritis",           "Arthritis"),
    ("gastritis",           "GERD"),
    ("gerd",                "GERD"),
    ("urinary tract",       "Urinary Tract Infection"),
    ("uti",                 "Urinary Tract Infection"),
    ("hypothyroidism",      "Hypothyroidism"),
    ("hyperthyroidism",     "Hyperthyroidism"),
    ("chickenpox",          "Chickenpox"),
    ("varicella",           "Chickenpox"),
    ("stroke",              "Paralysis (brain hemorrhage)"),
    ("fungal",              "Fungal Infection"),
    ("psoriasis",           "Psoriasis"),
    ("vertigo",             "Vertigo"),
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_anchor_schema() -> tuple[list[str], set[str]]:
    anchor = pd.read_csv(ANCHOR_PATH).drop_duplicates()
    sym_cols = [c for c in anchor.columns if c != "prognosis"]
    diseases = set(anchor["prognosis"].unique())
    return sym_cols, diseases


def _map_disease(raw: str, mapping: list[tuple[str, str]]) -> str | None:
    low = raw.strip().lower()
    for pattern, canonical in mapping:
        if pattern in low:
            return canonical
    return None


# ── DDXPlus conversion ────────────────────────────────────────────────────────

def _load_evidences_lookup() -> dict[str, str]:
    """
    Load release_evidences.json and build {evidence_id: symptom_name} lookup.
    Falls back to an empty dict if the file is missing (adapter still works via
    the _DDXPLUS_SYMPTOM_MAP direct-name lookup).
    """
    if not os.path.exists(_DDXPLUS_EVIDENCES):
        return {}
    with open(_DDXPLUS_EVIDENCES) as f:
        raw = json.load(f)

    lookup: dict[str, str] = {}
    for evidence_id, meta in raw.items():
        name = (
            meta.get("name") or
            meta.get("question_en") or
            meta.get("en", "")
        ).lower().strip()
        if name:
            lookup[evidence_id] = name
    return lookup


def _load_pathologies_lookup() -> dict[str, str]:
    """Load release_conditions.json → {pathology_id: name}."""
    if not os.path.exists(_DDXPLUS_CONDITIONS):
        return {}
    with open(_DDXPLUS_CONDITIONS) as f:
        raw = json.load(f)
    return {pid: meta.get("cond_name", pid) for pid, meta in raw.items()}


def convert_ddxplus(seed: int = 42) -> str:
    """
    Convert DDXPlus CSV to our 132-column training format.
    Returns path to the output CSV.
    """
    if not os.path.exists(_DDXPLUS_CSV):
        raise FileNotFoundError(
            f"{_DDXPLUS_CSV} not found.\n"
            "Download it with:\n"
            "  pip install datasets\n"
            "  python -c \"\n"
            "  from datasets import load_dataset\n"
            "  ds = load_dataset('Neko-Nik/DDXPlus', split='train')\n"
            "  ds.to_csv('data/raw/ddxplus_train.csv', index=False)\n"
            "  \"\n"
            "Also place release_evidences.json and release_conditions.json from\n"
            "https://github.com/intelai/ddxplus/tree/main/data into data/raw/"
        )

    sym_cols, canonical_diseases = _load_anchor_schema()
    evidence_lookup    = _load_evidences_lookup()
    pathology_lookup   = _load_pathologies_lookup()

    print(f"\nLoading DDXPlus from {_DDXPLUS_CSV} ...")
    df = pd.read_csv(_DDXPLUS_CSV, low_memory=False)
    print(f"  {len(df):,} rows, columns: {list(df.columns[:5])} ...")

    rng = np.random.default_rng(seed)
    rows: list[dict] = []
    skipped_disease = 0
    skipped_symptoms = 0

    for _, record in df.iterrows():
        # ── Map pathology ────────────────────────────────────────────────────
        raw_path = str(record.get("PATHOLOGY", ""))
        # If it's a pathology ID, resolve to name
        path_name = pathology_lookup.get(raw_path, raw_path)
        disease = _map_disease(path_name.lower(), _DDXPLUS_DISEASE_MAP)
        if disease is None or disease not in canonical_diseases:
            skipped_disease += 1
            continue

        # ── Parse EVIDENCES list ─────────────────────────────────────────────
        raw_evidences = record.get("EVIDENCES", "[]")
        try:
            evidence_tokens: list[str] = ast.literal_eval(str(raw_evidences))
        except (ValueError, SyntaxError):
            skipped_symptoms += 1
            continue

        # Collect present symptoms (V_1 tokens)
        detected: set[str] = set()
        for token in evidence_tokens:
            if not token.endswith("_V_1"):
                continue
            # Strip value suffix: "E_10_V_1" → "E_10"
            evidence_id = token[:-4]
            # Resolve to a symptom name
            symptom_name = evidence_lookup.get(evidence_id, "").lower()
            if not symptom_name:
                # Try treating the token itself as a readable name (some DDXPlus versions)
                symptom_name = evidence_id.replace("_", " ").lower()

            canonical_sym = _DDXPLUS_SYMPTOM_MAP.get(symptom_name)
            if canonical_sym and canonical_sym in sym_cols:
                detected.add(canonical_sym)

        if len(detected) < _MIN_SYMPTOMS:
            skipped_symptoms += 1
            continue

        row = {col: (1 if col in detected else 0) for col in sym_cols}
        row["prognosis"] = disease
        rows.append(row)

    print(f"  Mapped rows      : {len(rows):,}")
    print(f"  Skipped (disease): {skipped_disease:,}")
    print(f"  Skipped (<{_MIN_SYMPTOMS} syms): {skipped_symptoms:,}")

    out_df = pd.DataFrame(rows, columns=sym_cols + ["prognosis"])
    out_df = out_df.drop_duplicates()
    out_df.to_csv(_DDXPLUS_OUT, index=False)

    per_d = out_df.groupby("prognosis").size()
    print(f"\n{'='*60}")
    print(f"  DDXPlus rows     : {len(out_df):,}")
    print(f"  Diseases covered : {out_df.prognosis.nunique()} / {len(canonical_diseases)}")
    print(f"  Rows/disease     : avg {per_d.mean():.0f}  min {per_d.min()}  max {per_d.max()}")
    print(f"  Saved to         : {_DDXPLUS_OUT}")
    print(f"{'='*60}")
    return _DDXPLUS_OUT


# ── Columbia EHR conversion ───────────────────────────────────────────────────

def convert_columbia(n_per_disease: int = 200, seed: int = 42) -> str:
    """
    Convert Columbia EHR disease×symptom probability matrix to binary training rows
    using probabilistic sampling (same approach as synthea_converter.py).
    Returns path to the output CSV.
    """
    if not os.path.exists(_COLUMBIA_CSV):
        raise FileNotFoundError(
            f"{_COLUMBIA_CSV} not found.\n"
            "Download it with:\n"
            "  # On Linux/Mac:\n"
            "  wget -O data/raw/columbia_ehr.csv \\\n"
            '       "https://figshare.com/ndownloader/files/6629366"\n'
            "  # On Windows PowerShell:\n"
            "  Invoke-WebRequest -Uri 'https://figshare.com/ndownloader/files/6629366' "
            "-OutFile data/raw/columbia_ehr.csv"
        )

    sym_cols, canonical_diseases = _load_anchor_schema()
    rng = np.random.default_rng(seed)

    print(f"\nLoading Columbia EHR from {_COLUMBIA_CSV} ...")
    matrix = pd.read_csv(_COLUMBIA_CSV)
    print(f"  {len(matrix)} disease rows, {matrix.shape[1]-1} symptom columns")

    rows: list[dict] = []
    skipped = 0
    alpha = 0.1  # Laplace smoothing

    for _, record in matrix.iterrows():
        raw_disease = str(record.iloc[0])
        disease = _map_disease(raw_disease.lower(), _COLUMBIA_DISEASE_MAP)
        if disease is None or disease not in canonical_diseases:
            skipped += 1
            continue

        # Build probability vector over our 132 symptoms
        probs = np.full(len(sym_cols), alpha / (1 + 2 * alpha))

        for col_raw, prob_val in record.iloc[1:].items():
            canonical_sym = _COLUMBIA_SYMPTOM_MAP.get(str(col_raw))
            if canonical_sym and canonical_sym in sym_cols:
                idx = sym_cols.index(canonical_sym)
                try:
                    p = float(prob_val)
                    # Columbia stores probabilities as 0–1 or 0–100; normalise
                    if p > 1:
                        p /= 100
                    probs[idx] = (p + alpha) / (1 + 2 * alpha)
                except (ValueError, TypeError):
                    pass

        # Probabilistic sampling
        disease_rows: list[np.ndarray] = []
        seen: set[tuple] = set()
        attempts = 0

        while len(disease_rows) < n_per_disease and attempts < n_per_disease * 50:
            attempts += 1
            vec = (rng.random(len(probs)) < probs).astype(int)
            if vec.sum() < _MIN_SYMPTOMS:
                continue
            key = tuple(vec.tolist())
            if key in seen:
                continue
            disease_rows.append(vec)
            seen.add(key)

        for vec in disease_rows:
            row = dict(zip(sym_cols, vec))
            row["prognosis"] = disease
            rows.append(row)

        print(f"  {disease:<40} {len(disease_rows):>4} rows")

    print(f"  Skipped (unmapped diseases): {skipped}")

    out_df = pd.DataFrame(rows, columns=sym_cols + ["prognosis"])
    out_df = out_df.drop_duplicates()
    out_df.to_csv(_COLUMBIA_OUT, index=False)

    per_d = out_df.groupby("prognosis").size()
    print(f"\n{'='*60}")
    print(f"  Columbia rows    : {len(out_df):,}")
    print(f"  Diseases covered : {out_df.prognosis.nunique()} / {len(canonical_diseases)}")
    print(f"  Rows/disease     : avg {per_d.mean():.0f}  min {per_d.min()}  max {per_d.max()}")
    print(f"  Saved to         : {_COLUMBIA_OUT}")
    print(f"{'='*60}")
    return _COLUMBIA_OUT


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert external datasets to 132-symptom training format")
    parser.add_argument(
        "--source",
        choices=["ddxplus", "columbia", "all"],
        default="all",
        help="Which dataset to convert (default: all)"
    )
    parser.add_argument("--n-per-disease", type=int, default=200,
                        help="Rows per disease for Columbia EHR (default: 200)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if args.source in ("ddxplus", "all"):
        try:
            convert_ddxplus(seed=args.seed)
        except FileNotFoundError as e:
            print(f"\n[DDXPlus] {e}")

    if args.source in ("columbia", "all"):
        try:
            convert_columbia(n_per_disease=args.n_per_disease, seed=args.seed)
        except FileNotFoundError as e:
            print(f"\n[Columbia EHR] {e}")

    print("\nNext step: python training/data_pipeline.py && python training/train_model.py")
