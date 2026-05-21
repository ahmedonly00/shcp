"""
feedback_export.py
------------------
Exports confirmed patient feedback from the Spring Boot database into a
training-ready CSV that data_pipeline.py can merge with other sources.

How it works
------------
The symptom_feedback table records:
  - report_id      -> links to symptom_reports (which stores ai_raw_response JSONB)
  - was_correct    -> true = AI matched doctor, false = AI was wrong
  - doctor_diagnosis -> what the doctor actually said (free text, optional)

This script:
  1. Queries symptom_feedback joined with symptom_reports.
  2. For was_correct=true rows: uses the AI's predicted disease (confirmed by doctor).
     For was_correct=false rows with a doctor diagnosis: maps the free-text diagnosis
     to a canonical disease name.
  3. Reconstructs the 132-column binary symptom vector from the detected_symptoms
     list stored inside ai_raw_response JSONB.
  4. Writes a CSV with the same schema as symbipredict_2022.csv.

Usage
-----
  python training/feedback_export.py
  python training/feedback_export.py --dry-run          # stats only, no file written
  python training/feedback_export.py --out data/raw/feedback_confirmed.csv
"""
from __future__ import annotations

import argparse
import json
import os

import pandas as pd

BASE_DIR               = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANCHOR_PATH            = os.path.join(BASE_DIR, "data", "raw", "symbipredict_2022.csv")
SYMPTOM_COLUMNS_PATH   = os.path.join(BASE_DIR, "models", "symptom_columns.json")
DEFAULT_OUT            = os.path.join(BASE_DIR, "data", "raw", "feedback_confirmed.csv")
RETRAIN_LOG_PATH       = os.path.join(BASE_DIR, "models", "retrain_log.json")

# ── Canonical disease names ───────────────────────────────────────────────────
_CANONICAL: list[tuple[str, str]] = [
    # Longer/more specific patterns first
    ("alcoholic hepatitis",          "Alcoholic Hepatitis"),
    ("allergic rhinitis",            "Allergy"),
    ("high blood pressure",          "Hypertension"),
    ("benign paroxysmal",            "Vertigo"),
    ("low blood sugar",              "Hypoglycemia"),
    ("urinary tract",                "Urinary Tract Infection"),
    ("brain hemorrhage",             "Paralysis (brain hemorrhage)"),
    ("cervical spondylosis",         "Cervical Spondylosis"),
    ("chicken pox",                  "Chickenpox"),
    ("common cold",                  "Common Cold"),
    ("dengue",                       "Dengue"),
    ("peptic ulcer",                 "Peptic Ulcer Disease"),
    ("drug reaction",                "Drug Reaction"),
    ("drug allergy",                 "Drug Reaction"),
    ("hepatitis a",                  "Hepatitis A"),
    ("hepatitis b",                  "Hepatitis B"),
    ("hepatitis c",                  "Hepatitis C"),
    ("hepatitis d",                  "Hepatitis D"),
    ("hepatitis e",                  "Hepatitis E"),
    ("rheumatoid",                   "Arthritis"),
    ("myocardial",                   "Heart Attack"),
    ("heart attack",                 "Heart Attack"),
    ("pulmonary tuberculosis",       "Tuberculosis"),
    ("varicella",                    "Chickenpox"),
    ("cholestasis",                  "Chronic Cholestasis"),
    ("haemorrhoid",                  "Dimorphic Hemmorhoids (piles)"),
    ("hemorrhoid",                   "Dimorphic Hemmorhoids (piles)"),
    ("hyperthyroidism",              "Hyperthyroidism"),
    ("hypoglycemia",                 "Hypoglycemia"),
    ("hypothyroidism",               "Hypothyroidism"),
    ("osteoarthritis",               "Osteoarthritis"),
    ("paralysis",                    "Paralysis (brain hemorrhage)"),
    ("varicose",                     "Varicose Veins"),
    ("gastroenteritis",              "Gastroenteritis"),
    ("fungal",                       "Fungal Infection"),
    ("tinea",                        "Fungal Infection"),
    ("acne",                         "Acne"),
    ("aids",                         "AIDS"),
    ("allergy",                      "Allergy"),
    ("arthritis",                    "Arthritis"),
    ("asthma",                       "Bronchial Asthma"),
    ("bronchial",                    "Bronchial Asthma"),
    ("chickenpox",                   "Chickenpox"),
    ("cold",                         "Common Cold"),
    ("diabetes",                     "Diabetes"),
    ("gerd",                         "GERD"),
    ("reflux",                       "GERD"),
    ("hiv",                          "AIDS"),
    ("hypertension",                 "Hypertension"),
    ("impetigo",                     "Impetigo"),
    ("jaundice",                     "Jaundice"),
    ("malaria",                      "Malaria"),
    ("migraine",                     "Migraine"),
    ("piles",                        "Dimorphic Hemmorhoids (piles)"),
    ("pneumonia",                    "Pneumonia"),
    ("psoriasis",                    "Psoriasis"),
    ("stroke",                       "Paralysis (brain hemorrhage)"),
    ("tuberculosis",                 "Tuberculosis"),
    ("tb",                           "Tuberculosis"),
    ("typhoid",                      "Typhoid"),
    ("ulcer",                        "Peptic Ulcer Disease"),
    ("uti",                          "Urinary Tract Infection"),
    ("vertigo",                      "Vertigo"),
]


def _map_doctor_diagnosis(raw: str) -> str | None:
    low = raw.strip().lower()
    for pattern, canonical in _CANONICAL:
        if pattern in low:
            return canonical
    return None


def _load_db_credentials() -> dict:
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


def _load_symptom_columns() -> list[str]:
    """Load the 132 canonical symptom column names from models/symptom_columns.json."""
    if os.path.exists(SYMPTOM_COLUMNS_PATH):
        with open(SYMPTOM_COLUMNS_PATH) as f:
            return json.load(f)
    # Fall back to deriving from anchor dataset
    anchor = pd.read_csv(ANCHOR_PATH).drop_duplicates()
    return [c for c in anchor.columns if c != "prognosis"]


def _build_vector(detected_symptoms: list[str], sym_cols: list[str]) -> list[int]:
    """Reconstruct 132-column binary vector from a list of detected symptom names."""
    detected_set = set(detected_symptoms)
    return [1 if col in detected_set else 0 for col in sym_cols]


def count(conn=None) -> int:
    """
    Return the number of feedback rows that would be exported without writing anything.
    Useful for auto_retrain.py to decide whether retraining is worthwhile.
    Opens its own connection if conn is not provided.
    """
    close_conn = conn is None
    if conn is None:
        try:
            import psycopg2
        except ImportError:
            return 0
        creds = _load_db_credentials()
        try:
            conn = psycopg2.connect(**creds)
        except Exception:
            return 0

    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT COUNT(*)
            FROM symptom_feedback sf
            JOIN symptom_reports sr ON sr.report_id = sf.report_id
            WHERE sf.was_correct IS NOT NULL
              AND sr.ai_raw_response IS NOT NULL
              AND sr.ai_raw_response::text NOT IN ('{}', 'null', '')
        """)
        n = cur.fetchone()[0]
        cur.close()
        return n
    except Exception:
        return 0
    finally:
        if close_conn:
            conn.close()


def export(out_path: str = DEFAULT_OUT, dry_run: bool = False) -> int:
    """
    Query confirmed feedback from the database and export to CSV.
    Returns the number of rows written (0 on dry-run or no data).
    """
    sym_cols = _load_symptom_columns()
    canonical_diseases = set(pd.read_csv(ANCHOR_PATH)["prognosis"].unique())

    print(f"\nSymptom columns  : {len(sym_cols)}")
    print(f"Known diseases   : {len(canonical_diseases)}")

    try:
        import psycopg2
    except ImportError:
        print("\npsycopg2 not installed. Run:  pip install psycopg2-binary")
        return 0

    creds = _load_db_credentials()
    print(f"Connecting to    {creds['user']}@{creds['host']}:{creds['port']}/{creds['database']}")

    try:
        conn = psycopg2.connect(**creds)
    except Exception as exc:
        print(f"DB connection failed: {exc}")
        print("\nSet DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD in your .env file.")
        return 0

    # Fetch all feedback rows that have a usable label source:
    #   - was_correct=true  → AI predicted correctly; use AI's disease from ai_raw_response
    #   - was_correct=false → doctor corrected AI; use doctor_diagnosis free text
    query = """
        SELECT
            sf.was_correct,
            sf.doctor_diagnosis,
            sr.ai_raw_response
        FROM symptom_feedback sf
        JOIN symptom_reports sr ON sr.report_id = sf.report_id
        WHERE sf.was_correct IS NOT NULL
          AND sr.ai_raw_response IS NOT NULL
          AND sr.ai_raw_response::text NOT IN ('{}', 'null', '')
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

    print(f"\nTotal feedback rows fetched: {len(rows)}")

    if not rows:
        print("No feedback yet — the table is empty or no doctor diagnosis has been submitted.")
        return 0

    good_rows: list[dict] = []
    skipped_no_symptoms   = 0
    skipped_unmapped_dx   = 0
    skipped_unknown_status = 0
    correct_count         = 0
    corrected_count       = 0

    for was_correct, doctor_dx, ai_raw in rows:
        # ── Parse ai_raw_response ────────────────────────────────────────────
        if isinstance(ai_raw, str):
            try:
                ai_resp = json.loads(ai_raw)
            except json.JSONDecodeError:
                skipped_no_symptoms += 1
                continue
        elif isinstance(ai_raw, dict):
            ai_resp = ai_raw
        else:
            skipped_no_symptoms += 1
            continue

        # Support both snake_case (new records) and camelCase (legacy records)
        detected = ai_resp.get("detected_symptoms") or ai_resp.get("detectedSymptoms")
        if not isinstance(detected, list) or len(detected) == 0:
            skipped_no_symptoms += 1
            continue

        # ── Determine the correct disease label ──────────────────────────────
        if was_correct:
            # AI was right — use the AI-predicted disease as the confirmed label
            label = ai_resp.get("disease")  # single-word key, same in both formats
            if not label or label not in canonical_diseases:
                skipped_unmapped_dx += 1
                continue
            correct_count += 1
        else:
            # Doctor corrected the AI — map the free-text diagnosis
            if not doctor_dx or not doctor_dx.strip():
                skipped_unknown_status += 1
                continue
            label = _map_doctor_diagnosis(doctor_dx)
            if label is None:
                print(f"  Skipping unmapped doctor diagnosis: {doctor_dx!r}")
                skipped_unmapped_dx += 1
                continue
            corrected_count += 1

        vec = _build_vector(detected, sym_cols)
        row = dict(zip(sym_cols, vec))
        row["prognosis"] = label
        good_rows.append(row)

    print(f"\nExportable rows breakdown:")
    print(f"  AI-confirmed (was_correct=true)  : {correct_count}")
    print(f"  Doctor-corrected (was_correct=false) : {corrected_count}")
    print(f"  Skipped — no detected_symptoms   : {skipped_no_symptoms}")
    print(f"  Skipped — unmapped diagnosis     : {skipped_unmapped_dx}")
    print(f"  Skipped — no doctor diagnosis    : {skipped_unknown_status}")
    print(f"  Total exportable                 : {len(good_rows)}")

    if not good_rows:
        print("Nothing to export.")
        return 0

    df = pd.DataFrame(good_rows, columns=sym_cols + ["prognosis"])
    per_disease = df.groupby("prognosis").size().sort_values(ascending=False)
    print(f"\nDisease breakdown:")
    for disease, cnt in per_disease.items():
        print(f"  {disease:<45} {cnt:>4} rows")

    if dry_run:
        print("\nDry-run — nothing written.")
        return len(good_rows)

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
