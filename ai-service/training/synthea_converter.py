"""
synthea_converter.py
--------------------
Converts Synthea patient output into the 132-symptom binary training format
and saves it to data/raw/synthea_generated.csv.

How it works
------------
Synthea generates realistic patient demographics and diagnoses, but does not
produce symptom vectors in our 132-column binary format. This converter:

  1. Reads Synthea conditions.csv to get a realistic disease distribution
     (how many patients per disease, age/sex demographics).

  2. For each disease, learns P(symptom_j = 1 | disease) from the existing
     Symbipredict training data — i.e., how often each symptom appears for
     that disease in the validated dataset.

  3. Generates new rows by probabilistic sampling: each symptom is turned on
     with probability P(symptom_j = 1 | disease), producing unique symptom
     combinations that are medically realistic but have never been seen before.

  4. Applies a minimum-symptom filter (at least 3 symptoms per row) and
     deduplicates against the existing dataset before saving.

Why this produces better training data
---------------------------------------
The current training data has 5-10 unique symptom patterns per disease (304 rows
total). Probabilistic sampling can generate hundreds of unique combinations per
disease, teaching the model that the same disease can present with different
subsets of its characteristic symptoms — which is medically accurate.

Note on Synthea disease coverage
----------------------------------
Synthea is US-centric and covers ~20 of our 41 diseases natively. For the
remaining diseases (Malaria, Typhoid, Dengue, etc.) the converter uses the
diseases from our training data with uniform patient counts.

Usage:
  # Full run (requires synthea_setup.py to have been run first):
  python training/synthea_converter.py

  # Generate without Synthea output (pure probabilistic, all 41 diseases):
  python training/synthea_converter.py --no-synthea --n-per-disease 300
"""
from __future__ import annotations

import argparse
import os

import numpy as np
import pandas as pd

BASE_DIR      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANCHOR_PATH   = os.path.join(BASE_DIR, "data", "raw", "symbipredict_2022.csv")
SYNTHEA_CSV   = os.path.join(BASE_DIR, "data", "synthea", "output", "csv", "conditions.csv")
PATIENTS_CSV  = os.path.join(BASE_DIR, "data", "synthea", "output", "csv", "patients.csv")
OUT_PATH      = os.path.join(BASE_DIR, "data", "raw", "synthea_generated.csv")
DEMO_REPORT   = os.path.join(BASE_DIR, "data", "synthea", "demographics_report.json")

# Minimum symptoms a generated row must have to be included
_MIN_SYMPTOMS = 3

# How many generation attempts per target row before giving up
_MAX_TRIES = 20

# ── Synthea condition description → our canonical disease name ────────────────
# Synthea uses plain-English clinical descriptions; we match by substring.
# Longer/more specific patterns must come before shorter/general ones.
_SYNTHEA_MAP: list[tuple[str, str]] = [
    ("type 2 diabetes",             "Diabetes"),
    ("type 1 diabetes",             "Diabetes"),
    ("diabetes",                    "Diabetes"),
    ("essential hypertension",      "Hypertension"),
    ("hypertension",                "Hypertension"),
    ("bronchial asthma",            "Bronchial Asthma"),
    ("asthma",                      "Bronchial Asthma"),
    ("pneumonia",                   "Pneumonia"),
    ("community-acquired pneumonia","Pneumonia"),
    ("myocardial infarction",       "Heart Attack"),
    ("heart attack",                "Heart Attack"),
    ("acute myocardial",            "Heart Attack"),
    ("migraine",                    "Migraine"),
    ("osteoarthritis",              "Osteoarthritis"),
    ("rheumatoid arthritis",        "Arthritis"),
    ("arthritis",                   "Arthritis"),
    ("urinary tract infection",     "Urinary Tract Infection"),
    ("cystitis",                    "Urinary Tract Infection"),
    ("gastroesophageal reflux",     "GERD"),
    ("gerd",                        "GERD"),
    ("peptic ulcer",                "Peptic Ulcer Disease"),
    ("gastroenteritis",             "Gastroenteritis"),
    ("viral gastroenteritis",       "Gastroenteritis"),
    ("varicose veins",              "Varicose Veins"),
    ("varicosity",                  "Varicose Veins"),
    ("cervical spondylosis",        "Cervical Spondylosis"),
    ("chronic cholestasis",         "Chronic Cholestasis"),
    ("cholestasis",                 "Chronic Cholestasis"),
    ("hepatitis a",                 "Hepatitis A"),
    ("hepatitis b",                 "Hepatitis B"),
    ("hepatitis c",                 "Hepatitis C"),
    ("hepatitis d",                 "Hepatitis D"),
    ("hepatitis e",                 "Hepatitis E"),
    ("alcoholic hepatitis",         "Alcoholic Hepatitis"),
    ("jaundice",                    "Jaundice"),
    ("malaria",                     "Malaria"),
    ("typhoid",                     "Typhoid"),
    ("typhoid fever",               "Typhoid"),
    ("dengue",                      "Dengue"),
    ("tuberculosis",                "Tuberculosis"),
    ("pulmonary tuberculosis",      "Tuberculosis"),
    ("chickenpox",                  "Chickenpox"),
    ("varicella",                   "Chickenpox"),
    ("hyperthyroidism",             "Hyperthyroidism"),
    ("hypothyroidism",              "Hypothyroidism"),
    ("hypoglycemia",                "Hypoglycemia"),
    ("vertigo",                     "Vertigo"),
    ("benign paroxysmal",           "Vertigo"),
    ("acne",                        "Acne"),
    ("psoriasis",                   "Psoriasis"),
    ("fungal infection",            "Fungal Infection"),
    ("tinea",                       "Fungal Infection"),
    ("drug reaction",               "Drug Reaction"),
    ("drug allergy",                "Drug Reaction"),
    ("allergy",                     "Allergy"),
    ("allergic rhinitis",           "Allergy"),
    ("hemorrhoid",                  "Dimorphic Hemmorhoids (piles)"),
    ("haemorrhoid",                 "Dimorphic Hemmorhoids (piles)"),
    ("impetigo",                    "Impetigo"),
    ("hiv",                         "AIDS"),
    ("aids",                        "AIDS"),
    ("brain hemorrhage",            "Paralysis (brain hemorrhage)"),
    ("intracerebral hemorrhage",    "Paralysis (brain hemorrhage)"),
    ("stroke",                      "Paralysis (brain hemorrhage)"),
    ("common cold",                 "Common Cold"),
    ("upper respiratory infection", "Common Cold"),
    ("acute upper respiratory",     "Common Cold"),
]


def _map_synthea_condition(description: str) -> str | None:
    low = description.lower().strip()
    for pattern, canonical in _SYNTHEA_MAP:
        if pattern in low:
            return canonical
    return None


def _load_synthea_disease_counts() -> dict[str, int] | None:
    """
    Parse Synthea conditions.csv (and patients.csv if available) and count how
    many patients have each of our 41 diseases.

    When patients.csv is present, also:
      - Computes age at first diagnosis for each patient+disease pair.
      - Reports age/gender breakdown per disease to a demographics_report.json
        sidecar for data-quality auditing.
      - Applies age-aware count scaling so diseases predominantly affecting
        specific age groups get proportionally more generated samples.

    Returns None if the Synthea output file doesn't exist.
    """
    if not os.path.exists(SYNTHEA_CSV):
        return None

    print(f"Loading Synthea conditions from {SYNTHEA_CSV} ...")
    cond = pd.read_csv(SYNTHEA_CSV)
    cond = cond.drop_duplicates(subset=["PATIENT", "DESCRIPTION"])

    # ── Try to join with patients.csv for demographics ────────────────────────
    demo_available = os.path.exists(PATIENTS_CSV)
    if demo_available:
        print(f"Loading patient demographics from {PATIENTS_CSV} ...")
        patients = pd.read_csv(
            PATIENTS_CSV,
            usecols=["Id", "BIRTHDATE", "GENDER"],
            dtype={"GENDER": str},
        ).rename(columns={"Id": "PATIENT"})

        cond = cond.merge(patients, on="PATIENT", how="left")

        cond["_start"]     = pd.to_datetime(cond["START"],     errors="coerce")
        cond["_birthdate"] = pd.to_datetime(cond["BIRTHDATE"], errors="coerce")
        cond["_age"]       = (
            (cond["_start"] - cond["_birthdate"]).dt.days / 365.25
        ).clip(lower=0)

        bins   = [-1, 17, 44, 64, 150]
        labels = ["child (0-17)", "adult (18-44)", "middle (45-64)", "senior (65+)"]
        cond["_age_group"] = pd.cut(cond["_age"], bins=bins, labels=labels)

    # ── Count and map diseases ────────────────────────────────────────────────
    counts:   dict[str, int]                 = {}
    demo_map: dict[str, dict[str, dict[str, int]]] = {}  # disease → {age_group → count, gender → count}
    unmapped = 0

    for idx, row in cond.iterrows():
        mapped = _map_synthea_condition(str(row["DESCRIPTION"]))
        if not mapped:
            unmapped += 1
            continue

        counts[mapped] = counts.get(mapped, 0) + 1

        if demo_available:
            if mapped not in demo_map:
                demo_map[mapped] = {"age_groups": {}, "gender": {}}

            age_grp = str(row.get("_age_group", "unknown")) if pd.notna(row.get("_age_group")) else "unknown"
            gender  = str(row.get("GENDER", "unknown")).upper() if pd.notna(row.get("GENDER")) else "unknown"

            demo_map[mapped]["age_groups"][age_grp] = demo_map[mapped]["age_groups"].get(age_grp, 0) + 1
            demo_map[mapped]["gender"][gender]       = demo_map[mapped]["gender"].get(gender, 0) + 1

    print(f"  Mapped {sum(counts.values()):,} records -> {len(counts)} diseases  "
          f"({unmapped:,} unmapped Synthea conditions)")

    if demo_available:
        _save_demographics_report(demo_map, counts)

    return counts


def _save_demographics_report(
    demo_map: dict[str, dict[str, dict[str, int]]],
    counts:   dict[str, int],
) -> None:
    """Write per-disease age/gender breakdown to a JSON sidecar for auditing."""
    report = {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "diseases": {},
    }
    for disease, data in sorted(demo_map.items()):
        total = counts.get(disease, 0)
        age_groups = data["age_groups"]
        gender     = data["gender"]
        report["diseases"][disease] = {
            "total_patients": total,
            "age_groups": {
                k: {"count": v, "pct": round(v / total * 100, 1) if total else 0}
                for k, v in sorted(age_groups.items(), key=lambda x: -x[1])
            },
            "gender": {
                k: {"count": v, "pct": round(v / total * 100, 1) if total else 0}
                for k, v in sorted(gender.items(), key=lambda x: -x[1])
            },
        }
    os.makedirs(os.path.dirname(DEMO_REPORT), exist_ok=True)
    with open(DEMO_REPORT, "w") as f:
        __import__("json").dump(report, f, indent=2)
    print(f"  Demographics report saved -> {DEMO_REPORT}")


def _build_symptom_distributions(
    anchor: pd.DataFrame, sym_cols: list[str]
) -> dict[str, np.ndarray]:
    """
    For each disease, compute P(symptom_j = 1 | disease) with Laplace smoothing.
    Returns {disease: probability_vector}.
    """
    distributions: dict[str, np.ndarray] = {}
    alpha = 0.2   # smoothing — prevents 0/1 extremes
    for disease, group in anchor.groupby("prognosis"):
        X = group[sym_cols].values.astype(float)
        n = len(X)
        probs = (X.sum(axis=0) + alpha) / (n + 2 * alpha)
        distributions[disease] = probs
    return distributions


def _generate_row(
    probs: np.ndarray, rng: np.random.Generator, min_symptoms: int = _MIN_SYMPTOMS
) -> np.ndarray | None:
    """
    Sample a symptom vector by independent Bernoulli draws.
    Returns None if the vector has fewer than min_symptoms active symptoms
    after _MAX_TRIES attempts.
    """
    for _ in range(_MAX_TRIES):
        vec = (rng.random(len(probs)) < probs).astype(int)
        if vec.sum() >= min_symptoms:
            return vec
    return None


def convert(n_per_disease: int = 300, use_synthea: bool = True,
            max_per_disease: int = 5_000, seed: int = 42) -> str:
    """
    Generate a synthetic training CSV and save it to data/raw/synthea_generated.csv.

    Args:
        n_per_disease   : rows to generate per disease when Synthea data is absent.
        use_synthea     : if True, use Synthea conditions.csv for disease proportions.
        max_per_disease : hard cap per disease to prevent memory explosion when Synthea
                          counts are large (e.g. Diabetes ~8 k patients × 150 scale).
        seed            : random seed for reproducibility.

    Returns the path to the generated CSV.
    """
    rng = np.random.default_rng(seed)

    # ── 1. Load anchor dataset ─────────────────────────────────────────────────
    anchor   = pd.read_csv(ANCHOR_PATH).drop_duplicates()
    sym_cols = [c for c in anchor.columns if c != "prognosis"]
    diseases = sorted(anchor.prognosis.unique())
    existing_set = set(map(tuple, anchor[sym_cols].values.tolist()))

    print(f"\nAnchor dataset : {len(anchor)} rows, {len(diseases)} diseases")

    # ── 2. Learn symptom probability distributions ─────────────────────────────
    dists = _build_symptom_distributions(anchor, sym_cols)

    # ── 3. Determine target count per disease ─────────────────────────────────
    synthea_counts = _load_synthea_disease_counts() if use_synthea else None

    if synthea_counts:
        # Scale Synthea counts so the rarest disease gets at least n_per_disease/2,
        # then cap each disease at max_per_disease to avoid memory blow-up.
        min_count = min(synthea_counts.get(d, 1) for d in diseases)
        scale     = max(1, (n_per_disease // 2) / min_count)
        targets   = {
            d: min(max_per_disease,
                   max(n_per_disease // 2, int(synthea_counts.get(d, 1) * scale)))
            for d in diseases
        }
        print(f"Using Synthea disease distribution "
              f"(scaled by {scale:.1f}x, cap={max_per_disease:,}/disease)")
    else:
        targets = {d: n_per_disease for d in diseases}
        print(f"No Synthea output — generating {n_per_disease} rows per disease uniformly")

    # ── 4. Generate and stream rows to CSV (disease by disease) ───────────────
    # Writing disease-by-disease avoids holding the entire dataset in memory.
    skipped_diseases: list[str] = []
    header_written   = False
    total_rows       = 0

    if os.path.exists(OUT_PATH):
        os.remove(OUT_PATH)

    for disease in diseases:
        probs   = dists[disease]
        target  = targets[disease]
        disease_vecs: list[np.ndarray] = []
        seen_this_disease: set[tuple] = set()
        attempts = 0
        max_attempts = target * 50

        while len(disease_vecs) < target and attempts < max_attempts:
            attempts += 1
            vec = _generate_row(probs, rng)
            if vec is None:
                continue
            key = tuple(vec.tolist())
            if key in existing_set or key in seen_this_disease:
                continue
            disease_vecs.append(vec)
            seen_this_disease.add(key)

        if len(disease_vecs) == 0:
            skipped_diseases.append(disease)
            pct = 0
        else:
            arr      = np.array(disease_vecs, dtype=np.int8)
            df_chunk = pd.DataFrame(arr, columns=sym_cols)
            df_chunk["prognosis"] = disease
            df_chunk.to_csv(OUT_PATH,
                            mode="a" if header_written else "w",
                            header=not header_written,
                            index=False)
            header_written = True
            total_rows    += len(disease_vecs)
            pct = len(disease_vecs) / target * 100

        print(f"  {disease:<40} {len(disease_vecs):>4}/{target} rows ({pct:.0f}%)")

    if skipped_diseases:
        print(f"\nWarning: 0 rows generated for: {skipped_diseases}")

    # ── 5. Summary ────────────────────────────────────────────────────────────
    # Re-read just the prognosis column for stats (avoids loading full CSV).
    prognosis_col = pd.read_csv(OUT_PATH, usecols=["prognosis"])
    per_d = prognosis_col.groupby("prognosis").size()

    print(f"\n{'='*60}")
    print(f"  Generated rows  : {total_rows:,}")
    print(f"  Diseases covered: {per_d.shape[0]}")
    print(f"  Rows/disease    : avg {per_d.mean():.0f}  "
          f"min {per_d.min()}  max {per_d.max()}")
    print(f"  Saved to        : {OUT_PATH}")
    print(f"{'='*60}")
    print(f"\nNext step: python training/data_pipeline.py && python training/train_model.py")
    return OUT_PATH


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic training data")
    parser.add_argument("--n-per-disease", type=int, default=300,
                        help="Rows per disease when not using Synthea (default: 300)")
    parser.add_argument("--max-per-disease", type=int, default=5_000,
                        help="Hard cap per disease when scaling from Synthea (default: 5000)")
    parser.add_argument("--no-synthea", action="store_true",
                        help="Skip Synthea output and generate uniformly per disease")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    convert(n_per_disease=args.n_per_disease,
            use_synthea=not args.no_synthea,
            max_per_disease=args.max_per_disease,
            seed=args.seed)
