"""
feedback_export.py
------------------
Exports confirmed patient feedback from the Spring Boot database into a
training-ready CSV that data_pipeline.py can merge with other sources.

How it works
------------
The symptom_feedback table records:
  - report_id     -> links to symptom_report (which has the symptom_vector JSON)
  - was_correct   -> true = AI matched doctor, false = AI was wrong
  - doctor_diagnosis -> what the doctor actually said (free text, optional)

This script:
  1. Queries all feedback rows where the doctor provided a confirmed diagnosis
     (was_correct=false AND doctor_diagnosis IS NOT NULL), because those rows
     tell us exactly what disease the patient actually had.
  2. Reads the symptom_vector from the linked symptom_report.
  3. Maps the doctor_diagnosis free text to a canonical disease name.
  4. Writes a CSV with the same 132-column binary format as symbipredict_2022.csv.

Usage
-----
  # Requires DB credentials — set via environment variables or .env
  python training/feedback_export.py

  # Dry-run (print stats without writing)
  python training/feedback_export.py --dry-run

  # Output path (default: data/raw/feedback_confirmed.csv)
  python training/feedback_export.py --out data/raw/feedback_confirmed.csv
"""
from __future__ import annotations

import argparse
import json
import os
import re

import pandas as pd

BASE_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANCHOR_PATH  = os.path.join(BASE_DIR, "data", "raw", "symbipredict_2022.csv")
DEFAULT_OUT  = os.path.join(BASE_DIR, "data", "raw", "feedback_confirmed.csv")

# ── Canonical disease names (must match anchor dataset exactly) ───────────────
_CANONICAL = {
    # Key: lowercased substring → canonical name
    "aids":                          "AIDS",
    "hiv":                           "AIDS",
    "acne":                          "Acne",
    "alcoholic hepatitis":           "Alcoholic Hepatitis",
    "allergy":                       "Allergy",
    "allergic rhinitis":             "Allergy",
    "arthritis":                     "Arthritis",
    "rheumatoid":                    "Arthritis",
    "osteoarthritis":                "Osteoarthritis",
    "asthma":                        "Bronchial Asthma",
    "bronchial":                     "Bronchial Asthma",
    "cervical spondylosis":          "Cervical Spondylosis",
    "chickenpox":                    "Chickenpox",
    "chicken pox":                   "Chickenpox",
    "varicella":                     "Chickenpox",
    "cholestasis":                   "Chronic Cholestasis",
    "common cold":                   "Common Cold",
    "cold":                          "Common Cold",
    "dengue":                        "Dengue",
    "diabetes":                      "Diabetes",
    "haemorrhoid":                   "Dimorphic Hemmorhoids (piles)",
    "hemorrhoid":                    "Dimorphic Hemmorhoids (piles)",
    "piles":                         "Dimorphic Hemmorhoids (piles)",
    "drug reaction":                 "Drug Reaction",
    "drug allergy":                  "Drug Reaction",
    "fungal":                        "Fungal Infection",
    "tinea":                         "Fungal Infection",
    "gerd":                          "GERD",
    "reflux":                        "GERD",
    "gastroenteritis":               "Gastroenteritis",
    "heart attack":                  "Heart Attack",
    "myocardial":                    "Heart Attack",
    "hepatitis a":                   "Hepatitis A",
    "hepatitis b":                   "Hepatitis B",
    "hepatitis c":                   "Hepatitis C",
    "hepatitis d":                   "Hepatitis D",
    "hepatitis e":                   "Hepatitis E",
    "hypertension":                  "Hypertension",
    "high blood pressure":           "Hypertension",
    "hyperthyroidism":               "Hyperthyroidism",
    "hypoglycemia":                  "Hypoglycemia",
    "low blood sugar":               "Hypoglycemia",
    "hypothyroidism":                "Hypothyroidism",
    "impetigo":                      "Impetigo",
    "jaundice":                      "Jaundice",
    "malaria":                       "Malaria",
    "migraine":                      "Migraine",
    "paralysis":                     "Paralysis (brain hemorrhage)",
    "brain hemorrhage":              "Paralysis (brain hemorrhage)",
    "stroke":                        "Paralysis (brain hemorrhage)",
    "peptic ulcer":                  "Peptic Ulcer Disease",
    "ulcer":                         "Peptic Ulcer Disease",
    "pneumonia":                     "Pneumonia",
    "psoriasis":                     "Psoriasis",
    "tuberculosis":                  "Tuberculosis",
    "tb":                            "Tuberculosis",
    "typhoid":                       "Typhoid",
    "urinary tract":                 "Urinary Tract Infection",
    "uti":                           "Urinary Tract Infection",
    "varicose":                      "Varicose Veins",
    "vertigo":                       "Vertigo",
}


def _map_doctor_diagnosis(raw: str) -> str | None:
    """Map free-text doctor diagnosis to a canonical disease name."""
    low = raw.strip().lower()
    # Longest match first
    for pattern, canonical in sorted(_CANONICAL.items(), key=lambda x: -len(x[0])):
        if pattern in low:
            return canonical
    return None


def _load_db_credentials() -> dict:
    """Load DB credentials from environment, falling back to .env file."""
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

    return {
        "host":     os.environ.get("DB_HOST",     "localhost"),
        "port":     os.environ.get("DB_PORT",     "5432"),
        "database": os.environ.get("DB_NAME",     "shcp"),
        "user":     os.environ.get("DB_USER",     "postgres"),
        "password": os.environ.get("DB_PASSWORD", ""),
    }


def export(out_path: str = DEFAULT_OUT, dry_run: bool = False) -> int:
    """
    Query confirmed feedback from the database and export to CSV.
    Returns the number of rows written (0 on dry-run or no data).
    """
    # ── Load anchor schema ────────────────────────────────────────────────────
    anchor   = pd.read_csv(ANCHOR_PATH).drop_duplicates()
    sym_cols = [c for c in anchor.columns if c != "prognosis"]
    canonical_diseases = set(anchor["prognosis"].unique())

    print(f"\nAnchor schema : {len(sym_cols)} symptom columns, {len(canonical_diseases)} diseases")

    # ── Connect to PostgreSQL ─────────────────────────────────────────────────
    try:
        import psycopg2
    except ImportError:
        print("\npsycopg2 not installed. Run:  pip install psycopg2-binary")
        return 0

    creds = _load_db_credentials()
    print(f"Connecting to  {creds['user']}@{creds['host']}:{creds['port']}/{creds['database']}")

    try:
        conn = psycopg2.connect(**creds)
    except Exception as exc:
        print(f"DB connection failed: {exc}")
        print("\nSet DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD in your .env file.")
        return 0

    # ── Query confirmed feedback rows ─────────────────────────────────────────
    # We want rows where was_correct=false and the doctor gave a specific diagnosis,
    # because those tell us: "the patient had THESE symptoms and the ACTUAL disease was X"
    query = """
        SELECT
            sf.was_correct,
            sf.doctor_diagnosis,
            sr.symptom_vector
        FROM symptom_feedback sf
        JOIN symptom_report sr ON sr.report_id = sf.report_id
        WHERE sf.doctor_diagnosis IS NOT NULL
          AND TRIM(sf.doctor_diagnosis) <> ''
    """

    try:
        cur = conn.cursor()
        cur.execute(query)
        rows = cur.fetchall()
        cur.close()
        conn.close()
    except Exception as exc:
        print(f"Query failed: {exc}")
        conn.close()
        return 0

    print(f"\nFeedback rows with doctor diagnosis: {len(rows)}")

    if not rows:
        print("No confirmed feedback yet — the table is empty or no doctors diagnosed yet.")
        print("Feedback rows accumulate as patients use the Previous Assessments panel.")
        return 0

    # ── Map and build rows ────────────────────────────────────────────────────
    good_rows: list[dict] = []
    skipped = 0

    for was_correct, doctor_dx, symptom_vector_raw in rows:
        canonical = _map_doctor_diagnosis(doctor_dx)
        if canonical is None:
            print(f"  Skipping unmapped diagnosis: {doctor_dx!r}")
            skipped += 1
            continue

        # symptom_vector may be stored as JSON string or list
        if isinstance(symptom_vector_raw, str):
            try:
                vec = json.loads(symptom_vector_raw)
            except json.JSONDecodeError:
                skipped += 1
                continue
        else:
            vec = symptom_vector_raw

        if not isinstance(vec, list) or len(vec) != len(sym_cols):
            skipped += 1
            continue

        row = dict(zip(sym_cols, vec))
        row["prognosis"] = canonical
        good_rows.append(row)

    print(f"Mapped to canonical disease : {len(good_rows)} rows")
    print(f"Skipped (unmapped/invalid)  : {skipped} rows")

    if not good_rows:
        print("Nothing to export.")
        return 0

    # ── Stats ─────────────────────────────────────────────────────────────────
    df = pd.DataFrame(good_rows, columns=sym_cols + ["prognosis"])
    per_disease = df.groupby("prognosis").size().sort_values(ascending=False)
    print(f"\nDisease breakdown:")
    for disease, count in per_disease.items():
        print(f"  {disease:<40} {count:>4} rows")

    if dry_run:
        print("\nDry-run — nothing written.")
        return 0

    # ── Save ──────────────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    df.to_csv(out_path, index=False)
    print(f"\nSaved {len(df)} rows -> {out_path}")
    print("Next step: python training/data_pipeline.py && python training/train_model.py")
    return len(df)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export confirmed patient feedback as training data")
    parser.add_argument("--out",     default=DEFAULT_OUT, help="Output CSV path")
    parser.add_argument("--dry-run", action="store_true",  help="Print stats without writing")
    args = parser.parse_args()
    export(out_path=args.out, dry_run=args.dry_run)
