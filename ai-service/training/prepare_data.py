"""
prepare_data.py
---------------
Loads symbipredict_2022.csv, deduplicates it, encodes labels,
saves artefacts to models/:
  - symptom_columns.json
  - label_encoder.pkl
  - urgency_map.json
"""
import json
import os
import pickle
import sys

import pandas as pd
from sklearn.preprocessing import LabelEncoder

# ── paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH  = os.path.join(BASE_DIR, "data", "raw", "symbipredict_2022.csv")
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ── urgency classification ─────────────────────────────────────────────────────
URGENCY_MAP = {
    # EMERGENCY
    "Heart Attack":               "EMERGENCY",
    "Paralysis (brain hemorrhage)":"EMERGENCY",
    "Hepatitis E":                "EMERGENCY",
    "Hepatitis D":                "EMERGENCY",
    "Alcoholic Hepatitis":        "EMERGENCY",
    # URGENT
    "Malaria":                    "URGENT",
    "Dengue":                     "URGENT",
    "Typhoid":                    "URGENT",
    "Tuberculosis":               "URGENT",
    "Pneumonia":                  "URGENT",
    "AIDS":                       "URGENT",
    "Hepatitis A":                "URGENT",
    "Hepatitis B":                "URGENT",
    "Hepatitis C":                "URGENT",
    "Hypoglycemia":               "URGENT",
    "Jaundice":                   "URGENT",
    "Bronchial Asthma":           "URGENT",
    "Chronic Cholestasis":        "URGENT",
    # ROUTINE
    "Gastroenteritis":            "ROUTINE",
    "Urinary Tract Infection":    "ROUTINE",
    "Peptic Ulcer Disease":       "ROUTINE",
    "GERD":                       "ROUTINE",
    "Migraine":                   "ROUTINE",
    "Cervical Spondylosis":       "ROUTINE",
    "Hypothyroidism":             "ROUTINE",
    "Hyperthyroidism":            "ROUTINE",
    "Osteoarthritis":             "ROUTINE",
    "Arthritis":                  "ROUTINE",
    "Vertigo":                    "ROUTINE",
    "Varicose Veins":             "ROUTINE",
    "Drug Reaction":              "ROUTINE",
    "Dimorphic Hemmorhoids (piles)": "ROUTINE",
    "Psoriasis":                  "ROUTINE",
    "Diabetes":                   "ROUTINE",
    "Hypertension":               "ROUTINE",
    # SELF_CARE
    "Fungal Infection":           "SELF_CARE",
    "Allergy":                    "SELF_CARE",
    "Common Cold":                "SELF_CARE",
    "Chickenpox":                 "SELF_CARE",
    "Acne":                       "SELF_CARE",
    "Impetigo":                   "SELF_CARE",
}


def prepare():
    # 1. Load
    df = pd.read_csv(DATA_PATH)
    rows_before = len(df)

    # 2. Deduplicate
    df = df.drop_duplicates()
    rows_after = len(df)

    # 3. Feature columns (everything except 'prognosis')
    # Strip any accidental whitespace in column names introduced by the CSV
    df.columns = [c.strip() for c in df.columns]
    feature_cols = [c for c in df.columns if c != "prognosis"]

    # 4. Save symptom column order
    cols_path = os.path.join(MODELS_DIR, "symptom_columns.json")
    with open(cols_path, "w") as f:
        json.dump(feature_cols, f, indent=2)

    # 5. Label encode prognosis
    le = LabelEncoder()
    le.fit(df["prognosis"])
    enc_path = os.path.join(MODELS_DIR, "label_encoder.pkl")
    with open(enc_path, "wb") as f:
        pickle.dump(le, f)

    # 6. Save urgency map
    urgency_path = os.path.join(MODELS_DIR, "urgency_map.json")
    with open(urgency_path, "w") as f:
        json.dump(URGENCY_MAP, f, indent=2)

    # 7. Summary
    classes = sorted(le.classes_.tolist())
    print(f"Rows before dedup : {rows_before}")
    print(f"Rows after  dedup : {rows_after}")
    print(f"Feature columns   : {len(feature_cols)}")
    print(f"Disease classes   : {len(classes)}")
    print(f"\nClasses:\n  " + "\n  ".join(classes))
    print(f"\nUrgency mapping saved: {urgency_path}")
    print(f"Symptom columns saved: {cols_path}")
    print(f"Label encoder  saved: {enc_path}")

    return df, feature_cols, le


if __name__ == "__main__":
    prepare()
